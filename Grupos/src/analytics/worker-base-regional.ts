import { logger } from "../logger";
import { BaseRegionalInput, BaseRegionalRecord, WorkerRunResult } from "./types";

interface WorkerBaseRegionalDeps {
  fetchBaseInputs: (params: { dataInicial: string; dataFinal: string }) => Promise<BaseRegionalInput[]>;
  upsertBaseRegional: (records: BaseRegionalRecord[]) => Promise<number>;
}

function round(value: number, scale: number = 4): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

function computeBase(record: BaseRegionalInput): BaseRegionalRecord {
  const base_absoluta = round(record.preco_fisico_local - record.preco_referencia_sp, 4);
  const base_percentual =
    record.preco_referencia_sp === 0 ? 0 : round((base_absoluta / record.preco_referencia_sp) * 100, 4);

  return {
    ...record,
    base_absoluta,
    base_percentual,
  };
}

function dedupeByPracaData(records: BaseRegionalRecord[]): BaseRegionalRecord[] {
  const map = new Map<string, BaseRegionalRecord>();
  for (const record of records) {
    const key = `${record.praca_local}::${record.data}`;
    map.set(key, record);
  }
  return [...map.values()];
}

export async function runWorkerBaseRegional(
  deps: WorkerBaseRegionalDeps,
  params: { dataInicial: string; dataFinal: string }
): Promise<WorkerRunResult> {
  logger.info(`[worker_base_regional] Iniciando intervalo ${params.dataInicial}..${params.dataFinal}`);
  const raw = await deps.fetchBaseInputs(params);
  const computed = raw.map(computeBase);
  const deduped = dedupeByPracaData(computed);
  const upserted = deduped.length ? await deps.upsertBaseRegional(deduped) : 0;
  logger.info(`[worker_base_regional] read=${raw.length} deduped=${deduped.length} upserted=${upserted}`);
  return { read: raw.length, deduped: deduped.length, upserted };
}

