import { Page } from "playwright";
import { DadosTradingView, ResultadoScraper } from "../types";
import { parseBrlToFloat, sleep } from "../utils";
import { logger } from "../logger";
import { config } from "../config";

/**
 * Scraper para o preço do Boi Futuro (BGI1!) no TradingView.
 *
 * O TradingView usa renderização assíncrona pesada. Estratégia:
 *   1. Navegar até a página do ativo
 *   2. Aguardar o seletor de preço principal aparecer no DOM
 *   3. Tentar múltiplos seletores (o TradingView muda classes com frequência)
 *   4. Extrair e converter o valor
 */

// Lista de seletores candidatos, ordenados por probabilidade.
// O TradingView pode alterar os nomes das classes.
// Se todos falharem, o dev deve inspecionar a página e adicionar novos seletores aqui.
const PRICE_SELECTORS = [
    // Seletores mais comuns do TradingView (2024-2026)
    '[class*="lastContainer"] [class*="last-"]',
    '[class*="tickerPrice"]',
    '[class*="last-JWoJqCpY"]',
    '[data-testid="last-price"]',
    '[class*="symbolLast"]',
    '[class*="price-wrapper"] [class*="last"]',
    'span[class*="priceWrapper"] span[class*="last"]',
    '[class*="tv-symbol-price-quote__value"]',
    // Fallback genérico — tenta o primeiro elemento com a string "last" na classe
    'span[class*="last"]',
];

export async function scrapeTradingView(
    page: Page
): Promise<ResultadoScraper<DadosTradingView>> {
    try {
        logger.info("🌐 Navegando para TradingView...");

        // Configura o User-Agent e viewport para evitar bloqueios
        await page.setViewportSize({ width: 1920, height: 1080 });

        await page.goto(config.urls.tradingView, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
        });

        // Aguarda a página carregar o conteúdo dinâmico
        logger.info("⏳ Aguardando carregamento do TradingView...");
        await sleep(5000);

        // Tenta fechar popups/banners de cookies que podem aparecer
        try {
            const cookieBtnSelectors = [
                'button[class*="acceptAll"]',
                '[id*="cookie"] button',
                'button:has-text("Aceitar")',
                'button:has-text("Accept")',
                'button:has-text("Concordo")',
            ];
            for (const sel of cookieBtnSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await btn.click();
                    logger.info("🍪 Banner de cookies fechado.");
                    await sleep(1000);
                    break;
                }
            }
        } catch {
            // Sem banner de cookies, tudo certo
        }

        // Tenta cada seletor candidato
        let precoTexto: string | null = null;

        for (const selector of PRICE_SELECTORS) {
            try {
                logger.info(`🔍 Tentando seletor: ${selector}`);
                const elemento = page.locator(selector).first();

                // Espera o elemento ficar visível (max 5s por seletor)
                if (await elemento.isVisible({ timeout: 5000 }).catch(() => false)) {
                    const texto = await elemento.textContent({ timeout: 3000 });
                    if (texto) {
                        const limpo = texto.trim();
                        // Valida que parece ser um número (contém dígitos)
                        if (/\d/.test(limpo)) {
                            precoTexto = limpo;
                            logger.info(`✅ Preço encontrado com seletor "${selector}": ${precoTexto}`);
                            break;
                        }
                    }
                }
            } catch {
                // Seletor não encontrado, tenta o próximo
                continue;
            }
        }

        // Se nenhum seletor funcionou, tenta uma abordagem mais ampla
        if (!precoTexto) {
            logger.warn("⚠️ Nenhum seletor padrão funcionou. Tentando busca ampla...");

            precoTexto = await page.evaluate(() => {
                // Busca todos os elementos que possam conter o preço principal
                const allSpans = Array.from(document.querySelectorAll("span"));
                for (const span of allSpans) {
                    const classes = span.className || "";
                    const text = span.textContent?.trim() || "";

                    // Procura por elementos com classes que contenham "last" e valor numérico
                    if (
                        (classes.includes("last") || classes.includes("Last")) &&
                        /^\d{1,3}[.,]\d{2}$/.test(text)
                    ) {
                        return text;
                    }
                }
                return null;
            });
        }

        if (!precoTexto) {
            // Captura screenshot para debug
            const screenshotPath = `${config.logsDir}/tradingview-debug-${Date.now()}.png`;
            try {
                await page.screenshot({ path: screenshotPath, fullPage: false });
                logger.warn(`📸 Screenshot de debug salvo em: ${screenshotPath}`);
            } catch {
                // Ignora erro de screenshot
            }

            throw new Error(
                "Não foi possível localizar o preço do Boi Futuro no TradingView. " +
                "Os seletores podem ter sido alterados. Verifique a página manualmente e " +
                "atualize os seletores em src/scrapers/tradingview.ts."
            );
        }

        const preco = parseBrlToFloat(precoTexto);
        const resultado: DadosTradingView = { preco };

        logger.success("✅ TradingView extraído com sucesso!", resultado);
        return { sucesso: true, dados: resultado };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("❌ Falha ao extrair TradingView:", msg);
        return { sucesso: false, dados: null, erro: msg };
    }
}
