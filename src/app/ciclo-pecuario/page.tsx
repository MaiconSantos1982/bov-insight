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

export default function CicloPecuarioPage() {
    const { cicloPecuario, globalDateRange } = useData()
    const regioes = useMemo(() => [...new Set(cicloPecuario.map((r) => r.regiao))], [cicloPecuario])
    const [regiao, setRegiao] = useState<string>(regioes[0] || "BRASIL")

    const rows = useMemo(
        () => cicloPecuario
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

    const faseColor = latest?.fase_ciclo === "RETENCAO"
        ? "bg-emerald-500/10 text-emerald-500"
        : latest?.fase_ciclo === "LIQUIDACAO"
            ? "bg-rose-500/10 text-rose-500"
            : "bg-amber-500/10 text-amber-500"

    return (
        <>
            <PageHeader
                title="Ciclo Pecuário"
                description="Classificação mensal por taxa de participação de fêmeas no abate"
            >
                <InfoHint text="Leitura rápida: quando a taxa de fêmeas sobe, tende a indicar liquidacao de rebanho (mais oferta no curto prazo). Quando cai, tende a indicar retencao (menor oferta futura e suporte de preco)." />
                <Select value={regiao} onValueChange={setRegiao}>
                    <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {regioes.map((r) => <SelectItem key={r} value={r}>{formatLocationLabel(r)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Fase Atual</p>
                        <div className="mt-2">
                            <Badge className={faseColor}>{latest?.fase_ciclo || "—"}</Badge>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa Fêmeas</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.taxa_femeas_pct.toFixed(2)}%` : "—"}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Média 12m</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.media_movel_12m.toFixed(2)}%` : "—"}</p>
                    </CardContent></Card>
                </div>
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Variação vs período anterior</p>
                            <p className={`text-2xl font-bold mt-1 tabular-nums ${deltaTaxa !== null && deltaTaxa < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                                {deltaTaxa !== null ? `${deltaTaxa >= 0 ? "+" : ""}${deltaTaxa.toFixed(2)} p.p.` : "—"}
                            </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/alertas?auto=1&produto=boi_gordo&condicao=${sugestaoCondicao}`}>Ir para Alertas Pro</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Série Histórica</CardTitle>
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
