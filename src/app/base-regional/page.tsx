"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/info-hint"
import { formatLocationLabel } from "@/lib/location-labels"

function formatSituacaoBase(value: string | undefined) {
    if (!value) return "—"
    if (value === "BASE_FORTE") return "Base Forte"
    if (value === "BASE_FRACA") return "Base Fraca"
    if (value === "BASE_NORMAL") return "Base Normal"
    return value
}

export default function BaseRegionalPage() {
    const { baseRegionalStats, globalDateRange } = useData()
    const pracas = useMemo(() => [...new Set(baseRegionalStats.map((r) => r.praca_local))], [baseRegionalStats])
    const [praca, setPraca] = useState<string>(pracas[0] || "GOIANIA")

    const rows = useMemo(
        () => baseRegionalStats
            .filter((r) => r.praca_local === praca)
            .filter((r) => {
                const time = new Date(`${r.data}T12:00:00`).getTime()
                if (globalDateRange?.from && time < globalDateRange.from.getTime()) return false
                if (globalDateRange?.to && time > globalDateRange.to.getTime()) return false
                return true
            })
            .sort((a, b) => b.data.localeCompare(a.data)),
        [baseRegionalStats, praca, globalDateRange]
    )
    const latest = rows[0]
    const previous = rows[1]
    const deltaBase = latest && previous ? latest.base_percentual - previous.base_percentual : null
    const sugestaoCondicao = deltaBase !== null && deltaBase >= 0 ? "abaixo_de" : "acima_de"

    const statusColor = latest?.situacao_base === "BASE_FORTE"
        ? "bg-emerald-500/10 text-emerald-500"
        : latest?.situacao_base === "BASE_FRACA"
            ? "bg-rose-500/10 text-rose-500"
            : "bg-amber-500/10 text-amber-500"

    return (
        <>
            <PageHeader
                title="Base Regional"
                description="Diferencial de base entre praça local e referência São Paulo"
            >
                <InfoHint text="Leitura rápida: Base = preco da praca local menos referencia SP. Base negativa indica desconto da praca local; base positiva indica premio. O status Forte/Normal/Fraca compara o valor atual com o comportamento historico da propria praca." />
                <Select value={praca} onValueChange={setPraca}>
                    <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {pracas.map((r) => <SelectItem key={r} value={r}>{formatLocationLabel(r)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Situação Atual</p>
                        <div className="mt-2">
                            <Badge className={statusColor}>{formatSituacaoBase(latest?.situacao_base)}</Badge>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Base Absoluta</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `R$ ${latest.base_absoluta.toFixed(2)}` : "—"}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Base Percentual</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.base_percentual.toFixed(2)}%` : "—"}</p>
                    </CardContent></Card>
                </div>
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Variação base % (último vs anterior)</p>
                            <p className={`text-2xl font-bold mt-1 tabular-nums ${deltaBase !== null && deltaBase < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                                {deltaBase !== null ? `${deltaBase >= 0 ? "+" : ""}${deltaBase.toFixed(2)} p.p.` : "—"}
                            </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/alertas?auto=1&produto=boi_gordo&condicao=${sugestaoCondicao}`}>Ir para Alertas Pro</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Detalhamento Diário</CardTitle>
                        <CardDescription>{formatLocationLabel(praca)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Físico Local</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ref. SP</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Base R$</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Base %</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={`${row.praca_local}-${row.data}`} className="border-b border-border/30 hover:bg-muted/30">
                                            <td className="py-2.5 px-3">{format(new Date(`${row.data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">R$ {row.preco_fisico_local.toFixed(2)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">R$ {row.preco_referencia_sp.toFixed(2)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.base_absoluta.toFixed(2)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.base_percentual.toFixed(2)}%</td>
                                            <td className="text-right py-2.5 px-3"><Badge variant="outline">{formatSituacaoBase(row.situacao_base)}</Badge></td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 px-3 text-center text-muted-foreground">Sem dados para a praça selecionada.</td>
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
