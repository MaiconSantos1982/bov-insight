import axios, { AxiosInstance } from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../logger";
import {
  AbateFemeasRecord,
  AlertaAnaliticoRecord,
  AlertaAnaliticoPendenteEnvio,
  AnalyticsBaseViewRow,
  AnalyticsCicloViewRow,
  AnalyticsEscalaViewRow,
  AnalyticsExportacaoViewRow,
  BaseRegionalInput,
  BaseRegionalRecord,
  EscalaAbateRecord,
  ExportacaoBovinaRecord,
  GrupoNotificacaoConfig,
} from "./types";

function getRestClient(): AxiosInstance {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para os workers analíticos."
    );
  }

  return axios.create({
    baseURL: `${config.supabase.url}/rest/v1`,
    headers: {
      apikey: config.supabase.serviceRoleKey,
      Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 30000,
  });
}

async function fetchSourceArray<T>(url: string, label: string): Promise<T[]> {
  if (!url) {
    throw new Error(`Fonte não configurada para ${label}. Defina URL no .env.`);
  }

  // Local file source: file:///abs/path/file.json or file://relative/path.json
  if (url.startsWith("file://")) {
    const rawPath = url.slice("file://".length);
    const filePath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(process.cwd(), rawPath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado para ${label}: ${filePath}`);
    }

    const text = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Arquivo inválido para ${label}: esperado array JSON (${filePath})`);
    }
    return parsed as T[];
  }

  // Relative/absolute local path without file://
  if (url.endsWith(".json") || url.startsWith("./") || url.startsWith("../") || url.startsWith("/")) {
    const filePath = path.isAbsolute(url) ? url : path.resolve(process.cwd(), url);
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(`Arquivo inválido para ${label}: esperado array JSON (${filePath})`);
      }
      return parsed as T[];
    }
  }

  const response = await axios.get<T[]>(url, { timeout: 30000 });
  if (!Array.isArray(response.data)) {
    throw new Error(`A fonte ${label} não retornou um array JSON.`);
  }
  return response.data;
}

function round(value: number, scale: number = 4): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

export async function fetchAbateFemeasFromSource(params: {
  periodoInicial: string;
  periodoFinal: string;
}): Promise<AbateFemeasRecord[]> {
  const rows = await fetchSourceArray<AbateFemeasRecord>(
    config.analyticsSources.cicloPecuarioUrl,
    "ANALYTICS_CICLO_URL"
  );

  return rows.filter(
    (row) => row.periodo >= params.periodoInicial && row.periodo <= params.periodoFinal
  );
}

export async function fetchBaseRegionalInputsFromSource(params: {
  dataInicial: string;
  dataFinal: string;
}): Promise<BaseRegionalInput[]> {
  const parseSpreads = (): Array<{ praca: string; spreadAbs: number }> => {
    const raw = (process.env.ANALYTICS_BASE_REGIONAL_SPREADS || "GOIANIA:-5.5,DOURADOS:-5.0").trim();
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [praca, spread] = item.split(":").map((v) => v.trim());
        const spreadAbs = Number(spread);
        if (!praca || !Number.isFinite(spreadAbs)) return null;
        return { praca: praca.toUpperCase(), spreadAbs };
      })
      .filter((v): v is { praca: string; spreadAbs: number } => v !== null);
  };

  const deriveFromSupabase = async (): Promise<BaseRegionalInput[]> => {
    const client = getRestClient();
    const spreads = parseSpreads();
    if (!spreads.length) return [];

    const { data: historicoRows } = await client.get<Array<{ data: string; valor_brl: number }>>(
      `/boigordo_historico?select=data,valor_brl&produto=eq.boi_gordo&data=gte.${params.dataInicial}&data=lte.${params.dataFinal}&order=data.asc`
    );
    let refs = (historicoRows || [])
      .filter((row) => row?.data && Number.isFinite(Number(row?.valor_brl)))
      .map((row) => ({ data: row.data, preco_ref: Number(row.valor_brl) }));

    if (!refs.length) {
      const { data: baseRows } = await client.get<Array<{ data: string; preco_referencia_sp: number }>>(
        `/boigordo_base_regional_historico?select=data,preco_referencia_sp&data=gte.${params.dataInicial}&data=lte.${params.dataFinal}&order=data.asc`
      );
      const dedupe = new Map<string, number>();
      for (const row of baseRows || []) {
        if (!row?.data || !Number.isFinite(Number(row?.preco_referencia_sp))) continue;
        if (!dedupe.has(row.data)) dedupe.set(row.data, Number(row.preco_referencia_sp));
      }
      refs = [...dedupe.entries()].map(([data, preco_ref]) => ({ data, preco_ref }));
    }

    const out: BaseRegionalInput[] = [];
    for (const ref of refs) {
      for (const spread of spreads) {
        out.push({
          data: ref.data,
          praca_local: spread.praca,
          preco_fisico_local: round(ref.preco_ref + spread.spreadAbs, 4),
          preco_referencia_sp: round(ref.preco_ref, 4),
          fonte: "DERIVED_HISTORICO_BOI_GORDO",
        });
      }
    }
    return out;
  };

  try {
    const rows = await fetchSourceArray<BaseRegionalInput>(
      config.analyticsSources.baseRegionalUrl,
      "ANALYTICS_BASE_REGIONAL_URL"
    );
    const filtered = rows.filter((row) => row.data >= params.dataInicial && row.data <= params.dataFinal);
    if (filtered.length) return filtered;
    logger.warn("[analytics:base] fonte URL sem dados no período, aplicando fallback Supabase derivado.");
    return deriveFromSupabase();
  } catch (error) {
    logger.warn("[analytics:base] falha na fonte URL, aplicando fallback Supabase derivado.", {
      erro: error instanceof Error ? error.message : String(error),
    });
    return deriveFromSupabase();
  }
}

