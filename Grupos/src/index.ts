import cron from "node-cron";
import express from "express";
import { config } from "./config";
import { logger } from "./logger";
import { executarWorker } from "./worker";
import { runAnalyticsAlertEngine, runAnalyticsIngestionPipeline } from "./analytics";
import { FonteDados } from "./types";

let executando = false;

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

async function executarComLock(
    opcoes: { fonte?: FonteDados; enviarMensagem?: boolean },
    origemLog: string
) {
    if (executando) {
        throw new Error("Uma execução já está em andamento.");
    }

    executando = true;
    try {
        logger.info(`${origemLog} Iniciando worker (fonte=${opcoes.fonte ?? "cepea"}, enviarMensagem=${opcoes.enviarMensagem !== false})`);
        return await executarWorker(opcoes);
    } finally {
        executando = false;
    }
}

function iniciarServidorControle() {
    const app = express();
    const port = Number(process.env.PORT || 8080);

    app.get("/health", (_req, res) => {
        res.json({ ok: true, executando, mode: "scheduler+api" });
    });

    app.get("/api/status", (_req, res) => {
        res.json({
            ok: true,
            executando,
            cronSchedules: config.cronSchedules,
            historicoPreloadCron: config.historicoPreloadCron,
            analyticsAlertCron: config.analyticsAlertCron,
            analyticsIngestCron: config.analyticsIngestCron,
        });
    });

    app.get("/api/executar", async (req, res) => {
        const tokenEsperado = config.security.execToken;
        if (tokenEsperado) {
            const tokenRecebido = extrairTokenExec(req);
            if (tokenRecebido !== tokenEsperado) {
                logger.warn("⛔ Tentativa de execução sem token válido.");
                return res.status(401).json({
                    sucesso: false,
                    erro: "Não autorizado. Token inválido.",
                });
            }
        }

        const fonteQuery = String(req.query.fonte || "todos").toLowerCase();
        const fonte: FonteDados =
            fonteQuery === "datagro" || fonteQuery === "todos"
                ? fonteQuery
                : "cepea";

        const enviarMensagemParam = String(req.query.enviarMensagem ?? "true").toLowerCase();
        const enviarMensagem = !(enviarMensagemParam === "false" || enviarMensagemParam === "0" || enviarMensagemParam === "nao");

        try {
            const dados = await executarComLock(
                { fonte, enviarMensagem },
                "🔄 [api/executar]"
            );
            return res.json({ sucesso: true, dados });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("andamento")) {
                return res.status(429).json({ sucesso: false, erro: msg });
            }
            return res.status(500).json({ sucesso: false, erro: msg });
        }
    });

    app.listen(port, () => {
        logger.info(`🌐 API de controle do agendador ativa em http://localhost:${port}`);
    });
}

