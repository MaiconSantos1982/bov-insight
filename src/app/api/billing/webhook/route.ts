import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "ATIVA" | "TRIAL" | "INADIMPLENTE" | "CANCELADA" | "EXPIRADA"
type PaymentStatus = "PENDENTE" | "PAGO" | "FALHOU" | "ESTORNADO"

type WebhookPayload = {
  type?: string
  event?: string
  oldStatus?: string
  currentStatus?: string
  product?: {
    id?: string | number
    name?: string
    amount?: number
    period?: number
    type?: string
    method?: string
  }
  contract?: {
    id?: string | number
    status?: string
    start_date?: string
    current_period_end?: string
    created_at?: string
    updated_at?: string
  }
  sale?: {
    id?: string | number
    status?: string
    amount?: number
    method?: string
    created_at?: string
    updated_at?: string
  }
  currentSale?: {
    id?: string | number
    status?: string
    amount?: number
    method?: string
    created_at?: string
    updated_at?: string
  }
  client?: {
    id?: string | number
    email?: string
    cellphone?: string
    name?: string
  }
  lead?: {
    id?: string | number
    email?: string
    cellphone?: string
    name?: string
    step?: number
  }
  id?: string | number
  saleMetas?: Array<{ meta_key?: string; meta_value?: string }>
  productMetas?: Array<{ key?: string; value?: string }>
  proposalMetas?: Array<{ key?: string; value?: string }>
}

function findMetaValue(payload: WebhookPayload, keys: string[]): string | null {
  const normalized = keys.map((k) => k.toLowerCase())
  const sale = payload.saleMetas || []
  const product = payload.productMetas || []
  const proposal = payload.proposalMetas || []

  const pick = (
    arr: Array<{ k?: string; v?: string }>
  ): string | null => {
    for (const item of arr) {
      const key = (item.k || "").toLowerCase()
      if (normalized.includes(key) && item.v && String(item.v).trim()) {
        return String(item.v).trim()
      }
    }
    return null
  }

  return (
    pick(sale.map((i) => ({ k: i.meta_key, v: i.meta_value }))) ||
    pick(product.map((i) => ({ k: i.key, v: i.value }))) ||
    pick(proposal.map((i) => ({ k: i.key, v: i.value })))
  )
}

function normalizePhoneE164(phone: string | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("55")) return `+${digits}`
  return `+55${digits}`
}

function normalizeDateOnly(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function normalizeTimestamp(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function mapContractStatusToBilling(status?: string): BillingStatus {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return "ATIVA"
    case "trialing":
      return "TRIAL"
    case "pending_payment":
    case "unpaid":
      return "INADIMPLENTE"
    case "canceled":
      return "CANCELADA"
    default:
      return "INADIMPLENTE"
  }
}

function mapSaleStatusToBilling(status?: string): BillingStatus {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return "ATIVA"
    case "waiting_payment":
      return "INADIMPLENTE"
    case "refused":
      return "INADIMPLENTE"
    case "refunded":
    case "chargedback":
      return "CANCELADA"
    default:
      return "INADIMPLENTE"
  }
}

function mapSaleStatusToPayment(status?: string): PaymentStatus {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return "PAGO"
    case "waiting_payment":
      return "PENDENTE"
    case "refused":
    case "unpaid":
      return "FALHOU"
    case "refunded":
    case "chargedback":
      return "ESTORNADO"
    default:
      return "PENDENTE"
  }
}

function mapPeriodToCiclo(period?: number): "MENSAL" | "TRIMESTRAL" | "ANUAL" {
  if (period === 12) return "ANUAL"
  if (period === 3) return "TRIMESTRAL"
  return "MENSAL"
}

function extractPaymentRef(payload: WebhookPayload) {
  const sale = payload.sale || payload.currentSale
  return {
    paymentId: sale?.id ? String(sale.id) : null,
    amount: sale?.amount ?? payload.product?.amount ?? null,
    method: sale?.method || payload.product?.method || null,
    status: sale?.status || payload.currentStatus || null,
    paidAt: normalizeTimestamp(sale?.updated_at || sale?.created_at),
  }
}

