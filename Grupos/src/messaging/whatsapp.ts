import axios, { AxiosError } from "axios";
import { config } from "../config";
import { logger } from "../logger";
import { DadosCotacao, DadoDatagroItem } from "../types";
import { formatBrl } from "../utils";

/**
 * Monta a mensagem CEPEA/TradingView para envio no WhatsApp
 */
function montarMensagemCepea(dados: DadosCotacao): string {
    const cepeaBrl =
        dados.cepea_fisico_brl != null ? formatBrl(dados.cepea_fisico_brl) : "N/D";
    const bezerro =
        dados.cepea_bezerro_brl != null ? formatBrl(dados.cepea_bezerro_brl) : "N/D";
    const milho =
        dados.cepea_milho_brl != null ? formatBrl(dados.cepea_milho_brl) : "N/D";
    const soja =
        dados.cepea_soja_brl != null ? formatBrl(dados.cepea_soja_brl) : "N/D";

    // ISO date → DD/MM/YYYY
    const dataFormatada = new Date(dados.data_extracao).toLocaleDateString(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "America/Sao_Paulo",
        }
    );

    const linhas = [
        `📊 *Fechamento Diário | CEPEA*`,
        ``,
        `🐂 *Boi Gordo Físico (CEPEA):* R$ ${cepeaBrl}`,
        `🐂 *Bezerro:* R$ ${bezerro}`,
        `🌽 *Milho:* R$ ${milho}`,
        `🌱 *Soja:* R$ ${soja}`,
    ];

    // Adiciona data de referência do CEPEA se disponível
    if (dados.cepea_data_referencia) {
        linhas.push(`📅 *Ref. CEPEA:* ${dados.cepea_data_referencia}`);
    }

    linhas.push(``);
    linhas.push(`_Dados extraídos em ${dataFormatada}._`);

    return linhas.join("\n");
}

const ESTADOS_BRASIL: Record<string, string> = {
    BA: "Bahia",
    GO: "Goiás",
    MG: "Minas Gerais",
    MS: "Mato Grosso do Sul",
    MT: "Mato Grosso",
    PA: "Pará",
    RO: "Rondônia",
    SP: "São Paulo",
    TO: "Tocantins",
};

const PAISES_MUNDO: Record<string, string> = {
    BR: "Brasil",
    AR: "Argentina",
    UY: "Uruguai",
    PY: "Paraguai",
    US: "Estados Unidos",
    AU: "Austrália",
    MX: "México",
    CN: "China",
};

const MESES_FULL: Record<string, string> = {
    jan: "Janeiro",
    fev: "Fevereiro",
    mar: "Março",
    abr: "Abril",
    mai: "Maio",
    jun: "Junho",
    jul: "Julho",
    ago: "Agosto",
    set: "Setembro",
    out: "Outubro",
    nov: "Novembro",
    dez: "Dezembro",
};

const CODIGO_MES_BGI: Record<string, string> = {
    jan: "F",
    fev: "G",
    mar: "H",
    abr: "J",
    mai: "K",
    jun: "M",
    jul: "N",
    ago: "Q",
    set: "U",
    out: "V",
    nov: "X",
    dez: "Z",
};

function extrairSiglaUf(item: DadoDatagroItem): string | null {
    const byCode = item.codigo.match(/_([A-Z]{2})_BR$/);
    if (byCode?.[1]) return byCode[1];
    const byName = item.nome.match(/\b([A-Z]{2})$/);
    return byName?.[1] || null;
}

function extrairSiglaPais(item: DadoDatagroItem): string | null {
    const byCode = item.codigo.match(/_([A-Z]{2})$/);
    if (byCode?.[1]) return byCode[1];
    const byName = item.nome.match(/\b([A-Z]{2})$/);
    return byName?.[1] || null;
}

function formatUsdClean(valor: number): string {
    return valor.toFixed(2);
}

