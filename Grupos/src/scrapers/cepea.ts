import { Page } from "playwright";
import { DadosCepea, DadosCepeaIndicador, ResultadoScraper } from "../types";
import { parseBrlToFloat } from "../utils";
import { logger } from "../logger";
import { config } from "../config";

/**
 * Scraper para o indicador do Boi Gordo no CEPEA.
 *
 * A página é estática (HTML puro), então a extração é direta:
 *   - Tabela: #imagenet-indicador1
 *   - Primeira linha do tbody contém os dados mais recentes
 */
export async function scrapeCepea(
    page: Page
): Promise<ResultadoScraper<DadosCepea>> {
    try {
        logger.info("🌐 Navegando para CEPEA...");
        await page.goto(config.urls.cepea, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        // Aguarda a tabela carregar
        logger.info("⏳ Aguardando tabela do indicador...");
        await page.waitForSelector("#imagenet-indicador1 tbody tr", {
            timeout: 15000,
        });

        // Extrai os dados da primeira linha
        // Colunas da tabela CEPEA:
        //   Col 0: Data | Col 1: Valor R$ | Col 2: Var./Dia | Col 3: Var./Mês | Col 4: Valor US$
        const dados = await page.evaluate(() => {
            const row = document.querySelector(
                "#imagenet-indicador1 tbody tr:first-child"
            );
            if (!row) return null;

            const cells = row.querySelectorAll("td");
            if (cells.length < 5) return null;

            return {
                data: cells[0]?.textContent?.trim() || "",
                valorBrl: cells[1]?.textContent?.trim() || "",
                varDia: cells[2]?.textContent?.trim() || "",
                varMes: cells[3]?.textContent?.trim() || "",
                valorUsd: cells[4]?.textContent?.trim() || "",
            };
        });

        if (!dados) {
            throw new Error("Não foi possível localizar os dados na tabela CEPEA.");
        }

        if (!dados.valorBrl || !dados.valorUsd) {
            throw new Error(
                `Dados incompletos do CEPEA: BRL="${dados.valorBrl}", USD="${dados.valorUsd}"`
            );
        }

        const resultado: DadosCepea = {
            data: dados.data,
            valorBrl: parseBrlToFloat(dados.valorBrl),
            valorUsd: parseBrlToFloat(dados.valorUsd),
        };

        logger.success("✅ CEPEA extraído com sucesso!", resultado);
        return { sucesso: true, dados: resultado };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("❌ Falha ao extrair CEPEA:", msg);
        return { sucesso: false, dados: null, erro: msg };
    }
}

/**
 * Scraper genérico para indicadores CEPEA com valor em BRL na coluna 1.
 */
export async function scrapeCepeaIndicador(
    page: Page,
    url: string,
    nome: string
): Promise<ResultadoScraper<DadosCepeaIndicador>> {
    try {
        logger.info(`🌐 Navegando para CEPEA (${nome})...`);
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        logger.info(`⏳ Aguardando tabela do indicador (${nome})...`);
        await page.waitForSelector("#imagenet-indicador1 tbody tr", {
            timeout: 15000,
        });

        const dados = await page.evaluate(() => {
            const row = document.querySelector(
                "#imagenet-indicador1 tbody tr:first-child"
            );
            if (!row) return null;

            const cells = row.querySelectorAll("td");
            if (cells.length < 2) return null;

            return {
                data: cells[0]?.textContent?.trim() || "",
                valorBrl: cells[1]?.textContent?.trim() || "",
                valorUsd:
                    cells.length >= 5
                        ? cells[4]?.textContent?.trim() || ""
                        : "",
            };
        });

        if (!dados || !dados.valorBrl) {
            throw new Error(`Não foi possível localizar dados do indicador ${nome}.`);
        }

        const resultado: DadosCepeaIndicador = {
            data: dados.data,
            valorBrl: parseBrlToFloat(dados.valorBrl),
            valorUsd: dados.valorUsd ? parseBrlToFloat(dados.valorUsd) : null,
        };

        logger.success(`✅ CEPEA ${nome} extraído com sucesso!`, resultado);
        return { sucesso: true, dados: resultado };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Falha ao extrair CEPEA ${nome}:`, msg);
        return { sucesso: false, dados: null, erro: msg };
    }
}
