import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  nome?: string
  email?: string
  whatsapp?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  const nome = (body.nome || "").trim()
  const email = normalizeEmail(body.email || "")
  const whatsapp = (body.whatsapp || "").trim()

  if (!nome || !email || !whatsapp) {
    return NextResponse.json({ ok: false, error: "Nome, e-mail e WhatsApp são obrigatórios." }, { status: 400 })
  }

  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 })
  }

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

  const { error } = await supabaseAdmin.from("boigordo_lista").insert({
    nome,
    email,
    whatsapp,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