export async function fetchEscalasFromSource(params: {
  dataInicial: string;
  dataFinal: string;
}): Promise<EscalaAbateRecord[]> {
  const rows = await fetchSourceArray<EscalaAbateRecord>(
    config.analyticsSources.escalaAbateUrl,
    "ANALYTICS_ESCALA_ABATE_URL"
  );

  return rows.filter((row) => row.data >= params.dataInicial && row.data <= params.dataFinal);
}

export async function fetchExportacoesFromSource(params: {
  periodoInicial: string;
  periodoFinal: string;
}): Promise<ExportacaoBovinaRecord[]> {
  const rows = await fetchSourceArray<ExportacaoBovinaRecord>(
    config.analyticsSources.exportacaoUrl,
    "ANALYTICS_EXPORTACAO_URL"
  );

  return rows.filter(
    (row) => row.periodo >= params.periodoInicial && row.periodo <= params.periodoFinal
  );
}

export async function upsertAbateFemeas(records: AbateFemeasRecord[]): Promise<number> {
  if (!records.length) return 0;
  const client = getRestClient();

  await client.post("/boigordo_abate_femeas_historico?on_conflict=regiao,periodo", records, {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  return records.length;
}

export async function upsertBaseRegional(records: BaseRegionalRecord[]): Promise<number> {
  if (!records.length) return 0;
  const client = getRestClient();

  const payload = records.map((row) => ({
    data: row.data,
    praca_local: row.praca_local,
    preco_fisico_local: round(row.preco_fisico_local, 4),
    preco_referencia_sp: round(row.preco_referencia_sp, 4),
    base_absoluta: round(row.base_absoluta, 4),
    base_percentual: round(row.base_percentual, 4),
    fonte: row.fonte,
  }));

  await client.post("/boigordo_base_regional_historico?on_conflict=praca_local,data", payload, {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  return payload.length;
}

export async function upsertEscalas(records: EscalaAbateRecord[]): Promise<number> {
  if (!records.length) return 0;
  const client = getRestClient();

  await client.post("/boigordo_escala_abate_historico?on_conflict=planta_id,data", records, {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  return records.length;
}

export async function upsertExportacoes(records: ExportacaoBovinaRecord[]): Promise<number> {
  if (!records.length) return 0;
  const client = getRestClient();

  const payload = records.map((row) => ({
    periodo: row.periodo,
    destino: row.destino,
    volume_t: round(row.volume_t, 4),
    receita_usd: round(row.receita_usd, 2),
    preco_medio_usd_t: round(row.preco_medio_usd_t, 4),
    fonte: row.fonte,
  }));

  await client.post("/boigordo_exportacao_bovina_historico?on_conflict=periodo,destino", payload, {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  return payload.length;
}

export async function healthcheckAnalyticsTables(): Promise<void> {
  const client = getRestClient();
  const tables = [
    "boigordo_abate_femeas_historico",
    "boigordo_base_regional_historico",
    "boigordo_escala_abate_historico",
    "boigordo_exportacao_bovina_historico",
  ];

  for (const table of tables) {
    await client.get(`/${table}?select=id&limit=1`);
    logger.info(`[analytics] acesso ok: ${table}`);
  }
}

export async function fetchCicloClassificacaoRows(): Promise<AnalyticsCicloViewRow[]> {
  const client = getRestClient();
  const { data } = await client.get<AnalyticsCicloViewRow[]>(
    "/boigordo_view_ciclo_pecuario_classificacao?select=regiao,periodo,taxa_femeas_pct,media_movel_12m,fase_ciclo&order=periodo.desc&limit=5000"
  );
  return data || [];
}

export async function fetchBaseRegionalRows(): Promise<AnalyticsBaseViewRow[]> {
  const client = getRestClient();
  const { data } = await client.get<AnalyticsBaseViewRow[]>(
    "/boigordo_view_base_regional_stats?select=data,praca_local,base_percentual,situacao_base&order=data.desc&limit=5000"
  );
  return data || [];
}

export async function fetchEscalaRegionalRows(): Promise<AnalyticsEscalaViewRow[]> {
  const client = getRestClient();
  const { data } = await client.get<AnalyticsEscalaViewRow[]>(
    "/boigordo_view_escala_abate_regional?select=regiao,data,dias_escala_media,classificacao&order=data.desc&limit=5000"
  );
  return data || [];
}

export async function fetchExportacaoResumoRows(): Promise<AnalyticsExportacaoViewRow[]> {
  const client = getRestClient();
  const { data } = await client.get<AnalyticsExportacaoViewRow[]>(
    "/boigordo_view_exportacao_resumo_mensal?select=periodo,dependencia_china_pct,preco_medio_usd_t_global&order=periodo.desc&limit=5000"
  );
  return data || [];
}

export async function upsertAlertasAnaliticos(records: AlertaAnaliticoRecord[]): Promise<number> {
  if (!records.length) return 0;
  const client = getRestClient();
  const payload = records.map((record) => ({
    ...record,
    contexto: record.contexto || {},
  }));

  await client.post("/boigordo_alertas_analiticos?on_conflict=alert_key,data_ref", payload, {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  return payload.length;
}

export interface AlertaAnaliticoAbertoRow {
  id: string;
  alert_key: string;
  data_ref: string;
}

export async function fetchAlertasAnaliticosAbertos(): Promise<AlertaAnaliticoAbertoRow[]> {
  const client = getRestClient();
  const { data } = await client.get<AlertaAnaliticoAbertoRow[]>(
    "/boigordo_alertas_analiticos?select=id,alert_key,data_ref&status=eq.ABERTO&order=data_ref.desc&limit=5000"
  );
  return data || [];
}

export async function closeAlertasAnaliticosByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const client = getRestClient();
  const chunkSize = 200;
  let closed = 0;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const idsFilter = chunk.join(",");
    await client.patch(`/boigordo_alertas_analiticos?id=in.(${idsFilter})`, { status: "FECHADO" }, {
      headers: { Prefer: "return=minimal" },
    });
    closed += chunk.length;
  }

  return closed;
}

export async function fetchAlertasAnaliticosPendentesEnvio(): Promise<AlertaAnaliticoPendenteEnvio[]> {
  const client = getRestClient();
  const { data } = await client.get<AlertaAnaliticoPendenteEnvio[]>(
    "/boigordo_alertas_analiticos?select=id,alert_key,data_ref,tipo,severidade,titulo,descricao&status=eq.ABERTO&enviado_grupo_at=is.null&order=data_ref.desc&limit=1000"
  );
  return data || [];
}

export async function fetchGruposNotificacaoAtivos(): Promise<GrupoNotificacaoConfig[]> {
  const client = getRestClient();
  const { data } = await client.get<GrupoNotificacaoConfig[]>(
    "/boigordo_grupos_notificacao?select=id,nome_grupo,group_id,tipos_alerta,severidades,ativo&ativo=eq.true&order=created_at.asc&limit=500"
  );
  return data || [];
}

export async function markAlertaAnaliticoEnviado(id: string): Promise<void> {
  const client = getRestClient();
  await client.patch(`/boigordo_alertas_analiticos?id=eq.${id}`, { enviado_grupo_at: new Date().toISOString(), ultimo_erro_envio: null }, {
    headers: { Prefer: "return=minimal" },
  });
}

export async function markAlertaAnaliticoErroEnvio(id: string, erro: string): Promise<void> {
  const client = getRestClient();
  const mensagem = erro.slice(0, 500);
  await client.patch(`/boigordo_alertas_analiticos?id=eq.${id}`, { ultimo_erro_envio: mensagem }, {
    headers: { Prefer: "return=minimal" },
  });
}

export async function insertExecucaoLog(params: {
  origem: string;
  tipo: string;
  status: "SUCESSO" | "FALHA" | "INICIADO";
  mensagem?: string;
  contexto?: unknown;
  started_at?: string;
  finished_at?: string;
  duracao_ms?: number;
}): Promise<void> {
  const client = getRestClient();
  await client.post("/boigordo_execucoes_logs", [{
    origem: params.origem,
    tipo: params.tipo,
    status: params.status,
    mensagem: params.mensagem || null,
    contexto: params.contexto || {},
    started_at: params.started_at || null,
    finished_at: params.finished_at || null,
    duracao_ms: params.duracao_ms || null,
  }], {
    headers: { Prefer: "return=minimal" },
  });
}
