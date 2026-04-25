"use client"

import { useMemo, useRef, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { AdminSubnav } from "@/components/admin-subnav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type ProdutoHistorico = "boi_gordo" | "bezerro" | "milho" | "soja"

type WidgetKind = "cepea" | "na_single"

type WidgetConfig = {
  id: string
  title: string
  description: string
  url: string
  kind: WidgetKind
}

type WidgetRow = {
  data: string
  produtoTexto: string
  valorTexto: string
  valorBrl: number
}

type MappedRow = {
  produto: ProdutoHistorico
  data: string
  valor_brl: number
  origem: string
}

type AuxiliarySnapshot = {
  widgetId: string
  title: string
  data: string | null
  produtoTexto: string | null
  valorTexto: string | null
}

const WIDGETS: WidgetConfig[] = [
  {
    id: "cepea_core",
    title: "CEPEA · Boi/Bezerro/Milho/Soja",
    description: "Fonte primária para histórico interno (Supabase)",
    url:
      "https://cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=14&largura=400px&corfundo=dbd6b2&cortexto=333333&corlinha=ede7bf&id_indicador%5B%5D=8&id_indicador%5B%5D=2&id_indicador%5B%5D=77&id_indicador%5B%5D=92",
    kind: "cepea",
  },
  {
    id: "na_b3_futuro",
    title: "Notícias Agrícolas · Boi gordo B3 (mercado futuro)",
    description: "Widget id=248",
    url:
      "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=248&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
    kind: "na_single",
  },
  {
    id: "na_novilha",
    title: "Notícias Agrícolas · Indicador da Novilha",
    description: "Widget id=301",
    url:
      "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=301&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
    kind: "na_single",
  },
  {
    id: "na_vaca",
    title: "Notícias Agrícolas · Indicador da Vaca",
    description: "Widget id=300",
    url:
      "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=300&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
    kind: "na_single",
  },
  {
    id: "na_repo_femea",
    title: "Notícias Agrícolas · Reposição Nelore Fêmea",
    description: "Widget id=303",
    url:
      "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=303&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
    kind: "na_single",
  },
  {
    id: "na_repo_macho",
    title: "Notícias Agrícolas · Reposição Nelore Macho",
    description: "Widget id=302",
    url:
      "https://www.noticiasagricolas.com.br/widgets/cotacoes?id=302&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=14pt&largura=400px&cortexto=333333&corcabecalho=B2C3C6&corlinha=DCE7E9&imagem=true&output=js",
    kind: "na_single",
  },
]

function parseBrl(value: string): number {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : NaN
}

function normalizeDate(input: string): string {
  const raw = input.trim()
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) {
    const [, dd, mm, yyyy] = br
    return `${yyyy}-${mm}-${dd}`
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return raw
  return raw
}

function mapRowsToHistorico(rows: WidgetRow[]): MappedRow[] {
  const byProduct: Record<ProdutoHistorico, WidgetRow | null> = {
    boi_gordo: null,
    bezerro: null,
    milho: null,
    soja: null,
  }

  const normalized = rows.map((row) => ({
    ...row,
    key: row.produtoTexto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  }))

  for (const row of normalized) {
    if (!byProduct.boi_gordo && row.key.includes("boi gordo")) byProduct.boi_gordo = row
    if (!byProduct.milho && row.key.includes("milho")) byProduct.milho = row
    if (!byProduct.bezerro && row.key.includes("bezerro")) byProduct.bezerro = row
    if (!byProduct.soja && row.key.includes("soja")) byProduct.soja = row
  }

  return (Object.keys(byProduct) as ProdutoHistorico[])
    .map((produto) => {
      const source = byProduct[produto]
      if (!source) return null
      return {
        produto,
        data: normalizeDate(source.data),
        valor_brl: source.valorBrl,
        origem: source.produtoTexto,
      }
    })
    .filter((item): item is MappedRow => Boolean(item))
}

function getStatus(rows: MappedRow[]): { ok: boolean; missing: ProdutoHistorico[] } {
  const set = new Set(rows.map((row) => row.produto))
  const missing = (["boi_gordo", "bezerro", "milho", "soja"] as ProdutoHistorico[]).filter(
    (p) => !set.has(p)
  )
  return { ok: missing.length === 0, missing }
}

function parseCepeaRows(doc: Document): WidgetRow[] {
  const allRows = Array.from(doc.querySelectorAll("tr"))
  const parsed: WidgetRow[] = []

  for (const tr of allRows) {
    const tds = Array.from(tr.querySelectorAll("td"))
    if (tds.length < 3) continue

    const data = (tds[0].textContent || "").trim()
    const produto = (tds[1].textContent || "").replace(/\s+/g, " ").trim()
    const valor = (tds[2].textContent || "").replace(/\s+/g, " ").trim()

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) continue
    if (!produto || !valor || !valor.includes("R$")) continue

    const valorBrl = parseBrl(valor)
    if (!Number.isFinite(valorBrl)) continue

    parsed.push({
      data,
      produtoTexto: produto,
      valorTexto: valor,
      valorBrl,
    })
  }

  return parsed
}

