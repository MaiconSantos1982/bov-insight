export interface WorkerRunResult {
  read: number;
  deduped: number;
  upserted: number;
}

export interface AbateFemeasRecord {
  regiao: string;
  periodo: string; // YYYY-MM-DD
  taxa_femeas_pct: number;
  fonte: string;
}

export interface BaseRegionalInput {
  data: string; // YYYY-MM-DD
  praca_local: string;
  preco_fisico_local: number;
  preco_referencia_sp: number;
  fonte: string;
}

export interface BaseRegionalRecord extends BaseRegionalInput {
  base_absoluta: number;
  base_percentual: number;
}

export interface EscalaAbateRecord {
  planta_id: string;
  regiao: string;
  data: string; // YYYY-MM-DD
  dias_escala: number;
  capacidade_abate_dia: number | null;
  fonte: string;
}

export interface ExportacaoBovinaRecord {
  periodo: string; // YYYY-MM-DD
  destino: string;
  volume_t: number;
  receita_usd: number;
  preco_medio_usd_t: number;
  fonte: string;
}

export interface AnalyticsCicloViewRow {
  regiao: string;
  periodo: string;
  taxa_femeas_pct: number;
  media_movel_12m: number;
  fase_ciclo: "RETENCAO" | "ESTABILIDADE" | "LIQUIDACAO";
}

export interface AnalyticsBaseViewRow {
  data: string;
  praca_local: string;
  base_percentual: number;
  situacao_base: "BASE_FORTE" | "BASE_NORMAL" | "BASE_FRACA";
}

export interface AnalyticsEscalaViewRow {
  regiao: string;
  data: string;
  dias_escala_media: number;
  classificacao: "CURTA" | "NORMAL" | "LONGA";
}

export interface AnalyticsExportacaoViewRow {
  periodo: string;
  dependencia_china_pct: number;
  preco_medio_usd_t_global: number;
}

export interface AlertaAnaliticoRecord {
  alert_key: string;
  data_ref: string;
  tipo: string;
  severidade: "BAIXA" | "MEDIA" | "ALTA";
  titulo: string;
  descricao: string;
  status: "ABERTO" | "FECHADO";
  contexto?: unknown;
}

export interface AlertaAnaliticoPendenteEnvio {
  id: string;
  alert_key: string;
  data_ref: string;
  tipo: string;
  severidade: "BAIXA" | "MEDIA" | "ALTA";
  titulo: string;
  descricao: string;
}

export interface GrupoNotificacaoConfig {
  id: string;
  nome_grupo: string | null;
  group_id: string;
  tipos_alerta: string[] | null;
  severidades: string[] | null;
  ativo: boolean;
}
