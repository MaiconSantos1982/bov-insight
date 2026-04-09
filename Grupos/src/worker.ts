import { chromium, Browser, BrowserContext } from "playwright";
import { config } from "./config";
import { logger } from "./logger";
import { DadosCotacao, FonteDados } from "./types";
import {
    scrapeCepea,
    scrapeCepeaIndicador,
    scrapeDatagroLivestock,
    scrapeTradingView,
} from "./scrapers";
import { enviarWhatsApp } from "./messaging";
import fs from "fs";
import { spawnSync } from "child_process";
import { persistirHistoricoPrecos } from "./persistence/historico-precos";

function garantirChromiumPlaywright(): void {
    const executablePath = chromium.executablePath();
    if (fs.existsSync(executablePath)) {
        return;
    }

    logger.warn("⚠️ Chromium do Playwright não encontrado. Instalando automaticamente...");
    const resultado = spawnSync("npx", ["playwright", "install", "chromium"], {
        stdio: "inherit",
        env: process.env,
    });

    if (resultado.status !== 0) {
        throw new Error(
            "Falha ao instalar Chromium automaticamente. " +
            "Execute manualmente: npx playwright install chromium"
        );
    }

    const instalado = chromium.executablePath();
    if (!fs.existsSync(instalado)) {
        throw new Error(
            "Chromium ainda não encontrado após instalação automática."
        );
    }

    logger.success("✅ Chromium do Playwright instalado automaticamente.");
}

/**
 * Executa o pipeline completo de scraping e envio.
 *
 * Fluxo:
 *   1. Inicia browser headless via Playwright
 *   2. Raspa CEPEA (Boi Físico)
 *   3. Raspa TradingView (Boi Futuro)
 *   4. Consolida dados em JSON
 *   5. Salva log local
 *   6. Envia mensagem via WhatsApp (Pastorini API)
 */
