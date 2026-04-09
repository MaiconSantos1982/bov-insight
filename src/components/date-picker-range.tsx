"use client"

import * as React from "react"
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths, subYears } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
    dateRange: DateRange | undefined
    onDateRangeChange: (range: DateRange | undefined) => void
    className?: string
}

export function DatePickerWithRange({
    dateRange,
    onDateRangeChange,
    className,
}: DatePickerWithRangeProps) {
    const today = new Date()
    const presetRanges: Array<{ label: string; range: DateRange }> = [
        {
            label: "Este mês",
            range: { from: startOfMonth(today), to: today },
        },
        {
            label: "Mês anterior",
            range: {
                from: startOfMonth(subMonths(today, 1)),
                to: endOfMonth(subMonths(today, 1)),
            },
        },
        {
            label: "Este ano",
            range: { from: startOfYear(today), to: today },
        },
        {
            label: "Ano anterior",
            range: {
                from: startOfYear(subYears(today, 1)),
                to: endOfYear(subYears(today, 1)),
            },
        },
        {
            label: "Últimos 3 anos",
            range: { from: subYears(today, 3), to: today },
        },
    ]

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date-range-picker"
                        variant="outline"
                        className={cn(
                            "justify-start text-left font-normal h-9 px-3 text-sm",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "dd MMM yyyy", { locale: ptBR })} –{" "}
                                    {format(dateRange.to, "dd MMM yyyy", { locale: ptBR })}
                                </>
                            ) : (
                                format(dateRange.from, "dd MMM yyyy", { locale: ptBR })
                            )
                        ) : (
                            <span>Selecione o período</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
                        {presetRanges.map((preset) => (
                            <Button
                                key={preset.label}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => onDateRangeChange(preset.range)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={onDateRangeChange}
                        numberOfMonths={2}
                        locale={ptBR}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
