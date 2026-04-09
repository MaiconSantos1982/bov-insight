"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { DatePickerWithRange } from "@/components/date-picker-range"
import { useData } from "@/lib/data-provider"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"

interface PageHeaderProps {
    title: string
    description?: string
    showDatePicker?: boolean
    children?: React.ReactNode
}

export function PageHeader({ title, description, showDatePicker = true, children }: PageHeaderProps) {
    const { globalDateRange, setGlobalDateRange } = useData()

    return (
        <header className="flex flex-col gap-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 px-4 sm:px-6 py-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full">
                <div className="flex items-center gap-3 shrink-0">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="h-5" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto ml-auto">
                    {showDatePicker && (
                        <DatePickerWithRange
                            dateRange={globalDateRange}
                            onDateRangeChange={setGlobalDateRange}
                        />
                    )}
                    {children}
                </div>
            </div>
            {description && (
                <p className="text-sm text-muted-foreground -mt-1">{description}</p>
            )}
        </header>
    )
}
