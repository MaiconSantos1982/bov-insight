import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
    // Supabase (Analytics workers)
    supabase: {
        url: process.env.SUPABASE_URL || "",
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        schema: process.env.SUPABASE_SCHEMA || "public",
    },

    // Analytics source endpoints (JSON arrays)
    analyticsSources: {
        cicloPecuarioUrl: process.env.ANALYTICS_CICLO_URL || "",
        baseRegionalUrl: process.env.ANALYTICS_BASE_REGIONAL_URL || "",
        escalaAbateUrl: process.env.ANALYTICS_ESCALA_ABATE_URL || "",
        exportacaoUrl: process.env.ANALYTICS_EXPORTACAO_URL || "",
    },
    analyticsAlertRules: {
        chinaThresholdPct: Number(process.env.ANALYTICS_ALERT_CHINA_THRESHOLD_PCT || 70),
    },
    analyticsAlertCron: process.env.ANALYTICS_ALERT_CRON || "",
    analyticsIngestCron: process.env.ANALYTICS_INGEST_CRON || "",
    analyticsIngestLookbackMonths: {
        ciclo: Number(process.env.ANALYTICS_CICLO_LOOKBACK_MONTHS || 24),
        base: Number(process.env.ANALYTICS_BASE_LOOKBACK_MONTHS || 6),
        escala: Number(process.env.ANALYTICS_ESCALA_LOOKBACK_MONTHS || 3),
        exportacao: Number(process.env.ANALYTICS_EXPORTACAO_LOOKBACK_MONTHS || 24),
    },

    // Pastorini API
    pastorini: {
        baseUrl: process.env.PASTORINI_BASE_URL || "",
        apiKey: process.env.PASTORINI_API_KEY || "",
        instance: process.env.PASTORINI_INSTANCE || "",
        id: process.env.PASTORINI_ID || "",
    },

    // WhatsApp
    whatsapp: {
        groupId: process.env.WHATSAPP_GROUP_ID || "",
    },

    // Cron (múltiplos horários separados por vírgula)
    cronSchedules: (process.env.CRON_SCHEDULE || "0 5 * * *,0 10 * * *")
        .split(",")
        .map((s) => s.trim()),

    // Browser
    headless: process.env.HEADLESS !== "false",

    // Segurança
    security: {
        execToken: process.env.EXEC_TOKEN || "",
    },

    // URLs de Scraping
    urls: {
        cepea: "https://cepea.org.br/br/indicador/boi-gordo.aspx",
        cepeaBezerro: "https://cepea.org.br/br/indicador/bezerro.aspx",
        cepeaMilho: "https://cepea.org.br/br/indicador/milho.aspx",
        cepeaSoja: "https://cepea.org.br/br/indicador/soja.aspx",
        tradingView: "https://br.tradingview.com/symbols/BMFBOVESPA-BGI1!/",
        datagroLivestock:
            "https://precos.api.datagro.com/paginas/?mercado=5&minihome=&pos=1&idioma=pt-br",
    },

    // Logs
    logsDir: path.resolve(__dirname, "../logs"),
};
