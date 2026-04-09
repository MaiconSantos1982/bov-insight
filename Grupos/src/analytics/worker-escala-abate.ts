import { logger } from "../logger";
import { EscalaAbateRecord, WorkerRunResult } from "./types";

interface WorkerEscalaAbateDeps {
  fetchEscalas: (params: { dataInicial: string; dataFinal: string }) => Promise<EscalaAbateRecord[]>;
  upsertEscalas: (records: EscalaAbateRecord[]) => Promise<number>;
}

function dedupeByPlantaData(records: EscalaAbateRecord[]): EscalaAbateRecord[] {
  const map = new Map<string, EscalaAbateRecord>();
  for (const record of records) {
    const key = `${record.planta_id}::${record.data}`;
    map.set(key, record);
  }
  return [...map.values()];
}

export async function runWorkerEscalaAbate(
  deps: WorkerEscalaAbateDeps,
  params: { dataInicial: string; dataFinal: string }
): Promise<WorkerRunResult> {
  logger.info(`[worker_escala_abate] Iniciando intervalo ${params.dataInicial}..${params.dataFinal}`);
  const raw = await deps.fetchEscalas(params);
  const deduped = dedupeByPlantaData(raw);
  const upserted = deduped.length ? await deps.upsertEscalas(deduped) : 0;
  logger.info(`[worker_escala_abate] read=${raw.length} deduped=${deduped.length} upserted=${upserted}`);
  return { read: raw.length, deduped: deduped.length, upserted };
}

