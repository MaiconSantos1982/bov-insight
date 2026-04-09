export type FonteDados = "cepea" | "datagro" | "todos";

/**
 * Dados consolidados de uma extração
 */
export interface DadosCotacao {
    data_extracao: string;
    fonte: FonteDados;
    cepea_fisico_brl: number | null;
    cepea_bezerro_brl: number | null;
    cepea_milho_brl: number | null;
    cepea_soja_brl: number | null;
    cepea_fisico_usd: number | null;
    cepea_data_referencia: string | null;
    tradingview_futuro_brl: number | null;
    datagro_boi_brasil: DadoDatagroItem[];
    datagro_mercado_futuro: DadoDatagroItem[];
    datagro_boi_mundo: DadoDatagroItem[];
}

/**
 * Resultado individual de um scraper
 */
export interface ResultadoScraper<T> {
    sucesso: boolean;
    dados: T | null;
    erro?: string;
}

/**
 * Dados extraídos do CEPEA
 */
export interface DadosCepea {
    data: string;
    valorBrl: number;
    valorUsd: number;
}

export interface DadosCepeaIndicador {
    data: string;
    valorBrl: number;
    valorUsd: number | null;
}

/**
 * Dados extraídos do TradingView
 */
export interface DadosTradingView {
    preco: number;
}

export interface DadoDatagroItem {
    codigo: string;
    nome: string;
    preco: number | null;
    variacao: number | null;
    data: string | null;
}

export interface DadosDatagroLivestock {
    boiBrasil: DadoDatagroItem[];
    mercadoFuturo: DadoDatagroItem[];
    boiMundo: DadoDatagroItem[];
}

/**
 * Payload da Pastorini API
 */
export interface PastoriniPayload {
    number: string;
    options: {
        delay: number;
        presence: string;
    };
    textMessage: {
        text: string;
    };
}
