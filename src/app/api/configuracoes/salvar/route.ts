import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SaveConfigBody = {
  usuario_id: string
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

export async function POST(request: Request) {
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

  if (!body.usuario_id || !body.nome || !body.telefone_whatsapp) {
    return NextResponse.json(
      { ok: false, error: "usuario_id, nome e telefone_whatsapp são obrigatórios." },
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
        usuario_id: body.usuario_id,
        nome: body.nome,
        email: body.email,
        telefone_whatsapp: body.telefone_whatsapp,
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

  if (body.destino_id) {
    const { error: destinoUpdateError } = await supabaseAdmin
      .from("boigordo_alertas_pro_destinos")
      .update({
        telefone_destino: body.telefone_destino || body.telefone_whatsapp,
        ativo: true,
      })
      .eq("id", body.destino_id)

    if (destinoUpdateError) {
      return NextResponse.json({ ok: false, error: destinoUpdateError.message }, { status: 500 })
    }
  } else {
    const { error: destinoInsertError } = await supabaseAdmin
      .from("boigordo_alertas_pro_destinos")
      .insert({
        usuario_id: body.usuario_id,
        telefone_destino: body.telefone_destino || body.telefone_whatsapp,
        ativo: true,
        frequencia: "IMEDIATO",
        timezone: "America/Sao_Paulo",
        tipos_alerta: [],
        severidades: [],
      })

    if (destinoInsertError) {
      return NextResponse.json({ ok: false, error: destinoInsertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

