"use client"

import { useMemo } from "react"
import { format as formatDate } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronDown, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useData } from "@/lib/data-provider"
import { PRODUTOS, type ProdutoKey, type HistoricoPreco } from "@/lib/supabase"

const productOrder: ProdutoKey[] = ["boi_gordo", "bezerro", "milho", "soja"]

function formatCurrencyBRL(value: number | null | undefined) {
    if (value == null || Number.isNaN(value)) return "—"
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatCurrencyUSD(value: number | null | undefined) {
    if (value == null || Number.isNaN(value)) return "—"
    return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default function HistoricoPage() {
    const { historicalData, loading } = useData()

    const dataByProduct = useMemo(() => {
        return productOrder.reduce<Record<ProdutoKey, HistoricoPreco[]>>((acc, produto) => {
            acc[produto] = historicalData
                .filter((item) => {
                    if (item.produto !== produto) return false
                    return true
                })
                .sort((a, b) => b.data.localeCompare(a.data))
            return acc
        }, {
            boi_gordo: [],
            bezerro: [],
            milho: [],
            soja: [],
        })
    }, [historicalData])

    const totalRows = useMemo(
        () => productOrder.reduce((sum, key) => sum + dataByProduct[key].length, 0),
        [dataByProduct]
    )

    return (
        <>
            <PageHeader
                title="Histórico"
                description="Lista histórica de Boi Gordo, Bezerro, Milho e Soja com valores em BRL e USD"
            />

            <div className="flex flex-col gap-6 p-4 sm:p-6">
                <Card>
                    <Collapsible defaultOpen>
                        <CardHeader className="pb-3">
                            <CollapsibleTrigger className="group w-full">
                                <div className="flex items-center justify-between text-left">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Database className="size-4 text-primary" />
                                            <CardTitle className="text-base">Histórico</CardTitle>
                                        </div>
                                        <CardDescription>
                                            Dados por produto no intervalo selecionado
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{totalRows} registros</Badge>
                                        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                        </CardHeader>

                        <CollapsibleContent>
                            <CardContent className="pt-0 space-y-4">
                                {productOrder.map((produto) => {
                                    const rows = dataByProduct[produto]
                                    return (
                                        <Collapsible key={produto}>
                                            <div className="rounded-lg border">
                                                <CollapsibleTrigger className="group w-full px-4 py-3 border-b">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-semibold">{PRODUTOS[produto].label}</p>
                                                            <Badge variant="secondary">{rows.length}</Badge>
                                                        </div>
                                                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                                    </div>
                                                </CollapsibleTrigger>

                                                <CollapsibleContent>
                                                    <div className="max-h-[360px] overflow-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="sticky top-0 bg-background">
                                                                <tr className="border-b border-border/50">
                                                                    <th className="text-left py-2 px-4 text-muted-foreground font-medium">Data</th>
                                                                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Valor BRL</th>
                                                                    <th className="text-right py-2 px-4 text-muted-foreground font-medium">Valor USD</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {rows.map((row) => (
                                                                    <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                                                                        <td className="py-2 px-4">
                                                                            {formatDate(new Date(`${row.data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                                                                        </td>
                                                                        <td className="py-2 px-4 text-right tabular-nums">{formatCurrencyBRL(row.valor_brl)}</td>
                                                                        <td className="py-2 px-4 text-right tabular-nums">{formatCurrencyUSD(row.valor_usd)}</td>
                                                                    </tr>
                                                                ))}
                                                                {!loading && rows.length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={3} className="py-6 px-4 text-center text-muted-foreground">
                                                                            Sem dados no período selecionado.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                        {loading && (
                                                            <div className="px-4 py-6 text-sm text-muted-foreground">
                                                                Carregando dados...
                                                            </div>
                                                        )}
                                                    </div>
                                                </CollapsibleContent>
                                            </div>
                                        </Collapsible>
                                    )
                                })}
                            </CardContent>
                        </CollapsibleContent>
                    </Collapsible>
                </Card>
            </div>
        </>
    )
}