function buildProviderEventId(payload: WebhookPayload, rawBody: string, provider: string): string {
  const type = payload.type || "unknown_type"
  const event = payload.event || "unknown_event"
  const saleId = payload.sale?.id || payload.currentSale?.id
  const contractId = payload.contract?.id
  const leadId = payload.lead?.id
  const updatedAt =
    payload.contract?.updated_at ||
    payload.sale?.updated_at ||
    payload.currentSale?.updated_at ||
    payload.currentStatus ||
    ""

  const natural =
    payload.id ||
    (saleId ? `sale:${saleId}:${updatedAt}` : null) ||
    (contractId ? `contract:${contractId}:${updatedAt}` : null) ||
    (leadId ? `lead:${leadId}:${updatedAt}` : null)

  if (natural) return String(natural)

  const hash = crypto
    .createHash("sha256")
    .update(`${provider}|${type}|${event}|${rawBody}`)
    .digest("hex")
    .slice(0, 32)

  return `${type}:${event}:${hash}`
}

async function findUsuarioIdByClient(
  supabaseAdmin: any,
  payload: WebhookPayload
): Promise<string | null> {
  const emailFromMeta = findMetaValue(payload, ["email", "user_email", "cliente_email"])
  const phoneFromMeta = findMetaValue(payload, ["telefone", "phone", "whatsapp", "telefone_whatsapp"])
  const email = (payload.client?.email || payload.lead?.email || emailFromMeta || "").trim().toLowerCase() || null
  const phone = normalizePhoneE164(payload.client?.cellphone || payload.lead?.cellphone || phoneFromMeta || undefined)

  if (email) {
    const { data, error } = await supabaseAdmin
      .from("boigordo_usuarios_perfil")
      .select("usuario_id")
      .eq("email", email)
      .maybeSingle()
    if (error) throw new Error(`Falha ao buscar usuário por email: ${error.message}`)
    if (data?.usuario_id) return data.usuario_id
  }

  if (phone) {
    const { data, error } = await supabaseAdmin
      .from("boigordo_usuarios_perfil")
      .select("usuario_id")
      .eq("telefone_whatsapp", phone)
      .maybeSingle()
    if (error) throw new Error(`Falha ao buscar usuário por telefone: ${error.message}`)
    if (data?.usuario_id) return data.usuario_id
  }

  return null
}

function buildFallbackPhoneE164(payload: WebhookPayload): string {
  const seed =
    String(payload.client?.id || "") ||
    String(payload.lead?.id || "") ||
    String(payload.sale?.id || payload.currentSale?.id || "") ||
    String(payload.contract?.id || "") ||
    String(payload.id || "") ||
    crypto.randomUUID()

  const digits = crypto.createHash("sha256").update(seed).digest("hex").replace(/\D/g, "").slice(0, 8)
  return `+5500000${digits.padEnd(8, "0")}`
}

async function upsertUsuarioPerfilFromWebhook(
  supabaseAdmin: any,
  payload: WebhookPayload
): Promise<string | null> {
  const emailFromMeta = findMetaValue(payload, ["email", "user_email", "cliente_email"])
  const phoneFromMeta = findMetaValue(payload, ["telefone", "phone", "whatsapp", "telefone_whatsapp"])
  const email = (payload.client?.email || payload.lead?.email || emailFromMeta || "").trim().toLowerCase() || null
  const phoneRaw = payload.client?.cellphone || payload.lead?.cellphone || phoneFromMeta || undefined
  const phone = normalizePhoneE164(phoneRaw) || (email ? buildFallbackPhoneE164(payload) : null)
  const nome = (payload.client?.name || payload.lead?.name || "Cliente")?.trim() || "Cliente"

  if (!phone && !email) return null

  // Se já existir por email/telefone, reutiliza.
  const usuarioExistente = await findUsuarioIdByClient(supabaseAdmin, payload)
  if (usuarioExistente) {
    const updatePayload: Record<string, unknown> = { nome }
    if (email) updatePayload.email = email
    if (phone) {
      updatePayload.telefone_whatsapp = phone
      if (!phoneRaw) updatePayload.observacoes = "Webhook: telefone fallback gerado automaticamente."
    }
    const { error: updateError } = await supabaseAdmin
      .from("boigordo_usuarios_perfil")
      .update(updatePayload)
      .eq("usuario_id", usuarioExistente)
    if (updateError) throw new Error(`Falha ao atualizar perfil existente: ${updateError.message}`)
    return usuarioExistente
  }

  if (!phone) return null

  const usuarioId = crypto.randomUUID()

  const { error } = await supabaseAdmin.from("boigordo_usuarios_perfil").insert({
    usuario_id: usuarioId,
    nome,
    email,
    telefone_whatsapp: phone,
    status: "ATIVO",
    papeis_mercado: [],
    etapas_operacao: [],
    dados_questionario: {},
    observacoes: phoneRaw ? null : "Webhook: telefone fallback gerado automaticamente.",
  })

  if (error) {
    // Em caso de corrida, tenta buscar novamente.
    const retry = await findUsuarioIdByClient(supabaseAdmin, payload)
    if (retry) return retry
    throw new Error(`Falha ao criar usuário no perfil: ${error.message}`)
  }

  return usuarioId
}

