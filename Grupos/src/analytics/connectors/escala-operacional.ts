import { EscalaAbateRecord } from "../types";

const LIVESTOCK_URL =
  "https://precos.api.datagro.com/paginas/?mercado=5&minihome=&pos=1&idioma=pt-br";

interface DatagroAtivo {
  dados?: {
    nome?: string;
    ult?: string | number | null;
    dia?: string | null;
  };
}

interface DatagroQuadro {
  titulo?: string;
  ativos?: DatagroAtivo[];
}

interface DatagroPayload {
  quadros?: DatagroQuadro[];
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(dia?: string | null): string {
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) return dia;
  return new Date().toISOString().slice(0, 10);
}

function parseUfFromName(nome: string): string | null {
  // Ex.: "Indicador do Boi - Escala GO"
  const match = nome.match(/Escala\s+([A-Z]{2})\b/i);
  if (!match?.[1]) return null;
  return match[1].toUpperCase();
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function fetchEscalaOperacional(params?: {
  dataInicial?: string;
  dataFinal?: string;
}): Promise<EscalaAbateRecord[]> {
  const response = await fetch(LIVESTOCK_URL);
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Falha painel operacional escala: HTTP ${response.status} - ${txt}`);
  }

  const payload = (await response.json()) as DatagroPayload;
  const quadro = payload.quadros?.find((q) => q.titulo === "Escala - Indicador do Boi");
  if (!quadro?.ativos?.length) return [];

  const from = params?.dataInicial ? parseIsoDate(params.dataInicial) : null;
  const to = params?.dataFinal ? parseIsoDate(params.dataFinal) : null;

  const rows: EscalaAbateRecord[] = [];
  for (const ativo of quadro.ativos) {
    const nome = String(ativo?.dados?.nome || "");
    const uf = parseUfFromName(nome);
    const diasEscala = toNullableNumber(ativo?.dados?.ult);
    const data = normalizeDate(ativo?.dados?.dia);
    if (!uf || diasEscala == null) continue;

    const dataObj = parseIsoDate(data);
    if (from && dataObj < from) continue;
    if (to && dataObj > to) continue;

    rows.push({
      planta_id: `ESCALA_${uf}`,
      regiao: `UF_${uf}`,
      data,
      dias_escala: diasEscala,
      capacidade_abate_dia: null,
      fonte: "PAINEL_OPERACIONAL_ESCALA",
    });
  }

  return rows;
}
