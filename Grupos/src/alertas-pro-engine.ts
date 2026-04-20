import { config } from "./config";
import { logger } from "./logger";
import { sendAlertaProToPhone } from "./messaging";
import {
    buscarUltimosHistoricosPorProduto,
    ProdutoHistorico,
} from "./persistence/historico-precos";

type CondicaoRegra = "acima_de" | "abaixo_de" | "variacao_pct";

interface AlertaProRegraRow {
    id: string;
    usuario_id: string;
    produto: ProdutoHistorico;
    condicao: CondicaoRegra;
    valor_gatilho: number;
    ativo: boolean;
}

interface AlertaProDestinoRow {
    id: string;
    usuario_id: string;
    telefone_destino: string;
    ativo: boolean;
}

function garantirSupabaseConfigurado(): void {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
        throw new Error(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para executar alertas pro."
        );
    }
}

async function restRequest(
    pathWithQuery: string,
    method: "GET" | "POST" | "PATCH",
    body?: unknown
): Promise<Response> {
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

    return response;
}

async function fetchRegrasAtivas(): Promise<AlertaProRegraRow[]> {
    const response = await restRequest(
        "/boigordo_alertas_pro_regras?select=id,usuario_id,produto,condicao,valor_gatilho,ativo&ativo=eq.true&order=created_at.asc&limit=1000",
        "GET"
    );
    const rows = (await response.json()) as Array<{
        id: string;
        usuario_id: string;
        produto: ProdutoHistorico;
        condicao: CondicaoRegra;
        valor_gatilho: number | string;
        ativo: boolean;
    }>;

    return rows.map((row) => ({
        ...row,
        valor_gatilho: Number(row.valor_gatilho),
    }));
}

async function fetchDestinosAtivos(): Promise<AlertaProDestinoRow[]> {
    const response = await restRequest(
        "/boigordo_alertas_pro_destinos?select=id,usuario_id,telefone_destino,ativo&ativo=eq.true&order=created_at.asc&limit=1000",
        "GET"
    );
    return (await response.json()) as AlertaProDestinoRow[];
}

async function registrarEnvio(params: {
    usuarioId: string;
    telefoneDestino: string;
    status: "ENVIADO" | "FALHA";
    providerMessageId?: string | null;
    contexto: Record<string, unknown>;
}): Promise<void> {
    await restRequest("/boigordo_alertas_pro_envios", "POST", [
        {
            usuario_id: params.usuarioId,
            telefone_destino: params.telefoneDestino,
            mensagem_tipo: "ALERTA_PRO",
            status: params.status,
            custo_estimado_brl: 0,
            provider_message_id: params.providerMessageId || null,
            contexto: params.contexto,
        },
    ]);
}

async function desativarRegra(regraId: string): Promise<void> {
    await restRequest(`/boigordo_alertas_pro_regras?id=eq.${regraId}`, "PATCH", {
        ativo: false,
        ultimo_disparo: new Date().toISOString(),
    });
}

async function insertExecucaoLog(params: {
    status: "SUCESSO" | "FALHA" | "INICIADO";
    mensagem: string;
    contexto?: Record<string, unknown>;
    startedAt?: string;
    finishedAt?: string;
    duracaoMs?: number;
}): Promise<void> {
    await restRequest("/boigordo_execucoes_logs", "POST", [
        {
            origem: "Grupos",
            tipo: "alertas-pro",
            status: params.status,
            mensagem: params.mensagem,
            contexto: params.contexto || {},
            started_at: params.startedAt || null,
            finished_at: params.finishedAt || null,
            duracao_ms: params.duracaoMs || null,
        },
    ]);
}

function formatValorBrl(valor: number): string {
    return valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDataBr(dataIso: string): string {
    return new Date(`${dataIso}T00:00:00Z`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
    });
}

function nomeProduto(produto: ProdutoHistorico): string {
    const map: Record<ProdutoHistorico, string> = {
        boi_gordo: "Boi Gordo",
        bezerro: "Bezerro",
        milho: "Milho",
        soja: "Soja",
    };
    return map[produto];
}

function avaliarRegra(params: {
    condicao: CondicaoRegra;
    valorAtual: number;
    valorGatilho: number;
}): boolean {
    const { condicao, valorAtual, valorGatilho } = params;
    if (condicao === "acima_de") {
        return valorAtual >= valorGatilho;
    }
    if (condicao === "abaixo_de") {
        return valorAtual <= valorGatilho;
    }
    return false;
}

