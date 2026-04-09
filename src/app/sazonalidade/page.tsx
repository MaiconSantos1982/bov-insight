"use client"

import { useMemo, useState } from "react"
import { ComposedChart, Area, Line, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { PRODUTOS, type ProdutoKey } from "@/lib/supabase"
import { TrendingUp, TrendingDown, CalendarRange, Info } from "lucide-react"

const chartConfig = {
    media: { label: "Média Histórica", color: "var(--chart-1)" },
    min: { label: "Mínimo", color: "var(--chart-3)" },
    max: { label: "Máximo", color: "var(--chart-4)" },
    atual: { label: "Ano Atual (2026)", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function SazonalidadePage() {
    const { getSeasonality } = useData()
    const [produto, setProduto] = useState<ProdutoKey>('boi_gordo')
    const seasonData = useMemo(() => getSeasonality(produto), [getSeasonality, produto])
    const info = PRODUTOS[produto]
    const bestMonth = useMemo(() => [...seasonData].sort((a, b) => b.media - a.media)[0], [seasonData])
    const worstMonth = useMemo(() => [...seasonData].sort((a, b) => a.media - b.media)[0], [seasonData])
    const currentMonthIdx = new Date().getMonth()
    const currentMonthData = seasonData[currentMonthIdx]
    const currentVsAvg = currentMonthData?.atual && currentMonthData.media ? ((currentMonthData.atual - currentMonthData.media) / currentMonthData.media * 100) : null

    return (
        <>
            <PageHeader title="Sazonalidade" description="Identifique padrões sazonais de preços para planejar compras e vendas" showDatePicker={false}>
                <Select value={produto} onValueChange={(v) => setProduto(v as ProdutoKey)}>
                    <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {Object.entries(PRODUTOS).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}
                    </SelectContent>
                </Select>
            </PageHeader>
            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="card-hover"><CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-2"><TrendingUp className="size-4 text-emerald-500" /><p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Melhor Mês</p></div>
                        <p className="text-2xl font-bold">{bestMonth?.mes}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Média R$ {bestMonth?.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/{info.unit}</p>
                    </CardContent></Card>
                    <Card className="card-hover"><CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-2"><TrendingDown className="size-4 text-rose-500" /><p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pior Mês</p></div>
                        <p className="text-2xl font-bold">{worstMonth?.mes}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Média R$ {worstMonth?.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/{info.unit}</p>
                    </CardContent></Card>
                    <Card className="card-hover"><CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-2"><CalendarRange className="size-4 text-primary" /><p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Mês Atual</p></div>
                        <p className="text-2xl font-bold">{currentMonthData?.mes}</p>
                        {currentVsAvg !== null && <p className={`text-sm mt-0.5 ${currentVsAvg >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{currentVsAvg >= 0 ? '+' : ''}{currentVsAvg.toFixed(1)}% vs. média</p>}
                    </CardContent></Card>
                    <Card className="card-hover"><CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-2"><Info className="size-4 text-muted-foreground" /><p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Amplitude</p></div>
                        <p className="text-2xl font-bold tabular-nums">{bestMonth && worstMonth && bestMonth.media && worstMonth.media ? `${((bestMonth.media - worstMonth.media) / worstMonth.media * 100).toFixed(1)}%` : '—'}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Variação sazonal média</p>
                    </CardContent></Card>
                </div>
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div><CardTitle className="text-base">Padrão Sazonal – {info.label}</CardTitle><CardDescription>Faixa histórica (mín/máx), média e ano atual sobrepostos</CardDescription></div>
                            <Badge variant="outline" className="text-xs">Base: 3 anos de dados</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[400px] w-full">
                            <ComposedChart data={seasonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs><linearGradient id="fillRange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.15} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" tickFormatter={(v) => `R$${v}`} domain={['auto', 'auto']} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Area type="monotone" dataKey="max" stroke="none" fill="url(#fillRange)" name="Máximo" />
                                <Area type="monotone" dataKey="min" stroke="none" fill="var(--background)" name="Mínimo" />
                                <Line type="monotone" dataKey="media" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ fill: 'var(--chart-1)', r: 4, strokeWidth: 0 }} name="Média Histórica" />
                                <Line type="monotone" dataKey="atual" stroke="var(--chart-2)" strokeWidth={2.5} strokeDasharray="8 4" dot={{ fill: 'var(--chart-2)', r: 5, strokeWidth: 2, stroke: 'var(--background)' }} name="Ano Atual (2026)" connectNulls={false} />
                            </ComposedChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Detalhamento Mensal</CardTitle><CardDescription>Comparativo mês a mês dos preços de {info.label}</CardDescription></CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-border/50">
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Mês</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Mínimo</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Média</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Máximo</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">2026</th>
                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">vs. Média</th>
                                </tr></thead>
                                <tbody>{seasonData.map((row, i) => {
                                    const diff = row.atual && row.media ? ((row.atual - row.media) / row.media * 100) : null
                                    const isCurrent = i === currentMonthIdx
                                    return (<tr key={row.mes} className={`border-b border-border/30 ${isCurrent ? 'bg-primary/5' : 'hover:bg-muted/30'} transition-colors`}>
                                        <td className="py-2.5 px-3 font-medium">{row.mes}{isCurrent && <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 bg-primary/10 text-primary">Atual</Badge>}</td>
                                        <td className="text-right py-2.5 px-3 tabular-nums text-muted-foreground">R$ {row.min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="text-right py-2.5 px-3 tabular-nums font-medium">R$ {row.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="text-right py-2.5 px-3 tabular-nums text-muted-foreground">R$ {row.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="text-right py-2.5 px-3 tabular-nums font-medium">{row.atual !== null ? `R$ ${row.atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                                        <td className="text-right py-2.5 px-3 tabular-nums">{diff !== null ? <span className={diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}%</span> : '—'}</td>
                                    </tr>)
                                })}</tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
