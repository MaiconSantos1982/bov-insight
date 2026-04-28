"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Newspaper, FileText } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useData } from "@/lib/data-provider"

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

const CODIGO_MES: Record<string, string> = {
  F: "Janeiro",
  G: "Fevereiro",
  H: "Março",
  J: "Abril",
  K: "Maio",
  M: "Junho",
  N: "Julho",
  Q: "Agosto",
  U: "Setembro",
  V: "Outubro",
  X: "Novembro",
  Z: "Dezembro",
}

const ORDEM_CODIGOS = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"]

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
    const valorCell = tds.find((cell) => /R\$\s*[-\d.,]+/.test(cell) || /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(cell)) || ""
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
  const { historicalData } = useData()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [widgetRows, setWidgetRows] = useState<FuturoRow[]>([])

  const rowsFromHistorico = useMemo<FuturoRow[]>(() => {
    const futuros = historicalData.filter((row) => /bgi/i.test(row.produto))
    if (!futuros.length) return []

    const latestByProduto = new Map<string, typeof futuros[number]>()
    for (const row of [...futuros].sort((a, b) => b.data.localeCompare(a.data))) {
      if (!latestByProduto.has(row.produto)) {
        latestByProduto.set(row.produto, row)
      }
    }

    const parsed = Array.from(latestByProduto.values())
      .map((row) => {
        const produtoUpper = row.produto.toUpperCase()
        const letterMatch = produtoUpper.match(/BGI[_\s-]*([FGHJKMNQUVXZ])/)
        const codigoMes = letterMatch?.[1] || "?"
        const yearMatch = produtoUpper.match(/(20\d{2})/)
        const ano = yearMatch?.[1] || row.data.slice(0, 4)
        const mesNome = CODIGO_MES[codigoMes] || "Mês"
        return {
          data: new Date(`${row.data}T12:00:00`).toLocaleDateString("pt-BR"),
          codigo: `BGI ${codigoMes}`,
          vencimento: `${mesNome} - ${ano}`,
          valor: row.valor_brl,
        }
      })
      .sort((a, b) => {
        const codA = a.codigo.split(" ")[1] || ""
        const codB = b.codigo.split(" ")[1] || ""
        const ordemA = ORDEM_CODIGOS.indexOf(codA)
        const ordemB = ORDEM_CODIGOS.indexOf(codB)
        return ordemA - ordemB
      })

    return parsed
  }, [historicalData])

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
    setWidgetRows(parseMercadoFuturoRows(doc))
  }

  const refresh = useCallback(() => {
    if (rowsFromHistorico.length) return

    setLoading(true)
    mountWidget()
    void (async () => {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 800))
        const doc = iframeRef.current?.contentDocument
        if (!doc) continue
        const parsed = parseMercadoFuturoRows(doc)
        if (parsed.length > 0) {
          setWidgetRows(parsed)
          break
        }
      }
      setLoading(false)
    })()
  }, [rowsFromHistorico])

  useEffect(() => {
    if (rowsFromHistorico.length) return
    const timeoutId = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh, rowsFromHistorico])

  const rows = rowsFromHistorico.length ? rowsFromHistorico : widgetRows
  const sorted = useMemo(() => [...rows].sort((a, b) => b.valor - a.valor), [rows])
  const topHigh = sorted.slice(0, 3)
  const topLow = [...sorted].reverse().slice(0, 3)

  return (
    <>
      <PageHeader
        title="Mercado Futuro"
        description="Curva B3 de boi gordo (BGI) com leitura operacional baseada no histórico interno"
      >
        <Button onClick={refresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar Curva"}</Button>
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Curva Futura B3</CardTitle>
            <CardDescription>
              Formato operacional: BGI + vencimento + preço.
              {rowsFromHistorico.length ? " Fonte: histórico diário interno (TradingView)." : " Fonte fallback: widget Notícias Agrícolas."}
            </CardDescription>
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
              {!rows.length && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Sem cotações no período. Clique em <strong>Atualizar Curva</strong> para recarregar.
                </div>
              )}
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
              {!topHigh.length && <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>}
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
              {!topLow.length && <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>}
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

        {!rowsFromHistorico.length && (
          <div className="hidden">
            <iframe ref={iframeRef} title="na-b3-futuro" className="w-full h-[420px]" />
          </div>
        )}
      </div>
    </>
  )
}
