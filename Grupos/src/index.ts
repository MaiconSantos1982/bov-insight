import cron from "node-cron";
import { config } from "./config";
import { logger } from "./logger";
import { executarWorker } from "./worker";
import { runAnalyticsAlertEngine, runAnalyticsIngestionPipeline } from "./analytics";

/**
 * Ponto de entrada do Worker.
 *
 * Modos de execução:
 *   1. --force   → Executa imediatamente (teste/debug)
 *   2. Sem flag  → Agenda via Cron (produção)
 *
 * Exemplos:
 *   npx ts-node src/index.ts --force    # Roda agora
 *   npx ts-node src/index.ts            # Inicia agendador
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const forceRun = args.includes("--force") || args.includes("-f");

    console.log("");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║     🐂  Worker de Cotações - Boi Gordo      ║");
    console.log("║        CEPEA (Físico) + B3 (Futuro)         ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log("");

    if (forceRun) {
        // ── Modo Manual ──────────────────────────────────
        logger.info("🔧 Modo: EXECUÇÃO MANUAL (--force)");
        logger.info("─────────────────────────────────────");

        try {
            await executarWorker();
        } catch (error) {
            logger.error("Worker encerrou com erro.");
            process.exit(1);
        }

        process.exit(0);
    } else {
        // ── Modo Automático (Cron) ───────────────────────
        const schedules = config.cronSchedules;

        logger.info(`⏰ Modo: AGENDADOR (Cron)`);
        logger.info(`📆 Horários configurados: ${schedules.length}`);

        for (const schedule of schedules) {
            if (!cron.validate(schedule)) {
                logger.error(`❌ Expressão Cron inválida: "${schedule}"`);
                process.exit(1);
            }

            cron.schedule(
                schedule,
                async () => {
                    logger.info(`⏰ Cron disparado (${schedule})! Iniciando Worker...`);
                    try {
                        await executarWorker();
                    } catch (error) {
                        logger.error("Worker encerrou com erro nesta execução. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );

            logger.info(`  ✅ Agendado: ${schedule}`);
        }

        if (config.analyticsAlertCron) {
            if (!cron.validate(config.analyticsAlertCron)) {
                logger.error(`❌ ANALYTICS_ALERT_CRON inválido: "${config.analyticsAlertCron}"`);
                process.exit(1);
            }

            cron.schedule(
                config.analyticsAlertCron,
                async () => {
                    logger.info(`⏰ Cron analytics:alertas disparado (${config.analyticsAlertCron})!`);
                    try {
                        await runAnalyticsAlertEngine();
                    } catch (error) {
                        logger.error("Falha no analytics:alertas. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );
            logger.info(`  ✅ Agendado analytics:alertas: ${config.analyticsAlertCron}`);
        } else {
            logger.info("ℹ️ ANALYTICS_ALERT_CRON não definido. Alertas analíticos sem agendamento.");
        }

        if (config.analyticsIngestCron) {
            if (!cron.validate(config.analyticsIngestCron)) {
                logger.error(`❌ ANALYTICS_INGEST_CRON inválido: "${config.analyticsIngestCron}"`);
                process.exit(1);
            }

            cron.schedule(
                config.analyticsIngestCron,
                async () => {
                    logger.info(`⏰ Cron analytics:ingest disparado (${config.analyticsIngestCron})!`);
                    try {
                        await runAnalyticsIngestionPipeline();
                    } catch (error) {
                        logger.error("Falha no analytics:ingest. Continuando agendador...");
                    }
                },
                {
                    timezone: "America/Sao_Paulo",
                }
            );
            logger.info(`  ✅ Agendado analytics:ingest: ${config.analyticsIngestCron}`);
        } else {
            logger.info("ℹ️ ANALYTICS_INGEST_CRON não definido. Ingestão analítica sem agendamento.");
        }

        logger.info(`💡 Para executar manualmente, use: npx ts-node src/index.ts --force`);
        logger.info("─────────────────────────────────────");
        logger.info("⏳ Aguardando próxima execução...");

        // Mantém o processo vivo
        process.on("SIGINT", () => {
            logger.info("🛑 Agendador encerrado pelo usuário (SIGINT).");
            process.exit(0);
        });

        process.on("SIGTERM", () => {
            logger.info("🛑 Agendador encerrado (SIGTERM).");
            process.exit(0);
        });
    }
}

main().catch((err) => {
    console.error("Erro crítico na inicialização:", err);
    process.exit(1);
});
