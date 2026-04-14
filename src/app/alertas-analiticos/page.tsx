"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { InfoHint } from "@/components/info-hint"

function severityBadgeVariant(severity: 'BAIXA' | 'MEDIA' | 'ALTA'): "outline" | "secondary" | "default" {
    if (severity === "ALTA") return "default"
    if (severity === "MEDIA") return "secondary"
    return "outline"
}

function formatSeveridade(severity: 'BAIXA' | 'MEDIA' | 'ALTA'): string {
    if (severity === "ALTA") return "Alta"
    if (severity === "MEDIA") return "Média"
    return "Baixa"
}

function formatTipo(tipo: string): string {
    if (tipo === "CICLO_PECUARIO") return "Ciclo Pecuário"
    if (tipo === "BASE_REGIONAL") return "Base Regional"
    if (tipo === "EXPORTACAO") return "Exportação"
    return tipo
}

function formatStatus(status: 'ABERTO' | 'FECHADO'): string {
    if (status === "ABERTO") return "Aberto"
    return "Fechado"
}

export default function AlertasAnaliticosPage() {
    const { alertasAnaliticos } = useData()

    const totalAbertos = alertasAnaliticos.filter((a) => a.status === "ABERTO").length
    const totalAlta = alertasAnaliticos.filter((a) => a.severidade === "ALTA").length

    return (
        <>
            <PageHeader
                title="Alertas Analíticos"
                description="Sinais automáticos gerados a partir dos módulos de ciclo, base e exportações"
                showDatePicker={false}
            >
                <InfoHint text="Leitura rápida: alerta analitico e um aviso automatico quando um indicador sai da faixa esperada (ex.: mudanca de fase no ciclo ou dependencia China elevada). Severidade indica urgencia: Alta, Media ou Baixa." />
            </PageHeader>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Alertas Totais</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{alertasAnaliticos.length}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Abertos</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{totalAbertos}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Severidade Alta</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{totalAlta}</p>
                    </CardContent></Card>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Histórico de Alertas</CardTitle>
                        <CardDescription>Ordenado por data de referência mais recente</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Tipo</th>
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Título</th>
                                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Descrição</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Severidade</th>
                                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alertasAnaliticos.map((row) => (
                                        <tr key={row.id} className="border-b border-border/30 hover:bg-muted/30">
                                            <td className="py-2.5 px-3">{format(new Date(`${row.data_ref}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}</td>
                                            <td className="py-2.5 px-3">{formatTipo(row.tipo)}</td>
                                            <td className="py-2.5 px-3 font-medium">{row.titulo}</td>
                                            <td className="py-2.5 px-3 text-muted-foreground">{row.descricao}</td>
                                            <td className="text-right py-2.5 px-3">
                                                <Badge variant={severityBadgeVariant(row.severidade)}>{formatSeveridade(row.severidade)}</Badge>
                                            </td>
                                            <td className="text-right py-2.5 px-3">
                                                <Badge variant="outline">{formatStatus(row.status)}</Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {alertasAnaliticos.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 px-3 text-center text-muted-foreground">
                                                Nenhum alerta analítico gerado até o momento.
                                            </td>
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
