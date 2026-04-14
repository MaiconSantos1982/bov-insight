import { config } from "../config";
import { logger } from "../logger";
import { runWorkerBaseRegional } from "./worker-base-regional";
import { runWorkerCicloPecuario } from "./worker-ciclo-pecuario";
import { runWorkerExportacao } from "./worker-exportacao";
import {
  fetchAbateFemeasFromSource,
  fetchBaseRegionalInputsFromSource,
  fetchExportacoesFromSource,
  upsertAbateFemeas,
  upsertBaseRegional,
  upsertExportacoes,
} from "./supabase-repository";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export async function runAnalyticsIngestionPipeline(): Promise<void> {
  const to = todayIso();
  const lookback = config.analyticsIngestLookbackMonths;

  logger.info(
    `[analytics:ingest] Iniciando pipeline completo (to=${to}, ciclo=${lookback.ciclo}m, base=${lookback.base}m, exportacao=${lookback.exportacao}m)`
  );

  const ciclo = await runWorkerCicloPecuario(
    { fetchAbateFemeas: fetchAbateFemeasFromSource, upsertAbateFemeas },
    { periodoInicial: monthsAgoIso(lookback.ciclo), periodoFinal: to }
  );
  logger.info(`[analytics:ingest] ciclo concluído`, ciclo);

  const base = await runWorkerBaseRegional(
    { fetchBaseInputs: fetchBaseRegionalInputsFromSource, upsertBaseRegional },
    { dataInicial: monthsAgoIso(lookback.base), dataFinal: to }
  );
  logger.info(`[analytics:ingest] base concluído`, base);

  const exportacao = await runWorkerExportacao(
    { fetchExportacoes: fetchExportacoesFromSource, upsertExportacoes },
    { periodoInicial: monthsAgoIso(lookback.exportacao), periodoFinal: to }
  );
  logger.info(`[analytics:ingest] exportacao concluído`, exportacao);

  logger.success("[analytics:ingest] Pipeline concluído com sucesso.");
}
