#!/usr/bin/env node

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSV_FILES = [
  {
    produto: "boi_gordo",
    file: "/Users/maiconsilvasantos/Downloads/boi gordo.xlsx - boigordo.csv",
  },
  {
    produto: "bezerro",
    file: "/Users/maiconsilvasantos/Downloads/boi gordo.xlsx - bezerro.csv",
  },
  {
    produto: "milho",
    file: "/Users/maiconsilvasantos/Downloads/boi gordo.xlsx - milho.csv",
  },
  {
    produto: "soja",
    file: "/Users/maiconsilvasantos/Downloads/boi gordo.xlsx - soja.csv",
  },
];

const BATCH_SIZE = 500;

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function toIsoDate(brDate) {
  const [dd, mm, yyyy] = brDate.split("/");
  if (!dd || !mm || !yyyy) throw new Error(`Data inválida: ${brDate}`);
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toNumberBr(value) {
  if (!value) return null;
  const cleaned = value.replace(/\./g, "").replace(",", ".").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function parseCsvFile(filePath, produto) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headerIdx = lines.findIndex((line) => line.startsWith("Data,"));
  if (headerIdx < 0) {
    throw new Error(`Cabeçalho Data,À vista R$,À vista US$ não encontrado em ${filePath}`);
  }

  const parsed = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (!cols[0]) continue;

    const data = toIsoDate(cols[0]);
    const valor_brl = toNumberBr(cols[1]);
    const valor_usd = toNumberBr(cols[2]);
    if (valor_brl === null || valor_usd === null) continue;

    parsed.push({ data, produto, valor_brl, valor_usd });
  }

  const byKey = new Map();
  for (const row of parsed) {
    byKey.set(`${row.produto}::${row.data}`, row);
  }
  return [...byKey.values()].sort((a, b) => a.data.localeCompare(b.data));
}

async function restRequest(url, key, method, body = null) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[${method}] ${url} -> ${response.status} ${text}`);
  }
}

async function main() {
  const envLocal = parseEnvFile(path.join(ROOT, ".env.local"));
  const envGrupos = parseEnvFile(path.join(ROOT, "Grupos/.env"));

  const supabaseUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = envGrupos.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL (.env.local) e SUPABASE_SERVICE_ROLE_KEY (Grupos/.env) são obrigatórios.");
  }

  console.log("Iniciando importação de histórico...");

  const allRows = [];
  for (const source of CSV_FILES) {
    if (!fs.existsSync(source.file)) {
      throw new Error(`Arquivo não encontrado: ${source.file}`);
    }
    const rows = parseCsvFile(source.file, source.produto);
    console.log(`${source.produto}: ${rows.length} linhas válidas`);
    allRows.push(...rows);
  }

  for (const { produto } of CSV_FILES) {
    const deleteUrl = `${supabaseUrl}/rest/v1/boigordo_historico?produto=eq.${produto}`;
    await restRequest(deleteUrl, serviceKey, "DELETE");
    console.log(`Registros antigos removidos para ${produto}`);
  }

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const chunk = allRows.slice(i, i + BATCH_SIZE);
    const insertUrl = `${supabaseUrl}/rest/v1/boigordo_historico`;
    await restRequest(insertUrl, serviceKey, "POST", chunk);
    console.log(`Inseridos ${i + chunk.length}/${allRows.length}`);
  }

  console.log("Importação finalizada com sucesso.");
}

main().catch((err) => {
  console.error("Falha na importação:", err.message);
  process.exit(1);
});

