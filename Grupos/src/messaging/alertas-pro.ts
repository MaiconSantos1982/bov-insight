import axios, { AxiosError } from "axios";
import { config } from "../config";
import { logger } from "../logger";

export interface AlertaProSendResult {
    ok: boolean;
    providerMessageId: string | null;
    error: string | null;
}

function toJid(telefoneOuJid: string): string {
    const valor = telefoneOuJid.trim();
    if (valor.includes("@")) {
        return valor;
    }
    const digitos = valor.replace(/\D/g, "");
    return `${digitos}@s.whatsapp.net`;
}

export async function sendAlertaProToPhone(
    telefoneOuJid: string,
    mensagem: string
): Promise<AlertaProSendResult> {
    const { baseUrl, apiKey, instance } = config.pastorini;

    if (!baseUrl || !apiKey || !instance) {
        const error = "Credenciais da Pastorini API não configuradas.";
        logger.warn(`⚠️ ${error}`);
        return { ok: false, providerMessageId: null, error };
    }

    const url = `${baseUrl}/api/instances/${instance}/send-text`;
    const payload = {
        jid: toJid(telefoneOuJid),
        text: mensagem,
        delay: 1200,
        linkPreview: false,
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            timeout: 15000,
        });

        const providerMessageId =
            response.data?.messageId ||
            response.data?.data?.messageId ||
            response.data?.id ||
            null;

        return {
            ok: true,
            providerMessageId:
                typeof providerMessageId === "string" ? providerMessageId : null,
            error: null,
        };
    } catch (error) {
        if (error instanceof AxiosError) {
            const status = error.response?.status;
            const body = error.response?.data;
            const msg = `Falha no envio WhatsApp (status=${status ?? "n/a"}).`;
            logger.error("❌ Falha ao enviar alerta pro", {
                status,
                data: body,
                message: error.message,
            });
            return { ok: false, providerMessageId: null, error: msg };
        }

        const msg = error instanceof Error ? error.message : String(error);
        logger.error("❌ Falha inesperada no envio de alerta pro", { message: msg });
        return { ok: false, providerMessageId: null, error: msg };
    }
}