function parseSingleWidget(doc: Document, widgetId: string, title: string): AuxiliarySnapshot {
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
        widgetId,
        title,
        data: dateCell,
        produtoTexto: productCell,
        valorTexto: valueCell,
      }
    }
  }

  return {
    widgetId,
    title,
    data: null,
    produtoTexto: null,
    valorTexto: null,
  }
}

export default function AdminCepeaWidgetPage() {
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  const [loadingWidget, setLoadingWidget] = useState<string | null>(null)
  const [rawRows, setRawRows] = useState<WidgetRow[]>([])
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [auxSnapshots, setAuxSnapshots] = useState<AuxiliarySnapshot[]>([])

  const status = useMemo(() => getStatus(mappedRows), [mappedRows])

  function setIframeRef(id: string, el: HTMLIFrameElement | null) {
    iframeRefs.current[id] = el
  }

  function mountWidget(widget: WidgetConfig, autoCaptureCepea = false) {
    const iframe = iframeRefs.current[widget.id]
    if (!iframe) return

    setLoadingWidget(widget.id)
    const doc = iframe.contentDocument
    if (!doc) {
      setLoadingWidget(null)
      toast.error(`Falha ao inicializar iframe: ${widget.title}`)
      return
    }

    doc.open()
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <style>
      body { margin: 0; padding: 8px; background: #fff; font-family: Arial, sans-serif; }
    </style>
  </head>
  <body>
    <script src=\"${widget.url}\"></script>
  </body>
</html>`)
    doc.close()

    window.setTimeout(() => {
      setLoadingWidget((prev) => (prev === widget.id ? null : prev))
      if (widget.kind === "cepea" && autoCaptureCepea) {
        captureCepea()
      }
      if (widget.kind === "na_single") {
        captureAuxiliary()
      }
    }, 1800)
  }

  function mountAllWidgets() {
    for (const widget of WIDGETS) {
      mountWidget(widget, widget.kind === "cepea")
    }
  }

  function captureCepea() {
    const cepeaWidget = WIDGETS.find((w) => w.kind === "cepea")
    if (!cepeaWidget) return

    const iframe = iframeRefs.current[cepeaWidget.id]
    const doc = iframe?.contentDocument
    if (!doc) {
      toast.error("Widget CEPEA não carregado para captura.")
      return
    }

    const parsed = parseCepeaRows(doc)
    if (!parsed.length) {
      toast.error("Nenhuma linha válida capturada no widget CEPEA.")
      setRawRows([])
      setMappedRows([])
      return
    }

    const mapped = mapRowsToHistorico(parsed)
    setRawRows(parsed)
    setMappedRows(mapped)
    toast.success(`Captura CEPEA concluída: ${mapped.length} produto(s) mapeado(s).`)
  }

  function captureAuxiliary() {
    const widgets = WIDGETS.filter((w) => w.kind === "na_single")
    const snapshots: AuxiliarySnapshot[] = []

    for (const widget of widgets) {
      const iframe = iframeRefs.current[widget.id]
      const doc = iframe?.contentDocument
      if (!doc) continue
      snapshots.push(parseSingleWidget(doc, widget.id, widget.title))
    }

    setAuxSnapshots(snapshots)
  }

  async function saveToSupabase() {
    if (!mappedRows.length) {
      toast.error("Capture os dados CEPEA antes de salvar.")
      return
    }

    if (!status.ok) {
      toast.error(`Produtos ausentes: ${status.missing.join(", ")}`)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin/cepea-widget/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: mappedRows, allowHistorical: false }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao salvar dados no Supabase.")
      }

      toast.success("Histórico CEPEA salvo com sucesso.", {
        description: `Registros inseridos: ${payload.inserted}. Data referência: ${payload.referenceDate}.`,
      })
    } catch (error) {
      toast.error("Erro ao persistir histórico", {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Admin · Widgets de Mercado"
        description="Fontes visuais CEPEA e Notícias Agrícolas para alimentar e conferir dados"
        showDatePicker={false}
      >
        <AdminSubnav />
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações</CardTitle>
            <CardDescription>Carregue widgets, capture e grave CEPEA no Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={mountAllWidgets} disabled={Boolean(loadingWidget)}>
              {loadingWidget ? "Carregando..." : "Carregar Todos os Widgets"}
            </Button>
            <Button variant="outline" onClick={captureCepea}>Capturar CEPEA</Button>
            <Button variant="outline" onClick={captureAuxiliary}>Capturar Widgets Auxiliares</Button>
            <Button onClick={saveToSupabase} disabled={saving || !mappedRows.length}>
              {saving ? "Salvando..." : "Salvar CEPEA no Supabase"}
            </Button>
            <Badge variant={status.ok ? "default" : "secondary"}>
              {status.ok ? "CEPEA pronto para salvar" : `Faltando: ${status.missing.join(", ") || "-"}`}
            </Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {WIDGETS.map((widget) => (
            <Card key={widget.id}>
              <CardHeader>
                <CardTitle className="text-base">{widget.title}</CardTitle>
                <CardDescription>{widget.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingWidget === widget.id}
                  onClick={() => mountWidget(widget, widget.kind === "cepea")}
                >
                  {loadingWidget === widget.id ? "Carregando..." : "Recarregar Widget"}
                </Button>
                <div className="overflow-auto rounded-lg border bg-white">
                  <iframe
                    ref={(el) => setIframeRef(widget.id, el)}
                    title={widget.title}
                    className="h-[360px] w-full min-w-[420px]"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prévia CEPEA mapeada (Supabase)</CardTitle>
            <CardDescription>Mapeamento automático para boi_gordo, bezerro, milho e soja.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2 text-right">Valor BRL</th>
                    <th className="px-3 py-2">Origem no widget</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-muted-foreground">
                        Nenhum dado CEPEA capturado ainda.
                      </td>
                    </tr>
                  ) : (
                    mappedRows.map((row) => (
                      <tr key={`${row.produto}-${row.data}`} className="border-t">
                        <td className="px-3 py-2">{row.produto}</td>
                        <td className="px-3 py-2">{row.data}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.valor_brl.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="px-3 py-2">{row.origem}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Linhas CEPEA capturadas: {rawRows.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prévia Widgets Auxiliares</CardTitle>
            <CardDescription>Leitura rápida dos widgets do Notícias Agrícolas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Indicador</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {auxSnapshots.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-muted-foreground">
                        Nenhuma leitura auxiliar capturada ainda.
                      </td>
                    </tr>
                  ) : (
                    auxSnapshots.map((item) => (
                      <tr key={item.widgetId} className="border-t">
                        <td className="px-3 py-2">{item.title}</td>
                        <td className="px-3 py-2">{item.data || "N/D"}</td>
                        <td className="px-3 py-2">{item.produtoTexto || "N/D"}</td>
                        <td className="px-3 py-2">{item.valorTexto || "N/D"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
