import fs from "fs";
import path from "path";
import { config } from "./config";

/**
 * Níveis de log suportados
 */
type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS";

/**
 * Cores ANSI para output no terminal
 */
const COLORS: Record<LogLevel, string> = {
    INFO: "\x1b[36m",    // Cyan
    WARN: "\x1b[33m",    // Amarelo
    ERROR: "\x1b[31m",   // Vermelho
    SUCCESS: "\x1b[32m", // Verde
};
const RESET = "\x1b[0m";

/**
 * Garante que o diretório de logs exista
 */
function ensureLogsDir(): void {
    if (!fs.existsSync(config.logsDir)) {
        fs.mkdirSync(config.logsDir, { recursive: true });
    }
}

/**
 * Formata um timestamp para uso em logs
 */
function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Gera o nome do arquivo de log do dia
 */
function getLogFileName(): string {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return path.join(config.logsDir, `worker-${date}.log`);
}

/**
 * Escreve uma mensagem no console (com cor) e no arquivo de log
 */
function log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = getTimestamp();
    const color = COLORS[level];
    const prefix = `[${timestamp}] [${level}]`;

    // Console (com cores)
    console.log(`${color}${prefix}${RESET} ${message}`);
    if (data) {
        console.log(`${color}  └─${RESET}`, data);
    }

    // Arquivo de log (sem cores)
    ensureLogsDir();
    const logLine = data
        ? `${prefix} ${message} | ${JSON.stringify(data)}\n`
        : `${prefix} ${message}\n`;

    fs.appendFileSync(getLogFileName(), logLine, "utf-8");
}

export const logger = {
    info: (msg: string, data?: unknown) => log("INFO", msg, data),
    warn: (msg: string, data?: unknown) => log("WARN", msg, data),
    error: (msg: string, data?: unknown) => log("ERROR", msg, data),
    success: (msg: string, data?: unknown) => log("SUCCESS", msg, data),
};