async function upsertAssinaturaFromWebhook(
  supabaseAdmin: any,
  payload: WebhookPayload,
  usuarioId: string
): Promise<{ assinaturaId: string | null; statusNovo: BillingStatus }> {
  const type = (payload.type || "").toLowerCase()
  const isContract = type === "contract"

  const statusNovo = isContract
    ? mapContractStatusToBilling(payload.currentStatus || payload.contract?.status)
    : mapSaleStatusToBilling(payload.currentStatus || payload.sale?.status)

  const gatewaySubscriptionId =
    payload.contract?.id !== undefined
      ? String(payload.contract.id)
      : payload.sale?.id !== undefined
        ? String(payload.sale.id)
        : payload.currentSale?.id !== undefined
          ? String(payload.currentSale.id)
          : null

  const dataInicio = normalizeDateOnly(payload.contract?.start_date) || new Date().toISOString().slice(0, 10)
  const proximoVencimento =
    normalizeDateOnly(payload.contract?.current_period_end) ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const assinaturaPayload = {
    usuario_id: usuarioId,
    plano: payload.product?.name || "PRO",
    status: statusNovo,
    ciclo: mapPeriodToCiclo(payload.product?.period),
    valor: payload.product?.amount ?? null,
    moeda: "BRL",
    data_inicio: dataInicio,
    proximo_vencimento: proximoVencimento,
    gateway: "PAYMENT_WEBHOOK",
    gateway_subscription_id: gatewaySubscriptionId,
    metodo_pagamento_mask: payload.sale?.method || payload.currentSale?.method || payload.product?.method || null,
    ultimo_pagamento_at: normalizeTimestamp(payload.sale?.updated_at || payload.currentSale?.updated_at),
  }

  // Busca por subscription id do gateway (preferencial)
  if (gatewaySubscriptionId) {
    const { data: existingByGateway, error: findGatewayError } = await supabaseAdmin
      .from("boigordo_assinaturas")
      .select("id, status")
      .eq("gateway", "PAYMENT_WEBHOOK")
      .eq("gateway_subscription_id", gatewaySubscriptionId)
      .maybeSingle()
    if (findGatewayError) throw new Error(`Falha ao buscar assinatura por gateway: ${findGatewayError.message}`)

    if (existingByGateway?.id) {
      const { error: updateGatewayError } = await supabaseAdmin
        .from("boigordo_assinaturas")
        .update(assinaturaPayload)
        .eq("id", existingByGateway.id)
      if (updateGatewayError) throw new Error(`Falha ao atualizar assinatura por gateway: ${updateGatewayError.message}`)
      return { assinaturaId: existingByGateway.id, statusNovo }
    }
  }

  // Fallback por usuario
  const { data: existingByUser, error: findUserSubscriptionError } = await supabaseAdmin
    .from("boigordo_assinaturas")
    .select("id")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (findUserSubscriptionError) throw new Error(`Falha ao buscar assinatura por usuário: ${findUserSubscriptionError.message}`)

  if (existingByUser?.id) {
    const { error: updateUserSubscriptionError } = await supabaseAdmin
      .from("boigordo_assinaturas")
      .update(assinaturaPayload)
      .eq("id", existingByUser.id)
    if (updateUserSubscriptionError) {
      throw new Error(`Falha ao atualizar assinatura por usuário: ${updateUserSubscriptionError.message}`)
    }
    return { assinaturaId: existingByUser.id, statusNovo }
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("boigordo_assinaturas")
    .insert(assinaturaPayload)
    .select("id")
    .single()

  if (insertError) {
    throw new Error(`Falha ao criar assinatura: ${insertError.message}`)
  }

  return { assinaturaId: inserted.id, statusNovo }
}

async function insertPagamentoHistoricoFromWebhook(
  supabaseAdmin: any,
  payload: WebhookPayload,
  assinaturaId: string,
  usuarioId: string
) {
  const payment = extractPaymentRef(payload)
  if (payment.amount === null || payment.paymentId === null) return

  const competencia =
    normalizeDateOnly(payload.contract?.current_period_end) ||
    normalizeDateOnly(payload.sale?.updated_at) ||
    new Date().toISOString().slice(0, 10)

  const status = mapSaleStatusToPayment(payment.status || undefined)

  const { data: exists, error: existsError } = await supabaseAdmin
    .from("boigordo_pagamentos_historico")
    .select("id")
    .eq("gateway_payment_id", payment.paymentId)
    .maybeSingle()
  if (existsError) throw new Error(`Falha ao verificar pagamento existente: ${existsError.message}`)

  if (exists?.id) return

  const { error } = await supabaseAdmin.from("boigordo_pagamentos_historico").insert({
    assinatura_id: assinaturaId,
    usuario_id: usuarioId,
    competencia,
    valor: payment.amount,
    moeda: "BRL",
    status,
    metodo_pagamento: payment.method,
    gateway_payment_id: payment.paymentId,
    pago_em: status === "PAGO" ? payment.paidAt : null,
    detalhes: payload,
  })

  if (error) throw new Error(`Falha ao inserir pagamento: ${error.message}`)
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const provider = process.env.BILLING_WEBHOOK_PROVIDER || "pagamentos"
  const webhookToken = process.env.BILLING_WEBHOOK_TOKEN

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." },
      { status: 500 }
    )
  }
  if (!webhookToken) {
    return NextResponse.json({ ok: false, error: "BILLING_WEBHOOK_TOKEN é obrigatório." }, { status: 500 })
  }

  const tokenFromHeader = req.headers.get("x-webhook-token")
  const tokenFromQuery =
    req.nextUrl.searchParams.get("token") ||
    req.nextUrl.searchParams.get("webhook_token") ||
    req.nextUrl.searchParams.get("key")
  const tokenReceived = tokenFromHeader || tokenFromQuery
  if (tokenReceived !== webhookToken) {
    return NextResponse.json({ ok: false, error: "Webhook token inválido." }, { status: 401 })
  }

  const rawBody = await req.text()
  if (!rawBody.trim()) {
    return NextResponse.json({ ok: true, test: true, message: "Webhook autenticado (ping sem payload)." })
  }
  let payload: WebhookPayload

  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({
      ok: true,
      test: true,
      message: "Webhook autenticado (payload não-JSON aceito para teste).",
    })
  }

  const eventType = `${payload.type || "unknown"}.${payload.event || "unknown"}`
  const providerEventId = buildProviderEventId(payload, rawBody, provider)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existingEvent, error: existingEventError } = await supabaseAdmin
    .from("boigordo_billing_eventos")
    .select("id, status_processamento, usuario_id, assinatura_id")
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .maybeSingle()
  if (existingEventError) {
    return NextResponse.json({ ok: false, error: `Falha ao consultar evento existente: ${existingEventError.message}` }, { status: 500 })
  }

  if (existingEvent?.id) {
    // Se o evento já existia, mas sem vínculo de usuário/assinatura,
    // tentamos reprocessar para completar o cadastro.
    if (!existingEvent.usuario_id || !existingEvent.assinatura_id) {
      try {
        const usuarioId = await upsertUsuarioPerfilFromWebhook(supabaseAdmin, payload)
        let assinaturaId: string | null = existingEvent.assinatura_id
        let statusNovo: BillingStatus | null = null

        if (usuarioId) {
          const assinaturaResult = await upsertAssinaturaFromWebhook(supabaseAdmin, payload, usuarioId)
          assinaturaId = assinaturaResult.assinaturaId
          statusNovo = assinaturaResult.statusNovo

          if (assinaturaId) {
            await insertPagamentoHistoricoFromWebhook(supabaseAdmin, payload, assinaturaId, usuarioId)
          }

          const { error: assinaturaEventoError } = await supabaseAdmin.from("boigordo_assinaturas_eventos").insert({
            assinatura_id: assinaturaId,
            usuario_id: usuarioId,
            evento: eventType,
            status_anterior: payload.oldStatus || null,
            status_novo: statusNovo,
            origem: "WEBHOOK",
            detalhes: payload,
          })
          if (assinaturaEventoError) {
            throw new Error(`Falha ao registrar histórico de assinatura (duplicado): ${assinaturaEventoError.message}`)
          }
        }

        const { error: updateBillingEventError } = await supabaseAdmin
          .from("boigordo_billing_eventos")
          .update({
            usuario_id: usuarioId,
            assinatura_id: assinaturaId,
            status_processamento: "PROCESSADO",
            processed_at: new Date().toISOString(),
            erro: usuarioId ? null : "Reprocessado sem vínculo (faltou email/telefone válido no payload).",
          })
          .eq("id", existingEvent.id)
        if (updateBillingEventError) {
          throw new Error(`Falha ao atualizar evento reprocessado: ${updateBillingEventError.message}`)
        }

        return NextResponse.json({
          ok: true,
          duplicate: true,
          reprocessed: true,
          event_type: eventType,
          provider_event_id: providerEventId,
          usuario_id: usuarioId,
          assinatura_id: assinaturaId,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const { error: markFailedError } = await supabaseAdmin
          .from("boigordo_billing_eventos")
          .update({
            status_processamento: "FALHA",
            erro: message,
            processed_at: new Date().toISOString(),
          })
          .eq("id", existingEvent.id)
        if (markFailedError) {
          return NextResponse.json(
            { ok: false, error: `${message} | Falha ao marcar evento como FALHA: ${markFailedError.message}` },
            { status: 500 }
          )
        }
        return NextResponse.json({ ok: false, duplicate: true, error: message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      duplicate: true,
      event_type: eventType,
      provider_event_id: providerEventId,
      usuario_id: existingEvent.usuario_id,
      assinatura_id: existingEvent.assinatura_id,
    })
  }

  const { data: billingEvent, error: eventError } = await supabaseAdmin
    .from("boigordo_billing_eventos")
    .insert({
      provider,
      provider_event_id: providerEventId,
      event_type: eventType,
      payload,
      status_processamento: "PENDENTE",
    })
    .select("id, status_processamento")
    .single()

  if (eventError || !billingEvent?.id) {
    return NextResponse.json(
      { ok: false, error: `Falha ao registrar evento: ${eventError?.message || "sem id"}` },
      { status: 500 }
    )
  }

  try {
    const usuarioId = await upsertUsuarioPerfilFromWebhook(supabaseAdmin, payload)
    let assinaturaId: string | null = null
    let statusNovo: BillingStatus | null = null

    if (usuarioId) {
      const assinaturaResult = await upsertAssinaturaFromWebhook(supabaseAdmin, payload, usuarioId)
      assinaturaId = assinaturaResult.assinaturaId
      statusNovo = assinaturaResult.statusNovo

      if (assinaturaId) {
        await insertPagamentoHistoricoFromWebhook(supabaseAdmin, payload, assinaturaId, usuarioId)
      }

      const { error: assinaturaEventoError } = await supabaseAdmin.from("boigordo_assinaturas_eventos").insert({
        assinatura_id: assinaturaId,
        usuario_id: usuarioId,
        evento: eventType,
        status_anterior: payload.oldStatus || null,
        status_novo: statusNovo,
        origem: "WEBHOOK",
        detalhes: payload,
      })
      if (assinaturaEventoError) {
        throw new Error(`Falha ao registrar histórico de assinatura: ${assinaturaEventoError.message}`)
      }
    }

    const { error: updateBillingEventError } = await supabaseAdmin
      .from("boigordo_billing_eventos")
      .update({
        usuario_id: usuarioId,
        assinatura_id: assinaturaId,
        status_processamento: "PROCESSADO",
        tentativas: 1,
        processed_at: new Date().toISOString(),
        erro: usuarioId ? null : "Evento processado sem vínculo de usuário (faltou email/telefone válido no payload).",
      })
      .eq("id", billingEvent.id)
    if (updateBillingEventError) {
      throw new Error(`Falha ao atualizar status do evento de billing: ${updateBillingEventError.message}`)
    }

    return NextResponse.json({
      ok: true,
      event_type: eventType,
      provider_event_id: providerEventId,
      usuario_id: usuarioId,
      assinatura_id: assinaturaId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    const { error: markFailedError } = await supabaseAdmin
      .from("boigordo_billing_eventos")
      .update({
        status_processamento: "FALHA",
        tentativas: 1,
        erro: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", billingEvent.id)
    if (markFailedError) {
      return NextResponse.json(
        { ok: false, error: `${message} | Falha ao marcar evento como FALHA: ${markFailedError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/billing/webhook",
    method: "POST",
    auth_header: "x-webhook-token (opcional quando usar query string)",
    auth_query: "token=<BILLING_WEBHOOK_TOKEN> (ou webhook_token / key)",
  })
}
