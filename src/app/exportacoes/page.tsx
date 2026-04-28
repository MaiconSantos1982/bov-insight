"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/info-hint"

interface ExportacaoDatagroOperacional {
    ok: boolean
    fonte?: string
    data_ref?: string | null
    quantidade_t?: number | null
    quantidade_var_pct?: number | null
    preco_usd_t?: number | null
    preco_var_pct?: number | null
    volume_usd?: number | null
    volume_var_pct?: number | null
}

const chartConfig = {
    dependencia_china_pct: { label: "Dependência China (%)", color: "var(--chart-1)" },
    preco_medio_usd_t_global: { label: "Preço Médio USD/t", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function ExportacoesPage() {
    const { exportacaoResumo, globalDateRange, isSuperAdmin } = useData()
    const [datagro, setDatagro] = useState<ExportacaoDatagroOperacional | null>(null)
    const filtered = useMemo(
        () => exportacaoResumo.filter((r) => {
            const time = new Date(`${r.periodo}T12:00:00`).getTime()
            if (globalDateRange?.from && time < globalDateRange.from.getTime()) return false
            if (globalDateRange?.to && time > globalDateRange.to.getTime()) return false
            return true
        }),
        [exportacaoResumo, globalDateRange]
    )
    const latest = filtered[filtered.length - 1]
    const previous = filtered.length > 1 ? filtered[filtered.length - 2] : null
    const deltaDependencia = latest && previous ? latest.dependencia_china_pct - previous.dependencia_china_pct : null
    const sugestaoCondicao = deltaDependencia !== null && deltaDependencia >= 0 ? "abaixo_de" : "acima_de"

    const totalReceita = useMemo(
        () => filtered.reduce((sum, r) => sum + r.receita_total_usd, 0),
        [filtered]
    )

    useEffect(() => {
        let mounted = true
        void (async () => {
            try {
                const res = await fetch("/api/datagro/exportacoes-operacional", { cache: "no-store" })
                const json = (await res.json()) as ExportacaoDatagroOperacional
                if (!mounted) return
                if (json?.ok) setDatagro(json)
            } catch {
                if (!mounted) return
                setDatagro(null)
            }
        })()
        return () => {
            mounted = false
        }
    }, [])

    return (
        <>
            <PageHeader
                title="Exportações"
                description="Resumo mensal de exportação bovina e dependência de destinos-chave"
            >
                <InfoHint text="Leitura rápida: Dependencia China mostra quanto da receita exportada veio da China no mes. Quanto maior, maior o risco de impacto local caso a demanda chinesa desacelere. Preco medio USD/t mostra a qualidade do preco recebido no mercado externo." />
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Última Dependência China</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.dependencia_china_pct.toFixed(2)}%` : "—"}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Último Preço Médio</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `US$ ${latest.preco_medio_usd_t_global.toFixed(2)}/t` : "—"}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita Acumulada</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">US$ {totalReceita.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                    </CardContent></Card>
                </div>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Painel Operacional - Leitura tática de curto prazo</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Quantidade</p>
                                <p className="text-xl font-bold mt-1 tabular-nums">
                                    {datagro?.quantidade_t != null ? datagro.quantidade_t.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Variação: {datagro?.quantidade_var_pct != null ? `${datagro.quantidade_var_pct.toFixed(2)}%` : "—"}
                                </p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Preço US$/t</p>
                                <p className="text-xl font-bold mt-1 tabular-nums">
                                    {datagro?.preco_usd_t != null ? `US$ ${datagro.preco_usd_t.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Variação: {datagro?.preco_var_pct != null ? `${datagro.preco_var_pct.toFixed(2)}%` : "—"}
                                </p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Volume US$</p>
                                <p className="text-xl font-bold mt-1 tabular-nums">
                                    {datagro?.volume_usd != null ? `US$ ${datagro.volume_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Variação: {datagro?.volume_var_pct != null ? `${datagro.volume_var_pct.toFixed(2)}%` : "—"}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                            Referência: {datagro?.data_ref ? format(new Date(`${datagro.data_ref}T12:00:00`), "MM/yyyy", { locale: ptBR }) : "—"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Variação dependência China</p>
                            <p className={`text-2xl font-bold mt-1 tabular-nums ${deltaDependencia !== null && deltaDependencia < 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {deltaDependencia !== null ? `${deltaDependencia >= 0 ? "+" : ""}${deltaDependencia.toFixed(2)} p.p.` : "—"}
                            </p>
                        </div>
                        {isSuperAdmin && (
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/alertas?auto=1&produto=boi_gordo&condicao=${sugestaoCondicao}`}>Ir para Alertas Pro</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Série Mensal</CardTitle>
                        <CardDescription>Dependência China (%) e preço médio global (USD/t)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[340px] w-full">
                            <AreaChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                <XAxis
                                    dataKey="periodo"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    className="text-xs"
                                    tickFormatter={(value) => format(new Date(`${value}T12:00:00`), "MM/yy", { locale: ptBR })}
                                />
                                <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(value) => format(new Date(`${String(value)}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="dependencia_china_pct" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} strokeWidth={2} />
                                <Line yAxisId="right" type="monotone" dataKey="preco_medio_usd_t_global" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Detalhamento Mensal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Período</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Volume (t)</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Receita (USD)</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Dependência China</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Preço Médio USD/t</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...filtered].reverse().map((row) => (
                                        <tr key={row.periodo} className="border-b border-border/30 hover:bg-muted/30">
                                            <td className="py-2.5 px-3">{format(new Date(`${row.periodo}T12:00:00`), "MM/yyyy", { locale: ptBR })}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.volume_total_t.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">US$ {row.receita_total_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                            <td className="text-right py-2.5 px-3"><Badge variant="outline">{row.dependencia_china_pct.toFixed(2)}%</Badge></td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.preco_medio_usd_t_global.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 px-3 text-center text-muted-foreground">Sem dados de exportação.</td>
                                        </tr>
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
