"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    ReferenceLine,
    BarChart,
    Bar,
    Cell,
} from "recharts"
import { ArrowDownRight, ArrowUpRight, Info, Minus, Sigma, TrendingUp, Waves } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { useData, type RelacaoTrocaRow } from "@/lib/data-provider"
import { PRODUTOS, type ProdutoKey } from "@/lib/supabase"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

type Agrupamento = "day" | "week" | "month"
type Janela = "30" | "60" | "90"
type TrendDirection = "up" | "down" | "sideways"
type TrendStrength = "fraca" | "moderada" | "forte"

interface TrendAnalysis {
    direction: TrendDirection
    strength: TrendStrength
    variationPct: number
    volatilityPct: number
    slopePct: number
    convictionPct: number
}

interface RatioAnalysis {
    key: "relacao_boi_milho" | "relacao_boi_soja" | "relacao_boi_bezerro"
    label: string
    current: number | null
    average: number | null
    deviationPct: number | null
    status: "acima" | "abaixo" | "neutra"
}

interface CorrelationRow {
    pair: string
    shortPair: string
    correlation: number
}

interface AnalysisChartRow extends RelacaoTrocaRow {
    boi_gordo_idx: number | null
    bezerro_idx: number | null
    milho_idx: number | null
    soja_idx: number | null
    relacao_boi_milho: number | null
    relacao_boi_soja: number | null
    relacao_boi_bezerro: number | null
}

const chartConfig = {
    boi_gordo_idx: { label: "Boi Gordo (base 100)", color: "var(--chart-1)" },
    bezerro_idx: { label: "Bezerro (base 100)", color: "var(--chart-2)" },
    milho_idx: { label: "Milho (base 100)", color: "var(--chart-3)" },
    soja_idx: { label: "Soja (base 100)", color: "var(--chart-4)" },
    correlation: { label: "Correlação", color: "var(--chart-1)" },
} satisfies ChartConfig

const productKeys: ProdutoKey[] = ["boi_gordo", "bezerro", "milho", "soja"]

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: number[]): number {
    if (values.length <= 1) return 0
    const avg = mean(values)
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
    return Math.sqrt(variance)
}

function getTrendAnalysis(series: number[], windowSize: number): TrendAnalysis | null {
    if (series.length < 4) return null

    const slice = series.slice(-Math.min(windowSize, series.length))
    const first = slice[0]
    const last = slice[slice.length - 1]
    if (!first) return null

    const variationPct = ((last - first) / first) * 100
    const returns: number[] = []
    for (let i = 1; i < slice.length; i++) {
        const previous = slice[i - 1]
        const current = slice[i]
        if (!previous) continue
        returns.push(((current - previous) / previous) * 100)
    }

    const volatilityPct = stdDev(returns)
    const yMean = mean(slice)
    let slope = 0
    let numerator = 0
    let denominator = 0
    const xMean = (slice.length - 1) / 2

    for (let i = 0; i < slice.length; i++) {
        const xDelta = i - xMean
        numerator += xDelta * (slice[i] - yMean)
        denominator += xDelta * xDelta
    }

    if (denominator > 0) {
        slope = numerator / denominator
    }

    const slopePct = yMean ? ((slope * (slice.length - 1)) / yMean) * 100 : 0
    const threshold = Math.max(1.2, volatilityPct * 1.1)
    const slopeThreshold = threshold * 0.35
    const absVariation = Math.abs(variationPct)
    const sameDirection = Math.sign(variationPct) === Math.sign(slopePct) || Math.abs(slopePct) < 0.01

    let direction: TrendDirection = "sideways"
    if (variationPct > threshold && slopePct > slopeThreshold && sameDirection) direction = "up"
    if (variationPct < -threshold && slopePct < -slopeThreshold && sameDirection) direction = "down"

    let strength: TrendStrength = "fraca"
    const trendScore = absVariation / Math.max(volatilityPct, 0.35)
    if (direction !== "sideways" && trendScore >= 2.2) {
        strength = "forte"
    } else if (direction !== "sideways" && trendScore >= 1.3) {
        strength = "moderada"
    }

    const convictionPct = Math.min(99, trendScore * 40)

    return {
        direction,
        strength,
        variationPct,
        volatilityPct,
        slopePct,
        convictionPct,
    }
}

