import { NextResponse } from "next/server"

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

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export async function GET() {
  const gruposServerUrlRaw = process.env.GROUPS_SERVER_URL
  const execToken = process.env.GROUPS_EXEC_TOKEN || process.env.EXEC_TOKEN || ""

  if (!gruposServerUrlRaw) {
    return NextResponse.json(
      { ok: false, error: "GROUPS_SERVER_URL não configurada." },
      { status: 500 }
    )
  }

  const statusUrl = new URL("/api/status", normalizeBaseUrl(gruposServerUrlRaw))
  const headers: Record<string, string> = {}
  if (execToken) headers["x-exec-token"] = execToken

  try {
    const response = await fetch(statusUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    })

    if (!response.ok) {
      const raw = await response.text()
      return NextResponse.json(
        {
          ok: false,
          error: `Falha ao consultar groups-server (status=${response.status}).`,
          detail: raw.slice(0, 300),
        },
        { status: 502 }
      )
    }

    const payload = (await response.json()) as GruposStatusPayload
    const ultimoResultado = payload?.ultimoResultado
    const rows = Array.isArray(ultimoResultado?.datagro_mercado_futuro)
      ? ultimoResultado.datagro_mercado_futuro
      : []

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
