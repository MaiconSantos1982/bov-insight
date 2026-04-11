import axios from "axios";
import { DadosCepea, DadosCepeaIndicador, ResultadoScraper } from "../types";
import { parseBrlToFloat } from "../utils";
import { logger } from "../logger";
import { config } from "../config";

const CEPEA_HTTP_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function decodeEntities(input: string): string {
    return input
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function stripHtml(input: string): string {
    return decodeEntities(input.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function extrairPrimeiraLinhaTabelaIndicador(html: string): string[] {
    const tabelaMatch = html.match(
        /<table[^>]*id=["']imagenet-indicador1["'][\s\S]*?<\/table>/i
    );
    if (!tabelaMatch) {
        throw new Error("Tabela #imagenet-indicador1 não encontrada.");
    }

    const tabelaHtml = tabelaMatch[0];
    const linhaMatch =
        tabelaHtml.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i) ||
        tabelaHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);

    if (!linhaMatch?.[1]) {
        throw new Error("Linha de dados não encontrada na tabela do indicador.");
    }

    const cells = [...linhaMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (m) => stripHtml(m[1] || "")
    );

    if (!cells.length) {
        throw new Error("Células da tabela do indicador não encontradas.");
    }

    return cells;
}

async function baixarIndicadorCepea(url: string, nome: string): Promise<string[]> {
    logger.info(`🌐 Baixando CEPEA (${nome})...`);

    const response = await axios.get(url, {
        timeout: 30000,
        headers: CEPEA_HTTP_HEADERS,
    });

    const html = String(response.data || "");
    if (!html) {
        throw new Error(`Resposta vazia do CEPEA (${nome}).`);
    }

    return extrairPrimeiraLinhaTabelaIndicador(html);
}

/**
 * Scraper para o indicador do Boi Gordo no CEPEA.
 *
 * A página é estática (HTML puro), então a extração é direta:
 *   - Tabela: #imagenet-indicador1
 *   - Primeira linha do tbody contém os dados mais recentes
 */
export async function scrapeCepea(
): Promise<ResultadoScraper<DadosCepea>> {
    try {
        const cells = await baixarIndicadorCepea(config.urls.cepea, "Boi Gordo");
        if (cells.length < 5) {
            throw new Error(
                `Dados incompletos do CEPEA (Boi Gordo): colunas=${cells.length}`
            );
        }

        const resultado: DadosCepea = {
            data: cells[0] || "",
            valorBrl: parseBrlToFloat(cells[1] || ""),
            valorUsd: parseBrlToFloat(cells[4] || ""),
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
    url: string,
    nome: string
): Promise<ResultadoScraper<DadosCepeaIndicador>> {
    try {
        const cells = await baixarIndicadorCepea(url, nome);
        if (cells.length < 2 || !cells[1]) {
            throw new Error(`Não foi possível localizar dados do indicador ${nome}.`);
        }

        const resultado: DadosCepeaIndicador = {
            data: cells[0] || "",
            valorBrl: parseBrlToFloat(cells[1]),
            valorUsd: cells[4] ? parseBrlToFloat(cells[4]) : null,
        };

        logger.success(`✅ CEPEA ${nome} extraído com sucesso!`, resultado);
        return { sucesso: true, dados: resultado };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Falha ao extrair CEPEA ${nome}:`, msg);
        return { sucesso: false, dados: null, erro: msg };
    }
}
