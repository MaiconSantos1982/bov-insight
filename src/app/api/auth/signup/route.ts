import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkAccessByEmail, normalizeEmail } from "@/lib/auth/access-check"
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SignupBody = {
  nome?: string
  email?: string
  password?: string
  telefone_whatsapp?: string
}

function normalizePhoneE164Br(value: string | null | undefined): string | null {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return null
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`
  if (!/^55\d{10,11}$/.test(withCountry)) return null
  return `+${withCountry}`
}

function getTodayIso(): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(now.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export async function POST(request: Request) {
  let body: SignupBody
  try {
    body = (await request.json()) as SignupBody
  } catch {
    const response = NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const nome = String(body.nome || "").trim()
  const email = normalizeEmail(body.email)
  const password = String(body.password || "")
  const telefoneWhatsapp = normalizePhoneE164Br(body.telefone_whatsapp)

  if (!nome || !email || password.length < 6 || !telefoneWhatsapp) {
    const response = NextResponse.json(
      { ok: false, error: "Nome, email, senha (mínimo 6) e WhatsApp válido são obrigatórios." },
      { status: 400 }
    )
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!supabaseUrl || !serviceRoleKey) {
    const response = NextResponse.json({ ok: false, error: "Configuração de autenticação ausente." }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existingPerfil, error: existingPerfilError } = await adminClient
    .from("boigordo_usuarios_perfil")
    .select("usuario_id,email")
    .ilike("email", email)
    .limit(1)
    .maybeSingle()

  if (existingPerfilError) {
    const response = NextResponse.json({ ok: false, error: existingPerfilError.message }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (createError || !created.user?.id) {
    const createMessage = String(createError?.message || "").toLowerCase()
    if (createMessage.includes("already") || createMessage.includes("registered") || createMessage.includes("exists")) {
      const response = NextResponse.json(
        {
          ok: false,
          error: "Este email já está cadastrado. Faça login ou use 'Esqueci minha senha'.",
          motivo: "EMAIL_JA_CADASTRADO_AUTH",
        },
        { status: 409 }
      )
      response.cookies.delete(AUTH_COOKIE_NAME)
      return response
    }

    const response = NextResponse.json(
      { ok: false, error: createError?.message || "Falha ao criar usuário." },
      { status: 500 }
    )
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const usuarioId = created.user.id
  const previousUsuarioId = existingPerfil?.usuario_id ? String(existingPerfil.usuario_id) : null

  if (previousUsuarioId && previousUsuarioId !== usuarioId) {
    const migrateTables = [
      "boigordo_assinaturas",
      "boigordo_alertas_pro_destinos",
      "boigordo_alertas_pro_regras",
      "boigordo_alertas_pro_envios",
      "boigordo_pagamentos_historico",
      "boigordo_billing_eventos",
    ]

    for (const table of migrateTables) {
      const { error: migrateError } = await adminClient
        .from(table)
        .update({ usuario_id: usuarioId })
        .eq("usuario_id", previousUsuarioId)
      if (migrateError) {
        console.warn(`[auth:signup] falha ao migrar tabela ${table}`, {
          email,
          previousUsuarioId,
          usuarioId,
          error: migrateError.message,
        })
      }
    }
  }

  const { error: perfilError } = await adminClient.from("boigordo_usuarios_perfil").upsert(
    {
      usuario_id: usuarioId,
      nome,
      email,
      telefone_whatsapp: telefoneWhatsapp,
      status: "ATIVO",
      papeis_mercado: [],
      etapas_operacao: [],
      dados_questionario: {},
      observacoes: "Cadastro self-service.",
    },
    { onConflict: "usuario_id" }
  )
  if (perfilError) {
    const response = NextResponse.json({ ok: false, error: perfilError.message }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const { data: subRows, error: subFindError } = await adminClient
    .from("boigordo_assinaturas")
    .select("id,status")
    .eq("usuario_id", usuarioId)
    .limit(1)

  if (subFindError) {
    const response = NextResponse.json({ ok: false, error: subFindError.message }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  if (!subRows || subRows.length === 0) {
    const today = getTodayIso()
    const { error: subInsertError } = await adminClient.from("boigordo_assinaturas").insert({
      usuario_id: usuarioId,
      plano: "FREE",
      status: "ATIVA",
      ciclo: "MENSAL",
      valor: 0,
      moeda: "BRL",
      data_inicio: today,
      proximo_vencimento: "2099-12-31",
      renovacao_automatica: false,
      gateway: "SELF_SERVICE",
    })
    if (subInsertError) {
      const response = NextResponse.json({ ok: false, error: subInsertError.message }, { status: 500 })
      response.cookies.delete(AUTH_COOKIE_NAME)
      return response
    }
  }

  const access = await checkAccessByEmail(email)
  if (!access.ok || !access.result.usuario) {
    const response = NextResponse.json({ ok: false, error: access.ok ? "Cadastro criado, mas sem acesso." : access.error }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const session = createSessionToken({
    userId: access.result.usuario.usuario_id,
    email,
    nome: access.result.usuario.nome,
    tier: access.result.tier,
  })

  const response = NextResponse.json({
    ok: true,
    tier: access.result.tier,
    usuario: access.result.usuario,
    assinatura: access.result.assinatura,
  })
  response.cookies.set(AUTH_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  })
  return response
}
