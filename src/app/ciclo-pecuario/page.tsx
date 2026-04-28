"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Legend, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/info-hint"
import { formatLocationLabel } from "@/lib/location-labels"

const chartConfig = {
  taxa_femeas_pct: { label: "Taxa Fêmeas (%)", color: "var(--chart-1)" },
  media_movel_12m: { label: "Média Móvel 12m", color: "var(--chart-2)" },
} satisfies ChartConfig

const PHASE_META = {
  RETENCAO: {
    label: "Retenção",
    color: "#059669",
    description:
      "Fase em que o produtor retém mais fêmeas no rebanho. Tendência de menor oferta futura e suporte nos preços do boi.",
  },
  ESTABILIDADE: {
    label: "Estabilidade",
    color: "#d97706",
    description:
      "Fase de transição. A oferta fica mais equilibrada e o mercado costuma reagir com menor volatilidade no curto prazo.",
  },
  LIQUIDACAO: {
    label: "Liquidação",
    color: "#dc2626",
    description:
      "Fase de maior descarte de fêmeas. A oferta de animais cresce no curto prazo e tende a pressionar os preços.",
  },
} as const

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

function buildYearSeries(
  monthlyAverages: Map<string, number>,
  startYear: number,
  endYear: number
) {
  const years: number[] = []
  for (let y = startYear; y <= endYear; y += 1) years.push(y)

  return MONTH_NAMES.map((monthName, idx) => {
    const month = String(idx + 1).padStart(2, "0")
    const row: Record<string, string | number | null> = { mes: monthName }
    for (const year of years) {
      const value = monthlyAverages.get(`${year}-${month}`)
      row[String(year)] = value ?? null
    }
    return row
  })
}

