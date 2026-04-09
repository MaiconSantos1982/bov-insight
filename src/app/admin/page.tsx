"use client"

import { useMemo, useState } from "react"
import { format, startOfDay, startOfWeek, startOfMonth, subMonths, endOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { AdminSubnav } from "@/components/admin-subnav"
import { useData } from "@/lib/data-provider"

type PeriodFilter = "today" | "week" | "month" | "prev_month" | "3m" | "6m" | "custom"

function toMonthKey(date: Date): string {
  return format(date, "yyyy-MM-01")
}

function monthlyValue(valor: number | null, ciclo: string): number {
  const v = valor || 0
  if (ciclo === "ANUAL") return v / 12
  if (ciclo === "TRIMESTRAL") return v / 3
  return v
}

export default function AdminPage() {
  const { assinaturasDetalhadas, pagamentosHistorico, adminChurnMensal } = useData()

  const [period, setPeriod] = useState<PeriodFilter>("month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const now = new Date()
  const range = useMemo(() => {
    if (period === "today") return { from: startOfDay(now), to: endOfDay(now) }
    if (period === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) }
    if (period === "month") return { from: startOfMonth(now), to: endOfDay(now) }
    if (period === "prev_month") {
      const prev = subMonths(now, 1)
      return { from: startOfMonth(prev), to: endOfDay(new Date(startOfMonth(now).getTime() - 1)) }
    }
    if (period === "3m") return { from: startOfMonth(subMonths(now, 2)), to: endOfDay(now) }
    if (period === "6m") return { from: startOfMonth(subMonths(now, 5)), to: endOfDay(now) }
    const from = customFrom ? startOfDay(new Date(`${customFrom}T12:00:00`)) : startOfMonth(now)
    const to = customTo ? endOfDay(new Date(`${customTo}T12:00:00`)) : endOfDay(now)
    return { from, to }
  }, [period, customFrom, customTo, now])

  const activeAtEnd = assinaturasDetalhadas.filter((s) => {
    const inicio = new Date(`${s.data_inicio}T12:00:00`)
    const cancelada = s.cancelada_em ? new Date(`${s.cancelada_em}T12:00:00`) : null
    const activeStatus = s.status === "ATIVA" || s.status === "TRIAL" || s.status === "INADIMPLENTE"
    if (!activeStatus) return false
    if (inicio > range.to) return false
    if (cancelada && cancelada <= range.to) return false
    return true
  })

  const recorrentes = activeAtEnd.filter((s) => new Date(`${s.data_inicio}T12:00:00`) < range.from).length
  const novos = assinaturasDetalhadas.filter((s) => {
    const inicio = new Date(`${s.data_inicio}T12:00:00`)
    return inicio >= range.from && inicio <= range.to
  }).length
  const cancelamentos = assinaturasDetalhadas.filter((s) => {
    if (!s.cancelada_em) return false
    const d = new Date(`${s.cancelada_em}T12:00:00`)
    return d >= range.from && d <= range.to
  }).length
  const naoRenovaram = assinaturasDetalhadas.filter((s) => {
    const venc = new Date(`${s.proximo_vencimento}T12:00:00`)
    const statusOk = s.status === "INADIMPLENTE" || s.status === "EXPIRADA" || s.status === "CANCELADA"
    return statusOk && venc >= range.from && venc <= range.to
  }).length

  const receitaTotalPeriodo = pagamentosHistorico
    .filter((p) => p.status === "PAGO")
    .filter((p) => {
      const d = new Date(`${p.competencia}T12:00:00`)
      return d >= range.from && d <= range.to
    })
    .reduce((sum, p) => sum + p.valor, 0)

  const churnAtual = adminChurnMensal[0]?.churn_pct ?? 0
  const mrrBase = activeAtEnd.reduce((sum, s) => sum + monthlyValue(s.valor, s.ciclo), 0)
  const mrrPrevisto = mrrBase * (1 - churnAtual / 100)
  const arrPrevisto = mrrPrevisto * 12

  const avgNovasPorMes = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const s of assinaturasDetalhadas) {
      const key = toMonthKey(new Date(`${s.data_inicio}T12:00:00`))
      byMonth.set(key, (byMonth.get(key) || 0) + 1)
    }
    if (byMonth.size === 0) return 0
    const total = [...byMonth.values()].reduce((a, b) => a + b, 0)
    return total / byMonth.size
  }, [assinaturasDetalhadas])

  const chartData = useMemo(() => {
    const map = new Map<string, { month: string; recorrentes: number; novos: number; cancelamentos: number; naoRenovaram: number }>()
    for (const s of assinaturasDetalhadas) {
      const inicio = new Date(`${s.data_inicio}T12:00:00`)
      if (inicio < range.from || inicio > range.to) continue
      const key = toMonthKey(inicio)
      if (!map.has(key)) map.set(key, { month: key, recorrentes: 0, novos: 0, cancelamentos: 0, naoRenovaram: 0 })
      map.get(key)!.novos += 1
    }
    for (const s of assinaturasDetalhadas) {
      const venc = new Date(`${s.proximo_vencimento}T12:00:00`)
      if (venc < range.from || venc > range.to) continue
      const key = toMonthKey(venc)
      if (!map.has(key)) map.set(key, { month: key, recorrentes: 0, novos: 0, cancelamentos: 0, naoRenovaram: 0 })
      if (s.status === "INADIMPLENTE" || s.status === "EXPIRADA" || s.status === "CANCELADA") map.get(key)!.naoRenovaram += 1
    }
    for (const s of assinaturasDetalhadas) {
      if (!s.cancelada_em) continue
      const cancel = new Date(`${s.cancelada_em}T12:00:00`)
      if (cancel < range.from || cancel > range.to) continue
      const key = toMonthKey(cancel)
      if (!map.has(key)) map.set(key, { month: key, recorrentes: 0, novos: 0, cancelamentos: 0, naoRenovaram: 0 })
      map.get(key)!.cancelamentos += 1
    }

    const entries = [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
    let running = 0
    return entries.map((e) => {
      running = Math.max(0, running + e.novos - e.cancelamentos)
      return {
        ...e,
        recorrentes: running,
        monthLabel: format(new Date(`${e.month}T12:00:00`), "MM/yy", { locale: ptBR }),
      }
    })
  }, [assinaturasDetalhadas, range.from, range.to])

  return (
    <>
      <PageHeader title="Admin" description="Dashboard executivo de assinaturas e receita" showDatePicker={false}>
        <AdminSubnav />
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtro de Período</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Mes atual</SelectItem>
                <SelectItem value="prev_month">Mes anterior</SelectItem>
                <SelectItem value="3m">3 meses</SelectItem>
                <SelectItem value="6m">6 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {period === "custom" && (
              <>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Recorrentes</p><p className="text-2xl font-bold mt-1">{recorrentes}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Novos assinantes</p><p className="text-2xl font-bold mt-1">{novos}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Cancelamentos</p><p className="text-2xl font-bold mt-1">{cancelamentos}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Nao renovaram</p><p className="text-2xl font-bold mt-1">{naoRenovaram}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Receita total (periodo)</p><p className="text-2xl font-bold mt-1">R$ {receitaTotalPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">MRR previsto</p><p className="text-2xl font-bold mt-1">R$ {mrrPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">ARR previsto</p><p className="text-2xl font-bold mt-1">R$ {arrPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Media novas assinaturas/mes</p><p className="text-2xl font-bold mt-1">{avgNovasPorMes.toFixed(2)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolução de Assinaturas</CardTitle>
            <CardDescription>Recorrentes, novos, cancelamentos e nao renovados</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="recorrentes" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="novos" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cancelamentos" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="naoRenovaram" stroke="#ea580c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
