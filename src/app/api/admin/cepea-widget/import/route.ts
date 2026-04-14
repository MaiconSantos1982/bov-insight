import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProdutoHistorico = "boi_gordo" | "bezerro" | "milho" | "soja"

type PayloadItem = {
  produto: ProdutoHistorico
  data: string
  valor_brl: number
  valor_usd?: number | null
  origem?: string
}

function isProdutoHistorico(value: string): value is ProdutoHistorico {
  return value === "boi_gordo" || value === "bezerro" || value === "milho" || value === "soja"
}

function normalizeDate(input: string): string {
  const value = input.trim()
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) {
    const [, dd, mm, yyyy] = br
    return `${yyyy}-${mm}-${dd}`
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return value
  throw new Error(`Data inválida: ${input}`)
}

function isBusinessDay(isoDate: string): boolean {
  const dt = new Date(`${isoDate}T12:00:00-03:00`)
  const day = dt.getUTCDay()
  return day >= 1 && day <= 5
}

function getYesterdayIsoInSaoPaulo(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const now = new Date()
  const todaySaoPaulo = formatter.format(now)
  const dt = new Date(`${todaySaoPaulo}T12:00:00-03:00`)
  dt.setUTCDate(dt.getUTCDate() - 1)
  return formatter.format(dt)
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Payload JSON inválido." }, { status: 400 })
  }

  const items = Array.isArray((body as { items?: unknown[] })?.items)
    ? ((body as { items: unknown[] }).items as unknown[])
    : []

  if (!items.length) {
    return NextResponse.json({ ok: false, error: "Nenhum item recebido para importação." }, { status: 400 })
  }

  const parsed: Array<PayloadItem & { data: string }> = []
  for (const raw of items) {
    const row = raw as Partial<PayloadItem>
    if (!row?.produto || !isProdutoHistorico(String(row.produto))) {
      return NextResponse.json({ ok: false, error: "Produto inválido na carga." }, { status: 400 })
    }
    if (typeof row.valor_brl !== "number" || Number.isNaN(row.valor_brl) || row.valor_brl <= 0) {
      return NextResponse.json(
        { ok: false, error: `Valor BRL inválido para ${row.produto}.` },
        { status: 400 }
      )
    }

    let isoDate: string
    try {
      isoDate = normalizeDate(String(row.data || ""))
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Data inválida." },
        { status: 400 }
      )
    }

    if (!isBusinessDay(isoDate)) {
      return NextResponse.json(
        { ok: false, error: `Data fora de dia útil (seg-sex): ${isoDate}.` },
        { status: 400 }
      )
    }

    parsed.push({
      produto: row.produto,
      data: isoDate,
      valor_brl: row.valor_brl,
      valor_usd: typeof row.valor_usd === "number" ? row.valor_usd : null,
      origem: row.origem,
    })
  }

  const maxDate = parsed.map((item) => item.data).sort().at(-1)
  const yesterdayIso = getYesterdayIsoInSaoPaulo()
  if (maxDate && maxDate > yesterdayIso) {
    return NextResponse.json(
      {
        ok: false,
        error: `Data ${maxDate} ainda não deve ser consolidada. Limite atual: ${yesterdayIso}.`,
      },
      { status: 400 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const produtos = [...new Set(parsed.map((item) => item.produto))]
  const usdFallback = new Map<ProdutoHistorico, number>()

  for (const produto of produtos) {
    const { data: row, error } = await supabaseAdmin
      .from("boigordo_historico")
      .select("valor_usd")
      .eq("produto", produto)
      .not("valor_usd", "is", null)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Falha ao buscar fallback USD para ${produto}: ${error.message}` },
        { status: 500 }
      )
    }

    if (row?.valor_usd != null) {
      usdFallback.set(produto, Number(row.valor_usd))
    }
  }

  for (const item of parsed) {
    if (item.valor_usd == null) {
      const fallback = usdFallback.get(item.produto)
      if (fallback == null) {
        return NextResponse.json(
          {
            ok: false,
            error: `Sem valor_usd no payload e sem fallback histórico para ${item.produto}.`,
          },
          { status: 400 }
        )
      }
      item.valor_usd = fallback
    }
  }

  let upserted = 0
  for (const item of parsed) {
    const { error: deleteError } = await supabaseAdmin
      .from("boigordo_historico")
      .delete()
      .eq("produto", item.produto)
      .eq("data", item.data)

    if (deleteError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Falha ao limpar registro existente (${item.produto}/${item.data}): ${deleteError.message}`,
        },
        { status: 500 }
      )
    }

    const { error: insertError } = await supabaseAdmin.from("boigordo_historico").insert({
      produto: item.produto,
      data: item.data,
      valor_brl: item.valor_brl,
      valor_usd: item.valor_usd,
    })

    if (insertError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Falha ao inserir histórico (${item.produto}/${item.data}): ${insertError.message}`,
        },
        { status: 500 }
      )
    }

    upserted += 1
  }

  return NextResponse.json({
    ok: true,
    inserted: upserted,
    referenceDate: maxDate || null,
    items: parsed,
  })
}
