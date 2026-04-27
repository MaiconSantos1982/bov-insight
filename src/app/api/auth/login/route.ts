import { NextResponse } from "next/server"
import { checkAccessByEmail, normalizeEmail } from "@/lib/auth/access-check"
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type LoginBody = {
  email?: string
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
  })

  const response = NextResponse.json({
    ok: true,
    allowed: true,
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