function nomeMesMercadoFuturo(nome: string): { label: string; codigoBgi: string | null } {
    const match = nome.match(/(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/(\d{2,4})/i);
    if (!match) return { label: nome, codigoBgi: null };

    const mesKey = match[1].toLowerCase();
    const nomeMes = MESES_FULL[mesKey] || nome;
    const codigoBgi = CODIGO_MES_BGI[mesKey] || null;
    const anoAtual = new Date().getFullYear();
    const anoRaw = Number.parseInt(match[2], 10);
    const ano = match[2].length === 2 ? 2000 + anoRaw : anoRaw;

    if (ano !== anoAtual) {
        return { label: `${nomeMes}/${ano}`, codigoBgi };
    }

    return { label: nomeMes, codigoBgi };
}

function montarMensagemBoiBrasil(itens: DadoDatagroItem[]): string {
    const linhas = [`🇧🇷 *Indicador do Boi no Brasil*`, ``];
    const validos = itens.filter((item) => item.preco !== null);

    for (const item of validos) {
        const uf = extrairSiglaUf(item);
        const nomeEstado = (uf && ESTADOS_BRASIL[uf]) || item.nome;
        linhas.push(`- ${nomeEstado}: R$ ${formatBrl(item.preco ?? 0)}`);
    }

    if (!validos.length) {
        linhas.push("- Sem dados no momento");
    }

    return linhas.join("\n");
}

function montarMensagemMercadoFuturo(itens: DadoDatagroItem[]): string {
    const linhas = [`📊 *Mercado Futuro | B3*`, ``];
    const validos = itens.filter((item) => item.preco !== null);

    for (const item of validos) {
        const mes = nomeMesMercadoFuturo(item.nome);
        const prefixo = mes.codigoBgi ? `BGI ${mes.codigoBgi} - ` : "";
        linhas.push(`- ${prefixo}${mes.label}: ${formatBrl(item.preco ?? 0)}`);
    }

    if (!validos.length) {
        linhas.push("- Sem dados no momento");
    }

    return linhas.join("\n");
}

function montarMensagemBoiMundo(itens: DadoDatagroItem[]): string {
    const linhas = [`🌎 *Boi no Mundo | Em dólar*`, ``];
    const validos = itens.filter((item) => item.preco !== null);

    for (const item of validos) {
        const paisSigla = extrairSiglaPais(item);
        const nomePais = (paisSigla && PAISES_MUNDO[paisSigla]) || item.nome.replace(/^Boi Vivo\s+/i, "");
        linhas.push(`- ${nomePais}: ${formatUsdClean(item.preco ?? 0)}`);
    }

    if (!validos.length) {
        linhas.push("- Sem dados no momento");
    }

    return linhas.join("\n");
}

export function montarMensagensWhatsApp(dados: DadosCotacao): string[] {
    if (dados.fonte === "datagro") {
        return [
            montarMensagemBoiBrasil(dados.datagro_boi_brasil),
            montarMensagemMercadoFuturo(dados.datagro_mercado_futuro),
            montarMensagemBoiMundo(dados.datagro_boi_mundo),
        ];
    }

    if (dados.fonte === "todos") {
        return [
            montarMensagemCepea(dados),
            montarMensagemBoiBrasil(dados.datagro_boi_brasil),
            montarMensagemMercadoFuturo(dados.datagro_mercado_futuro),
            montarMensagemBoiMundo(dados.datagro_boi_mundo),
        ];
    }

    return [montarMensagemCepea(dados)];
}

/**
 * Monta o payload no formato exato da API (mesmo do N8N)
 * Formato: { jid, text, delay, linkPreview }
 */
function montarPayload(text: string): { jid: string; text: string; delay: number; linkPreview: boolean } {
    return {
        jid: config.whatsapp.groupId,
        text,
        delay: 1200,
        linkPreview: false,
    };
}

async function enviarTexto(url: string, headers: Record<string, string>, text: string): Promise<boolean> {
    const payload = montarPayload(text);
    logger.info("📦 Payload:", JSON.stringify(payload));

    try {
        const response = await axios.post(url, payload, {
            headers,
            timeout: 15000,
        });

        logger.success("✅ Mensagem enviada com sucesso!", {
            status: response.status,
            data: response.data,
        });
        return true;
    } catch (error) {
        if (error instanceof AxiosError) {
            logger.error("❌ Erro ao enviar WhatsApp:", {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
            });
        } else {
            logger.error(
                "❌ Erro inesperado ao enviar WhatsApp:",
                error instanceof Error ? error.message : String(error)
            );
        }
        return false;
    }
}

/**
 * Envia a mensagem via Pastorini API (WhatsApp)
 */
export async function enviarWhatsApp(dados: DadosCotacao): Promise<boolean> {
    const { baseUrl, apiKey, instance } = config.pastorini;

    // Validação de configuração
    if (!baseUrl || !apiKey || !instance) {
        logger.warn(
            "⚠️ Credenciais da Pastorini API não configuradas. Mensagem não será enviada."
        );
        logger.info("💡 Configure as variáveis PASTORINI_* no arquivo .env");
        return false;
    }

    if (!config.whatsapp.groupId || config.whatsapp.groupId === "ID_DO_GRUPO_AQUI") {
        logger.warn(
            "⚠️ ID do grupo WhatsApp não configurado. Mensagem não será enviada."
        );
        logger.info("💡 Configure a variável WHATSAPP_GROUP_ID no arquivo .env");
        return false;
    }

    const url = `${baseUrl}/api/instances/${instance}/send-text`;
    const mensagens = montarMensagensWhatsApp(dados);
    const headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
    };
    const safeHeaders = {
        ...headers,
        "x-api-key": apiKey ? `${apiKey.slice(0, 4)}***` : "",
    };

    // Debug completo da requisição
    logger.info("📤 Enviando mensagem via WhatsApp...");
    logger.info("🔗 URL:", url);
    logger.info("📋 Headers:", JSON.stringify(safeHeaders));
    logger.info(`🧾 Quantidade de mensagens: ${mensagens.length}`);

    let enviadas = 0;
    for (let i = 0; i < mensagens.length; i += 1) {
        logger.info(`📨 Enviando mensagem ${i + 1}/${mensagens.length}...`);
        const ok = await enviarTexto(url, headers, mensagens[i]);
        if (ok) {
            enviadas += 1;
        }
        if (i < mensagens.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    return enviadas > 0;
}
