import { logger } from "../logger";
import { AbateFemeasRecord, WorkerRunResult } from "./types";

interface WorkerCicloDeps {
  fetchAbateFemeas: (params: { periodoInicial: string; periodoFinal: string }) => Promise<AbateFemeasRecord[]>;
  upsertAbateFemeas: (records: AbateFemeasRecord[]) => Promise<number>;
}

function dedupeByRegiaoPeriodo(records: AbateFemeasRecord[]): AbateFemeasRecord[] {
  const map = new Map<string, AbateFemeasRecord>();
  for (const record of records) {
    const key = `${record.regiao}::${record.periodo}`;
    map.set(key, record);
  }
  return [...map.values()];
}

export async function runWorkerCicloPecuario(
  deps: WorkerCicloDeps,
  params: { periodoInicial: string; periodoFinal: string }
): Promise<WorkerRunResult> {
  logger.info(`[worker_ciclo_pecuario] Iniciando intervalo ${params.periodoInicial}..${params.periodoFinal}`);
  const raw = await deps.fetchAbateFemeas(params);
  const deduped = dedupeByRegiaoPeriodo(raw);
  const upserted = deduped.length ? await deps.upsertAbateFemeas(deduped) : 0;
  logger.info(`[worker_ciclo_pecuario] read=${raw.length} deduped=${deduped.length} upserted=${upserted}`);
  return { read: raw.length, deduped: deduped.length, upserted };
}

