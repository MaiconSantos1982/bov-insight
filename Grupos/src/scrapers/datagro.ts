import axios from "axios";
import { config } from "../config";
import { logger } from "../logger";
import {
    DadosDatagroLivestock,
    DadoDatagroItem,
    ResultadoScraper,
} from "../types";

type DatagroAtivo = {
    cod?: string;
    dados?: {
        cod?: string;
        nome?: string;
        ult?: string | number | null;
        var?: string | number | null;
        dia?: string | null;
    };
};

type DatagroQuadro = {
    titulo?: string;
    ativos?: DatagroAtivo[];
};

type DatagroPayload = {
    quadros?: DatagroQuadro[];
};

function toNullableNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const normalized = String(value).replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAtivo(ativo: DatagroAtivo): DadoDatagroItem {
    const dados = ativo.dados || {};
    return {
        codigo: dados.cod || ativo.cod || "",
        nome: dados.nome || "",
        preco: toNullableNumber(dados.ult),
        variacao: toNullableNumber(dados.var),
        data: dados.dia || null,
    };
}

function extrairQuadro(
    quadros: DatagroQuadro[],
    titulo: string
): DadoDatagroItem[] {
    const quadro = quadros.find((q) => q.titulo === titulo);
    if (!quadro?.ativos?.length) {
        return [];
    }

    return quadro.ativos
        .map(normalizeAtivo)
        .filter((item) => item.nome && item.codigo);
}

/**
 * Coleta os blocos de Pecuária na API da DATAGRO:
 * - Indicador do Boi DATAGRO
 * - Boi Futuro - B3 - SP
 * - Boi no Mundo
 */
export async function scrapeDatagroLivestock(): Promise<
    ResultadoScraper<DadosDatagroLivestock>
> {
    try {
        logger.info("🌐 Consultando DATAGRO Livestock...");
        const response = await axios.get<DatagroPayload>(config.urls.datagroLivestock, {
            timeout: 30000,
        });

        const quadros = response.data?.quadros || [];
        if (!quadros.length) {
            throw new Error("Resposta DATAGRO sem quadros.");
        }

        const boiBrasil = extrairQuadro(quadros, "Indicador do Boi DATAGRO");
        const mercadoFuturo = extrairQuadro(quadros, "Boi Futuro - B3 - SP");
        const boiMundo = extrairQuadro(quadros, "Boi no Mundo");

        if (!boiBrasil.length && !mercadoFuturo.length && !boiMundo.length) {
            throw new Error("Nenhum dos 3 blocos solicitados foi encontrado na DATAGRO.");
        }

        const dados: DadosDatagroLivestock = {
            boiBrasil,
            mercadoFuturo,
            boiMundo,
        };

        logger.success("✅ DATAGRO Livestock extraído com sucesso!", {
            boiBrasil: boiBrasil.length,
            mercadoFuturo: mercadoFuturo.length,
            boiMundo: boiMundo.length,
        });

        return { sucesso: true, dados };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("❌ Falha ao extrair DATAGRO Livestock:", msg);
        return { sucesso: false, dados: null, erro: msg };
    }
}
