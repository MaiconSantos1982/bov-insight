"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Legend, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"
import Image from "next/image"
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

const WHEEL_SEGMENTS = {
  preco_bezerro_sobe: { angle: "-18deg", label: "Preço do bezerro sobe" },
  retencao_matrizes: { angle: "18deg", label: "Retenção de matrizes" },
  diminuicao_carne: { angle: "54deg", label: "Diminuição da disponibilidade de carne" },
  arroba_sobe: { angle: "90deg", label: "Arroba do boi gordo sobe" },
  aumento_producao_bezerros: { angle: "126deg", label: "Aumento da produção de bezerros" },
  preco_bezerro_cai: { angle: "162deg", label: "Preço do bezerro cai" },
  abate_femeas: { angle: "198deg", label: "Abate de fêmeas" },
  aumento_carne: { angle: "234deg", label: "Aumento da disponibilidade de carne" },
  arroba_cai: { angle: "-90deg", label: "Arroba do boi gordo cai" },
  cai_producao_bezerros: { angle: "-54deg", label: "Cai a produção de bezerros" },
} as const

type WheelSegmentKey = keyof typeof WHEEL_SEGMENTS

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

function getProductTrend(
  data: { data: string; produto: string; valor_brl: number }[],
  produto: string
) {
  const rows = data
    .filter((row) => row.produto === produto)
    .sort((a, b) => b.data.localeCompare(a.data))

  const latest = rows[0]
  const previous = rows.find((row) => row.data < latest?.data)
  if (!latest || !previous) return null

  const delta = latest.valor_brl - previous.valor_brl
  const pct = previous.valor_brl ? (delta / previous.valor_brl) * 100 : 0

  return {
    latest,
    previous,
    delta,
    pct,
    direction: Math.abs(pct) < 0.1 ? "flat" : delta > 0 ? "up" : "down",
  } as const
}

function formatBrl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  })
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
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
  const boiTrend = useMemo(() => getProductTrend(historicalData, "boi_gordo"), [historicalData])
  const bezerroTrend = useMemo(() => getProductTrend(historicalData, "bezerro"), [historicalData])

  const activeWheelSegments = useMemo(() => {
    const segments = new Map<WheelSegmentKey, { reason: string; kind: "observed" | "inferred" }>()
    const addSegment = (
      key: WheelSegmentKey,
      reason: string,
      kind: "observed" | "inferred" = "observed"
    ) => {
      if (!segments.has(key)) segments.set(key, { reason, kind })
    }

    if (bezerroTrend?.direction === "up") {
      const reason = `Bezerro: ${formatBrl(bezerroTrend.previous.valor_brl)} -> ${formatBrl(bezerroTrend.latest.valor_brl)} (${formatPct(bezerroTrend.pct)})`
      addSegment("preco_bezerro_sobe", reason)
      addSegment("cai_producao_bezerros", "Inferência: bezerro valorizando sugere menor oferta disponível.", "inferred")
    } else if (bezerroTrend?.direction === "down") {
      const reason = `Bezerro: ${formatBrl(bezerroTrend.previous.valor_brl)} -> ${formatBrl(bezerroTrend.latest.valor_brl)} (${formatPct(bezerroTrend.pct)})`
      addSegment("preco_bezerro_cai", reason)
      addSegment("aumento_producao_bezerros", "Inferência: bezerro desvalorizando sugere maior oferta disponível.", "inferred")
    }

    if (deltaTaxa !== null) {
      if (deltaTaxa >= 0.15) {
        const reason = `Taxa de fêmeas subiu ${deltaTaxa.toFixed(2)} p.p. no mês.`
        addSegment("abate_femeas", reason)
        addSegment("aumento_carne", "Inferência: mais abate de fêmeas aumenta a oferta de carne.", "inferred")
      } else if (deltaTaxa <= -0.15) {
        const reason = `Taxa de fêmeas caiu ${Math.abs(deltaTaxa).toFixed(2)} p.p. no mês.`
        addSegment("retencao_matrizes", reason)
        addSegment("diminuicao_carne", "Inferência: retenção reduz a oferta imediata de carne.", "inferred")
      }
    } else {
      if (phase === "RETENCAO") {
        addSegment("retencao_matrizes", "Fallback pela classificação macro: retenção.")
        addSegment("diminuicao_carne", "Fallback pela classificação macro: retenção reduz oferta imediata.", "inferred")
      }
      if (phase === "LIQUIDACAO") {
        addSegment("abate_femeas", "Fallback pela classificação macro: liquidação.")
        addSegment("aumento_carne", "Fallback pela classificação macro: liquidação amplia oferta de carne.", "inferred")
      }
    }

    if (boiTrend?.direction === "up") {
      addSegment("arroba_sobe", `Boi gordo: ${formatBrl(boiTrend.previous.valor_brl)} -> ${formatBrl(boiTrend.latest.valor_brl)} (${formatPct(boiTrend.pct)})`)
    } else if (boiTrend?.direction === "down") {
      addSegment("arroba_cai", `Boi gordo: ${formatBrl(boiTrend.previous.valor_brl)} -> ${formatBrl(boiTrend.latest.valor_brl)} (${formatPct(boiTrend.pct)})`)
    }

    if (!segments.size) {
      const fallbackKey =
        phase === "RETENCAO"
          ? "retencao_matrizes"
          : phase === "LIQUIDACAO"
            ? "abate_femeas"
            : "arroba_cai"
      addSegment(fallbackKey, `Fallback pela fase macro: ${PHASE_META[phase].label}.`)
    }

    return Array.from(segments.entries()).map(([key, signal]) => ({
      key,
      ...signal,
      ...WHEEL_SEGMENTS[key],
    }))
  }, [bezerroTrend, boiTrend, deltaTaxa, phase])

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
                <div className="space-y-2">
                  <p className="text-base font-semibold" style={{ color: PHASE_META[phase].color }}>
                    Fase do ciclo: {PHASE_META[phase].label}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {PHASE_META[phase].description}
                  </p>
                </div>
                <div
                  className="cycle-wheel relative mx-auto w-full max-w-[620px] px-5 py-5 sm:px-8 sm:py-8"
                  style={
                    {
                      "--phase-color": PHASE_META[phase].color,
                    } as CSSProperties
                  }
                >
                  <div className="absolute right-3 top-3 z-10 rounded-md bg-background/80 px-2 py-1 text-xs font-semibold">
                    {formatLocationLabel(regiao)}
                  </div>
                  {activeWheelSegments.map((segment, index) => (
                    <div
                      key={segment.key}
                      className="cycle-wheel__indicator"
                      style={
                        {
                          "--segment-angle": segment.angle,
                          "--segment-index": index,
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    >
                      <div className="cycle-wheel__halo" />
                      <div className="cycle-wheel__pointer">
                        <div className="cycle-wheel__marker">
                          <strong>{index + 1}</strong>
                          <span />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="sr-only">
                    Sinais destacados na mandala: {activeWheelSegments.map((segment) => segment.label).join(", ")}
                  </div>
                  <div className="relative z-[1] w-full overflow-hidden rounded-lg">
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
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Leitura da mandala
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activeWheelSegments.map((segment, index) => (
                      <div key={segment.key} className="flex gap-2 rounded-md bg-background p-2 text-sm">
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: PHASE_META[phase].color }}
                        >
                          {index + 1}
                        </span>
                        <span>
                          <span className="font-semibold text-foreground">{segment.label}</span>
                          <span className="block text-xs leading-relaxed text-muted-foreground">
                            {segment.reason}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
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
