import { NextResponse } from "next/server"
import { checkAccessByEmail, normalizeEmail } from "@/lib/auth/access-check"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ConsultaBody = { email?: string }

export async function POST(request: Request) {
  let body: ConsultaBody
  try {
    body = (await request.json()) as ConsultaBody
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  const email = normalizeEmail(body.email)
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 })
  }

  const access = await checkAccessByEmail(email)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    email,
    ...access.result,
  })
}
