import { NextResponse } from "next/server"

const DATAGRO_LIVESTOCK_URL =
  "https://precos.api.datagro.com/paginas/?mercado=5&minihome=&pos=1&idioma=pt-br"

interface DatagroAtivo {
  dados?: {
    nome?: string
    ult?: string | number | null
    var?: string | number | null
    dia?: string | null
  }
}

interface DatagroQuadro {
  titulo?: string
  ativos?: DatagroAtivo[]
}

interface DatagroPayload {
  quadros?: DatagroQuadro[]
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const raw = String(value).trim()
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  try {
    const response = await fetch(DATAGRO_LIVESTOCK_URL, {
      cache: "no-store",
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { ok: false, error: `Falha Datagro: HTTP ${response.status} - ${text}` },
        { status: 502 }
      )
    }

    const payload = (await response.json()) as DatagroPayload
    const quadro = payload.quadros?.find((q) => q.titulo === "Exportação de Bovinos")

    if (!quadro?.ativos?.length) {
      return NextResponse.json(
        { ok: false, error: "Quadro 'Exportação de Bovinos' não encontrado." },
        { status: 404 }
      )
    }

    const quantidade = quadro.ativos.find((a) =>
      String(a.dados?.nome || "").toLowerCase().includes("quantidade")
    )?.dados
    const precoUsd = quadro.ativos.find((a) =>
      String(a.dados?.nome || "").toLowerCase().includes("preço us$")
    )?.dados
    const volumeUsd = quadro.ativos.find((a) =>
      String(a.dados?.nome || "").toLowerCase().includes("volume us$")
    )?.dados

    const dataRef = quantidade?.dia || precoUsd?.dia || volumeUsd?.dia || null

    return NextResponse.json({
      ok: true,
      fonte: "DATAGRO",
      data_ref: dataRef,
      quantidade_t: toNumber(quantidade?.ult),
      quantidade_var_pct: toNumber(quantidade?.var),
      preco_usd_t: toNumber(precoUsd?.ult),
      preco_var_pct: toNumber(precoUsd?.var),
      volume_usd: toNumber(volumeUsd?.ult),
      volume_var_pct: toNumber(volumeUsd?.var),
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
