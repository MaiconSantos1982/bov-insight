import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const gruposServerUrl = process.env.GROUPS_SERVER_URL
  const execToken = process.env.GROUPS_EXEC_TOKEN || process.env.EXEC_TOKEN || ""

  if (!gruposServerUrl) {
    return NextResponse.json(
      { ok: false, error: "GROUPS_SERVER_URL não configurada." },
      { status: 500 }
    )
  }

  const url = new URL("/api/executar", gruposServerUrl)
  url.searchParams.set("fonte", "todos")
  url.searchParams.set("enviarMensagem", "true")

  try {
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

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: response.status,
          error: "Falha no disparo manual do grupos-server.",
          payload,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, payload })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
