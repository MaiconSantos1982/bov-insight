import { config } from "../config";
import { logger } from "../logger";
import { sendAnalyticsAlertToGroup } from "../messaging";
import {
  AlertaAnaliticoRecord,
  AlertaAnaliticoPendenteEnvio,
  AnalyticsBaseViewRow,
  AnalyticsCicloViewRow,
  AnalyticsExportacaoViewRow,
  GrupoNotificacaoConfig,
} from "./types";
import {
  closeAlertasAnaliticosByIds,
  fetchAlertasAnaliticosAbertos,
  fetchAlertasAnaliticosPendentesEnvio,
  fetchBaseRegionalRows,
  fetchCicloClassificacaoRows,
  fetchExportacaoResumoRows,
  fetchGruposNotificacaoAtivos,
  insertExecucaoLog,
  markAlertaAnaliticoEnviado,
  markAlertaAnaliticoErroEnvio,
  upsertAlertasAnaliticos,
} from "./supabase-repository";

function latestByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function buildCicloAlerts(rows: AnalyticsCicloViewRow[]): AlertaAnaliticoRecord[] {
  const latest = latestByKey(rows, (r) => r.regiao);
  return latest
    .filter((row) => row.fase_ciclo === "LIQUIDACAO")
    .map((row) => ({
      alert_key: `CICLO_LIQUIDACAO_${row.regiao}`,
      data_ref: row.periodo,
      tipo: "CICLO_PECUARIO",
      severidade: "ALTA",
      titulo: `Ciclo pecuário em liquidação (${row.regiao})`,
      descricao: `A região ${row.regiao} entrou em fase de liquidação com taxa de fêmeas em ${row.taxa_femeas_pct.toFixed(2)}%.`,
      status: "ABERTO",
      contexto: row,
    }));
}

function buildBaseAlerts(rows: AnalyticsBaseViewRow[]): AlertaAnaliticoRecord[] {
  const latest = latestByKey(rows, (r) => r.praca_local);
  return latest
    .filter((row) => row.situacao_base === "BASE_FORTE" || row.situacao_base === "BASE_FRACA")
    .map((row) => ({
      alert_key: `BASE_${row.situacao_base}_${row.praca_local}`,
      data_ref: row.data,
      tipo: "BASE_REGIONAL",
      severidade: row.situacao_base === "BASE_FRACA" ? "MEDIA" : "BAIXA",
      titulo: `Base ${row.situacao_base === "BASE_FRACA" ? "fraca" : "forte"} em ${row.praca_local}`,
      descricao: `Praça ${row.praca_local} com base em ${row.base_percentual.toFixed(2)}% (${row.situacao_base}).`,
      status: "ABERTO",
      contexto: row,
    }));
}

function buildExportacaoAlerts(rows: AnalyticsExportacaoViewRow[]): AlertaAnaliticoRecord[] {
  if (!rows.length) return [];
  const latest = rows[0];
  const threshold = config.analyticsAlertRules.chinaThresholdPct;
  if (latest.dependencia_china_pct < threshold) return [];

  return [
    {
      alert_key: "EXPORTACAO_DEPENDENCIA_CHINA",
      data_ref: latest.periodo,
      tipo: "EXPORTACAO",
      severidade: "MEDIA",
      titulo: "Dependência de China acima do limite",
      descricao: `Dependência China em ${latest.dependencia_china_pct.toFixed(2)}%, acima do limite de ${threshold.toFixed(2)}%.`,
      status: "ABERTO",
      contexto: latest,
    },
  ];
}

function groupAcceptsAlert(group: GrupoNotificacaoConfig, alert: AlertaAnaliticoPendenteEnvio): boolean {
  const tipos = group.tipos_alerta || [];
  const severidades = group.severidades || [];
  const tipoOk = tipos.length === 0 || tipos.includes(alert.tipo);
  const severidadeOk = severidades.length === 0 || severidades.includes(alert.severidade);
  return tipoOk && severidadeOk;
}

function resolveTargetGroupIds(
  alert: AlertaAnaliticoPendenteEnvio,
  groups: GrupoNotificacaoConfig[]
): string[] {
  const matched = groups.filter((group) => groupAcceptsAlert(group, alert)).map((group) => group.group_id);
  if (matched.length) {
    return [...new Set(matched)];
  }

  if (config.whatsapp.groupId && config.whatsapp.groupId !== "ID_DO_GRUPO_AQUI") {
    return [config.whatsapp.groupId];
  }

  return [];
}

