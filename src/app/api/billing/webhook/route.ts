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
  const email = payload.client?.email || payload.lead?.email
  const phone = normalizePhoneE164(payload.client?.cellphone || payload.lead?.cellphone)

  if (email) {
    const { data } = await supabaseAdmin
      .from("boigordo_usuarios_perfil")
      .select("usuario_id")
      .eq("email", email)
      .maybeSingle()
    if (data?.usuario_id) return data.usuario_id
  }

  if (phone) {
    const { data } = await supabaseAdmin
      .from("boigordo_usuarios_perfil")
      .select("usuario_id")
      .eq("telefone_whatsapp", phone)
      .maybeSingle()
    if (data?.usuario_id) return data.usuario_id
  }

  return null
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
    const { data: existingByGateway } = await supabaseAdmin
      .from("boigordo_assinaturas")
      .select("id, status")
      .eq("gateway", "PAYMENT_WEBHOOK")
      .eq("gateway_subscription_id", gatewaySubscriptionId)
      .maybeSingle()

    if (existingByGateway?.id) {
      await supabaseAdmin.from("boigordo_assinaturas").update(assinaturaPayload).eq("id", existingByGateway.id)
      return { assinaturaId: existingByGateway.id, statusNovo }
    }
  }

  // Fallback por usuario
  const { data: existingByUser } = await supabaseAdmin
    .from("boigordo_assinaturas")
    .select("id")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingByUser?.id) {
    await supabaseAdmin.from("boigordo_assinaturas").update(assinaturaPayload).eq("id", existingByUser.id)
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

  const { data: exists } = await supabaseAdmin
    .from("boigordo_pagamentos_historico")
    .select("id")
    .eq("gateway_payment_id", payment.paymentId)
    .maybeSingle()

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

  const tokenReceived = req.headers.get("x-webhook-token")
  if (webhookToken && tokenReceived !== webhookToken) {
    return NextResponse.json({ ok: false, error: "Webhook token inválido." }, { status: 401 })
  }

  const rawBody = await req.text()
  let payload: WebhookPayload

  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({ ok: false, error: "Payload JSON inválido." }, { status: 400 })
  }

  const eventType = `${payload.type || "unknown"}.${payload.event || "unknown"}`
  const providerEventId = buildProviderEventId(payload, rawBody, provider)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existingEvent } = await supabaseAdmin
    .from("boigordo_billing_eventos")
    .select("id, status_processamento, usuario_id, assinatura_id")
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .maybeSingle()

  if (existingEvent?.id) {
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
    const usuarioId = await findUsuarioIdByClient(supabaseAdmin, payload)
    let assinaturaId: string | null = null
    let statusNovo: BillingStatus | null = null

    if (usuarioId) {
      const assinaturaResult = await upsertAssinaturaFromWebhook(supabaseAdmin, payload, usuarioId)
      assinaturaId = assinaturaResult.assinaturaId
      statusNovo = assinaturaResult.statusNovo

      if (assinaturaId) {
        await insertPagamentoHistoricoFromWebhook(supabaseAdmin, payload, assinaturaId, usuarioId)
      }

      await supabaseAdmin.from("boigordo_assinaturas_eventos").insert({
        assinatura_id: assinaturaId,
        usuario_id: usuarioId,
        evento: eventType,
        status_anterior: payload.oldStatus || null,
        status_novo: statusNovo,
        origem: "WEBHOOK",
        detalhes: payload,
      })
    }

    await supabaseAdmin
      .from("boigordo_billing_eventos")
      .update({
        usuario_id: usuarioId,
        assinatura_id: assinaturaId,
        status_processamento: "PROCESSADO",
        tentativas: 1,
        processed_at: new Date().toISOString(),
        erro: null,
      })
      .eq("id", billingEvent.id)

    return NextResponse.json({
      ok: true,
      event_type: eventType,
      provider_event_id: providerEventId,
      usuario_id: usuarioId,
      assinatura_id: assinaturaId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await supabaseAdmin
      .from("boigordo_billing_eventos")
      .update({
        status_processamento: "FALHA",
        tentativas: 1,
        erro: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", billingEvent.id)

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/billing/webhook",
    method: "POST",
    auth_header: "x-webhook-token (opcional, conforme BILLING_WEBHOOK_TOKEN)",
  })
}