function montarMensagemAlerta(params: {
    produto: ProdutoHistorico;
    condicao: CondicaoRegra;
    valorAtual: number;
    valorGatilho: number;
    dataReferencia: string;
}): string {
    const condicaoTexto =
        params.condicao === "acima_de"
            ? "acima de"
            : params.condicao === "abaixo_de"
                ? "abaixo de"
                : "variação";

    return [
        "🚨 *Alerta Pro Disparado*",
        "",
        `*Produto:* ${nomeProduto(params.produto)}`,
        `*Condição:* ${condicaoTexto} R$ ${formatValorBrl(params.valorGatilho)}`,
        `*Preço atual:* R$ ${formatValorBrl(params.valorAtual)}`,
        `*Data de referência:* ${formatDataBr(params.dataReferencia)}`,
        "",
        "_Este alerta foi desativado automaticamente após o disparo._",
    ].join("\n");
}

export async function runAlertasProEngine(): Promise<{
    regrasAtivas: number;
    avaliadas: number;
    disparadas: number;
    desativadas: number;
    falhasEnvio: number;
    semDestino: number;
}> {
    garantirSupabaseConfigurado();

    const startedAt = new Date();
    await insertExecucaoLog({
        status: "INICIADO",
        mensagem: "Engine de alertas pro iniciado.",
        startedAt: startedAt.toISOString(),
    });
    logger.info("[alertas-pro] iniciando avaliação de gatilhos");

    try {
        const [regrasAtivas, destinosAtivos, ultimosPrecos] = await Promise.all([
            fetchRegrasAtivas(),
            fetchDestinosAtivos(),
            buscarUltimosHistoricosPorProduto(["boi_gordo", "bezerro", "milho", "soja"]),
        ]);

        let avaliadas = 0;
        let disparadas = 0;
        let desativadas = 0;
        let falhasEnvio = 0;
        let semDestino = 0;

        const destinosPorUsuario = new Map<string, AlertaProDestinoRow[]>();
        for (const destino of destinosAtivos) {
            const lista = destinosPorUsuario.get(destino.usuario_id) || [];
            lista.push(destino);
            destinosPorUsuario.set(destino.usuario_id, lista);
        }

        for (const regra of regrasAtivas) {
            avaliadas += 1;

            if (regra.condicao === "variacao_pct") {
                logger.warn(
                    `[alertas-pro] regra ${regra.id} ignorada: condicao variacao_pct sem suporte no worker atual.`
                );
                continue;
            }

            const precoAtual = ultimosPrecos[regra.produto];
            if (!precoAtual) {
                continue;
            }

            const atingiu = avaliarRegra({
                condicao: regra.condicao,
                valorAtual: precoAtual.valorBrl,
                valorGatilho: regra.valor_gatilho,
            });

            if (!atingiu) {
                continue;
            }

            const destinosUsuario = destinosPorUsuario.get(regra.usuario_id) || [];
            if (!destinosUsuario.length) {
                semDestino += 1;
                continue;
            }

            const mensagem = montarMensagemAlerta({
                produto: regra.produto,
                condicao: regra.condicao,
                valorAtual: precoAtual.valorBrl,
                valorGatilho: regra.valor_gatilho,
                dataReferencia: precoAtual.data,
            });

            let enviouAoMenosUm = false;
            for (const destino of destinosUsuario) {
                const envio = await sendAlertaProToPhone(destino.telefone_destino, mensagem);
                await registrarEnvio({
                    usuarioId: regra.usuario_id,
                    telefoneDestino: destino.telefone_destino,
                    status: envio.ok ? "ENVIADO" : "FALHA",
                    providerMessageId: envio.providerMessageId,
                    contexto: {
                        regra_id: regra.id,
                        produto: regra.produto,
                        condicao: regra.condicao,
                        valor_gatilho: regra.valor_gatilho,
                        valor_atual: precoAtual.valorBrl,
                        data_referencia: precoAtual.data,
                        erro: envio.error,
                    },
                });
                if (envio.ok) {
                    enviouAoMenosUm = true;
                } else {
                    falhasEnvio += 1;
                }
            }

            if (enviouAoMenosUm) {
                disparadas += 1;
                await desativarRegra(regra.id);
                desativadas += 1;
            }
        }

        const finishedAt = new Date();
        const result = {
            regrasAtivas: regrasAtivas.length,
            avaliadas,
            disparadas,
            desativadas,
            falhasEnvio,
            semDestino,
        };

        await insertExecucaoLog({
            status: "SUCESSO",
            mensagem: "Engine de alertas pro concluído.",
            contexto: result,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            duracaoMs: finishedAt.getTime() - startedAt.getTime(),
        });

        logger.success("[alertas-pro] concluído", result);
        return result;
    } catch (error) {
        const finishedAt = new Date();
        const message = error instanceof Error ? error.message : String(error);
        await insertExecucaoLog({
            status: "FALHA",
            mensagem: message,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            duracaoMs: finishedAt.getTime() - startedAt.getTime(),
        });
        throw error;
    }
}