export async function executarWorker(
    opcoes: { fonte?: FonteDados; enviarMensagem?: boolean } = {}
): Promise<DadosCotacao> {
    const fonte: FonteDados =
        opcoes.fonte === "datagro" || opcoes.fonte === "todos"
            ? opcoes.fonte
            : "cepea";
    const enviarMensagem = opcoes.enviarMensagem !== false;

    logger.info("═══════════════════════════════════════════════");
    logger.info("🚀 Worker de Cotações iniciado");
    logger.info(`🧭 Fonte selecionada: ${fonte.toUpperCase()}`);
    logger.info(`⏰ Hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
    logger.info("═══════════════════════════════════════════════");

    let browser: Browser | null = null;

    try {
        // ── Fluxo DATAGRO ───────────────────────────────────
        if (fonte === "datagro") {
            logger.info("─── Etapa 1/1: DATAGRO Livestock ───");
            const resultadoDatagro = await scrapeDatagroLivestock();

            const dados: DadosCotacao = {
                data_extracao: new Date().toISOString(),
                fonte,
                cepea_fisico_brl: null,
                cepea_bezerro_brl: null,
                cepea_milho_brl: null,
                cepea_soja_brl: null,
                cepea_fisico_usd: null,
                cepea_data_referencia: null,
                tradingview_futuro_brl: null,
                datagro_boi_brasil: resultadoDatagro.dados?.boiBrasil ?? [],
                datagro_mercado_futuro: resultadoDatagro.dados?.mercadoFuturo ?? [],
                datagro_boi_mundo: resultadoDatagro.dados?.boiMundo ?? [],
            };

            logger.info("═══════════════════════════════════════════════");
            logger.info("📦 RESULTADO CONSOLIDADO:");
            logger.info("═══════════════════════════════════════════════");
            console.log(JSON.stringify(dados, null, 2));

            const outputDir = config.logsDir;
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const outputFile = `${outputDir}/resultado-${new Date().toISOString().split("T")[0]}.json`;
            fs.writeFileSync(outputFile, JSON.stringify(dados, null, 2), "utf-8");
            logger.info(`💾 Resultado salvo em: ${outputFile}`);

            if (!resultadoDatagro.sucesso) {
                logger.warn("⚠️ DATAGRO falhou: " + resultadoDatagro.erro);
            }

            if (!enviarMensagem) {
                logger.info("📭 Envio WhatsApp desativado para esta execução.");
            } else {
                if (
                    dados.datagro_boi_brasil.length ||
                    dados.datagro_mercado_futuro.length ||
                    dados.datagro_boi_mundo.length
                ) {
                    await enviarWhatsApp(dados);
                } else {
                    logger.error("❌ DATAGRO sem dados úteis. Mensagem NÃO será enviada.");
                }
            }

            logger.success("🏁 Worker finalizado com sucesso.");
            return dados;
        }

        // ── 1. Setup do Browser ──────────────────────────────
        garantirChromiumPlaywright();
        logger.info("🖥️  Iniciando navegador...");
        browser = await chromium.launch({
            headless: config.headless,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        });

        // Contexto com user-agent real para evitar bloqueios
        const context: BrowserContext = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport: { width: 1920, height: 1080 },
            locale: "pt-BR",
            timezoneId: "America/Sao_Paulo",
        });

        // Injeta script stealth para mascarar detecção de bot
        await context.addInitScript(() => {
            // Remove o flag de automação do navigator
            Object.defineProperty(navigator, "webdriver", {
                get: () => false,
            });
            // Simula plugins reais
            Object.defineProperty(navigator, "plugins", {
                get: () => [1, 2, 3, 4, 5],
            });
        });

        // ── 2. Scrapers CEPEA ────────────────────────────────
        logger.info("─── Etapa 1/2: CEPEA ───");
        const pageCepea = await context.newPage();
        const resultadoCepea = await scrapeCepea(pageCepea);
        await pageCepea.close();

        const pageBezerro = await context.newPage();
        const resultadoBezerro = await scrapeCepeaIndicador(
            pageBezerro,
            config.urls.cepeaBezerro,
            "Bezerro"
        );
        await pageBezerro.close();

        const pageMilho = await context.newPage();
        const resultadoMilho = await scrapeCepeaIndicador(
            pageMilho,
            config.urls.cepeaMilho,
            "Milho"
        );
        await pageMilho.close();

        const pageSoja = await context.newPage();
        const resultadoSoja = await scrapeCepeaIndicador(
            pageSoja,
            config.urls.cepeaSoja,
            "Soja"
        );
        await pageSoja.close();

        // ── Persistência no histórico Supabase ─────────────
        try {
            const dataReferencia =
                resultadoCepea.dados?.data ??
                resultadoBezerro.dados?.data ??
                resultadoMilho.dados?.data ??
                resultadoSoja.dados?.data;
            if (dataReferencia) {
                await persistirHistoricoPrecos([
                    {
                        produto: "boi_gordo",
                        dataReferencia,
                        valorBrl: resultadoCepea.dados?.valorBrl ?? null,
                        valorUsd: resultadoCepea.dados?.valorUsd ?? null,
                    },
                    {
                        produto: "bezerro",
                        dataReferencia: resultadoBezerro.dados?.data ?? dataReferencia,
                        valorBrl: resultadoBezerro.dados?.valorBrl ?? null,
                        valorUsd: resultadoBezerro.dados?.valorUsd ?? null,
                    },
                    {
                        produto: "milho",
                        dataReferencia: resultadoMilho.dados?.data ?? dataReferencia,
                        valorBrl: resultadoMilho.dados?.valorBrl ?? null,
                        valorUsd: resultadoMilho.dados?.valorUsd ?? null,
                    },
                    {
                        produto: "soja",
                        dataReferencia: resultadoSoja.dados?.data ?? dataReferencia,
                        valorBrl: resultadoSoja.dados?.valorBrl ?? null,
                        valorUsd: resultadoSoja.dados?.valorUsd ?? null,
                    },
                ]);
            } else {
                logger.warn(
                    "⚠️ Histórico de preços não atualizado: data de referência CEPEA indisponível."
                );
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error("❌ Falha ao persistir histórico de preços no Supabase:", msg);
        }

        // ── 3. Scraper TradingView (Boi Futuro) ──────────────
        logger.info("─── Etapa 2/2: TradingView ───");
        const pageTv = await context.newPage();
        const resultadoTv = await scrapeTradingView(pageTv);
        await pageTv.close();

        // ── 4. Scraper DATAGRO opcional (modo TODOS) ─────────
        let resultadoDatagro = null as Awaited<ReturnType<typeof scrapeDatagroLivestock>> | null;
        if (fonte === "todos") {
            logger.info("─── Etapa extra: DATAGRO Livestock ───");
            resultadoDatagro = await scrapeDatagroLivestock();
        }

        // ── 5. Consolidação ──────────────────────────────────
        const dados: DadosCotacao = {
            data_extracao: new Date().toISOString(),
            fonte,
            cepea_fisico_brl: resultadoCepea.dados?.valorBrl ?? null,
            cepea_bezerro_brl: resultadoBezerro.dados?.valorBrl ?? null,
            cepea_milho_brl: resultadoMilho.dados?.valorBrl ?? null,
            cepea_soja_brl: resultadoSoja.dados?.valorBrl ?? null,
            cepea_fisico_usd: resultadoCepea.dados?.valorUsd ?? null,
            cepea_data_referencia: resultadoCepea.dados?.data ?? null,
            tradingview_futuro_brl: resultadoTv.dados?.preco ?? null,
            datagro_boi_brasil: resultadoDatagro?.dados?.boiBrasil ?? [],
            datagro_mercado_futuro: resultadoDatagro?.dados?.mercadoFuturo ?? [],
            datagro_boi_mundo: resultadoDatagro?.dados?.boiMundo ?? [],
        };

        // ── 6. Log e Saída ───────────────────────────────────
        logger.info("═══════════════════════════════════════════════");
        logger.info("📦 RESULTADO CONSOLIDADO:");
        logger.info("═══════════════════════════════════════════════");
        console.log(JSON.stringify(dados, null, 2));

        // Salva resultado em arquivo JSON
        const outputDir = config.logsDir;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFile = `${outputDir}/resultado-${new Date().toISOString().split("T")[0]}.json`;
        fs.writeFileSync(outputFile, JSON.stringify(dados, null, 2), "utf-8");
        logger.info(`💾 Resultado salvo em: ${outputFile}`);

        // Status final
        if (!resultadoCepea.sucesso) {
            logger.warn("⚠️ CEPEA falhou: " + resultadoCepea.erro);
        }
        if (!resultadoBezerro.sucesso) {
            logger.warn("⚠️ CEPEA Bezerro falhou: " + resultadoBezerro.erro);
        }
        if (!resultadoMilho.sucesso) {
            logger.warn("⚠️ CEPEA Milho falhou: " + resultadoMilho.erro);
        }
        if (!resultadoSoja.sucesso) {
            logger.warn("⚠️ CEPEA Soja falhou: " + resultadoSoja.erro);
        }
        if (!resultadoTv.sucesso) {
            logger.warn("⚠️ TradingView falhou: " + resultadoTv.erro);
        }
        if (fonte === "todos" && resultadoDatagro && !resultadoDatagro.sucesso) {
            logger.warn("⚠️ DATAGRO falhou: " + resultadoDatagro.erro);
        }

        // ── 7. Envio via WhatsApp ────────────────────────────
        const temDadosDatagro =
            dados.datagro_boi_brasil.length > 0 ||
            dados.datagro_mercado_futuro.length > 0 ||
            dados.datagro_boi_mundo.length > 0;

        if (!enviarMensagem) {
            logger.info("📭 Envio WhatsApp desativado para esta execução.");
        } else {
            if (resultadoCepea.sucesso || resultadoTv.sucesso || temDadosDatagro) {
                await enviarWhatsApp(dados);
            } else {
                logger.error(
                    "❌ Ambas as fontes falharam. Mensagem NÃO será enviada."
                );
            }
        }

        logger.success("🏁 Worker finalizado com sucesso.");
        return dados;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("💥 Erro fatal no Worker:", msg);
        throw error;
    } finally {
        // Fecha o browser em qualquer cenário
        if (browser) {
            await browser.close();
            logger.info("🔒 Navegador fechado.");
        }
    }
}
