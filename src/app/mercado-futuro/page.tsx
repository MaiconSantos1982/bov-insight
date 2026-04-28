"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Newspaper, FileText } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type FuturoRow = {
  data: string
  codigo: string
  vencimento: string
  valor: number
}

const WIDGET_B3_URL =
  "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=248&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js"

const MES_CODIGO: Record<string, string> = {
  Janeiro: "F",
  Fevereiro: "G",
  Marco: "H",
  Abril: "J",
  Maio: "K",
  Junho: "M",
  Julho: "N",
  Agosto: "Q",
  Setembro: "U",
  Outubro: "V",
  Novembro: "X",
  Dezembro: "Z",
}

function parseBrl(value: string): number {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : NaN
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeMonth(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function parseMercadoFuturoRows(doc: Document): FuturoRow[] {
  const rows = Array.from(doc.querySelectorAll("tr"))
  const out: FuturoRow[] = []

  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").replace(/\s+/g, " ").trim())
    if (!tds.length) continue

    const data = tds.find((cell) => /^\d{2}\/\d{2}\/\d{4}$/.test(cell)) || ""
    const valorCell = tds.find((cell) => /R\$\s*[-\d.,]+/.test(cell)) || ""
    const produtoCell = tds.find((cell) => cell && cell !== data && cell !== valorCell) || ""

    if (!data || !valorCell || !produtoCell) continue

    const mesMatch = produtoCell.match(/(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)/i)
    const anoMatch = produtoCell.match(/(20\d{2})/)

    const mes = mesMatch ? normalizeMonth(mesMatch[1]).replace(/^./, (c) => c.toUpperCase()) : ""
    const ano = anoMatch ? anoMatch[1] : new Date().getFullYear().toString()
    const codigo = `BGI ${MES_CODIGO[mes] || "?"}`
    const valor = parseBrl(valorCell)

    if (!Number.isFinite(valor)) continue

    out.push({
      data,
      codigo,
      vencimento: `${mes || "Mês"} - ${ano}`,
      valor,
    })
  }

  return out
}

export default function MercadoFuturoPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<FuturoRow[]>([])

  function mountWidget() {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset=\"utf-8\" /><style>body{margin:0;padding:8px;font-family:Arial,sans-serif;background:#fff;}</style></head><body><script src=\"${WIDGET_B3_URL}\"></script></body></html>`)
    doc.close()
  }

  function capture() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    setRows(parseMercadoFuturoRows(doc))
  }

  const refresh = useCallback(() => {
    setLoading(true)
    mountWidget()
    window.setTimeout(() => {
      capture()
      setLoading(false)
    }, 1800)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh])

  const sorted = useMemo(() => [...rows].sort((a, b) => b.valor - a.valor), [rows])
  const topHigh = sorted.slice(0, 3)
  const topLow = [...sorted].reverse().slice(0, 3)

  return (
    <>
      <PageHeader
        title="Mercado Futuro"
        description="Curva B3 de boi gordo (BGI) com leitura operacional"
      >
        <Button onClick={refresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar Curva"}</Button>
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Curva Futura B3</CardTitle>
            <CardDescription>Formato operacional: BGI + vencimento + preço</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={`${row.codigo}-${row.vencimento}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{row.codigo} - {row.vencimento}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{row.data}</Badge>
                    <p className="text-lg font-semibold tabular-nums">R$ {formatBrl(row.valor)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="size-4 text-emerald-500" /> Cotações mais altas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topHigh.map((row) => (
                <div key={`high-${row.codigo}-${row.vencimento}`} className="rounded-lg border p-3 flex items-center justify-between">
                  <p className="text-sm">{row.codigo} - {row.vencimento}</p>
                  <p className="font-semibold tabular-nums">R$ {formatBrl(row.valor)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="size-4 text-rose-500" /> Cotações mais baixas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topLow.map((row) => (
                <div key={`low-${row.codigo}-${row.vencimento}`} className="rounded-lg border p-3 flex items-center justify-between">
                  <p className="text-sm">{row.codigo} - {row.vencimento}</p>
                  <p className="font-semibold tabular-nums">R$ {formatBrl(row.valor)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="size-4 text-primary" /> Relatórios</CardTitle>
              <CardDescription>Área reservada para análises estruturadas da curva</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Em desenvolvimento: consolidação de leitura de spread, estrutura de termo e cenário semanal.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Newspaper className="size-4 text-primary" /> Notícias</CardTitle>
              <CardDescription>Feed curado para eventos que impactam mercado futuro</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Em desenvolvimento: integração com fontes setoriais e clipping automático.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden">
          <iframe ref={iframeRef} title="na-b3-futuro" className="w-full h-[420px]" />
        </div>
      </div>
    </>
  )
}
