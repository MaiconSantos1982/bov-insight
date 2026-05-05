"use client"

import { useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Beef, Wheat, Bean, ArrowUpRight, ArrowDownRight, Globe2, GitBranch } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Line } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PageHeader } from "@/components/page-header"
import { PriceCard } from "@/components/price-card"
import MobileStockWidget, { StockItem } from "@/components/stock-05"
import { useData } from "@/lib/data-provider"
import { PRODUTOS } from "@/lib/supabase"

const chartConfig = {
    boi_gordo: { label: "Boi Gordo", color: "var(--chart-1)" },
    bezerro: { label: "Bezerro", color: "var(--chart-2)" },
    milho: { label: "Milho", color: "var(--chart-3)" },
    soja: { label: "Soja", color: "var(--chart-4)" },
} satisfies ChartConfig

const priceCardIcons: Record<string, React.ReactNode> = {
    boi_gordo: <Beef className="size-5" />,
    bezerro: <Beef className="size-5" />,
    milho: <Wheat className="size-5" />,
    soja: <Bean className="size-5" />,
}

const priceCardDotColors: Record<string, string> = {
    boi_gordo: "bg-emerald-600",
    bezerro: "bg-amber-500",
    milho: "bg-blue-500",
    soja: "bg-red-400",
}

export default function DashboardPage() {
    const {
        latestPrices,
        previousPrices,
        getRelacaoTroca,
        globalDateRange,
        cicloPecuario,
        exportacaoResumo,
    } = useData()

    const chartData = useMemo(() => {
        return getRelacaoTroca(globalDateRange, 'day')
    }, [getRelacaoTroca, globalDateRange])

    const latestCicloBrasil = useMemo(
        () => [...cicloPecuario]
            .filter((row) => row.regiao === "BRASIL")
            .sort((a, b) => b.periodo.localeCompare(a.periodo))[0],
        [cicloPecuario]
    )

    const latestExportacao = exportacaoResumo[exportacaoResumo.length - 1]

    const widgetItems: StockItem[] = useMemo(() => {
        return Object.entries(PRODUTOS).map(([key, info]) => {
            const current = latestPrices[key]
            return {
                key,
                title: info.label,
                price: current?.valor_brl || 0,
                unit: info.unit,
                icon: priceCardIcons[key],
            }
        }).filter(item => item.price > 0)
    }, [latestPrices])

    // Calculate 30-day trend
    const recentData = chartData.slice(-8)
    const olderData = chartData.slice(-16, -8)

    function getTrend(product: string): { direction: 'up' | 'down' | 'stable', percent: number } {
        const getVal = (d: typeof chartData[0], key: string) => {
            return (d as unknown as Record<string, number | null>)[key] ?? 0
        }
        const recentAvg = recentData.reduce((sum, d) => sum + (getVal(d, product) || 0), 0) / (recentData.length || 1)
        const olderAvg = olderData.reduce((sum, d) => sum + (getVal(d, product) || 0), 0) / (olderData.length || 1)
        const percent = olderAvg ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0
        return {
            direction: percent > 0.5 ? 'up' : percent < -0.5 ? 'down' : 'stable',
            percent: Math.abs(percent),
        }
    }

    return (
        <>
            <PageHeader
                title="Dashboard"
                description="Visão geral dos indicadores e tendências de mercado"
            />

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="card-hover">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Ciclo Pecuário</p>
                                    <p className="text-2xl font-bold mt-1">{latestCicloBrasil?.fase_ciclo === "LIQUIDACAO" ? "Liquidação" : latestCicloBrasil?.fase_ciclo === "RETENCAO" ? "Retenção" : latestCicloBrasil?.fase_ciclo === "ESTABILIDADE" ? "Estabilidade" : "—"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {latestCicloBrasil ? `${latestCicloBrasil.taxa_femeas_pct.toFixed(2)}% de fêmeas` : "Sem dados"}
                                    </p>
                                </div>
                                <GitBranch className="size-5 text-primary" />
                            </div>
                            <div className="mt-3">
                                <Link href="/ciclo-pecuario" className="text-xs text-primary hover:underline">Abrir módulo</Link>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-hover">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Exportações</p>
                                    <p className="text-2xl font-bold mt-1 tabular-nums">{latestExportacao ? `${latestExportacao.dependencia_china_pct.toFixed(1)}%` : "—"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Dependência China</p>
                                </div>
                                <Globe2 className="size-5 text-primary" />
                            </div>
                            <div className="mt-3">
                                <Link href="/exportacoes" className="text-xs text-primary hover:underline">Abrir módulo</Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Price Cards Mobile */}
                <div className="flex sm:hidden w-full flex-col items-center gap-4">
                    <MobileStockWidget items={widgetItems} className="w-full max-w-[340px] shadow-sm bg-card hover:bg-card/90 transition-colors" />
                </div>

                {/* Price Cards Desktop */}
                <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(PRODUTOS).map(([key, info]) => {
                        const current = latestPrices[key]
                        const previous = previousPrices[key]
                        if (!current) return null
                        return (
                            <PriceCard
                                key={key}
                                title={info.label}
                                currentPrice={current.valor_brl}
                                previousPrice={previous?.valor_brl || current.valor_brl}
                                unit={info.unit}
                                icon={priceCardIcons[key]}
                            />
                        )
                    })}
                </div>

                {/* Main Chart + Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Price Evolution Chart */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Evolução de Preços</CardTitle>
                                    <CardDescription>Indicadores no período selecionado</CardDescription>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse-dot" />
                                    <span className="text-xs text-muted-foreground">Atualizado</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[320px] w-full">
                                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="fillBoiGordo" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                    <XAxis
                                        dataKey="data_ref"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => {
                                            const date = new Date(value + 'T12:00:00')
                                            return format(date, "dd/MM", { locale: ptBR })
                                        }}
                                        className="text-xs"
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        className="text-xs"
                                        tickFormatter={(v) => `R$${v}`}
                                        domain={['auto', 'auto']}
                                    />
                                    <ChartTooltip
                                        content={<ChartTooltipContent />}
                                        labelFormatter={(value) => {
                                            const date = new Date(value + 'T12:00:00')
                                            return format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="boi_gordo"
                                        stroke="var(--chart-1)"
                                        strokeWidth={2}
                                        fill="url(#fillBoiGordo)"
                                        dot={false}
                                        connectNulls
                                    />
                                    <Line type="monotone" dataKey="milho" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} connectNulls />
                                    <Line type="monotone" dataKey="soja" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} connectNulls />
                                </AreaChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    {/* Market Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Resumo de Mercado</CardTitle>
                            <CardDescription>Tendência dos últimos 60 dias</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {Object.entries(PRODUTOS).map(([key, info]) => {
                                const trend = getTrend(key)
                                return (
                                    <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-2.5 rounded-full ${priceCardDotColors[key]}`} />
                                            <div>
                                                <p className="text-sm font-medium">{info.label}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    R$ {latestPrices[key]?.valor_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '—'}/{info.unit}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {trend.direction === 'up' ? (
                                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 gap-1">
                                                    <ArrowUpRight className="size-3" />
                                                    {trend.percent.toFixed(1)}%
                                                </Badge>
                                            ) : trend.direction === 'down' ? (
                                                <Badge variant="secondary" className="bg-rose-500/10 text-rose-500 border-0 gap-1">
                                                    <ArrowDownRight className="size-3" />
                                                    {trend.percent.toFixed(1)}%
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">
                                                    Estável
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                        </CardContent>
                    </Card>
                </div>

                {/* Bottom Row - Bezerro chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Bezerro</CardTitle>
                                <CardDescription>Evolução do preço da cabeça no período</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                {latestPrices['bezerro']
                                    ? `R$ ${latestPrices['bezerro'].valor_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : '—'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[200px] w-full">
                            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fillBezerro" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                <XAxis
                                    dataKey="data_ref"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => {
                                        const date = new Date(value + 'T12:00:00')
                                        return format(date, "dd/MM", { locale: ptBR })
                                    }}
                                    className="text-xs"
                                    interval="preserveStartEnd"
                                />
                                <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" tickFormatter={(v) => `R$${v}`} domain={['auto', 'auto']} />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(value) => {
                                        const date = new Date(value + 'T12:00:00')
                                        return format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="bezerro"
                                    stroke="var(--chart-2)"
                                    strokeWidth={2}
                                    fill="url(#fillBezerro)"
                                    dot={false}
                                />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

            </div>
        </>
    )
}
