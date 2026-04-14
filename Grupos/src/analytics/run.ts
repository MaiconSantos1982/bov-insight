import { logger } from "../logger";
import {
  runAnalyticsAlertEngine,
  runWorkerBaseRegional,
  runWorkerCicloPecuario,
  runWorkerExportacao,
  runAnalyticsIngestionPipeline,
} from "./index";
import {
  fetchAbateFemeasFromSource,
  fetchBaseRegionalInputsFromSource,
  fetchExportacoesFromSource,
  healthcheckAnalyticsTables,
  upsertAbateFemeas,
  upsertBaseRegional,
  upsertExportacoes,
} from "./supabase-repository";

type WorkerName = "ciclo" | "base" | "exportacao" | "healthcheck" | "alertas" | "ingest";

function argValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function argWorker(): WorkerName {
  const worker = process.argv.slice(2)[0] as WorkerName | undefined;
  if (!worker) {
    throw new Error("Informe o worker: ciclo | base | exportacao | healthcheck");
  }
  return worker;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const worker = argWorker();

  if (worker === "healthcheck") {
    await healthcheckAnalyticsTables();
    logger.success("[analytics] healthcheck concluído");
    return;
  }

  if (worker === "ciclo") {
    const from = argValue("--from") || monthsAgoIso(24);
    const to = argValue("--to") || todayIso();
    const result = await runWorkerCicloPecuario(
      { fetchAbateFemeas: fetchAbateFemeasFromSource, upsertAbateFemeas },
      { periodoInicial: from, periodoFinal: to }
    );
    logger.success(`[analytics:ciclo] concluído`, result);
    return;
  }

  if (worker === "base") {
    const from = argValue("--from") || monthsAgoIso(6);
    const to = argValue("--to") || todayIso();
    const result = await runWorkerBaseRegional(
      { fetchBaseInputs: fetchBaseRegionalInputsFromSource, upsertBaseRegional },
      { dataInicial: from, dataFinal: to }
    );
    logger.success(`[analytics:base] concluído`, result);
    return;
  }

  if (worker === "exportacao") {
    const from = argValue("--from") || monthsAgoIso(24);
    const to = argValue("--to") || todayIso();
    const result = await runWorkerExportacao(
      { fetchExportacoes: fetchExportacoesFromSource, upsertExportacoes },
      { periodoInicial: from, periodoFinal: to }
    );
    logger.success(`[analytics:exportacao] concluído`, result);
    return;
  }

  if (worker === "alertas") {
    await runAnalyticsAlertEngine();
    return;
  }

  if (worker === "ingest") {
    await runAnalyticsIngestionPipeline();
    return;
  }

  throw new Error(`Worker não suportado: ${worker}`);
}

main().catch((err) => {
  logger.error("[analytics] erro fatal", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
