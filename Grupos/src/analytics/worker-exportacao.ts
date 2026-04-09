import { logger } from "../logger";
import { ExportacaoBovinaRecord, WorkerRunResult } from "./types";

interface WorkerExportacaoDeps {
  fetchExportacoes: (params: { periodoInicial: string; periodoFinal: string }) => Promise<ExportacaoBovinaRecord[]>;
  upsertExportacoes: (records: ExportacaoBovinaRecord[]) => Promise<number>;
}

function dedupeByPeriodoDestino(records: ExportacaoBovinaRecord[]): ExportacaoBovinaRecord[] {
  const map = new Map<string, ExportacaoBovinaRecord>();
  for (const record of records) {
    const key = `${record.periodo}::${record.destino}`;
    map.set(key, record);
  }
  return [...map.values()];
}

export async function runWorkerExportacao(
  deps: WorkerExportacaoDeps,
  params: { periodoInicial: string; periodoFinal: string }
): Promise<WorkerRunResult> {
  logger.info(`[worker_exportacao] Iniciando intervalo ${params.periodoInicial}..${params.periodoFinal}`);
  const raw = await deps.fetchExportacoes(params);
  const deduped = dedupeByPeriodoDestino(raw);
  const upserted = deduped.length ? await deps.upsertExportacoes(deduped) : 0;
  logger.info(`[worker_exportacao] read=${raw.length} deduped=${deduped.length} upserted=${upserted}`);
  return { read: raw.length, deduped: deduped.length, upserted };
}

