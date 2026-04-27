import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedSession } from "@/lib/auth/request-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SaveConfigBody = {
  usuario_id?: string
  nome: string
  email: string | null
  telefone_whatsapp: string
  papeis_mercado: string[]
  etapas_operacao: string[]
  cabecas_gado: number
  experiencia_anos: number | null
  status: string
  destino_id: string | null
  telefone_destino: string
}

function normalizePhoneE164Br(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  if (!digits) return null

  if (digits.startsWith("55")) {
    if (digits.length !== 12 && digits.length !== 13) return null
    return `+${digits}`
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`
  }

  return null
}

export async function POST(request: Request) {
  const session = getAuthenticatedSession(request)
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." },
      { status: 500 }
    )
  }

  let body: SaveConfigBody
  try {
    body = (await request.json()) as SaveConfigBody
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  if (!body.nome || !body.telefone_whatsapp) {
    return NextResponse.json(
      { ok: false, error: "nome e telefone_whatsapp são obrigatórios." },
      { status: 400 }
    )
  }

  const telefoneWhatsappE164 = normalizePhoneE164Br(body.telefone_whatsapp)
  if (!telefoneWhatsappE164) {
    return NextResponse.json(
      { ok: false, error: "Telefone WhatsApp inválido. Use DDD + número (10 ou 11 dígitos)." },
      { status: 400 }
    )
  }

  const telefoneDestinoE164 = normalizePhoneE164Br(body.telefone_destino || body.telefone_whatsapp)
  if (!telefoneDestinoE164) {
    return NextResponse.json(
      { ok: false, error: "Telefone de destino inválido. Use DDD + número (10 ou 11 dígitos)." },
      { status: 400 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: perfilError } = await supabaseAdmin
    .from("boigordo_usuarios_perfil")
    .upsert(
      {
        usuario_id: session.userId,
        nome: body.nome,
        email: body.email || session.email,
        telefone_whatsapp: telefoneWhatsappE164,
        papeis_mercado: body.papeis_mercado || [],
        etapas_operacao: body.etapas_operacao || [],
        cabecas_gado: body.cabecas_gado,
        experiencia_anos: body.experiencia_anos,
        status: body.status || "ATIVO",
      },
      { onConflict: "usuario_id" }
    )

  if (perfilError) {
    return NextResponse.json({ ok: false, error: perfilError.message }, { status: 500 })
  }

  const { error: destinoUpsertError } = await supabaseAdmin
    .from("boigordo_alertas_pro_destinos")
    .upsert(
      {
        id: body.destino_id || undefined,
        usuario_id: session.userId,
        telefone_destino: telefoneDestinoE164,
        ativo: true,
        frequencia: "IMEDIATO",
        timezone: "America/Sao_Paulo",
        tipos_alerta: [],
        severidades: [],
      },
      { onConflict: "usuario_id" }
    )

  if (destinoUpsertError) {
    return NextResponse.json({ ok: false, error: destinoUpsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
