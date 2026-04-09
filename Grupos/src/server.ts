import express from "express";
import path from "path";
import { config } from "./config";
import { logger } from "./logger";
import { executarWorker } from "./worker";
import { DadosCotacao, FonteDados } from "./types";
import fs from "fs";
import { montarMensagensWhatsApp } from "./messaging";
import { runAnalyticsAlertEngine, runAnalyticsIngestionPipeline } from "./analytics";

const app = express();
const PORT = process.env.PORT || 3000;

function extrairTokenExec(req: express.Request): string {
    const authHeader = req.header("authorization") || "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
        return bearerMatch[1].trim();
    }

    const headerToken = req.header("x-exec-token");
    if (headerToken) {
        return headerToken.trim();
    }

    const queryToken = req.query.token;
    if (typeof queryToken === "string") {
        return queryToken.trim();
    }

    return "";
}

// Último resultado em memória
let ultimoResultado: DadosCotacao | null = null;
let executando = false;
let executandoAnalyticsIngest = false;
let ultimoErro: string | null = null;

// Tenta carregar último resultado salvo do disco
try {
    const hoje = new Date().toISOString().split("T")[0];
    const arquivo = path.join(config.logsDir, `resultado-${hoje}.json`);
    if (fs.existsSync(arquivo)) {
        ultimoResultado = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
        logger.info("📂 Resultado anterior carregado do disco.");
    }
} catch {
    // Sem resultado anterior
}

// Serve arquivos estáticos
app.use(express.static(path.join(__dirname, "../public")));

// API: Status atual
app.get("/api/status", (_req, res) => {
    res.json({
        executando,
        ultimoResultado,
        ultimoErro,
        ultimaFonte: ultimoResultado?.fonte || "cepea",
        config: {
            cronSchedules: config.cronSchedules,
            analyticsAlertCron: config.analyticsAlertCron,
            headless: config.headless,
            whatsappConfigurado:
                !!config.whatsapp.groupId &&
                config.whatsapp.groupId !== "ID_DO_GRUPO_AQUI",
            pastoriniConfigurado:
                !!config.pastorini.baseUrl &&
                config.pastorini.apiKey !== "YOUR_SECRET_KEY",
        },
    });
});

// API: Logs do dia atual (últimas N linhas)
app.get("/api/logs", (_req, res) => {
    try {
        const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const logFile = path.join(config.logsDir, `worker-${hoje}.log`);

        if (!fs.existsSync(logFile)) {
            return res.json({ logs: [], arquivo: logFile });
        }

        const conteudo = fs.readFileSync(logFile, "utf-8");
        const linhas = conteudo.trim().split("\n");
        // Retorna as últimas 100 linhas
        const ultimas = linhas.slice(-100);

        res.json({ logs: ultimas, total: linhas.length, arquivo: logFile });
    } catch (error) {
        res.status(500).json({ erro: "Falha ao ler logs" });
    }
});

// API: Disparar scraping manual
app.get("/api/executar", async (_req, res) => {
    const tokenEsperado = config.security.execToken;
    if (tokenEsperado) {
        const tokenRecebido = extrairTokenExec(_req);
        if (tokenRecebido !== tokenEsperado) {
            logger.warn("⛔ Tentativa de execução sem token válido.");
            return res.status(401).json({
                sucesso: false,
                erro: "Não autorizado. Token inválido.",
            });
        }
    }

    if (executando) {
        return res.status(429).json({
            erro: "Uma extração já está em andamento. Aguarde.",
        });
    }

    executando = true;
    ultimoErro = null;

    try {
        const fonteQuery = String(_req.query.fonte || "cepea").toLowerCase();
        const fonte: FonteDados =
            fonteQuery === "datagro" || fonteQuery === "todos"
                ? fonteQuery
                : "cepea";

        const enviarMensagemParam = String(_req.query.enviarMensagem ?? "true").toLowerCase();
        const enviarMensagem = !(enviarMensagemParam === "false" || enviarMensagemParam === "0" || enviarMensagemParam === "nao");

        logger.info(`🔄 Scraping disparado via interface web (fonte=${fonte}, enviarMensagem=${enviarMensagem})...`);
        ultimoResultado = await executarWorker({ fonte, enviarMensagem });
        res.json({ sucesso: true, dados: ultimoResultado });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        ultimoErro = msg;
        res.status(500).json({ sucesso: false, erro: msg });
    } finally {
        executando = false;
    }
});

