import { AbateFemeasRecord } from "../types";

interface SidraTableDescriptor {
  Id: number;
  Nome: string;
  Pesquisa: string;
  TipoPeriodo: string;
  PeriodoDisponibilidade: string;
}

interface SidraValueRow {
  V: string;
  D2N: string; // Ex.: "4º trimestre 2025"
  D4N: string; // Ex.: "Total" | "Vacas" | "Novilhas"
  D5N: string; // Ex.: "No 1º mês"
}

const SIDRA_BASE_URL = "https://apisidra.ibge.gov.br";

export const SIDRA_TABLES_DEFAULT = [1092, 1093, 1094];

function parseSidraNumber(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text || text === "..." || text === ".." || text === "-" || text === "X") {
    return null;
  }
  const normalized = text.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseQuarterLabel(label: string): { year: number; quarter: number } | null {
  const match = label.match(/(\d+).+trimestre\s+(\d{4})/i);
  if (!match) return null;
  const quarter = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return null;
  if (!Number.isInteger(year) || year < 1900) return null;
  return { year, quarter };
}

function parseRefMonth(label: string): number | null {
  const match = label.match(/(\d+).+m[eê]s/i);
  if (!match) return null;
  const idx = Number(match[1]);
  if (!Number.isInteger(idx) || idx < 1 || idx > 3) return null;
  return idx;
}

function quarterMonthToIsoDate(year: number, quarter: number, refMonth: number): string {
  const month = (quarter - 1) * 3 + refMonth;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function isFemaleCategory(category: string): boolean {
  const normalized = category.toLowerCase();
  return normalized.includes("vaca") || normalized.includes("novilha");
}

function parseIsoDateMaybe(value: string): Date | null {
  const t = value.trim();
  const match = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(dateIso: string, fromIso?: string, toIso?: string): boolean {
  const d = parseIsoDateMaybe(dateIso);
  if (!d) return false;
  const from = fromIso ? parseIsoDateMaybe(fromIso) : null;
  const to = toIso ? parseIsoDateMaybe(toIso) : null;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export async function fetchSidraTableDescriptor(tableId: number): Promise<SidraTableDescriptor> {
  const response = await fetch(`${SIDRA_BASE_URL}/DescritoresTabela/t/${tableId}`);
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`SIDRA descritor tabela ${tableId} falhou: HTTP ${response.status} - ${txt}`);
  }
  return (await response.json()) as SidraTableDescriptor;
}

export async function fetchSidraTablesDescriptors(tableIds: number[]): Promise<SidraTableDescriptor[]> {
  const rows = await Promise.all(tableIds.map((id) => fetchSidraTableDescriptor(id)));
  return rows;
}

export async function fetchAbateFemeasFromSidra(params?: {
  from?: string;
  to?: string;
}): Promise<AbateFemeasRecord[]> {
  // Tabela 1092: abate de bovinos.
  // v=284 -> "Animais abatidos"
  // n1/1 -> Brasil
  // c18 -> tipo rebanho: total (992), vacas (56), novilhas (111735)
  // c12716 -> referência temporal: 1º/2º/3º mês do trimestre
  // c12529 -> inspeção: total (118225)
  const url =
    `${SIDRA_BASE_URL}/values/t/1092/v/284/p/all/n1/1` +
    `/c18/992,56,111735/c12716/115233,115234,115235/c12529/118225/h/n/f/n`;

  const response = await fetch(url);
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`SIDRA values 1092 falhou: HTTP ${response.status} - ${txt}`);
  }

  const rows = (await response.json()) as SidraValueRow[];
  const byPeriod = new Map<string, { total: number; female: number }>();

  for (const row of rows) {
    const period = parseQuarterLabel(row.D2N);
    const refMonth = parseRefMonth(row.D5N);
    if (!period || !refMonth) continue;
    const dateIso = quarterMonthToIsoDate(period.year, period.quarter, refMonth);
    if (!inRange(dateIso, params?.from, params?.to)) continue;

    const value = parseSidraNumber(row.V);
    if (value == null) continue;

    const bucket = byPeriod.get(dateIso) || { total: 0, female: 0 };
    if (row.D4N === "Total") {
      bucket.total += value;
    } else if (isFemaleCategory(row.D4N)) {
      bucket.female += value;
    }
    byPeriod.set(dateIso, bucket);
  }

  return [...byPeriod.entries()]
    .filter(([, val]) => val.total > 0)
    .map(([periodo, val]) => ({
      regiao: "BRASIL",
      periodo,
      taxa_femeas_pct: Number(((val.female / val.total) * 100).toFixed(4)),
      fonte: "IBGE_SIDRA_T1092",
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}
