import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

async function callGruposServer(url: URL, execToken: string) {
  const headers: Record<string, string> = {}
  if (execToken) headers["x-exec-token"] = execToken

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  })

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { raw: text }
  }

  return { response, payload }
}

export async function POST() {
  const gruposServerUrlRaw = process.env.GROUPS_SERVER_URL
  const execToken = process.env.GROUPS_EXEC_TOKEN || process.env.EXEC_TOKEN || ""

  if (!gruposServerUrlRaw) {
    return NextResponse.json(
      { ok: false, error: "GROUPS_SERVER_URL não configurada." },
      { status: 500 }
    )
  }

  const gruposServerUrl = normalizeBaseUrl(gruposServerUrlRaw)

  try {
    const datagroUrl = new URL("/api/executar", gruposServerUrl)
    datagroUrl.searchParams.set("fonte", "datagro")
    datagroUrl.searchParams.set("enviarMensagem", "true")

    const datagroResult = await callGruposServer(datagroUrl, execToken)
    if (datagroResult.response.ok) {
      return NextResponse.json({
        ok: true,
        strategy: "datagro",
        payload: datagroResult.payload,
      })
    }

    const fullUrl = new URL("/api/executar", gruposServerUrl)
    fullUrl.searchParams.set("fonte", "todos")
    fullUrl.searchParams.set("enviarMensagem", "true")

    const fullResult = await callGruposServer(fullUrl, execToken)
    if (fullResult.response.ok) {
      return NextResponse.json({
        ok: true,
        strategy: "todos",
        payload: fullResult.payload,
        fallbackFrom: {
          strategy: "datagro",
          status: datagroResult.response.status,
          payload: datagroResult.payload,
        },
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Falha no disparo manual do grupos-server em todas as estratégias.",
        attempts: [
          { strategy: "datagro", status: datagroResult.response.status, payload: datagroResult.payload },
          { strategy: "todos", status: fullResult.response.status, payload: fullResult.payload },
        ],
      },
      { status: 502 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        groupsServerUrl,
      },
      { status: 500 }
    )
  }
}