// API: Atualizar apenas histórico CEPEA (sem envio WhatsApp)
app.get("/api/executar-historico", async (_req, res) => {
    const tokenEsperado = config.security.execToken;
    if (tokenEsperado) {
        const tokenRecebido = extrairTokenExec(_req);
        if (tokenRecebido !== tokenEsperado) {
            logger.warn("⛔ Tentativa de execução de histórico sem token válido.");
            return res.status(401).json({
                sucesso: false,
                erro: "Não autorizado. Token inválido.",
            });
        }
    }

    if (executando) {
        return res.status(429).json({
            erro: "Uma extração já está em andamento. Aguarde.",
        });
    }

    executando = true;
    ultimoErro = null;

    try {
        logger.info("🗂️ Atualização de histórico disparada via interface web (fonte=cepea, enviarMensagem=false)...");
        ultimoResultado = await executarWorker({ fonte: "cepea", enviarMensagem: false });
        res.json({ sucesso: true, dados: ultimoResultado });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        ultimoErro = msg;
        res.status(500).json({ sucesso: false, erro: msg });
    } finally {
        executando = false;
    }
});

// API: Mensagem preview (como ficaria no WhatsApp)
app.get("/api/preview-mensagem", (_req, res) => {
    if (!ultimoResultado) {
        return res.json({ mensagem: null, mensagens: [] });
    }

    const mensagens = montarMensagensWhatsApp(ultimoResultado);
    const separador = "\n\n━━━━━━━━━━━━━━━━━━━━\n\n";
    res.json({ mensagem: mensagens.join(separador), mensagens });
});

import cron from "node-cron";

/**
 * Verifica se a extração de hoje já foi feita.
 * Retorna true se já existe resultado do dia.
 */
function extraçãoDeHojeExiste(): boolean {
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
    const arquivo = path.join(config.logsDir, `resultado-${hoje}.json`);
    return fs.existsSync(arquivo);
}

/**
 * Verifica se algum horário agendado já passou hoje.
 * Retorna true se pelo menos um cron deveria ter rodado.
 */
