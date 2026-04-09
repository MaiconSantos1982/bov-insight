"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface PriceCardProps {
    title: string
    currentPrice: number
    previousPrice: number
    unit: string
    icon?: React.ReactNode
}

export function PriceCard({ title, currentPrice, previousPrice, unit, icon }: PriceCardProps) {
    const diff = currentPrice - previousPrice
    const percentChange = previousPrice ? ((diff / previousPrice) * 100) : 0
    const isUp = diff > 0
    const isDown = diff < 0

    return (
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    {icon && <div className="text-muted-foreground/40">{icon}</div>}
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">
                        R$ {currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">/{unit}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                    {isUp ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                            <TrendingUp className="size-3.5" />
                            <span className="text-xs font-medium">+{percentChange.toFixed(2)}%</span>
                        </div>
                    ) : isDown ? (
                        <div className="flex items-center gap-1 text-red-500">
                            <TrendingDown className="size-3.5" />
                            <span className="text-xs font-medium">{percentChange.toFixed(2)}%</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Minus className="size-3.5" />
                            <span className="text-xs font-medium">0.00%</span>
                        </div>
                    )}
                    <span className="text-xs text-muted-foreground">vs. dia anterior</span>
                </div>
            </CardContent>
        </Card>
    )
}
