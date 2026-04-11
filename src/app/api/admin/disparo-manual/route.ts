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
  const traceId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const gruposServerUrlRaw = process.env.GROUPS_SERVER_URL
  const execToken = process.env.GROUPS_EXEC_TOKEN || process.env.EXEC_TOKEN || ""

  if (!gruposServerUrlRaw) {
    console.error(`[disparo-manual][${traceId}] GROUPS_SERVER_URL não configurada`)
    return NextResponse.json(
      { ok: false, error: "GROUPS_SERVER_URL não configurada." },
      { status: 500 }
    )
  }

  const gruposServerUrl = normalizeBaseUrl(gruposServerUrlRaw)
  console.info(
    `[disparo-manual][${traceId}] iniciado baseUrl=${gruposServerUrl} token=${execToken ? "presente" : "ausente"}`
  )

  try {
    const fullUrl = new URL("/api/executar", gruposServerUrl)
    fullUrl.searchParams.set("fonte", "todos")
    fullUrl.searchParams.set("enviarMensagem", "true")

    console.info(`[disparo-manual][${traceId}] tentativa=todos url=${fullUrl.toString()}`)
    const fullResult = await callGruposServer(fullUrl, execToken)
    console.info(
      `[disparo-manual][${traceId}] resultado=todos status=${fullResult.response.status}`
    )
    if (fullResult.response.ok) {
      console.info(`[disparo-manual][${traceId}] concluído strategy=todos`)
      return NextResponse.json({
        ok: true,
        traceId,
        strategy: "todos",
        payload: fullResult.payload,
      })
    }

    const datagroUrl = new URL("/api/executar", gruposServerUrl)
    datagroUrl.searchParams.set("fonte", "datagro")
    datagroUrl.searchParams.set("enviarMensagem", "true")

    console.info(`[disparo-manual][${traceId}] tentativa=datagro url=${datagroUrl.toString()}`)
    const datagroResult = await callGruposServer(datagroUrl, execToken)
    console.info(
      `[disparo-manual][${traceId}] resultado=datagro status=${datagroResult.response.status}`
    )
    if (datagroResult.response.ok) {
      console.info(`[disparo-manual][${traceId}] concluído strategy=datagro`)
      return NextResponse.json({
        ok: true,
        traceId,
        strategy: "datagro",
        payload: datagroResult.payload,
        fallbackFrom: {
          strategy: "todos",
          status: fullResult.response.status,
          payload: fullResult.payload,
        },
      })
    }

    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: "Falha no disparo manual do grupos-server em todas as estratégias.",
        attempts: [
          { strategy: "todos", status: fullResult.response.status, payload: fullResult.payload },
          { strategy: "datagro", status: datagroResult.response.status, payload: datagroResult.payload },
        ],
      },
      { status: 502 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[disparo-manual][${traceId}] erro fatal: ${message}`)
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: message,
        gruposServerUrl,
      },
      { status: 500 }
    )
  }
}
