import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkAccessByEmail, normalizeEmail } from "@/lib/auth/access-check"
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type LoginBody = {
  email?: string
  password?: string
}

export async function POST(request: Request) {
  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    const response = NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const email = normalizeEmail(body.email)
  if (!email) {
    const response = NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }
  const password = String(body.password || "")
  if (password.length < 6) {
    const response = NextResponse.json({ ok: false, error: "Senha inválida." }, { status: 400 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!supabaseUrl || !supabaseAnonKey) {
    const response = NextResponse.json({ ok: false, error: "Configuração de autenticação ausente." }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signInData.user) {
    const response = NextResponse.json(
      { ok: false, error: "Email ou senha inválidos.", motivo: "CREDENCIAIS_INVALIDAS" },
      { status: 401 }
    )
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  const access = await checkAccessByEmail(email)
  if (!access.ok) {
    const response = NextResponse.json({ ok: false, error: access.error }, { status: 500 })
    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  console.info("[auth:login] tentativa", {
    email,
    allowed: access.result.allowed,
    motivo: access.result.motivo,
    fonte_busca: access.result.fonte_busca,
    usuario_id: access.result.usuario?.usuario_id || null,
  })

  if (!access.result.allowed || !access.result.usuario) {
    const response = NextResponse.json(
      {
        ok: false,
        error: "Acesso não liberado para este email.",
        motivo: access.result.motivo,
        tier: access.result.tier,
        assinatura: access.result.assinatura,
        fonte_busca: access.result.fonte_busca,
      },
      { status: 403 }
    )
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
    allowed: true,
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
