import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CreateBody = {
  usuario_id: string
  produto: "boi_gordo" | "bezerro" | "milho" | "soja"
  condicao: "acima_de" | "abaixo_de" | "variacao_pct"
  valor_gatilho: number
  ativo?: boolean
  ultimo_disparo?: string | null
}

type UpdateBody = {
  id: string
  ativo: boolean
}

type DeleteBody = {
  id: string
}

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { client: null, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." }
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, error: null as string | null }
}

export async function POST(request: Request) {
  const { client, error } = getAdminClient()
  if (!client) return NextResponse.json({ ok: false, error }, { status: 500 })

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  if (!body.usuario_id || !body.produto || !body.condicao || typeof body.valor_gatilho !== "number") {
    return NextResponse.json({ ok: false, error: "Campos obrigatórios inválidos." }, { status: 400 })
  }

  const { data, error: insertError } = await client
    .from("boigordo_alertas_pro_regras")
    .insert({
      usuario_id: body.usuario_id,
      produto: body.produto,
      condicao: body.condicao,
      valor_gatilho: body.valor_gatilho,
      ativo: body.ativo ?? true,
      ultimo_disparo: body.ultimo_disparo ?? null,
    })
    .select("*")
    .single()

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, row: data })
}

export async function GET(request: Request) {
  const { client, error } = getAdminClient()
  if (!client) return NextResponse.json({ ok: false, error }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const usuarioId = searchParams.get("usuario_id")

  if (!usuarioId) {
    return NextResponse.json({ ok: false, error: "usuario_id é obrigatório." }, { status: 400 })
  }

  const { data, error: fetchError } = await client
    .from("boigordo_alertas_pro_regras")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false })

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rows: data || [] })
}

export async function PATCH(request: Request) {
  const { client, error } = getAdminClient()
  if (!client) return NextResponse.json({ ok: false, error }, { status: 500 })

  let body: UpdateBody
  try {
    body = (await request.json()) as UpdateBody
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  if (!body.id || typeof body.ativo !== "boolean") {
    return NextResponse.json({ ok: false, error: "Campos obrigatórios inválidos." }, { status: 400 })
  }

  const { error: updateError } = await client
    .from("boigordo_alertas_pro_regras")
    .update({ ativo: body.ativo })
    .eq("id", body.id)

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { client, error } = getAdminClient()
  if (!client) return NextResponse.json({ ok: false, error }, { status: 500 })

  let body: DeleteBody
  try {
    body = (await request.json()) as DeleteBody
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "ID é obrigatório." }, { status: 400 })
  }

  const { error: deleteError } = await client
    .from("boigordo_alertas_pro_regras")
    .delete()
    .eq("id", body.id)

  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
