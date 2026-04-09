import { ExportacaoBovinaRecord } from "../types";
import { execFileSync } from "node:child_process";

const SECEX_BASE_URL = "https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm";

interface RawExportRow {
  ano: number;
  mes: number;
  ncm: string;
  pais: string;
  kgLiquido: number;
  vlFobUsd: number;
}

interface AggregatedBucket {
  kg: number;
  usd: number;
}

function parseCsvLineSemicolon(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ";" && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function parseNumber(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function parseIntSafe(value: string): number {
  const num = Number(value);
  return Number.isInteger(num) ? num : 0;
}

function monthIsoDate(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function parseIsoDateOrNull(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(dateIso: string, fromIso: string, toIso: string): boolean {
  const d = parseIsoDateOrNull(dateIso);
  const from = parseIsoDateOrNull(fromIso);
  const to = parseIsoDateOrNull(toIso);
  if (!d || !from || !to) return false;
  return d >= from && d <= to;
}

function yearsInRange(fromIso: string, toIso: string): number[] {
  const from = parseIsoDateOrNull(fromIso);
  const to = parseIsoDateOrNull(toIso);
  if (!from || !to) return [];
  const years: number[] = [];
  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y += 1) {
    years.push(y);
  }
  return years;
}

async function fetchExportCsvByYear(year: number): Promise<string> {
  const url = `${SECEX_BASE_URL}/EXP_${year}.csv`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Falha ao buscar SECEX ${url}: HTTP ${response.status} - ${txt}`);
    }
    return response.text();
  } catch (error) {
    // Fallback para ambientes com cadeia TLS local incompleta no Node.
    const txt = execFileSync("curl", ["-sSL", url], {
      encoding: "utf8",
      // Alguns anos da base SECEX podem exceder 64MB em CSV bruto.
      maxBuffer: 1024 * 1024 * 512,
    });
    if (!txt) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao buscar SECEX ${url} via fetch/curl: ${msg}`);
    }
    return txt;
  }
}

function parseRawRowsFromCsv(csvText: string): RawExportRow[] {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const header = parseCsvLineSemicolon(lines[0]);
  const idxAno = header.indexOf("CO_ANO");
  const idxMes = header.indexOf("CO_MES");
  const idxNcm = header.indexOf("CO_NCM");
  const idxPais = header.indexOf("CO_PAIS");
  const idxKg = header.indexOf("KG_LIQUIDO");
  const idxUsd = header.indexOf("VL_FOB");
  if ([idxAno, idxMes, idxNcm, idxPais, idxKg, idxUsd].some((i) => i < 0)) {
    throw new Error("Layout CSV SECEX inesperado: colunas obrigatórias não encontradas.");
  }

  const rows: RawExportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLineSemicolon(lines[i]);
    if (cols.length <= Math.max(idxAno, idxMes, idxNcm, idxPais, idxKg, idxUsd)) continue;
    rows.push({
      ano: parseIntSafe(cols[idxAno]),
      mes: parseIntSafe(cols[idxMes]),
      ncm: cols[idxNcm],
      pais: cols[idxPais],
      kgLiquido: parseNumber(cols[idxKg]),
      vlFobUsd: parseNumber(cols[idxUsd]),
    });
  }
  return rows;
}

function toExportacaoRecords(params: {
  rows: RawExportRow[];
  from: string;
  to: string;
  chinaCountryCode: string;
  ncmPrefixes: string[];
}): ExportacaoBovinaRecord[] {
  const { rows, from, to, chinaCountryCode, ncmPrefixes } = params;
  const byPeriodDestino = new Map<string, AggregatedBucket>();

  for (const row of rows) {
    if (!row.ano || !row.mes || !row.ncm) continue;
    if (!ncmPrefixes.some((prefix) => row.ncm.startsWith(prefix))) continue;

    const periodo = monthIsoDate(row.ano, row.mes);
    if (!inRange(periodo, from, to)) continue;

    const destino = row.pais === chinaCountryCode ? "CHINA" : "OUTROS";
    const key = `${periodo}::${destino}`;
    const bucket = byPeriodDestino.get(key) || { kg: 0, usd: 0 };
    bucket.kg += row.kgLiquido;
    bucket.usd += row.vlFobUsd;
    byPeriodDestino.set(key, bucket);
  }

  return [...byPeriodDestino.entries()]
    .map(([key, bucket]) => {
      const [periodo, destino] = key.split("::");
      const volumeT = bucket.kg / 1000;
      const precoMedio = volumeT > 0 ? bucket.usd / volumeT : 0;
      return {
        periodo,
        destino,
        volume_t: Number(volumeT.toFixed(4)),
        receita_usd: Number(bucket.usd.toFixed(2)),
        preco_medio_usd_t: Number(precoMedio.toFixed(4)),
        fonte: "SECEX_COMEXSTAT_NCM",
      } as ExportacaoBovinaRecord;
    })
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.destino.localeCompare(b.destino));
}

export async function fetchExportacoesFromSecex(params?: {
  from?: string;
  to?: string;
  chinaCountryCode?: string;
  ncmPrefixes?: string[];
}): Promise<ExportacaoBovinaRecord[]> {
  const to = params?.to || new Date().toISOString().slice(0, 10);
  const from = params?.from || monthsAgoIso(24);
  const chinaCountryCode = params?.chinaCountryCode || "160";
  const ncmPrefixes = (params?.ncmPrefixes && params.ncmPrefixes.length
    ? params.ncmPrefixes
    : ["0201", "0202", "0206"]
  ).map((p) => p.trim()).filter(Boolean);

  const years = yearsInRange(from, to);
  const csvByYear = await Promise.all(years.map((year) => fetchExportCsvByYear(year)));
  const rows = csvByYear.flatMap((csv) => parseRawRowsFromCsv(csv));

  return toExportacaoRecords({
    rows,
    from,
    to,
    chinaCountryCode,
    ncmPrefixes,
  });
}