function algumHorarioJaPassou(): boolean {
    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes(); // minutos desde meia-noite

    for (const schedule of config.cronSchedules) {
        // Parse simples: "0 5 * * *" → hora=5, min=0
        const partes = schedule.trim().split(/\s+/);
        if (partes.length >= 2) {
            const minCron = parseInt(partes[0], 10);
            const horaCron = parseInt(partes[1], 10);
            if (!isNaN(minCron) && !isNaN(horaCron)) {
                const minutoCron = horaCron * 60 + minCron;
                if (horaAtual >= minutoCron) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Executa se detectar que perdeu o horário (ex: Mac dormiu).
 */
async function verificarExecuçãoPerdida(origem: string): Promise<void> {
    if (executando) return;

    if (!extraçãoDeHojeExiste() && algumHorarioJaPassou()) {
        logger.warn(`🔄 [${origem}] Extração do dia não encontrada e horário já passou. Executando agora...`);
        executando = true;
        ultimoErro = null;
        try {
            ultimoResultado = await executarWorker({ fonte: "todos" });
            logger.success(`✅ [${origem}] Extração de recuperação concluída!`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            ultimoErro = msg;
            logger.error(`❌ [${origem}] Falha na extração de recuperação:`, msg);
        } finally {
            executando = false;
        }
    }
}

// Fallback → index.html
app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
    console.log("");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║     🐂  Worker de Cotações - Boi Gordo      ║");
    console.log("║          Painel de Teste (localhost)         ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log("");
    logger.info(`🌐 Servidor rodando em: http://localhost:${PORT}`);
    logger.info(`💡 Clique em "Extrair Agora" na interface para testar.`);

    // ── Cron schedules ───────────────────────────────
    for (const schedule of config.cronSchedules) {
        if (cron.validate(schedule)) {
            cron.schedule(
                schedule,
                async () => {
                    logger.info(`⏰ Cron disparado (${schedule})!`);
                    executando = true;
                    ultimoErro = null;
                    try {
                        ultimoResultado = await executarWorker({ fonte: "todos" });
                    } catch (error) {
                        const msg = error instanceof Error ? error.message : String(error);
                        ultimoErro = msg;
                        logger.error("Worker encerrou com erro nesta execução.");
                    } finally {
                        executando = false;
                    }
                },
                { timezone: "America/Sao_Paulo" }
            );
            logger.info(`  ✅ Cron agendado: ${schedule}`);
        }
    }

    // ── Cron analytics: alertas analíticos ─────────────
    if (config.analyticsAlertCron) {
        if (!cron.validate(config.analyticsAlertCron)) {
            logger.warn(`⚠️ ANALYTICS_ALERT_CRON inválido: "${config.analyticsAlertCron}"`);
        } else {
            cron.schedule(
                config.analyticsAlertCron,
                async () => {
                    logger.info(`⏰ Cron analytics:alertas disparado (${config.analyticsAlertCron})`);
                    try {
                        await runAnalyticsAlertEngine();
                    } catch (error) {
                        const msg = error instanceof Error ? error.message : String(error);
                        logger.error("Falha ao executar analytics:alertas no cron.", msg);
                    }
                },
                { timezone: "America/Sao_Paulo" }
            );
            logger.info(`  ✅ Cron analytics:alertas agendado: ${config.analyticsAlertCron}`);
        }
    } else {
        logger.info("ℹ️ ANALYTICS_ALERT_CRON não definido. Agendador de alertas analíticos desativado.");
    }

    // ── Cron analytics: ingestão de tabelas ─────────────
    if (config.analyticsIngestCron) {
        if (!cron.validate(config.analyticsIngestCron)) {
            logger.warn(`⚠️ ANALYTICS_INGEST_CRON inválido: "${config.analyticsIngestCron}"`);
        } else {
            cron.schedule(
                config.analyticsIngestCron,
                async () => {
                    if (executandoAnalyticsIngest) {
                        logger.warn("⏭️ Cron analytics:ingest ignorado (execução anterior ainda em andamento).");
                        return;
                    }
                    executandoAnalyticsIngest = true;
                    logger.info(`⏰ Cron analytics:ingest disparado (${config.analyticsIngestCron})`);
                    try {
                        await runAnalyticsIngestionPipeline();
                    } catch (error) {
                        const msg = error instanceof Error ? error.message : String(error);
                        logger.error("Falha ao executar analytics:ingest no cron.", msg);
                    } finally {
                        executandoAnalyticsIngest = false;
                    }
                },
                { timezone: "America/Sao_Paulo" }
            );
            logger.info(`  ✅ Cron analytics:ingest agendado: ${config.analyticsIngestCron}`);
        }
    } else {
        logger.info("ℹ️ ANALYTICS_INGEST_CRON não definido. Agendador de ingestão analítica desativado.");
    }

    // ── Verificação de execução perdida (startup) ────
    logger.info("🔍 Verificando se perdeu alguma extração...");
    verificarExecuçãoPerdida("STARTUP");

    // ── Watchdog: verifica a cada 5min (resolve sleep do Mac) ─
    setInterval(() => {
        verificarExecuçãoPerdida("WATCHDOG");
    }, 5 * 60 * 1000);
    logger.info("🐕 Watchdog ativo: verifica a cada 5 min se perdeu extração.");
});
