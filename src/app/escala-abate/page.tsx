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
import { formatLocationLabel, normalizeRegionCode } from "@/lib/location-labels"

function formatClassificacao(value: string | undefined): string {
    if (!value) return "—"
    if (value === "CURTA") return "Escala curta"
    if (value === "NORMAL") return "Escala normal"
    if (value === "LONGA") return "Escala longa"
    return value
}

export default function EscalaAbatePage() {
    const isSuperAdmin = process.env.NEXT_PUBLIC_IS_SUPER_ADMIN === "true"
    const { escalaAbateRegional, globalDateRange } = useData()
    const regioes = useMemo(
        () => [...new Set(escalaAbateRegional.map((r) => normalizeRegionCode(r.regiao)))],
        [escalaAbateRegional]
    )
    const [regiao, setRegiao] = useState<string>(regioes[0] || "UF_GO")

    const rows = useMemo(
        () => escalaAbateRegional
            .filter((r) => normalizeRegionCode(r.regiao) === regiao)
            .filter((r) => {
                const time = new Date(`${r.data}T12:00:00`).getTime()
                if (globalDateRange?.from && time < globalDateRange.from.getTime()) return false
                if (globalDateRange?.to && time > globalDateRange.to.getTime()) return false
                return true
            })
            .sort((a, b) => b.data.localeCompare(a.data)),
        [escalaAbateRegional, regiao, globalDateRange]
    )

    const latest = rows[0]
    const previous = rows[1]
    const deltaEscala = latest && previous ? latest.dias_escala_media - previous.dias_escala_media : null
    const sugestaoCondicao = deltaEscala !== null && deltaEscala >= 0 ? "abaixo_de" : "acima_de"
    const badgeVariant = latest?.classificacao === "CURTA" ? "default" : latest?.classificacao === "LONGA" ? "secondary" : "outline"

    if (!isSuperAdmin) {
        return (
            <>
                <PageHeader
                    title="Escala de Abate"
                    description="Módulo em criação"
                    showDatePicker={false}
                />
                <div className="flex flex-col gap-6 p-4 sm:p-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Em criação</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Este módulo está em construção e disponível apenas para super admins nesta fase.
                        </CardContent>
                    </Card>
                </div>
            </>
        )
    }

    return (
        <>
            <PageHeader
                title="Escala de Abate"
                description="Escala média regional ponderada e classificação operacional · Em criação"
            >
                <Select value={regiao} onValueChange={setRegiao}>
                    <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {regioes.map((r) => <SelectItem key={r} value={r}>{formatLocationLabel(r)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Classificação Atual</p>
                        <div className="mt-2">
                            <Badge variant={badgeVariant}>{formatClassificacao(latest?.classificacao)}</Badge>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Dias Escala Média</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? latest.dias_escala_media.toFixed(2) : "—"}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Faixa de Referência</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{latest ? `${latest.limite_curta.toFixed(0)} - ${latest.limite_longa.toFixed(0)} dias` : "—"}</p>
                    </CardContent></Card>
                </div>
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Variação dias de escala</p>
                            <p className={`text-2xl font-bold mt-1 tabular-nums ${deltaEscala !== null && deltaEscala < 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {deltaEscala !== null ? `${deltaEscala >= 0 ? "+" : ""}${deltaEscala.toFixed(2)} dias` : "—"}
                            </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/alertas?auto=1&produto=boi_gordo&condicao=${sugestaoCondicao}`}>Ir para Alertas Pro</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Série Regional</CardTitle>
                        <CardDescription>{formatLocationLabel(regiao)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Dias Média</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Limite Curta</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Limite Longa</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Classificação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={`${row.regiao}-${row.data}`} className="border-b border-border/30 hover:bg-muted/30">
                                            <td className="py-2.5 px-3">{format(new Date(`${row.data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.dias_escala_media.toFixed(2)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.limite_curta.toFixed(2)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums">{row.limite_longa.toFixed(2)}</td>
                                            <td className="text-right py-2.5 px-3"><Badge variant="outline">{formatClassificacao(row.classificacao)}</Badge></td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 px-3 text-center text-muted-foreground">Sem dados para a região selecionada.</td>
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