export default function CicloPecuarioPage() {
  const { cicloPecuario, globalDateRange, isSuperAdmin, historicalData } = useData()
  const regioes = useMemo(() => [...new Set(cicloPecuario.map((r) => r.regiao))], [cicloPecuario])
  const [regiao, setRegiao] = useState<string>(regioes[0] || "BRASIL")

  const rows = useMemo(
    () =>
      cicloPecuario
        .filter((r) => r.regiao === regiao)
        .filter((r) => {
          const time = new Date(`${r.periodo}T12:00:00`).getTime()
          if (globalDateRange?.from && time < globalDateRange.from.getTime()) return false
          if (globalDateRange?.to && time > globalDateRange.to.getTime()) return false
          return true
        }),
    [cicloPecuario, regiao, globalDateRange]
  )

  const latest = rows[rows.length - 1]
  const previous = rows.length > 1 ? rows[rows.length - 2] : null
  const deltaTaxa = latest && previous ? latest.taxa_femeas_pct - previous.taxa_femeas_pct : null
  const sugestaoCondicao = deltaTaxa !== null && deltaTaxa >= 0 ? "acima_de" : "abaixo_de"

  const phase = (latest?.fase_ciclo || "ESTABILIDADE") as keyof typeof PHASE_META

  const monthlyAverages = useMemo(() => {
    const boiRows = historicalData.filter((row) => row.produto === "boi_gordo")
    const buckets = new Map<string, number[]>()

    for (const row of boiRows) {
      const d = new Date(`${row.data}T12:00:00`)
      if (Number.isNaN(d.getTime())) continue
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const key = `${year}-${String(month).padStart(2, "0")}`
      const list = buckets.get(key) || []
      list.push(row.valor_brl)
      buckets.set(key, list)
    }

    const out = new Map<string, number>()
    for (const [key, values] of buckets.entries()) {
      const avg = values.reduce((acc, val) => acc + val, 0) / values.length
      out.set(key, avg)
    }
    return out
  }, [historicalData])

  const chartData2015_2024 = useMemo(
    () => buildYearSeries(monthlyAverages, 2015, 2024),
    [monthlyAverages]
  )
  const chartData2020_2024 = useMemo(
    () => buildYearSeries(monthlyAverages, 2020, 2024),
    [monthlyAverages]
  )

  const lineColors: Record<string, string> = {
    "2015": "#f59e0b",
    "2016": "#f97316",
    "2017": "#ef4444",
    "2018": "#ec4899",
    "2019": "#38bdf8",
    "2020": "#14b8a6",
    "2021": "#22c55e",
    "2022": "#84cc16",
    "2023": "#eab308",
    "2024": "#f97316",
  }

  return (
    <>
      <PageHeader
        title="Ciclo Pecuário"
        description="Classificação mensal por participação de fêmeas no abate"
      >
        <InfoHint text="Leitura rápida: taxa de fêmeas subindo sugere liquidação. Caindo, sugere retenção. Isso ajuda a antecipar ciclos de oferta e preço." />
        <Select value={regiao} onValueChange={setRegiao}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {regioes.map((r) => <SelectItem key={r} value={r}>{formatLocationLabel(r)}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fase do ciclo</CardTitle>
              <CardDescription>{formatLocationLabel(regiao)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative mx-auto w-full md:w-[70%] xl:w-[60%] overflow-hidden rounded-lg border border-border/60">
                  <div className="absolute left-3 top-3 z-10">
                    <Badge style={{ backgroundColor: `${PHASE_META[phase].color}E6`, color: "#fff" }}>
                      Fase atual: {PHASE_META[phase].label}
                    </Badge>
                  </div>
                  <div className="absolute right-3 top-3 z-10 rounded-md bg-background/80 px-2 py-1 text-xs font-semibold">
                    {formatLocationLabel(regiao)}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 z-[1]"
                    style={{
                      boxShadow: `inset 0 0 0 3px ${PHASE_META[phase].color}66`,
                    }}
                  />
                  <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-background/80 px-3 py-1 text-xs">
                    Destaque visual do ciclo pecuário em andamento
                  </div>
                  <div className="w-full">
                    <Image
                      src="https://ztlddoutgextdmyiwoxl.supabase.co/storage/v1/object/sign/inteligencia_pecuaria/ChatGPT%20Image%2028%20de%20abr.%20de%202026,%2016_01_31.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNDA2OTRjYy04ZjYzLTQxODMtOTQxZS0wMGVkZDJkMjg0MTgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbnRlbGlnZW5jaWFfcGVjdWFyaWEvQ2hhdEdQVCBJbWFnZSAyOCBkZSBhYnIuIGRlIDIwMjYsIDE2XzAxXzMxLndlYnAiLCJpYXQiOjE3Nzc0MDMwNDksImV4cCI6NDkzMTAwMzA0OX0.PaL6SUp-APAPOufJbzLdhDgFumFisxtq6w0afxh-fRY"
                      alt="Fases do ciclo pecuário"
                      width={1280}
                      height={1280}
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Badge style={{ backgroundColor: `${PHASE_META[phase].color}1A`, color: PHASE_META[phase].color }}>
                    {PHASE_META[phase].label}
                  </Badge>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {PHASE_META[phase].description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa de fêmeas</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.taxa_femeas_pct.toFixed(2)}%` : "—"}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Média móvel (12m)</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.media_movel_12m.toFixed(2)}%` : "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Variação mensal</CardTitle>
              <CardDescription>Comparativo com o período anterior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={`text-3xl font-bold tabular-nums ${deltaTaxa !== null && deltaTaxa < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {deltaTaxa !== null ? `${deltaTaxa >= 0 ? "+" : ""}${deltaTaxa.toFixed(2)} p.p.` : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Ajuste de referência para gatilho automático conforme tendência atual do ciclo.</p>
              {isSuperAdmin && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/alertas?auto=1&produto=boi_gordo&condicao=${sugestaoCondicao}`}>Ir para Alertas Pro</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Série histórica</CardTitle>
            <CardDescription>{formatLocationLabel(regiao)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[340px] w-full">
              <LineChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                <XAxis
                  dataKey="periodo"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                  tickFormatter={(value) => format(new Date(`${value}T12:00:00`), "MM/yy", { locale: ptBR })}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  labelFormatter={(value) => format(new Date(`${String(value)}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                />
                <Line type="monotone" dataKey="taxa_femeas_pct" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="media_movel_12m" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Como o Ciclo Impacta o Preço da Arroba</CardTitle>
            <CardDescription>
              O preço do boi gordo é balizador das demais fases da pecuária e responde à dinâmica de oferta e demanda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground leading-relaxed">
            <p>
              A decisão dos produtores de aumentar ou reduzir o rebanho impacta diretamente o preço da arroba.
              O aumento do abate de fêmeas eleva a oferta de carne no curto prazo e tende a pressionar o preço do boi.
              A retenção de matrizes reduz oferta imediata e tende a sustentar alta da arroba.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3"><span className="font-semibold text-foreground">1.</span> Baixa oferta de bezerros eleva o preço do bezerro.</div>
              <div className="rounded-lg border p-3"><span className="font-semibold text-foreground">2.</span> Retenção de matrizes reduz oferta de carne e tende a elevar a arroba.</div>
              <div className="rounded-lg border p-3"><span className="font-semibold text-foreground">3.</span> Maior retenção aumenta a produção de bezerros ao longo do tempo.</div>
              <div className="rounded-lg border p-3"><span className="font-semibold text-foreground">4.</span> Com queda do bezerro, aumenta o abate de fêmeas e a arroba tende a cair.</div>
              <div className="rounded-lg border p-3 md:col-span-2"><span className="font-semibold text-foreground">5.</span> Redução de matrizes diminui a produção futura de bezerros e reinicia o ciclo.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gráfico 1 · Variação mensal média da arroba (2015–2024)</CardTitle>
            <CardDescription>Médias mensais CEPEA (sem correção inflacionária), por ano.</CardDescription>
          </CardHeader>
          <CardContent className="h-[430px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData2015_2024} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {Array.from({ length: 10 }, (_, i) => 2015 + i).map((year) => (
                  <Line
                    key={String(year)}
                    type="monotone"
                    dataKey={String(year)}
                    stroke={lineColors[String(year)] || "#64748b"}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gráfico 2 · Variação mensal média da arroba (2020–2024)</CardTitle>
            <CardDescription>Zoom do ciclo mais recente para leitura tática.</CardDescription>
          </CardHeader>
          <CardContent className="h-[430px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData2020_2024} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {Array.from({ length: 5 }, (_, i) => 2020 + i).map((year) => (
                  <Line
                    key={String(year)}
                    type="monotone"
                    dataKey={String(year)}
                    stroke={lineColors[String(year)] || "#64748b"}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