function getPairedSeries(rows: RelacaoTrocaRow[], a: ProdutoKey, b: ProdutoKey): [number, number][] {
    const paired: [number, number][] = []
    for (const row of rows) {
        const aValue = row[a]
        const bValue = row[b]
        if (aValue !== null && bValue !== null) {
            paired.push([aValue, bValue])
        }
    }
    return paired
}

function pearsonCorrelation(pairedValues: [number, number][]): number | null {
    if (pairedValues.length < 4) return null

    const xs = pairedValues.map((value) => value[0])
    const ys = pairedValues.map((value) => value[1])
    const xMean = mean(xs)
    const yMean = mean(ys)

    let covariance = 0
    let xVariance = 0
    let yVariance = 0

    for (let i = 0; i < pairedValues.length; i++) {
        const xDelta = xs[i] - xMean
        const yDelta = ys[i] - yMean
        covariance += xDelta * yDelta
        xVariance += xDelta * xDelta
        yVariance += yDelta * yDelta
    }

    if (xVariance === 0 || yVariance === 0) return null
    return covariance / Math.sqrt(xVariance * yVariance)
}

function ratioStatus(deviationPct: number | null): "acima" | "abaixo" | "neutra" {
    if (deviationPct === null) return "neutra"
    if (deviationPct > 3) return "acima"
    if (deviationPct < -3) return "abaixo"
    return "neutra"
}

function formatTrendLabel(direction: TrendDirection): string {
    if (direction === "up") return "Alta"
    if (direction === "down") return "Baixa"
    return "Lateral"
}

