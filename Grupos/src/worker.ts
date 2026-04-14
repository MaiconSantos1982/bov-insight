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
import {
    buscarHistoricosPorData,
    buscarUltimosHistoricosPorProduto,
    persistirHistoricoPrecos,
} from "./persistence/historico-precos";

interface CacheCepea {
    cepea_fisico_brl: number | null;
    cepea_bezerro_brl: number | null;
    cepea_milho_brl: number | null;
    cepea_soja_brl: number | null;
    cepea_fisico_usd: number | null;
    cepea_data_referencia: string | null;
}

interface FallbackHistoricoDatagro {
    dataReferencia: string;
    valorBrl: number;
    valorUsd: number;
}

function formatarDataIso(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function agoraSaoPaulo(): Date {
    return new Date(
        new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
}

function ehFimDeSemana(data: Date): boolean {
    const diaSemana = data.getDay();
    return diaSemana === 0 || diaSemana === 6;
}

function dataFechamentoEsperada(): string {
    const data = agoraSaoPaulo();
    data.setDate(data.getDate() - 1);
    while (ehFimDeSemana(data)) {
        data.setDate(data.getDate() - 1);
    }
    return formatarDataIso(data);
}

function normalizarDataIsoOuNulo(data: string | null | undefined): string | null {
    if (!data) return null;
    const texto = data.trim();
    const matchBr = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (matchBr) {
        const [, dd, mm, yyyy] = matchBr;
        return `${yyyy}-${mm}-${dd}`;
    }
    const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchIso) {
        return texto;
    }
    return null;
}

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

function recuperarUltimoCepeaValidoDosLogs(): CacheCepea | null {
    try {
        if (!fs.existsSync(config.logsDir)) {
            return null;
        }

        const arquivos = fs
            .readdirSync(config.logsDir)
            .filter((nome) => /^resultado-\d{4}-\d{2}-\d{2}\.json$/.test(nome))
            .sort()
            .reverse();

        for (const arquivo of arquivos) {
            const caminho = `${config.logsDir}/${arquivo}`;
            const bruto = fs.readFileSync(caminho, "utf-8");
            const json = JSON.parse(bruto) as Partial<DadosCotacao>;

            const temCepea =
                json.cepea_fisico_brl != null ||
                json.cepea_bezerro_brl != null ||
                json.cepea_milho_brl != null ||
                json.cepea_soja_brl != null;

            if (!temCepea) {
                continue;
            }

            return {
                cepea_fisico_brl: json.cepea_fisico_brl ?? null,
                cepea_bezerro_brl: json.cepea_bezerro_brl ?? null,
                cepea_milho_brl: json.cepea_milho_brl ?? null,
                cepea_soja_brl: json.cepea_soja_brl ?? null,
                cepea_fisico_usd: json.cepea_fisico_usd ?? null,
                cepea_data_referencia: json.cepea_data_referencia ?? null,
            };
        }

        return null;
    } catch (error) {
        logger.warn(
            "⚠️ Não foi possível recuperar último CEPEA válido dos logs:",
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

function obterFallbackHistoricoDatagro(dados: {
    boiBrasil: DadosCotacao["datagro_boi_brasil"];
    boiMundo: DadosCotacao["datagro_boi_mundo"];
}): FallbackHistoricoDatagro | null {
    const itensBrasilValidos = dados.boiBrasil.filter((item) => item.preco != null);
    if (!itensBrasilValidos.length) {
        return null;
    }

    const itemSp =
        itensBrasilValidos.find((item) => item.codigo === "D_PEPR_SP_BR") ??
        itensBrasilValidos.find((item) => item.nome.toLowerCase().includes("sp"));
    const valorBrl =
        itemSp?.preco ??
        Number(
            (
                itensBrasilValidos.reduce((acc, item) => acc + (item.preco ?? 0), 0) /
                itensBrasilValidos.length
            ).toFixed(2)
        );
    const dataRefBrasil = itemSp?.data ?? itensBrasilValidos.find((item) => item.data)?.data;

    const itemMundoBr =
        dados.boiMundo.find((item) => item.codigo === "PEPR_BR" && item.preco != null) ??
        dados.boiMundo.find((item) => item.nome.toLowerCase().includes("brasil") && item.preco != null) ??
        dados.boiMundo.find((item) => item.preco != null);

    if (valorBrl == null || itemMundoBr?.preco == null) {
        return null;
    }

    const dataReferencia = dataRefBrasil ?? itemMundoBr.data;
    if (!dataReferencia) {
        return null;
    }

    return {
        dataReferencia,
        valorBrl,
        valorUsd: itemMundoBr.preco,
    };
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

        const dataEsperadaHistorico = dataFechamentoEsperada();

        // ── 1. Fonte primária: Supabase (histórico próprio) ──────────
        let historicoDiaEsperado = {} as Awaited<
            ReturnType<typeof buscarHistoricosPorData>
        >;
        try {
            historicoDiaEsperado = await buscarHistoricosPorData(dataEsperadaHistorico, [
                "boi_gordo",
                "bezerro",
                "milho",
                "soja",
            ]);
        } catch (error) {
            logger.warn(
                "⚠️ Falha ao consultar histórico do dia esperado no Supabase:",
                error instanceof Error ? error.message : String(error)
            );
        }

        let cepeaFisicoBrl = historicoDiaEsperado.boi_gordo?.valorBrl ?? null;
        let cepeaBezerroBrl = historicoDiaEsperado.bezerro?.valorBrl ?? null;
        let cepeaMilhoBrl = historicoDiaEsperado.milho?.valorBrl ?? null;
        let cepeaSojaBrl = historicoDiaEsperado.soja?.valorBrl ?? null;
        let cepeaFisicoUsd = historicoDiaEsperado.boi_gordo?.valorUsd ?? null;
        let cepeaDataReferencia =
            historicoDiaEsperado.boi_gordo?.data ??
            historicoDiaEsperado.bezerro?.data ??
            historicoDiaEsperado.milho?.data ??
            historicoDiaEsperado.soja?.data ??
            null;

        const faltaBoi = cepeaFisicoBrl == null || cepeaFisicoUsd == null;
        const faltaBezerro = cepeaBezerroBrl == null;
        const faltaMilho = cepeaMilhoBrl == null;
        const faltaSoja = cepeaSojaBrl == null;
        const precisaScrapeCepea = faltaBoi || faltaBezerro || faltaMilho || faltaSoja;

        // ── 2. Scrapers CEPEA (apenas para faltantes) ────────────────
        let resultadoCepea = {
            sucesso: true,
            dados: null,
            erro: "CEPEA suprido via Supabase",
        } as Awaited<ReturnType<typeof scrapeCepea>>;
        let resultadoBezerro = {
            sucesso: true,
            dados: null,
            erro: "Bezerro suprido via Supabase",
        } as Awaited<ReturnType<typeof scrapeCepeaIndicador>>;
        let resultadoMilho = {
            sucesso: true,
            dados: null,
            erro: "Milho suprido via Supabase",
        } as Awaited<ReturnType<typeof scrapeCepeaIndicador>>;
        let resultadoSoja = {
            sucesso: true,
            dados: null,
            erro: "Soja suprido via Supabase",
        } as Awaited<ReturnType<typeof scrapeCepeaIndicador>>;

        if (precisaScrapeCepea) {
            logger.info("─── Etapa 1/2: CEPEA (complemento de faltantes) ───");
            if (faltaBoi) {
                resultadoCepea = await scrapeCepea();
                cepeaFisicoBrl = resultadoCepea.dados?.valorBrl ?? cepeaFisicoBrl;
                cepeaFisicoUsd = resultadoCepea.dados?.valorUsd ?? cepeaFisicoUsd;
                cepeaDataReferencia = resultadoCepea.dados?.data ?? cepeaDataReferencia;
            }
            if (faltaBezerro) {
                resultadoBezerro = await scrapeCepeaIndicador(
                    config.urls.cepeaBezerro,
                    "Bezerro"
                );
                cepeaBezerroBrl = resultadoBezerro.dados?.valorBrl ?? cepeaBezerroBrl;
                cepeaDataReferencia = resultadoBezerro.dados?.data ?? cepeaDataReferencia;
            }
            if (faltaMilho) {
                resultadoMilho = await scrapeCepeaIndicador(
                    config.urls.cepeaMilho,
                    "Milho"
                );
                cepeaMilhoBrl = resultadoMilho.dados?.valorBrl ?? cepeaMilhoBrl;
                cepeaDataReferencia = resultadoMilho.dados?.data ?? cepeaDataReferencia;
            }
            if (faltaSoja) {
                resultadoSoja = await scrapeCepeaIndicador(
                    config.urls.cepeaSoja,
                    "Soja"
                );
                cepeaSojaBrl = resultadoSoja.dados?.valorBrl ?? cepeaSojaBrl;
                cepeaDataReferencia = resultadoSoja.dados?.data ?? cepeaDataReferencia;
            }
        } else {
            logger.info(
                `✅ CEPEA carregado do Supabase para ${dataEsperadaHistorico}. Scrape externo não necessário.`
            );
        }

        const cepeaTodosNulos =
            cepeaFisicoBrl == null &&
            cepeaBezerroBrl == null &&
            cepeaMilhoBrl == null &&
            cepeaSojaBrl == null;

        if (cepeaTodosNulos) {
            try {
                const ultimos = await buscarUltimosHistoricosPorProduto([
                    "boi_gordo",
                    "bezerro",
                    "milho",
                    "soja",
                ]);
                if (ultimos.boi_gordo || ultimos.bezerro || ultimos.milho || ultimos.soja) {
                    cepeaFisicoBrl = ultimos.boi_gordo?.valorBrl ?? null;
                    cepeaBezerroBrl = ultimos.bezerro?.valorBrl ?? null;
                    cepeaMilhoBrl = ultimos.milho?.valorBrl ?? null;
                    cepeaSojaBrl = ultimos.soja?.valorBrl ?? null;
                    cepeaFisicoUsd = ultimos.boi_gordo?.valorUsd ?? null;
                    cepeaDataReferencia =
                        ultimos.boi_gordo?.data ??
                        ultimos.bezerro?.data ??
                        ultimos.milho?.data ??
                        ultimos.soja?.data ??
                        null;
                    logger.warn(
                        `⚠️ CEPEA indisponível. Usando último fechamento do Supabase (${cepeaDataReferencia ?? "sem data"}).`
                    );
                }
            } catch (error) {
                logger.warn(
                    "⚠️ Falha ao obter fallback CEPEA no Supabase:",
                    error instanceof Error ? error.message : String(error)
                );
            }

            if (
                cepeaFisicoBrl == null &&
                cepeaBezerroBrl == null &&
                cepeaMilhoBrl == null &&
                cepeaSojaBrl == null
            ) {
                const cache = recuperarUltimoCepeaValidoDosLogs();
                if (cache) {
                    cepeaFisicoBrl = cache.cepea_fisico_brl;
                    cepeaBezerroBrl = cache.cepea_bezerro_brl;
                    cepeaMilhoBrl = cache.cepea_milho_brl;
                    cepeaSojaBrl = cache.cepea_soja_brl;
                    cepeaFisicoUsd = cache.cepea_fisico_usd;
                    cepeaDataReferencia = cache.cepea_data_referencia;
                    logger.warn(
                        `⚠️ CEPEA indisponível agora (403). Usando último fechamento disponível (${cepeaDataReferencia ?? "sem data"}).`
                    );
                }
            }
        }

        // ── 2. Scraper TradingView (Boi Futuro) ──────────────
        logger.info("─── Etapa 2/2: TradingView ───");
        let resultadoTv = {
            sucesso: false,
            dados: null,
            erro: "TradingView não executado.",
        } as Awaited<ReturnType<typeof scrapeTradingView>>;

        let browser: Browser | null = null;
        let context: BrowserContext | null = null;
        try {
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

            context = await browser.newContext({
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport: { width: 1920, height: 1080 },
                locale: "pt-BR",
                timezoneId: "America/Sao_Paulo",
            });

            await context.addInitScript(() => {
                Object.defineProperty(navigator, "webdriver", {
                    get: () => false,
                });
                Object.defineProperty(navigator, "plugins", {
                    get: () => [1, 2, 3, 4, 5],
                });
            });

            const pageTv = await context.newPage();
            resultadoTv = await scrapeTradingView(pageTv);
            await pageTv.close();
            await context.close();
            context = null;
            await browser.close();
            browser = null;
            logger.info("🔒 Navegador fechado.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn("⚠️ TradingView indisponível nesta execução:", msg);
            resultadoTv = {
                sucesso: false,
                dados: null,
                erro: msg,
            };
        } finally {
            if (context) {
                await context.close();
            }
            if (browser) {
                await browser.close();
            }
        }

        // ── 3. Scraper DATAGRO opcional (modo TODOS) ─────────
        let resultadoDatagro = null as Awaited<ReturnType<typeof scrapeDatagroLivestock>> | null;
        if (fonte === "todos") {
            logger.info("─── Etapa extra: DATAGRO Livestock ───");
            resultadoDatagro = await scrapeDatagroLivestock();
            const cepeaDataIso = normalizarDataIsoOuNulo(cepeaDataReferencia);
            const cepeaAtrasado = !cepeaDataIso || cepeaDataIso < dataEsperadaHistorico;
            if (cepeaAtrasado && resultadoDatagro.sucesso && resultadoDatagro.dados) {
                const fallbackHistorico = obterFallbackHistoricoDatagro({
                    boiBrasil: resultadoDatagro.dados.boiBrasil,
                    boiMundo: resultadoDatagro.dados.boiMundo,
                });

                if (fallbackHistorico) {
                    try {
                        await persistirHistoricoPrecos([
                            {
                                produto: "boi_gordo",
                                dataReferencia: fallbackHistorico.dataReferencia,
                                valorBrl: fallbackHistorico.valorBrl,
                                valorUsd: fallbackHistorico.valorUsd,
                            },
                        ]);
                        cepeaDataReferencia = fallbackHistorico.dataReferencia;
                        cepeaFisicoBrl = fallbackHistorico.valorBrl;
                        cepeaFisicoUsd = fallbackHistorico.valorUsd;
                        logger.warn(
                            `⚠️ Histórico CEPEA atualizado em contingência (${fallbackHistorico.dataReferencia}).`
                        );
                    } catch (error) {
                        logger.error(
                            "❌ Falha ao persistir histórico CEPEA em contingência:",
                            error instanceof Error ? error.message : String(error)
                        );
                    }
                }
            }
        }

        // ── Persistência no histórico Supabase ─────────────
        try {
            const dataReferenciaCapturada = normalizarDataIsoOuNulo(
                cepeaDataReferencia ??
                    resultadoBezerro.dados?.data ??
                    resultadoMilho.dados?.data ??
                    resultadoSoja.dados?.data
            );
            const dataPersistencia =
                dataReferenciaCapturada && dataReferenciaCapturada >= dataEsperadaHistorico
                    ? dataReferenciaCapturada
                    : dataEsperadaHistorico;

            const valoresAtuais = {
                boi_gordo: {
                    valorBrl: cepeaFisicoBrl,
                    valorUsd: cepeaFisicoUsd,
                },
                bezerro: {
                    valorBrl: cepeaBezerroBrl,
                    valorUsd: resultadoBezerro.dados?.valorUsd ?? null,
                },
                milho: {
                    valorBrl: cepeaMilhoBrl,
                    valorUsd: resultadoMilho.dados?.valorUsd ?? null,
                },
                soja: {
                    valorBrl: cepeaSojaBrl,
                    valorUsd: resultadoSoja.dados?.valorUsd ?? null,
                },
            };

            const produtos = Object.keys(valoresAtuais) as Array<
                keyof typeof valoresAtuais
            >;
            const precisaFallback = produtos.some(
                (produto) =>
                    valoresAtuais[produto].valorBrl == null ||
                    valoresAtuais[produto].valorUsd == null
            );

            if (precisaFallback) {
                const ultimos = await buscarUltimosHistoricosPorProduto([
                    "boi_gordo",
                    "bezerro",
                    "milho",
                    "soja",
                ]);
                for (const produto of produtos) {
                    if (valoresAtuais[produto].valorBrl == null) {
                        valoresAtuais[produto].valorBrl = ultimos[produto]?.valorBrl ?? null;
                    }
                    if (valoresAtuais[produto].valorUsd == null) {
                        valoresAtuais[produto].valorUsd = ultimos[produto]?.valorUsd ?? null;
                    }
                }
            }

            const persistencia = await persistirHistoricoPrecos([
                {
                    produto: "boi_gordo",
                    dataReferencia: dataPersistencia,
                    valorBrl: valoresAtuais.boi_gordo.valorBrl,
                    valorUsd: valoresAtuais.boi_gordo.valorUsd,
                },
                {
                    produto: "bezerro",
                    dataReferencia: dataPersistencia,
                    valorBrl: valoresAtuais.bezerro.valorBrl,
                    valorUsd: valoresAtuais.bezerro.valorUsd,
                },
                {
                    produto: "milho",
                    dataReferencia: dataPersistencia,
                    valorBrl: valoresAtuais.milho.valorBrl,
                    valorUsd: valoresAtuais.milho.valorUsd,
                },
                {
                    produto: "soja",
                    dataReferencia: dataPersistencia,
                    valorBrl: valoresAtuais.soja.valorBrl,
                    valorUsd: valoresAtuais.soja.valorUsd,
                },
            ]);

            if (persistencia.ignorados > 0) {
                logger.warn(
                    `⚠️ Histórico preenchido parcialmente para ${dataPersistencia}.`
                );
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error("❌ Falha ao persistir histórico de preços no Supabase:", msg);
        }

        // ── 4. Consolidação ──────────────────────────────────
        const dados: DadosCotacao = {
            data_extracao: new Date().toISOString(),
            fonte,
            cepea_fisico_brl: cepeaFisicoBrl,
            cepea_bezerro_brl: cepeaBezerroBrl,
            cepea_milho_brl: cepeaMilhoBrl,
            cepea_soja_brl: cepeaSojaBrl,
            cepea_fisico_usd: cepeaFisicoUsd,
            cepea_data_referencia: cepeaDataReferencia,
            tradingview_futuro_brl: resultadoTv.dados?.preco ?? null,
            datagro_boi_brasil: resultadoDatagro?.dados?.boiBrasil ?? [],
            datagro_mercado_futuro: resultadoDatagro?.dados?.mercadoFuturo ?? [],
            datagro_boi_mundo: resultadoDatagro?.dados?.boiMundo ?? [],
        };

        // ── 5. Log e Saída ───────────────────────────────────
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

        // ── 6. Envio via WhatsApp ────────────────────────────
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
    }
}
