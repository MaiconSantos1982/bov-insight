"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Landmark, Beef, Wheat, Bean, CircleDollarSign } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useData } from "@/lib/data-provider"

type WidgetRow = {
  data: string
  produto: string
  valor: number
}

type AuxRow = {
  title: string
  data: string | null
  produto: string | null
  valor: number | null
}

const CEPEA_URL =
  "https://cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=14&largura=400px&corfundo=dbd6b2&cortexto=333333&corlinha=ede7bf&id_indicador%5B%5D=8&id_indicador%5B%5D=2&id_indicador%5B%5D=77&id_indicador%5B%5D=92"

const AUX_WIDGETS = [
  {
    id: "na_novilha",
    title: "Novilha",
    url: "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=301&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
  },
  {
    id: "na_vaca",
    title: "Vaca",
    url: "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=300&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
  },
  {
    id: "na_repo_femea",
    title: "Reposição Nelore Fêmea",
    url: "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=303&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
  },
  {
    id: "na_repo_macho",
    title: "Reposição Nelore Macho",
    url: "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=302&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
  },
]

function parseBrl(value: string): number {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : NaN
}

function formatBrl(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCepeaRows(doc: Document): WidgetRow[] {
  const rows = Array.from(doc.querySelectorAll("tr"))
  const parsed: WidgetRow[] = []

  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll("td"))
    if (tds.length < 3) continue
    const data = (tds[0].textContent || "").trim()
    const produto = (tds[1].textContent || "").replace(/\s+/g, " ").trim()
    const valorRaw = (tds[2].textContent || "").replace(/\s+/g, " ").trim()
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) continue
    if (!valorRaw.includes("R$")) continue
    const valor = parseBrl(valorRaw)
    if (!Number.isFinite(valor)) continue
    parsed.push({ data, produto, valor })
  }

  return parsed
}

function parseSingleWidget(doc: Document, title: string): AuxRow {
  const allRows = Array.from(doc.querySelectorAll("tr"))

  for (const tr of allRows) {
    const tds = Array.from(tr.querySelectorAll("td")).map((td) =>
      (td.textContent || "").replace(/\s+/g, " ").trim()
    )
    if (!tds.length) continue

    const dateCell = tds.find((cell) => /^\d{2}\/\d{2}\/\d{4}$/.test(cell)) || null
    const valueCell = tds.find((cell) => /R\$\s*[-\d.,]+/.test(cell)) || null
    const productCell = tds.find((cell) => cell && cell !== dateCell && cell !== valueCell) || null

    if (dateCell || valueCell || productCell) {
      return {
        title,
        data: dateCell,
        produto: productCell,
        valor: valueCell ? parseBrl(valueCell) : null,
      }
    }
  }

  return { title, data: null, produto: null, valor: null }
}

export default function CotacoesPage() {
  const { baseRegionalStats } = useData()
  const cepeaRef = useRef<HTMLIFrameElement | null>(null)
  const auxRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  const [cepeaRows, setCepeaRows] = useState<WidgetRow[]>([])
  const [auxRows, setAuxRows] = useState<AuxRow[]>([])
  const [loading, setLoading] = useState(false)

  const latestStateQuotes = useMemo(() => {
    const latestByPraca = new Map<string, { data: string; preco: number }>()
    for (const row of [...baseRegionalStats].sort((a, b) => b.data.localeCompare(a.data))) {
      if (!latestByPraca.has(row.praca_local)) {
        latestByPraca.set(row.praca_local, { data: row.data, preco: row.preco_fisico_local })
      }
    }

    return Array.from(latestByPraca.entries())
      .map(([praca, item]) => ({ praca, ...item }))
      .sort((a, b) => a.praca.localeCompare(b.praca))
  }, [baseRegionalStats])

  function mountWidget(iframe: HTMLIFrameElement | null, url: string) {
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset=\"utf-8\" /><style>body{margin:0;padding:8px;font-family:Arial,sans-serif;background:#fff;}</style></head><body><script src=\"${url}\"></script></body></html>`)
    doc.close()
  }

  function captureWidgets() {
    const cepeaDoc = cepeaRef.current?.contentDocument
    if (cepeaDoc) {
      setCepeaRows(parseCepeaRows(cepeaDoc))
    }

    const aux: AuxRow[] = []
    for (const widget of AUX_WIDGETS) {
      const doc = auxRefs.current[widget.id]?.contentDocument
      if (!doc) continue
      aux.push(parseSingleWidget(doc, widget.title))
    }
    setAuxRows(aux)
  }

  const loadAllWidgets = useCallback(() => {
    setLoading(true)
    mountWidget(cepeaRef.current, CEPEA_URL)
    for (const widget of AUX_WIDGETS) {
      mountWidget(auxRefs.current[widget.id], widget.url)
    }

    window.setTimeout(() => {
      captureWidgets()
      setLoading(false)
    }, 1800)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAllWidgets()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadAllWidgets])

  return (
    <>
      <PageHeader
        title="Cotações"
        description="Cotações consolidadas do mercado físico e indicadores auxiliares"
      >
        <Button onClick={loadAllWidgets} disabled={loading}>{loading ? "Atualizando..." : "Atualizar Cotações"}</Button>
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Boi por Estado</CardTitle>
            <CardDescription>Leitura consolidada por praça local</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {latestStateQuotes.map((row) => (
                <div key={row.praca} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium flex items-center gap-2"><Landmark className="size-4 text-primary" /> {row.praca}</p>
                    <Badge variant="outline">{new Date(`${row.data}T12:00:00`).toLocaleDateString("pt-BR")}</Badge>
                  </div>
                  <p className="text-2xl font-bold mt-2 tabular-nums">R$ {formatBrl(row.preco)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CEPEA (núcleo)</CardTitle>
              <CardDescription>Boi Gordo, Bezerro, Milho e Soja</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cepeaRows.map((row) => (
                <div key={`${row.data}-${row.produto}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{row.produto}</p>
                    <p className="text-xs text-muted-foreground">{row.data}</p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">R$ {formatBrl(row.valor)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Indicadores auxiliares</CardTitle>
              <CardDescription>Novilha, Vaca e Reposição Nelore</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {auxRows.map((row) => (
                <div key={row.title} className="rounded-lg border p-3">
                  <p className="text-sm font-medium flex items-center gap-2"><CircleDollarSign className="size-4 text-primary" /> {row.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{row.produto || "Sem detalhamento"}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-lg font-semibold tabular-nums">R$ {formatBrl(row.valor)}</p>
                    <Badge variant="outline">{row.data || "Sem data"}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="hidden">
          <iframe ref={cepeaRef} title="cepea-core" className="w-full h-[420px]" />
          {AUX_WIDGETS.map((widget) => (
            <iframe
              key={widget.id}
              ref={(el) => {
                auxRefs.current[widget.id] = el
              }}
              title={widget.id}
              className="w-full h-[220px]"
            />
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leitura rápida</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
            <div className="rounded-lg border p-3 flex items-center gap-2"><Beef className="size-4 text-primary" /> Boi e reposição para decisão de compra/venda</div>
            <div className="rounded-lg border p-3 flex items-center gap-2"><Wheat className="size-4 text-primary" /> Milho para custo de trato e confinamento</div>
            <div className="rounded-lg border p-3 flex items-center gap-2"><Bean className="size-4 text-primary" /> Soja como indicador de equilíbrio de insumos</div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
