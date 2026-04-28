import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DatagroItem = {
  nome: string
  preco: number | null
}

type GruposStatusPayload = {
  ultimoResultado?: {
    data_extracao?: string
    datagro_mercado_futuro?: DatagroItem[]
  } | null
}

type ExecucaoLogRow = {
  created_at: string
  contexto: Record<string, unknown> | null
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function tryExtractRowsFromContext(contexto: Record<string, unknown> | null): DatagroItem[] {
  if (!contexto || typeof contexto !== "object") return []

  const direct = contexto["datagro_mercado_futuro"]
  if (Array.isArray(direct)) {
    return direct
      .map((item) => item as Partial<DatagroItem>)
      .filter((item) => typeof item?.nome === "string")
      .map((item) => ({ nome: String(item.nome), preco: typeof item.preco === "number" ? item.preco : null }))
  }

  const nestedDados = contexto["dados"]
  if (nestedDados && typeof nestedDados === "object") {
    const inner = (nestedDados as Record<string, unknown>)["datagro_mercado_futuro"]
    if (Array.isArray(inner)) {
      return inner
        .map((item) => item as Partial<DatagroItem>)
        .filter((item) => typeof item?.nome === "string")
        .map((item) => ({ nome: String(item.nome), preco: typeof item.preco === "number" ? item.preco : null }))
    }
  }

  return []
}

export async function GET() {
  const gruposServerUrlRaw = process.env.GROUPS_SERVER_URL
  const execToken = process.env.GROUPS_EXEC_TOKEN || process.env.EXEC_TOKEN || ""
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 1) Prioridade máxima: groups-server (mesma fonte do WhatsApp)
  if (gruposServerUrlRaw) {
    const statusUrl = new URL("/api/status", normalizeBaseUrl(gruposServerUrlRaw))
    const headers: Record<string, string> = {}
    if (execToken) headers["x-exec-token"] = execToken

    try {
      const response = await fetch(statusUrl.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
      })

      if (response.ok) {
        const payload = (await response.json()) as GruposStatusPayload
        const ultimoResultado = payload?.ultimoResultado
        const rows = Array.isArray(ultimoResultado?.datagro_mercado_futuro)
          ? ultimoResultado.datagro_mercado_futuro
          : []

        if (rows.length > 0) {
          return NextResponse.json({
            ok: true,
            source: "groups-server",
            dataExtracao: ultimoResultado?.data_extracao || null,
            rows,
          })
        }
      }
    } catch {
      // segue para fallback
    }
  }

  // 2) Fallback: últimos logs persistidos no Supabase
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data, error } = await supabaseAdmin
        .from("boigordo_execucoes_logs")
        .select("created_at, contexto")
        .order("created_at", { ascending: false })
        .limit(200)

      if (!error) {
        const rowsData = (data || []) as ExecucaoLogRow[]
        for (const row of rowsData) {
          const parsed = tryExtractRowsFromContext(row.contexto)
          if (parsed.length > 0) {
            return NextResponse.json({
              ok: true,
              source: "supabase-execucoes-logs",
              dataExtracao: row.created_at,
              rows: parsed,
            })
          }
        }
      }
    } catch {
      // segue para retorno vazio
    }
  }

  // 3) Sem dados em nenhuma fonte
  return NextResponse.json(
    {
      ok: false,
      error:
        "Sem dados de mercado futuro disponíveis em groups-server ou logs de execução no Supabase.",
      rows: [],
    },
    { status: 404 }
  )
}
    return NextResponse.json({
      ok: true,
      dataExtracao: ultimoResultado?.data_extracao || null,
      rows,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