async function dispatchPendingAnalyticsAlerts(
  pending: AlertaAnaliticoPendenteEnvio[],
  groups: GrupoNotificacaoConfig[]
): Promise<{ enviados: number; falhasEnvio: number; semRota: number }> {
  if (!pending.length) {
    return { enviados: 0, falhasEnvio: 0, semRota: 0 };
  }

  let enviados = 0;
  let falhasEnvio = 0;
  let semRota = 0;

  for (const alert of pending) {
    const groupIds = resolveTargetGroupIds(alert, groups);
    if (!groupIds.length) {
      semRota += 1;
      await markAlertaAnaliticoErroEnvio(alert.id, "Sem grupo configurado para tipo/severidade.");
      continue;
    }

    let sentAny = false;
    for (const groupId of groupIds) {
      const ok = await sendAnalyticsAlertToGroup(
        {
          alertKey: alert.alert_key,
          dataRef: alert.data_ref,
          tipo: alert.tipo,
          severidade: alert.severidade,
          titulo: alert.titulo,
          descricao: alert.descricao,
        },
        groupId
      );
      if (ok) {
        sentAny = true;
      }
    }

    if (sentAny) {
      enviados += 1;
      await markAlertaAnaliticoEnviado(alert.id);
    } else {
      falhasEnvio += 1;
      await markAlertaAnaliticoErroEnvio(alert.id, "Falha no envio para todos os grupos elegíveis.");
    }
  }

  return { enviados, falhasEnvio, semRota };
}

export async function runAnalyticsAlertEngine(): Promise<{
  ciclo: number;
  base: number;
  exportacao: number;
  fechados: number;
  enviados: number;
  falhasEnvio: number;
  semRota: number;
  total: number;
}> {
  const startedAt = new Date();
  logger.info("[analytics:alertas] iniciando avaliação de gatilhos");
  await insertExecucaoLog({
    origem: "Grupos",
    tipo: "analytics:alertas",
    status: "INICIADO",
    mensagem: "Engine de alertas analíticos iniciado.",
    started_at: startedAt.toISOString(),
  });

  try {
    const [cicloRows, baseRows, exportacaoRows] = await Promise.all([
      fetchCicloClassificacaoRows(),
      fetchBaseRegionalRows(),
      fetchExportacaoResumoRows(),
    ]);

    const cicloAlerts = buildCicloAlerts(cicloRows);
    const baseAlerts = buildBaseAlerts(baseRows);
    const exportacaoAlerts = buildExportacaoAlerts(exportacaoRows);
    const all = [...cicloAlerts, ...baseAlerts, ...exportacaoAlerts];
    const openRows = await fetchAlertasAnaliticosAbertos();

    const upserted = all.length ? await upsertAlertasAnaliticos(all) : 0;
    const targetByKey = new Map(all.map((row) => [row.alert_key, row.data_ref]));
    const staleOpenIds = openRows
      .filter((row) => targetByKey.get(row.alert_key) !== row.data_ref)
      .map((row) => row.id);
    const closed = staleOpenIds.length ? await closeAlertasAnaliticosByIds(staleOpenIds) : 0;
    const [pendingForDispatch, groups] = await Promise.all([
      fetchAlertasAnaliticosPendentesEnvio(),
      fetchGruposNotificacaoAtivos(),
    ]);
    const dispatch = await dispatchPendingAnalyticsAlerts(pendingForDispatch, groups);

    const result = {
      ciclo: cicloAlerts.length,
      base: baseAlerts.length,
      exportacao: exportacaoAlerts.length,
      fechados: closed,
      enviados: dispatch.enviados,
      falhasEnvio: dispatch.falhasEnvio,
      semRota: dispatch.semRota,
      total: upserted,
    };

    const finishedAt = new Date();
    await insertExecucaoLog({
      origem: "Grupos",
      tipo: "analytics:alertas",
      status: "SUCESSO",
      mensagem: "Engine concluído com sucesso.",
      contexto: result,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duracao_ms: finishedAt.getTime() - startedAt.getTime(),
    });

    logger.success("[analytics:alertas] concluído", result);
    return result;
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    await insertExecucaoLog({
      origem: "Grupos",
      tipo: "analytics:alertas",
      status: "FALHA",
      mensagem: message,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duracao_ms: finishedAt.getTime() - startedAt.getTime(),
    });
    throw error;
  }
}
