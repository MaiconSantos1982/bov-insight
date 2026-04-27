import { NextResponse } from "next/server"
import { getSessionFromCookieHeader } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"))
  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: {
      usuario_id: session.userId,
      email: session.email,
      nome: session.nome,
    },
  })
}