export default function AnaliseGraficoPage() {
    const { getRelacaoTroca, globalDateRange } = useData()
    const [agrupamento, setAgrupamento] = useState<Agrupamento>("week")
    const [janela, setJanela] = useState<Janela>("60")

    const marketData = useMemo(() => {
        return getRelacaoTroca(globalDateRange, agrupamento)
    }, [getRelacaoTroca, globalDateRange, agrupamento])

    const analysisData = useMemo<AnalysisChartRow[]>(() => {
        const baseByProduct: Partial<Record<ProdutoKey, number>> = {}
        const rows: AnalysisChartRow[] = []

        for (const row of marketData) {
            for (const key of productKeys) {
                if (!baseByProduct[key] && row[key] !== null) {
                    baseByProduct[key] = row[key]
                }
            }

            const relacao_boi_milho =
                row.boi_gordo !== null && row.milho !== null ? row.boi_gordo / row.milho : null
            const relacao_boi_soja =
                row.boi_gordo !== null && row.soja !== null ? row.boi_gordo / row.soja : null
            const relacao_boi_bezerro =
                row.boi_gordo !== null && row.bezerro !== null ? row.bezerro / row.boi_gordo : null

            rows.push({
                ...row,
                boi_gordo_idx:
                    row.boi_gordo !== null && baseByProduct.boi_gordo
                        ? (row.boi_gordo / baseByProduct.boi_gordo) * 100
                        : null,
                bezerro_idx:
                    row.bezerro !== null && baseByProduct.bezerro
                        ? (row.bezerro / baseByProduct.bezerro) * 100
                        : null,
                milho_idx:
                    row.milho !== null && baseByProduct.milho
                        ? (row.milho / baseByProduct.milho) * 100
                        : null,
                soja_idx:
                    row.soja !== null && baseByProduct.soja
                        ? (row.soja / baseByProduct.soja) * 100
                        : null,
                relacao_boi_milho: relacao_boi_milho !== null ? Math.round(relacao_boi_milho * 100) / 100 : null,
                relacao_boi_soja: relacao_boi_soja !== null ? Math.round(relacao_boi_soja * 100) / 100 : null,
                relacao_boi_bezerro: relacao_boi_bezerro !== null ? Math.round(relacao_boi_bezerro * 100) / 100 : null,
            })
        }

        return rows
    }, [marketData])

    const trendByProduct = useMemo(() => {
        const windowSize = Number(janela)
        const entries = productKeys.map((key) => {
            const series = analysisData
                .map((row) => row[key])
                .filter((value): value is number => value !== null)
            return [key, getTrendAnalysis(series, windowSize)] as const
        })
        return Object.fromEntries(entries) as Record<ProdutoKey, TrendAnalysis | null>
    }, [analysisData, janela])

    const correlationRows = useMemo<CorrelationRow[]>(() => {
        const pairs: Array<{ a: ProdutoKey; b: ProdutoKey; label: string; short: string }> = [
            { a: "boi_gordo", b: "milho", label: "Boi Gordo x Milho", short: "Boi/Milho" },
            { a: "boi_gordo", b: "soja", label: "Boi Gordo x Soja", short: "Boi/Soja" },
            { a: "boi_gordo", b: "bezerro", label: "Boi Gordo x Bezerro", short: "Boi/Bezerro" },
            { a: "milho", b: "soja", label: "Milho x Soja", short: "Milho/Soja" },
        ]

        return pairs
            .map((pair) => {
                const pairedValues = getPairedSeries(marketData, pair.a, pair.b)
                const corr = pearsonCorrelation(pairedValues)
                return {
                    pair: pair.label,
                    shortPair: pair.short,
                    correlation: corr !== null ? Math.round(corr * 100) / 100 : 0,
                }
            })
            .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    }, [marketData])

    const ratioInsights = useMemo<RatioAnalysis[]>(() => {
        const ratioDefs: Array<Pick<RatioAnalysis, "key" | "label">> = [
            { key: "relacao_boi_milho", label: "Boi/Milho (sacas por arroba)" },
            { key: "relacao_boi_soja", label: "Boi/Soja (sacas por arroba)" },
            { key: "relacao_boi_bezerro", label: "Boi/Bezerro (arrobas por bezerro)" },
        ]

        return ratioDefs.map((ratioDef) => {
            const values = analysisData
                .map((row) => row[ratioDef.key])
                .filter((value): value is number => value !== null)
            const current = values.length ? values[values.length - 1] : null
            const average = values.length ? mean(values) : null
            const deviationPct = current !== null && average ? ((current - average) / average) * 100 : null

            return {
                key: ratioDef.key,
                label: ratioDef.label,
                current: current !== null ? Math.round(current * 100) / 100 : null,
                average: average !== null ? Math.round(average * 100) / 100 : null,
                deviationPct: deviationPct !== null ? Math.round(deviationPct * 10) / 10 : null,
                status: ratioStatus(deviationPct),
            }
        })
    }, [analysisData])

    return (
        <>
            <PageHeader
                title="Análise de Gráfico"
                description="Tendência, volatilidade, correlação e leitura de relação de troca em tela separada"
            >
                <Select value={agrupamento} onValueChange={(value) => setAgrupamento(value as Agrupamento)}>
                    <SelectTrigger className="w-[125px] h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day">Diário</SelectItem>
                        <SelectItem value="week">Semanal</SelectItem>
                        <SelectItem value="month">Mensal</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={janela} onValueChange={(value) => setJanela(value as Janela)}>
                    <SelectTrigger className="w-[125px] h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="30">Janela 30</SelectItem>
                        <SelectItem value="60">Janela 60</SelectItem>
                        <SelectItem value="90">Janela 90</SelectItem>
                    </SelectContent>
                </Select>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Informações das métricas">
                            <Info className="size-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden p-0">
                        <DialogHeader>
                            <DialogTitle className="px-6 pt-6">Leitura das Métricas</DialogTitle>
                            <DialogDescription className="px-6">
                                Explicação simples, em linguagem de campo, para facilitar a decisão.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm overflow-y-auto px-6 pb-6 max-h-[calc(85vh-100px)]">
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Tendência</p>
                                <p className="text-muted-foreground">
                                    Mostra para onde o preço está indo.
                                    <br />
                                    Alta = subindo.
                                    <br />
                                    Baixa = caindo.
                                    <br />
                                    Lateral = andando de lado.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Variação</p>
                                <p className="text-muted-foreground">
                                    Quanto o preço mudou no período.
                                    <br />
                                    Exemplo: +8% significa que ficou 8% mais caro.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Força</p>
                                <p className="text-muted-foreground">
                                    Diz se a tendência está fraca, média ou firme.
                                    <br />
                                    Forte = movimento mais consistente.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Volatilidade</p>
                                <p className="text-muted-foreground">
                                    É o nervosismo do preço.
                                    <br />
                                    Alta volatilidade = sobe e desce muito.
                                    <br />
                                    Baixa volatilidade = mercado mais calmo.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Inclinação</p>
                                <p className="text-muted-foreground">
                                    Mostra a velocidade do movimento.
                                    <br />
                                    Positiva = alta ganhando ritmo.
                                    <br />
                                    Negativa = queda ganhando ritmo.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Convicção</p>
                                <p className="text-muted-foreground">
                                    É a confiança do sinal.
                                    <br />
                                    Quanto maior, mais confiável parece o movimento.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Séries Normalizadas (Base 100)</p>
                                <p className="text-muted-foreground">
                                    Coloca boi, bezerro, milho e soja na mesma régua.
                                    <br />
                                    Assim fica fácil ver quem subiu ou caiu mais.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Correlação</p>
                                <p className="text-muted-foreground">
                                    Mostra se dois preços andam juntos.
                                    <br />
                                    Perto de +1 = sobem/caem juntos.
                                    <br />
                                    Perto de -1 = um sobe quando o outro cai.
                                </p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="font-medium">Desvio da Relação de Troca</p>
                                <p className="text-muted-foreground">
                                    Compara hoje com a média do período.
                                    <br />
                                    Acima da média = troca melhor que o normal.
                                    <br />
                                    Abaixo da média = troca pior que o normal.
                                </p>
                            </div>
                            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                                <p className="font-medium">Leitura rápida para decisão</p>
                                <p className="text-muted-foreground">
                                    Tendência + força + convicção altas indicam movimento mais confiável.
                                    <br />
                                    Se volatilidade estiver alta, tenha cuidado: o mercado pode virar rápido.
                                </p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {productKeys.map((key) => {
                        const analysis = trendByProduct[key]
                        const trendLabel = analysis ? formatTrendLabel(analysis.direction) : "Sem dados"

                        return (
                            <Card key={key}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">{PRODUTOS[key].label}</CardTitle>
                                    <CardDescription>Janela de {janela} pontos</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Tendência</span>
                                        {analysis?.direction === "up" ? (
                                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0 gap-1">
                                                <ArrowUpRight className="size-3" />
                                                {trendLabel}
                                            </Badge>
                                        ) : analysis?.direction === "down" ? (
                                            <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 border-0 gap-1">
                                                <ArrowDownRight className="size-3" />
                                                {trendLabel}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 gap-1">
                                                <Minus className="size-3" />
                                                {trendLabel}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-md border p-2">
                                            <p className="text-muted-foreground">Variação</p>
                                            <p className="font-semibold">
                                                {analysis ? `${analysis.variationPct >= 0 ? "+" : ""}${analysis.variationPct.toFixed(1)}%` : "—"}
                                            </p>
                                        </div>
                                        <div className="rounded-md border p-2">
                                            <p className="text-muted-foreground">Força</p>
                                            <p className="font-semibold capitalize">{analysis?.strength || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Waves className="size-3.5" />
                                        Volatilidade: {analysis ? `${analysis.volatilityPct.toFixed(2)}%` : "—"}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Inclinação</span>
                                        <span className="font-medium">
                                            {analysis ? `${analysis.slopePct >= 0 ? "+" : ""}${analysis.slopePct.toFixed(1)}%` : "—"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Convicção</span>
                                        <span className="font-medium">
                                            {analysis ? `${analysis.convictionPct.toFixed(0)}%` : "—"}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <Card className="xl:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Séries Normalizadas (Base 100)</CardTitle>
                            <CardDescription>
                                Compara direção e intensidade entre ativos em mesma escala
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[360px] w-full">
                                <LineChart data={analysisData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                    <XAxis
                                        dataKey="data_ref"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => {
                                            const date = new Date(value + "T12:00:00")
                                            return format(date, agrupamento === "month" ? "MMM/yy" : "dd/MM", { locale: ptBR })
                                        }}
                                        className="text-xs"
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        className="text-xs"
                                        domain={["auto", "auto"]}
                                        tickFormatter={(value) => `${Math.round(value)}`}
                                    />
                                    <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                                    <ChartTooltip
                                        content={<ChartTooltipContent />}
                                        labelFormatter={(value) => {
                                            const date = new Date(value + "T12:00:00")
                                            return format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })
                                        }}
                                    />
                                    <Line type="monotone" dataKey="boi_gordo_idx" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="bezerro_idx" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="milho_idx" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="soja_idx" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Matriz de Correlação</CardTitle>
                            <CardDescription>Leitura de co-movimento entre os ativos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <ChartContainer config={chartConfig} className="h-[220px] w-full">
                                <BarChart data={correlationRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                    <XAxis dataKey="shortPair" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        className="text-xs"
                                        domain={[-1, 1]}
                                    />
                                    <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="correlation" radius={[4, 4, 0, 0]}>
                                        {correlationRows.map((entry) => (
                                            <Cell
                                                key={entry.shortPair}
                                                fill={entry.correlation >= 0 ? "var(--chart-1)" : "var(--chart-4)"}
                                                fillOpacity={0.75}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>

                            <div className="space-y-2">
                                {correlationRows.map((row) => (
                                    <div key={row.pair} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                                        <span className="text-muted-foreground">{row.pair}</span>
                                        <Badge
                                            variant="secondary"
                                            className={row.correlation >= 0 ? "bg-emerald-500/10 text-emerald-600 border-0" : "bg-rose-500/10 text-rose-600 border-0"}
                                        >
                                            {row.correlation.toFixed(2)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Leitura de Relação de Troca</CardTitle>
                        <CardDescription>
                            Desvio da relação atual contra a média do período selecionado
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {ratioInsights.map((ratio) => (
                                <div key={ratio.key} className="rounded-lg border p-4 space-y-3">
                                    <p className="text-sm font-medium">{ratio.label}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Atual</span>
                                        <span className="text-sm font-semibold tabular-nums">
                                            {ratio.current !== null ? ratio.current.toFixed(2) : "—"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Média</span>
                                        <span className="text-sm font-semibold tabular-nums">
                                            {ratio.average !== null ? ratio.average.toFixed(2) : "—"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Desvio</span>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                ratio.status === "acima"
                                                    ? "bg-emerald-500/10 text-emerald-600 border-0"
                                                    : ratio.status === "abaixo"
                                                        ? "bg-rose-500/10 text-rose-600 border-0"
                                                        : "bg-muted text-muted-foreground border-0"
                                            }
                                        >
                                            {ratio.deviationPct !== null
                                                ? `${ratio.deviationPct >= 0 ? "+" : ""}${ratio.deviationPct.toFixed(1)}%`
                                                : "—"}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 rounded-lg border bg-primary/5 border-primary/10 p-3 flex items-center gap-2 text-sm">
                            <Sigma className="size-4 text-primary" />
                            <p>
                                Leitura rápida:
                                {" "}
                                {ratioInsights.some((item) => item.status === "acima")
                                    ? "há relações acima da média histórica do período."
                                    : ratioInsights.some((item) => item.status === "abaixo")
                                        ? "há relações abaixo da média histórica do período."
                                        : "as relações estão próximas da média histórica do período."}
                            </p>
                            <TrendingUp className="size-4 text-primary ml-auto" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
