import express from "express";
import fs from "fs";
import path from "path";
import { logger } from "../logger";
import {
  AbateFemeasRecord,
  BaseRegionalInput,
  EscalaAbateRecord,
  ExportacaoBovinaRecord,
} from "./types";
import {
  fetchAbateFemeasFromSidra,
  fetchSidraTablesDescriptors,
  SIDRA_TABLES_DEFAULT,
} from "./connectors/sidra";
import { fetchExportacoesFromSecex } from "./connectors/secex";
import { fetchBaseRegionalDerived } from "./connectors/base-regional-derived";
import { fetchEscalaOperacional } from "./connectors/escala-operacional";

const app = express();
const PORT = Number(process.env.ANALYTICS_SOURCE_PORT || 4010);

const dataDir = path.resolve(__dirname, "../../data/analytics");

function readJsonArray<T>(fileName: string): T[] {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    logger.warn(`[analytics-source] arquivo não encontrado: ${filePath}`);
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      logger.warn(`[analytics-source] payload inválido (não-array): ${filePath}`);
      return [];
    }
    return parsed as T[];
  } catch (err) {
    logger.error(
      `[analytics-source] falha ao ler JSON: ${filePath}`,
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "analytics-source", port: PORT });
});

app.get("/analytics/ciclo", (_req, res) => {
  const provider = String(process.env.ANALYTICS_CICLO_PROVIDER || "sidra").toLowerCase();
  if (provider === "sidra") {
    void (async () => {
      try {
        const from = typeof _req.query.from === "string" ? _req.query.from : undefined;
        const to = typeof _req.query.to === "string" ? _req.query.to : undefined;
        const rows = await fetchAbateFemeasFromSidra({ from, to });
        res.json(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[analytics-source] falha no conector SIDRA (ciclo): ${msg}`);
        res.status(502).json({ erro: msg });
      }
    })();
    return;
  }

  const rows = readJsonArray<AbateFemeasRecord>("ciclo.json");
  res.json(rows);
});

app.get("/analytics/base-regional", (_req, res) => {
  const provider = String(process.env.ANALYTICS_BASE_REGIONAL_PROVIDER || "derived").toLowerCase();
  if (provider === "derived") {
    void (async () => {
      try {
        const dataInicial = typeof _req.query.from === "string" ? _req.query.from : "2000-01-01";
        const dataFinal = typeof _req.query.to === "string" ? _req.query.to : "2100-12-31";
        const rows = await fetchBaseRegionalDerived({ dataInicial, dataFinal });
        res.json(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[analytics-source] falha no conector DERIVED (base-regional): ${msg}`);
        res.status(502).json({ erro: msg });
      }
    })();
    return;
  }

  const rows = readJsonArray<BaseRegionalInput>("base-regional.json");
  res.json(rows);
});

app.get("/analytics/escala-abate", (_req, res) => {
  const provider = String(process.env.ANALYTICS_ESCALA_PROVIDER || "operacional").toLowerCase();
  if (provider === "operacional") {
    void (async () => {
      try {
        const dataInicial = typeof _req.query.from === "string" ? _req.query.from : undefined;
        const dataFinal = typeof _req.query.to === "string" ? _req.query.to : undefined;
        const rows = await fetchEscalaOperacional({ dataInicial, dataFinal });
        res.json(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[analytics-source] falha no conector OPERACIONAL (escala): ${msg}`);
        res.status(502).json({ erro: msg });
      }
    })();
    return;
  }

  const rows = readJsonArray<EscalaAbateRecord>("escala-abate.json");
  res.json(rows);
});

app.get("/analytics/exportacao", (_req, res) => {
  const provider = String(process.env.ANALYTICS_EXPORTACAO_PROVIDER || "secex").toLowerCase();
  if (provider === "secex") {
    void (async () => {
      try {
        const from = typeof _req.query.from === "string" ? _req.query.from : undefined;
        const to = typeof _req.query.to === "string" ? _req.query.to : undefined;
        const chinaCountryCode = String(process.env.ANALYTICS_EXPORTACAO_CHINA_COUNTRY_CODE || "160");
        const ncmPrefixes = String(process.env.ANALYTICS_EXPORTACAO_NCM_PREFIXES || "0201,0202,0206")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        const rows = await fetchExportacoesFromSecex({ from, to, chinaCountryCode, ncmPrefixes });
        res.json(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[analytics-source] falha no conector SECEX (exportacao): ${msg}`);
        res.status(502).json({ erro: msg });
      }
    })();
    return;
  }

  const rows = readJsonArray<ExportacaoBovinaRecord>("exportacao.json");
  res.json(rows);
});

app.get("/analytics/sidra/tabelas", (_req, res) => {
  void (async () => {
    try {
      const tableIds = String(_req.query.ids || SIDRA_TABLES_DEFAULT.join(","))
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isInteger(v) && v > 0);
      const rows = await fetchSidraTablesDescriptors(tableIds);
      res.json(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[analytics-source] falha ao consultar descritores SIDRA: ${msg}`);
      res.status(502).json({ erro: msg });
    }
  })();
});

app.listen(PORT, () => {
  logger.success(`[analytics-source] servidor iniciado em http://localhost:${PORT}`);
  logger.info(`[analytics-source] lendo dados em ${dataDir}`);
});