/**
 * Ponto de entrada do Worker.
 *
 * Modos de execução:
 *   1. --force   → Executa imediatamente (teste/debug)
 *   2. Sem flag  → Agenda via Cron (produção)
 *
 * Exemplos:
 *   npx ts-node src/index.ts --force    # Roda agora
 *   npx ts-node src/index.ts            # Inicia agendador
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const forceRun = args.includes("--force") || args.includes("-f");

    console.log("");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║     🐂  Worker de Cotações - Boi Gordo      ║");
    console.log("║        CEPEA (Físico) + B3 (Futuro)         ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log("");

    if (forceRun) {
        // ── Modo Manual ──────────────────────────────────
        logger.info("🔧 Modo: EXECUÇÃO MANUAL (--force)");
        logger.info("─────────────────────────────────────");

        try {
            await executarWorker();
        } catch (error) {
            logger.error("Worker encerrou com erro.");
            process.exit(1);
        }

        process.exit(0);
    } else {
        iniciarServidorControle();

        // ── Modo Automático (Cron) ───────────────────────
        const schedules = config.cronSchedules;

        logger.info(`⏰ Modo: AGENDADOR (Cron)`);
        logger.info(`📆 Horários configurados: ${schedules.length}`);

        for (const schedule of schedules) {
            if (!cron.validate(schedule)) {
                logger.error(`❌ Expressão Cron inválida: "${schedule}"`);
                process.exit(1);
            }

            cron.schedule(
                schedule,
                async () => {
                    logger.info(`⏰ Cron disparado (${schedule})! Iniciando Worker...`);
                    try {
                        await executarComLock({ fonte: "todos", enviarMensagem: true }, "⏰ [cron:cotacoes]");
                    } catch (error) {
                        logger.error("Worker encerrou com erro nesta execução. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );

            logger.info(`  ✅ Agendado: ${schedule}`);
        }

        if (config.historicoPreloadCron) {
            if (!cron.validate(config.historicoPreloadCron)) {
                logger.error(`❌ HISTORICO_PRELOAD_CRON inválido: "${config.historicoPreloadCron}"`);
                process.exit(1);
            }

            cron.schedule(
                config.historicoPreloadCron,
                async () => {
                    logger.info(`⏰ Cron histórico:preload disparado (${config.historicoPreloadCron})!`);
                    try {
                        await executarComLock(
                            { fonte: "cepea", enviarMensagem: false },
                            "⏰ [cron:historico-preload]"
                        );
                    } catch (error) {
                        logger.error("Falha no cron histórico:preload. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );

            logger.info(`  ✅ Agendado histórico:preload: ${config.historicoPreloadCron}`);
        } else {
            logger.info("ℹ️ HISTORICO_PRELOAD_CRON não definido. Pré-carga de histórico desativada.");
        }

        if (config.analyticsAlertCron) {
            if (!cron.validate(config.analyticsAlertCron)) {
                logger.error(`❌ ANALYTICS_ALERT_CRON inválido: "${config.analyticsAlertCron}"`);
                process.exit(1);
            }

            cron.schedule(
                config.analyticsAlertCron,
                async () => {
                    logger.info(`⏰ Cron analytics:alertas disparado (${config.analyticsAlertCron})!`);
                    try {
                        await runAnalyticsAlertEngine();
                    } catch (error) {
                        logger.error("Falha no analytics:alertas. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );
            logger.info(`  ✅ Agendado analytics:alertas: ${config.analyticsAlertCron}`);
        } else {
            logger.info("ℹ️ ANALYTICS_ALERT_CRON não definido. Alertas analíticos sem agendamento.");
        }

        if (config.analyticsIngestCron) {
            if (!cron.validate(config.analyticsIngestCron)) {
                logger.error(`❌ ANALYTICS_INGEST_CRON inválido: "${config.analyticsIngestCron}"`);
                process.exit(1);
            }

            cron.schedule(
                config.analyticsIngestCron,
                async () => {
                    logger.info(`⏰ Cron analytics:ingest disparado (${config.analyticsIngestCron})!`);
                    try {
                        await runAnalyticsIngestionPipeline();
                    } catch (error) {
                        logger.error("Falha no analytics:ingest. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );
            logger.info(`  ✅ Agendado analytics:ingest: ${config.analyticsIngestCron}`);
        } else {
            logger.info("ℹ️ ANALYTICS_INGEST_CRON não definido. Ingestão analítica sem agendamento.");
        }

        logger.info(`💡 Para executar manualmente, use: npx ts-node src/index.ts --force`);
        logger.info("─────────────────────────────────────");
        logger.info("⏳ Aguardando próxima execução...");

        // Mantém o processo vivo
        process.on("SIGINT", () => {
            logger.info("🛑 Agendador encerrado pelo usuário (SIGINT).");
            process.exit(0);
        });

        process.on("SIGTERM", () => {
            logger.info("🛑 Agendador encerrado (SIGTERM).");
            process.exit(0);
        });
    }
}

main().catch((err) => {
    console.error("Erro crítico na inicialização:", err);
    process.exit(1);
});
