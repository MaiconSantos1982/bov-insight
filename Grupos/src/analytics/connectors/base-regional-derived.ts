import { config } from "../../config";
import { BaseRegionalInput } from "../types";

interface HistoricoPrecoRef {
  data: string;
  valor_brl: number;
}

interface BaseRegionalRefFallback {
  data: string;
  preco_referencia_sp: number;
}

interface PracaSpread {
  praca: string;
  spreadAbs: number;
}

function parseSpreadConfig(raw: string | undefined): PracaSpread[] {
  const text = (raw || "GOIANIA:-5.5,DOURADOS:-5.0").trim();
  if (!text) return [];

  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [praca, spread] = item.split(":").map((v) => v.trim());
      const spreadAbs = Number(spread);
      if (!praca || !Number.isFinite(spreadAbs)) {
        return null;
      }
      return { praca: praca.toUpperCase(), spreadAbs };
    })
    .filter((row): row is PracaSpread => row !== null);
}

function round(value: number, scale: number = 4): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

async function fetchReferenciaBoiGordo(params: {
  dataInicial: string;
  dataFinal: string;
}): Promise<HistoricoPrecoRef[]> {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para derivar base regional."
    );
  }

  const endpoint =
    `${config.supabase.url}/rest/v1/boigordo_historico` +
    `?select=data,valor_brl` +
    `&produto=eq.boi_gordo` +
    `&data=gte.${params.dataInicial}` +
    `&data=lte.${params.dataFinal}` +
    `&order=data.asc`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: config.supabase.serviceRoleKey,
      Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Falha ao buscar referência boi_gordo: HTTP ${response.status} - ${txt}`);
  }

  const rows = (await response.json()) as HistoricoPrecoRef[];
  return rows.filter((row) => row?.data && Number.isFinite(Number(row?.valor_brl)));
}

async function fetchReferenciaFromBaseRegional(params: {
  dataInicial: string;
  dataFinal: string;
}): Promise<HistoricoPrecoRef[]> {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    return [];
  }

  const endpoint =
    `${config.supabase.url}/rest/v1/boigordo_base_regional_historico` +
    `?select=data,preco_referencia_sp` +
    `&data=gte.${params.dataInicial}` +
    `&data=lte.${params.dataFinal}` +
    `&order=data.asc`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: config.supabase.serviceRoleKey,
      Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) return [];

  const rows = (await response.json()) as BaseRegionalRefFallback[];
  const dedupe = new Map<string, number>();
  for (const row of rows) {
    if (!row?.data || !Number.isFinite(Number(row?.preco_referencia_sp))) continue;
    if (!dedupe.has(row.data)) {
      dedupe.set(row.data, Number(row.preco_referencia_sp));
    }
  }

  return [...dedupe.entries()].map(([data, valor_brl]) => ({ data, valor_brl }));
}

export async function fetchBaseRegionalDerived(params: {
  dataInicial: string;
  dataFinal: string;
}): Promise<BaseRegionalInput[]> {
  let referenciaRows = await fetchReferenciaBoiGordo(params);
  if (!referenciaRows.length) {
    referenciaRows = await fetchReferenciaFromBaseRegional(params);
  }
  const pracas = parseSpreadConfig(process.env.ANALYTICS_BASE_REGIONAL_SPREADS);

  const output: BaseRegionalInput[] = [];
  for (const ref of referenciaRows) {
    const refPrice = Number(ref.valor_brl);
    for (const praca of pracas) {
      const localPrice = round(refPrice + praca.spreadAbs, 4);
      output.push({
        data: ref.data,
        praca_local: praca.praca,
        preco_fisico_local: localPrice,
        preco_referencia_sp: round(refPrice, 4),
        fonte: "DERIVED_HISTORICO_BOI_GORDO",
      });
    }
  }

  return output;
}
