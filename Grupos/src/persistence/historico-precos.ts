import { config } from "../config";
import { logger } from "../logger";

export type ProdutoHistorico = "boi_gordo" | "bezerro" | "milho" | "soja";

export interface HistoricoPrecoInput {
    produto: ProdutoHistorico;
    dataReferencia: string;
    valorBrl: number | null;
    valorUsd: number | null;
}

interface HistoricoPrecoPayload {
    data: string;
    produto: ProdutoHistorico;
    valor_brl: number;
    valor_usd: number;
}

function garantirSupabaseConfigurado(): void {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
        throw new Error(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para persistir histórico de preços."
        );
    }
}

function normalizarDataParaIso(data: string): string {
    const texto = data.trim();
    const matchBr = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (matchBr) {
        const [, dd, mm, yyyy] = matchBr;
        return `${yyyy}-${mm}-${dd}`;
    }

    const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchIso) {
        return texto;
    }

    throw new Error(`Data de referência inválida para histórico: "${data}"`);
}

function toPayload(input: HistoricoPrecoInput): HistoricoPrecoPayload | null {
    if (input.valorBrl == null || Number.isNaN(input.valorBrl)) {
        return null;
    }
    if (input.valorUsd == null || Number.isNaN(input.valorUsd)) {
        return null;
    }

    return {
        data: normalizarDataParaIso(input.dataReferencia),
        produto: input.produto,
        valor_brl: input.valorBrl,
        valor_usd: input.valorUsd,
    };
}

async function restRequest(
    pathWithQuery: string,
    method: "DELETE" | "POST",
    body?: unknown
): Promise<void> {
    const response = await fetch(`${config.supabase.url}/rest/v1${pathWithQuery}`, {
        method,
        headers: {
            apikey: config.supabase.serviceRoleKey,
            Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            Prefer: "return=minimal",
            "Accept-Profile": config.supabase.schema,
            "Content-Profile": config.supabase.schema,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(
            `Falha REST ${method} ${pathWithQuery}: HTTP ${response.status} - ${txt}`
        );
    }
}

export async function persistirHistoricoPrecos(
    entradas: HistoricoPrecoInput[]
): Promise<{ processados: number; persistidos: number; ignorados: number }> {
    garantirSupabaseConfigurado();

    const payloads = entradas
        .map((item) => toPayload(item))
        .filter((item): item is HistoricoPrecoPayload => item !== null);

    for (const row of payloads) {
        const deleteQuery = `/boigordo_historico?produto=eq.${row.produto}&data=eq.${row.data}`;
        await restRequest(deleteQuery, "DELETE");
        await restRequest("/boigordo_historico", "POST", [row]);
    }

    const ignorados = entradas.length - payloads.length;
    if (ignorados > 0) {
        logger.warn(
            `⚠️ Histórico de preços: ${ignorados} registro(s) ignorado(s) por dados incompletos (BRL/USD).`
        );
    }

    logger.info(
        `📚 Histórico de preços atualizado: ${payloads.length}/${entradas.length} registro(s).`
    );

    return {
        processados: entradas.length,
        persistidos: payloads.length,
        ignorados,
    };
}
