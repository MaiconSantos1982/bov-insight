"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
    ComposedChart,
    Area,
    Line,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    ReferenceLine,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"

const chartConfig = {
    boi_gordo: { label: "Boi Gordo (R$/@)", color: "var(--chart-1)" },
    bezerro: { label: "Bezerro (R$/cab)", color: "var(--chart-2)" },
    milho: { label: "Milho (R$/sc)", color: "var(--chart-3)" },
    soja: { label: "Soja (R$/sc)", color: "var(--chart-4)" },
    relacao_boi_milho: { label: "Boi/Milho (sacas)", color: "var(--chart-1)" },
    relacao_boi_soja: { label: "Boi/Soja (sacas)", color: "var(--chart-3)" },
    relacao_boi_bezerro: { label: "Boi/Bezerro (cab/@)", color: "var(--chart-2)" },
} satisfies ChartConfig

type Agrupamento = 'day' | 'week' | 'month'

export default function RelacaoTrocaPage() {
    const { getRelacaoTroca, globalDateRange } = useData()
    const [agrupamento, setAgrupamento] = useState<Agrupamento>('week')
    const [comparacao, setComparacao] = useState<'milho' | 'soja' | 'bezerro'>('milho')

    const rawData = useMemo(() => {
        return getRelacaoTroca(globalDateRange, agrupamento)
    }, [getRelacaoTroca, globalDateRange, agrupamento])

    const chartData = useMemo(() => {
        return rawData.map(d => {
            const relacao_boi_milho = d.boi_gordo && d.milho ? Math.round((d.boi_gordo / d.milho) * 100) / 100 : null
            const relacao_boi_soja = d.boi_gordo && d.soja ? Math.round((d.boi_gordo / d.soja) * 100) / 100 : null
            const relacao_boi_bezerro = d.boi_gordo && d.bezerro ? Math.round((d.bezerro / d.boi_gordo) * 100) / 100 : null
            return { ...d, relacao_boi_milho, relacao_boi_soja, relacao_boi_bezerro }
        })
    }, [rawData])

    const avgRelacao = useMemo(() => {
        const key = comparacao === 'milho' ? 'relacao_boi_milho' : comparacao === 'soja' ? 'relacao_boi_soja' : 'relacao_boi_bezerro'
        const values = chartData.map(d => d[key]).filter(Boolean) as number[]
        return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
    }, [chartData, comparacao])

    const currentRelacao = useMemo(() => {
        const key = comparacao === 'milho' ? 'relacao_boi_milho' : comparacao === 'soja' ? 'relacao_boi_soja' : 'relacao_boi_bezerro'
        const last = chartData[chartData.length - 1]
        return last ? last[key] : 0
    }, [chartData, comparacao])

    const relacaoLabel = comparacao === 'milho'
        ? 'sacas de milho por arroba'
        : comparacao === 'soja'
            ? 'sacas de soja por arroba'
            : 'arrobas por bezerro'

    return (
        <>
            <PageHeader
                title="Relação de Troca"
                description="Compare o poder de compra da arroba de boi contra insumos e bezerro"
            >
                <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
                    <SelectTrigger className="w-[130px] h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day">Diário</SelectItem>
                        <SelectItem value="week">Semanal</SelectItem>
                        <SelectItem value="month">Mensal</SelectItem>
                    </SelectContent>
                </Select>
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                {/* KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="card-hover cursor-pointer" onClick={() => setComparacao('milho')}>
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Boi / Milho</p>
                                    <p className="text-2xl font-bold mt-1 tabular-nums">
                                        {chartData.length ? (chartData[chartData.length - 1]?.relacao_boi_milho?.toFixed(1) || '—') : '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">sacas por arroba</p>
                                </div>
                                <div className={`size-3 rounded-full ${comparacao === 'milho' ? 'bg-chart-1 animate-pulse-dot' : 'bg-muted'}`} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-hover cursor-pointer" onClick={() => setComparacao('soja')}>
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Boi / Soja</p>
                                    <p className="text-2xl font-bold mt-1 tabular-nums">
                                        {chartData.length ? (chartData[chartData.length - 1]?.relacao_boi_soja?.toFixed(1) || '—') : '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">sacas por arroba</p>
                                </div>
                                <div className={`size-3 rounded-full ${comparacao === 'soja' ? 'bg-chart-3 animate-pulse-dot' : 'bg-muted'}`} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-hover cursor-pointer" onClick={() => setComparacao('bezerro')}>
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Boi / Bezerro</p>
                                    <p className="text-2xl font-bold mt-1 tabular-nums">
                                        {chartData.length ? (chartData[chartData.length - 1]?.relacao_boi_bezerro?.toFixed(1) || '—') : '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">arrobas por bezerro</p>
                                </div>
                                <div className={`size-3 rounded-full ${comparacao === 'bezerro' ? 'bg-chart-2 animate-pulse-dot' : 'bg-muted'}`} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Dual-Axis Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <CardTitle className="text-base">Preços com Eixos Duplos</CardTitle>
                                <CardDescription>
                                    Eixo esquerdo: Boi Gordo (R$/@) · Eixo direito: {comparacao === 'milho' ? 'Milho' : comparacao === 'soja' ? 'Soja' : 'Bezerro'} (R$/{comparacao === 'bezerro' ? 'cab' : 'sc'})
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs gap-1.5">
                                Relação atual: <span className="font-bold text-primary">{currentRelacao?.toFixed(2) || '—'}</span> {relacaoLabel}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[400px] w-full">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fillBoiGordoRT" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
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
                                        return format(date, agrupamento === 'month' ? "MMM/yy" : "dd/MM", { locale: ptBR })
                                    }}
                                    className="text-xs"
                                    interval="preserveStartEnd"
                                />
                                <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" tickFormatter={(v) => `R$${v}`} domain={['auto', 'auto']} orientation="left" />
                                <YAxis yAxisId="right" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" tickFormatter={(v) => `R$${v}`} domain={['auto', 'auto']} orientation="right" />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(value) => {
                                        const date = new Date(value + 'T12:00:00')
                                        return format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })
                                    }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="boi_gordo" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#fillBoiGordoRT)" dot={false} name="Boi Gordo (R$/@)" />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey={comparacao}
                                    stroke={comparacao === 'milho' ? 'var(--chart-3)' : comparacao === 'soja' ? 'var(--chart-4)' : 'var(--chart-2)'}
                                    strokeWidth={2}
                                    dot={false}
                                    strokeDasharray={comparacao === 'bezerro' ? undefined : "5 5"}
                                    name={`${comparacao === 'milho' ? 'Milho' : comparacao === 'soja' ? 'Soja' : 'Bezerro'} (R$/${comparacao === 'bezerro' ? 'cab' : 'sc'})`}
                                />
                            </ComposedChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Exchange Ratio Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <CardTitle className="text-base">Relação de Troca: Boi Gordo / {comparacao === 'milho' ? 'Milho' : comparacao === 'soja' ? 'Soja' : 'Bezerro'}</CardTitle>
                                <CardDescription>
                                    Quantas {relacaoLabel} — Média do período: <span className="text-foreground font-semibold">{avgRelacao.toFixed(2)}</span>
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                <XAxis
                                    dataKey="data_ref"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => {
                                        const date = new Date(value + 'T12:00:00')
                                        return format(date, agrupamento === 'month' ? "MMM/yy" : "dd/MM", { locale: ptBR })
                                    }}
                                    className="text-xs"
                                    interval="preserveStartEnd"
                                />
                                <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" domain={['auto', 'auto']} />
                                <ReferenceLine
                                    y={avgRelacao}
                                    stroke="var(--muted-foreground)"
                                    strokeDasharray="6 4"
                                    strokeWidth={1}
                                    label={{ value: `Média: ${avgRelacao.toFixed(1)}`, position: 'right', fontSize: 11, fill: 'var(--muted-foreground)' }}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(value) => {
                                        const date = new Date(value + 'T12:00:00')
                                        return format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })
                                    }}
                                />
                                <Bar
                                    dataKey={comparacao === 'milho' ? 'relacao_boi_milho' : comparacao === 'soja' ? 'relacao_boi_soja' : 'relacao_boi_bezerro'}
                                    fill={comparacao === 'milho' ? 'var(--chart-1)' : comparacao === 'soja' ? 'var(--chart-3)' : 'var(--chart-2)'}
                                    fillOpacity={0.6}
                                    radius={[4, 4, 0, 0]}
                                    name={`Relação Boi/${comparacao === 'milho' ? 'Milho' : comparacao === 'soja' ? 'Soja' : 'Bezerro'}`}
                                />
                            </ComposedChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
