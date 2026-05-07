import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireSuperAdmin } from "@/lib/auth/admin-guard"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeEmail(value: string | null | undefined): string | null {
  const email = String(value || "").trim().toLowerCase()
  return email.includes("@") ? email : null
}

function normalizePhoneE164(value: string | null | undefined): string | null {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("55") && /^55\d{10,11}$/.test(digits)) return `+${digits}`
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  if (digits.length >= 11 && digits.length <= 14) return `+${digits}`
  return null
}

export async function GET(request: Request) {
  const guard = requireSuperAdmin(request)
  if (!guard.ok) return guard.response

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabaseAdmin
    .from("boigordo_view_admin_assinantes")
    .select("*")
    .order("nome", { ascending: true })
    .limit(5000)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rows: data || [] })
}

type UpsertAssinanteBody = {
  usuario_id?: string
  nome?: string
  email?: string
  telefone_whatsapp?: string
  perfil_status?: "ATIVO" | "INATIVO" | "BLOQUEADO"
  plano?: string
  assinatura_status?: "ATIVA" | "TRIAL" | "INADIMPLENTE" | "CANCELADA" | "EXPIRADA"
  ciclo?: "MENSAL" | "TRIMESTRAL" | "ANUAL"
  proximo_vencimento?: string | null
  renovacao_automatica?: boolean
  assinatura_id?: string | null
}

export async function POST(request: Request) {
  const guard = requireSuperAdmin(request)
  if (!guard.ok) return guard.response

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." }, { status: 500 })
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = (await request.json()) as UpsertAssinanteBody
  const nome = String(body.nome || "").trim()
  const email = normalizeEmail(body.email)
  const telefone = normalizePhoneE164(body.telefone_whatsapp)
  const perfilStatus = body.perfil_status || "ATIVO"
  const plano = String(body.plano || "FREE").trim().toUpperCase()
  const assinaturaStatus = body.assinatura_status || "ATIVA"
  const ciclo = body.ciclo || "MENSAL"
  const proximoVencimento = body.proximo_vencimento || null
  const renovacaoAutomatica = Boolean(body.renovacao_automatica)

  if (!nome || !email || !telefone) {
    return NextResponse.json({ ok: false, error: "Nome, email e WhatsApp válido são obrigatórios." }, { status: 400 })
  }

  const usuarioId = body.usuario_id || crypto.randomUUID()
  const { error: perfilError } = await supabaseAdmin.from("boigordo_usuarios_perfil").upsert(
    {
      usuario_id: usuarioId,
      nome,
      email,
      telefone_whatsapp: telefone,
      status: perfilStatus,
      papeis_mercado: [],
      etapas_operacao: [],
      dados_questionario: {},
    },
    { onConflict: "usuario_id" }
  )
  if (perfilError) return NextResponse.json({ ok: false, error: perfilError.message }, { status: 500 })

  const { data: existingSub, error: existingSubError } = await supabaseAdmin
    .from("boigordo_assinaturas")
    .select("id")
    .eq("usuario_id", usuarioId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingSubError) return NextResponse.json({ ok: false, error: existingSubError.message }, { status: 500 })

  if (existingSub?.id) {
    const { error: updateSubError } = await supabaseAdmin
      .from("boigordo_assinaturas")
      .update({
        plano,
        status: assinaturaStatus,
        ciclo,
        proximo_vencimento: proximoVencimento,
        renovacao_automatica: renovacaoAutomatica,
      })
      .eq("id", existingSub.id)
    if (updateSubError) return NextResponse.json({ ok: false, error: updateSubError.message }, { status: 500 })
  } else {
    const { error: insertSubError } = await supabaseAdmin.from("boigordo_assinaturas").insert({
      usuario_id: usuarioId,
      plano,
      status: assinaturaStatus,
      ciclo,
      valor: 0,
      moeda: "BRL",
      data_inicio: new Date().toISOString().slice(0, 10),
      proximo_vencimento: proximoVencimento,
      renovacao_automatica: renovacaoAutomatica,
      gateway: "ADMIN",
    })
    if (insertSubError) return NextResponse.json({ ok: false, error: insertSubError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, usuario_id: usuarioId })
}

export async function PUT(request: Request) {
  const guard = requireSuperAdmin(request)
  if (!guard.ok) return guard.response

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." }, { status: 500 })
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = (await request.json()) as UpsertAssinanteBody
  const usuarioId = String(body.usuario_id || "").trim()
  if (!usuarioId) return NextResponse.json({ ok: false, error: "usuario_id é obrigatório." }, { status: 400 })

  const nome = String(body.nome || "").trim()
  const email = normalizeEmail(body.email)
  const telefone = normalizePhoneE164(body.telefone_whatsapp)
  if (!nome || !email || !telefone) {
    return NextResponse.json({ ok: false, error: "Nome, email e WhatsApp válido são obrigatórios." }, { status: 400 })
  }

  const { error: perfilError } = await supabaseAdmin
    .from("boigordo_usuarios_perfil")
    .update({
      nome,
      email,
      telefone_whatsapp: telefone,
      status: body.perfil_status || "ATIVO",
    })
    .eq("usuario_id", usuarioId)
  if (perfilError) return NextResponse.json({ ok: false, error: perfilError.message }, { status: 500 })

  if (body.assinatura_id) {
    const { error: assinaturaError } = await supabaseAdmin
      .from("boigordo_assinaturas")
      .update({
        plano: String(body.plano || "FREE").trim().toUpperCase(),
        status: body.assinatura_status || "ATIVA",
        ciclo: body.ciclo || "MENSAL",
        proximo_vencimento: body.proximo_vencimento || null,
        renovacao_automatica: Boolean(body.renovacao_automatica),
      })
      .eq("id", body.assinatura_id)
    if (assinaturaError) return NextResponse.json({ ok: false, error: assinaturaError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const guard = requireSuperAdmin(request)
  if (!guard.ok) return guard.response

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." }, { status: 500 })
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const url = new URL(request.url)
  const usuarioId = url.searchParams.get("usuario_id")
  if (!usuarioId) return NextResponse.json({ ok: false, error: "usuario_id é obrigatório." }, { status: 400 })

  const tables = [
    "boigordo_alertas_pro_envios",
    "boigordo_alertas_pro_regras",
    "boigordo_alertas_pro_destinos",
    "boigordo_pagamentos_historico",
    "boigordo_billing_eventos",
    "boigordo_assinaturas",
    "boigordo_usuarios_perfil",
  ]

  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).delete().eq("usuario_id", usuarioId)
    if (error) return NextResponse.json({ ok: false, error: `${table}: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
