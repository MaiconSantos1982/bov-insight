"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import Link from "next/link"
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

const PHASE_ORDER: Array<keyof typeof PHASE_META> = ["RETENCAO", "ESTABILIDADE", "LIQUIDACAO"]

export default function CicloPecuarioPage() {
  const { cicloPecuario, globalDateRange } = useData()
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
  const phaseIndex = PHASE_ORDER.indexOf(phase)
  const pointerDeg = phaseIndex === 0 ? -120 : phaseIndex === 1 ? 0 : 120

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
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="relative w-[280px] h-[280px] shrink-0">
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      background:
                        "conic-gradient(from -150deg, #059669 0deg 120deg, #d97706 120deg 240deg, #dc2626 240deg 360deg)",
                    }}
                  />
                  <div className="absolute inset-6 rounded-full bg-background border" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="origin-bottom"
                      style={{ transform: `translateY(-18px) rotate(${pointerDeg}deg)` }}
                    >
                      <div className="w-1 h-[120px] rounded-full bg-foreground/80" />
                    </div>
                    <div className="absolute w-4 h-4 rounded-full bg-foreground" />
                  </div>
                  <div className="absolute inset-0 flex items-start justify-center pt-5 text-[11px] font-semibold text-white">RETENÇÃO</div>
                  <div className="absolute inset-0 flex items-center justify-end pr-5 text-[11px] font-semibold text-white">ESTABILIDADE</div>
                  <div className="absolute inset-0 flex items-end justify-center pb-5 text-[11px] font-semibold text-white">LIQUIDAÇÃO</div>
                </div>

                <div className="flex-1 space-y-3">
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
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/alertas?auto=1&produto=boi_gordo&condicao=${sugestaoCondicao}`}>Ir para Alertas Pro</Link>
              </Button>
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
      </div>
    </>
  )
}
