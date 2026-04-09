import axios, { AxiosError } from "axios";
import { config } from "../config";
import { logger } from "../logger";

export interface AnalyticsAlertMessage {
  alertKey: string;
  dataRef: string;
  tipo: string;
  severidade: "BAIXA" | "MEDIA" | "ALTA";
  titulo: string;
  descricao: string;
}

function formatDateBr(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function prettyTipo(tipo: string): string {
  const map: Record<string, string> = {
    CICLO_PECUARIO: "Ciclo Pecuario",
    BASE_REGIONAL: "Base Regional",
    ESCALA_ABATE: "Escala de Abate",
    EXPORTACAO: "Exportacao",
  };
  return map[tipo] || tipo;
}

function prettySeveridade(severidade: string): string {
  const map: Record<string, string> = {
    BAIXA: "Baixa",
    MEDIA: "Media",
    ALTA: "Alta",
  };
  return map[severidade] || severidade;
}

function formatUf(uf: string): string {
  const estados: Record<string, string> = {
    AC: "Acre - AC",
    AL: "Alagoas - AL",
    AP: "Amapa - AP",
    AM: "Amazonas - AM",
    BA: "Bahia - BA",
    CE: "Ceara - CE",
    DF: "Distrito Federal - DF",
    ES: "Espirito Santo - ES",
    GO: "Goias - GO",
    MA: "Maranhao - MA",
    MT: "Mato Grosso - MT",
    MS: "Mato Grosso do Sul - MS",
    MG: "Minas Gerais - MG",
    PA: "Para - PA",
    PB: "Paraiba - PB",
    PR: "Parana - PR",
    PE: "Pernambuco - PE",
    PI: "Piaui - PI",
    RJ: "Rio de Janeiro - RJ",
    RN: "Rio Grande do Norte - RN",
    RS: "Rio Grande do Sul - RS",
    RO: "Rondonia - RO",
    RR: "Roraima - RR",
    SC: "Santa Catarina - SC",
    SP: "Sao Paulo - SP",
    SE: "Sergipe - SE",
    TO: "Tocantins - TO",
  };
  return estados[uf] || `UF ${uf}`;
}

function normalizeAlertText(text: string): string {
  if (!text) return text;

  let normalized = text.replace(/\bUF_([A-Z]{2})\b/g, (_match, uf: string) => formatUf(uf));

  const termos: Record<string, string> = {
    CURTA: "Escala curta",
    NORMAL: "Escala normal",
    LONGA: "Escala longa",
    RETENCAO: "Retencao",
    ESTABILIDADE: "Estabilidade",
    LIQUIDACAO: "Liquidacao",
    BASE_FORTE: "Base forte",
    BASE_NORMAL: "Base normal",
    BASE_FRACA: "Base fraca",
  };

  for (const [raw, pretty] of Object.entries(termos)) {
    normalized = normalized.replace(new RegExp(`\\b${raw}\\b`, "g"), pretty);
  }

  return normalized;
}

function buildAlertMessage(alert: AnalyticsAlertMessage): string {
  return [
    "🚨 *Alerta Analitico*",
    "",
    `*Tipo:* ${prettyTipo(alert.tipo)}`,
    `*Severidade:* ${prettySeveridade(alert.severidade)}`,
    `*Data ref.:* ${formatDateBr(alert.dataRef)}`,
    "",
    `*${normalizeAlertText(alert.titulo)}*`,
    normalizeAlertText(alert.descricao),
  ].join("\n");
}

export async function sendAnalyticsAlertToGroup(
  alert: AnalyticsAlertMessage,
  groupId: string
): Promise<boolean> {
  const { baseUrl, apiKey, instance } = config.pastorini;
  if (!baseUrl || !apiKey || !instance) {
    logger.warn("⚠️ Pastorini API não configurada para envio de alerta analítico.");
    return false;
  }

  if (!groupId) {
    logger.warn("⚠️ group_id vazio no envio de alerta analítico.");
    return false;
  }

  const url = `${baseUrl}/api/instances/${instance}/send-text`;
  const payload = {
    jid: groupId,
    text: buildAlertMessage(alert),
    delay: 1200,
    linkPreview: false,
  };

  try {
    await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      timeout: 15000,
    });
    return true;
  } catch (error) {
    if (error instanceof AxiosError) {
      logger.error("❌ Falha no envio de alerta analítico", {
        groupId,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      logger.error("❌ Falha inesperada no envio de alerta analítico", {
        groupId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return false;
  }
}
