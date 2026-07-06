"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleHelp, FileDown, Save } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  calculateLivestockDecision,
  type DecisionType,
  type LivestockCategory,
} from "@/lib/livestock-decision"

type FormState = {
  lotName: string
  category: LivestockCategory
  uf: string
  praca: string
  cycle: "curto" | "medio" | "longo"
  quantity: number
  currentWeightKg: number
  purchasePricePerHead: number
  carcassYield: number
  gmdKgDay: number
  futureArrobaPrice: number
  dailyCostPerHead: number
  freightPerHead: number
  commissionPercent: number
  taxesPerHead: number
  capitalCostMonthlyPercent: number
  mortalityPercent: number
}

const PRACA_TO_UF: Record<string, string> = {
  GOIANIA: "GO",
  DOURADOS: "MS",
  CUIABA: "MT",
  UBERABA: "MG",
  "CAMPO GRANDE": "MS",
  BELEM: "PA",
  "PORTO VELHO": "RO",
  "SAO PAULO": "SP",
}

const UF_LABELS: Record<string, string> = {
  GO: "Goiás",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  MG: "Minas Gerais",
  PA: "Pará",
  RO: "Rondônia",
  SP: "São Paulo",
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatCurrencyMask(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCurrencyMask(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")
  if (!cleaned) return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function decisionLabel(decision: DecisionType): string {
  if (decision === "segurar") return "SEGURAR"
  if (decision === "avaliar_risco") return "AVALIAR RISCO"
  return "VENDER"
}

function daysFromCycle(cycle: FormState["cycle"]): number {
  if (cycle === "curto") return 30
  if (cycle === "medio") return 60
  return 120
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export default function CalculadoraVendaPage() {
  const { latestPrices, baseRegionalStats, authUser } = useData()
  const [futurePriceTouched, setFuturePriceTouched] = useState(false)

  const latestByPraca = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of [...baseRegionalStats].sort((a, b) => b.data.localeCompare(a.data))) {
      if (!map.has(row.praca_local)) map.set(row.praca_local, row.preco_fisico_local)
    }
    return Array.from(map.entries()).map(([praca, preco]) => ({ praca, preco }))
  }, [baseRegionalStats])

  const ufOptions = useMemo(() => {
    const set = new Set(latestByPraca.map((row) => PRACA_TO_UF[row.praca.toUpperCase()] || "N/D"))
    return Array.from(set).filter((uf) => uf !== "N/D").sort()
  }, [latestByPraca])

  const [form, setForm] = useState<FormState>({
    lotName: "Lote Confinamento",
    category: "boi_gordo",
    uf: ufOptions[0] || "SP",
    praca: "",
    cycle: "medio",
    quantity: 50,
    currentWeightKg: 480,
    purchasePricePerHead: 3800,
    carcassYield: 0.52,
    gmdKgDay: 1.2,
    futureArrobaPrice: latestPrices.boi_gordo?.valor_brl || 340,
    dailyCostPerHead: 12,
    freightPerHead: 80,
    commissionPercent: 0.02,
    taxesPerHead: 30,
    capitalCostMonthlyPercent: 0.012,
    mortalityPercent: 0,
  })

  const pracaOptions = useMemo(
    () => latestByPraca.filter((row) => (PRACA_TO_UF[row.praca.toUpperCase()] || "") === form.uf),
    [latestByPraca, form.uf]
  )

  const baseCurrentArrobaPrice = useMemo(() => {
    const selectedPraca = pracaOptions.find((row) => row.praca === form.praca)
    if (selectedPraca) return selectedPraca.preco
    return latestPrices.boi_gordo?.valor_brl || 0
  }, [pracaOptions, form.praca, latestPrices.boi_gordo?.valor_brl])

  const currentCategoryPrice = useMemo(() => {
    if (form.category === "vaca") return baseCurrentArrobaPrice * 0.9
    if (form.category === "bezerro") {
      const bezerroCabeca = latestPrices.bezerro?.valor_brl || 0
      const kgPrice = form.currentWeightKg > 0 ? bezerroCabeca / form.currentWeightKg : 0
      return kgPrice * 15
    }
    return baseCurrentArrobaPrice
  }, [form.category, form.currentWeightKg, baseCurrentArrobaPrice, latestPrices.bezerro?.valor_brl])

  const effectiveFutureArrobaPrice = futurePriceTouched ? form.futureArrobaPrice : currentCategoryPrice

  const selectedDays = daysFromCycle(form.cycle)

  const mainResult = useMemo(
    () =>
      calculateLivestockDecision({
        category: form.category,
        quantity: form.quantity,
        currentWeightKg: form.currentWeightKg,
        carcassYield: form.carcassYield,
        purchasePricePerHead: form.purchasePricePerHead,
        currentArrobaPrice: currentCategoryPrice,
        futureArrobaPrice: effectiveFutureArrobaPrice,
        daysToHold: selectedDays,
        gmdKgDay: form.gmdKgDay,
        dailyCostPerHead: form.dailyCostPerHead,
        freightPerHead: form.freightPerHead,
        commissionPercent: form.commissionPercent,
        taxesPerHead: form.taxesPerHead,
        healthCostPerHead: 0,
        otherCostsPerHead: 0,
        capitalCostMonthlyPercent: form.capitalCostMonthlyPercent,
        mortalityPercent: form.mortalityPercent,
      }),
    [form, currentCategoryPrice, effectiveFutureArrobaPrice, selectedDays]
  )

  const scenarios = useMemo(() => {
    const periods = [0, 30, 60, 90, 120]
    return periods.map((days) => ({
      days,
      result: calculateLivestockDecision({
        category: form.category,
        quantity: form.quantity,
        currentWeightKg: form.currentWeightKg,
        carcassYield: form.carcassYield,
        purchasePricePerHead: form.purchasePricePerHead,
        currentArrobaPrice: currentCategoryPrice,
        futureArrobaPrice: effectiveFutureArrobaPrice,
        daysToHold: days,
        gmdKgDay: form.gmdKgDay,
        dailyCostPerHead: form.dailyCostPerHead,
        freightPerHead: form.freightPerHead,
        commissionPercent: form.commissionPercent,
        taxesPerHead: form.taxesPerHead,
        healthCostPerHead: 0,
        otherCostsPerHead: 0,
        capitalCostMonthlyPercent: form.capitalCostMonthlyPercent,
        mortalityPercent: form.mortalityPercent,
      }),
    }))
  }, [form, currentCategoryPrice, effectiveFutureArrobaPrice])

  const scenarioToday = scenarios.find((item) => item.days === 0)?.result || mainResult

  const sensitivityPrice = useMemo(() => {
    const factors = [-0.1, -0.05, 0, 0.05, 0.1]
    return factors.map((factor) => {
      const futurePrice = effectiveFutureArrobaPrice * (1 + factor)
      const result = calculateLivestockDecision({
        category: form.category,
        quantity: form.quantity,
        currentWeightKg: form.currentWeightKg,
        carcassYield: form.carcassYield,
        purchasePricePerHead: form.purchasePricePerHead,
        currentArrobaPrice: currentCategoryPrice,
        futureArrobaPrice: futurePrice,
        daysToHold: selectedDays,
        gmdKgDay: form.gmdKgDay,
        dailyCostPerHead: form.dailyCostPerHead,
        freightPerHead: form.freightPerHead,
        commissionPercent: form.commissionPercent,
        taxesPerHead: form.taxesPerHead,
        healthCostPerHead: 0,
        otherCostsPerHead: 0,
        capitalCostMonthlyPercent: form.capitalCostMonthlyPercent,
        mortalityPercent: form.mortalityPercent,
      })
      return { factor, futurePrice, result }
    })
  }, [form, currentCategoryPrice, effectiveFutureArrobaPrice, selectedDays])

  const sensitivityGmd = useMemo(() => {
    const values = [0.8, 1.0, 1.2, 1.4]
    return values.map((gmd) => {
      const result = calculateLivestockDecision({
        category: form.category,
        quantity: form.quantity,
        currentWeightKg: form.currentWeightKg,
        carcassYield: form.carcassYield,
        purchasePricePerHead: form.purchasePricePerHead,
        currentArrobaPrice: currentCategoryPrice,
        futureArrobaPrice: effectiveFutureArrobaPrice,
        daysToHold: selectedDays,
        gmdKgDay: gmd,
        dailyCostPerHead: form.dailyCostPerHead,
        freightPerHead: form.freightPerHead,
        commissionPercent: form.commissionPercent,
        taxesPerHead: form.taxesPerHead,
        healthCostPerHead: 0,
        otherCostsPerHead: 0,
        capitalCostMonthlyPercent: form.capitalCostMonthlyPercent,
        mortalityPercent: form.mortalityPercent,
      })
      return { gmd, result }
    })
  }, [form, currentCategoryPrice, effectiveFutureArrobaPrice, selectedDays])

  const sensitivityDailyCost = useMemo(() => {
    const factors = [-0.1, 0, 0.1, 0.2]
    return factors.map((factor) => {
      const dailyCost = form.dailyCostPerHead * (1 + factor)
      const result = calculateLivestockDecision({
        category: form.category,
        quantity: form.quantity,
        currentWeightKg: form.currentWeightKg,
        carcassYield: form.carcassYield,
        purchasePricePerHead: form.purchasePricePerHead,
        currentArrobaPrice: currentCategoryPrice,
        futureArrobaPrice: effectiveFutureArrobaPrice,
        daysToHold: selectedDays,
        gmdKgDay: form.gmdKgDay,
        dailyCostPerHead: dailyCost,
        freightPerHead: form.freightPerHead,
        commissionPercent: form.commissionPercent,
        taxesPerHead: form.taxesPerHead,
        healthCostPerHead: 0,
        otherCostsPerHead: 0,
        capitalCostMonthlyPercent: form.capitalCostMonthlyPercent,
        mortalityPercent: form.mortalityPercent,
      })
      return { factor, dailyCost, result }
    })
  }, [form, currentCategoryPrice, effectiveFutureArrobaPrice, selectedDays])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      if (key !== "category") return { ...prev, [key]: value }
      const category = value as LivestockCategory
      if (category === "vaca") return { ...prev, category, carcassYield: 0.5 }
      if (category === "bezerro") return { ...prev, category, carcassYield: 0.5, gmdKgDay: 0.8 }
      return { ...prev, category, carcassYield: 0.52 }
    })
    if (key === "category") setFuturePriceTouched(false)
  }

  function saveSimulation() {
    const payload = {
      ...form,
      currentArrobaPrice: currentCategoryPrice,
      futureArrobaPrice: effectiveFutureArrobaPrice,
      result: mainResult,
      savedAt: new Date().toISOString(),
      userId: authUser?.usuario_id || "anon",
    }
    const key = "livestock_simulations_local"
    const previous = JSON.parse(localStorage.getItem(key) || "[]")
    localStorage.setItem(key, JSON.stringify([payload, ...previous].slice(0, 50)))
  }

  return (
    <>
      <PageHeader
        title="Calculadora de Venda"
        description="Estruture dados, custos e cálculos por ciclo para decidir venda imediata ou retenção."
      />

      <div className="p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>DADOS</CardTitle>
            <CardDescription>Informações do lote e referência de preço atual.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TextField label="Nome do lote" value={form.lotName} onChange={(v) => updateField("lotName", v)} />

            <div className="space-y-2">
              <FieldLabel label="Categoria" />
              <Select value={form.category} onValueChange={(v) => updateField("category", v as LivestockCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boi_gordo">Boi gordo</SelectItem>
                  <SelectItem value="vaca">Vaca</SelectItem>
                  <SelectItem value="bezerro">Bezerro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel label="UF" />
              <Select value={form.uf} onValueChange={(v) => updateField("uf", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ufOptions.map((uf) => (
                    <SelectItem key={uf} value={uf}>{UF_LABELS[uf] || uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel label="Praça" />
              <Select value={form.praca} onValueChange={(v) => updateField("praca", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pracaOptions.map((row) => (
                    <SelectItem key={row.praca} value={row.praca}>{row.praca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberField label="Quantidade cabeças" value={form.quantity} onChange={(v) => updateField("quantity", v)} />
            <CurrencyField label="Custo de aquisição (cabeça)" value={form.purchasePricePerHead} onChange={(v) => updateField("purchasePricePerHead", v)} />
            <NumberField label="Peso médio inicial (kg)" value={form.currentWeightKg} onChange={(v) => updateField("currentWeightKg", v)} />
            <NumberField label="GMD (kg/dia)" value={form.gmdKgDay} onChange={(v) => updateField("gmdKgDay", v)} step={0.1} />
            <NumberField label="Rendimento de carcaça" value={form.carcassYield} onChange={(v) => updateField("carcassYield", v)} step={0.01} />

            <div className="space-y-2">
              <FieldLabel label="Ciclo" />
              <Select value={form.cycle} onValueChange={(v) => updateField("cycle", v as FormState["cycle"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="curto">Curto (30 dias)</SelectItem>
                  <SelectItem value="medio">Médio (60 dias)</SelectItem>
                  <SelectItem value="longo">Longo (120 dias)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ReadOnlyField label="Preço atual médio por @" value={formatCurrency(currentCategoryPrice)} />
            <ReadOnlyField label="Preço atual médio por animal" value={formatCurrency(scenarioToday.finalValuePerHeadToday)} />
            <CurrencyField
              label="Preço futuro por @ (simulação)"
              value={effectiveFutureArrobaPrice}
              onChange={(v) => {
                setFuturePriceTouched(true)
                updateField("futureArrobaPrice", v)
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CUSTOS</CardTitle>
            <CardDescription>Custos operacionais e financeiros da retenção.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CurrencyField label="Custo diário total (inclui sanidade)" value={form.dailyCostPerHead} onChange={(v) => updateField("dailyCostPerHead", v)} />
            <NumberField label="Comissão" value={form.commissionPercent} onChange={(v) => updateField("commissionPercent", v)} step={0.001} />
            <CurrencyField label="Frete" value={form.freightPerHead} onChange={(v) => updateField("freightPerHead", v)} />
            <CurrencyField label="Imposto" value={form.taxesPerHead} onChange={(v) => updateField("taxesPerHead", v)} />
            <NumberField label="Custo Capital" value={form.capitalCostMonthlyPercent} onChange={(v) => updateField("capitalCostMonthlyPercent", v)} step={0.001} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CÁLCULOS</CardTitle>
            <CardDescription>Resultados do ciclo selecionado ({selectedDays} dias).</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ResultCard title="Ganho de peso no período" value={`${mainResult.additionalWeightKgPerHead.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg/cab`} subtitle="GMD x dias" />
            <ResultCard title="Custo da @ produzida" value={mainResult.producedArrobaCost == null ? "—" : formatCurrency(mainResult.producedArrobaCost)} subtitle="Custo adicional / @ adicional" />
            <ResultCard title="Custo final total" value={formatCurrency(mainResult.totalFutureCost)} subtitle="Aquisição + custos + venda" />
            <ResultCard title="Peso final do animal" value={`${mainResult.futureWeightKg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`} subtitle="Peso inicial + ganho" />
            <ResultCard title="Valor final por animal" value={formatCurrency(mainResult.finalValuePerHeadFuture)} subtitle="Usa rendimento de carcaça" />
            <ResultCard title="ROI do ciclo" value={formatPercent(mainResult.roiFuturePercent)} subtitle="Lucro futuro / custo final total" />
            <ResultCard title="Payback estimado" value={mainResult.paybackDays == null ? "—" : `${mainResult.paybackDays.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias`} subtitle="Recuperação do custo da retenção" />
            <ResultCard title="Custo diário teto" value={formatCurrency(mainResult.maxDailyCostPerHeadForHold)} subtitle="Máximo para segurar empatar com hoje" />
            <ResultCard title="Decisão" value={decisionLabel(mainResult.decision)} subtitle={`Ganho adicional ${formatCurrency(mainResult.additionalGain)}`} tone={mainResult.decision} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valor de venda final por cenário</CardTitle>
            <CardDescription>Comparativo da receita bruta e lucro por prazo.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Cenário</th>
                  <th className="text-right py-2">Valor venda final</th>
                  <th className="text-right py-2">Lucro</th>
                  <th className="text-right py-2">Preço equilíbrio</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((item) => (
                  <tr key={item.days} className="border-b">
                    <td className="py-2">{item.days === 0 ? "Hoje" : `${item.days} dias`}</td>
                    <td className="text-right py-2">{formatCurrency(item.days === 0 ? item.result.grossRevenueToday : item.result.grossRevenueFuture)}</td>
                    <td className="text-right py-2">{formatCurrency(item.days === 0 ? item.result.profitToday : item.result.profitFuture)}</td>
                    <td className="text-right py-2">{formatCurrency(item.result.breakEvenPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sensibilidade automática</CardTitle>
            <CardDescription>Risco por preço da arroba, GMD e custo diário.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-auto">
              <h4 className="font-medium mb-2">Sensibilidade da arroba</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Variação</th>
                    <th className="text-right py-2">Preço simulado</th>
                    <th className="text-right py-2">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityPrice.map((item) => (
                    <tr key={item.factor} className="border-b">
                      <td className="py-2">{item.factor === 0 ? "Atual" : `${item.factor > 0 ? "+" : ""}${(item.factor * 100).toFixed(0)}%`}</td>
                      <td className="text-right py-2">{formatCurrency(item.futurePrice)}</td>
                      <td className="text-right py-2">{formatCurrency(item.result.profitFuture)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <h4 className="font-medium mb-2">Sensibilidade do custo diário</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Variação</th>
                    <th className="text-right py-2">Custo diário</th>
                    <th className="text-right py-2">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityDailyCost.map((item) => (
                    <tr key={item.factor} className="border-b">
                      <td className="py-2">{item.factor === 0 ? "Atual" : `${item.factor > 0 ? "+" : ""}${(item.factor * 100).toFixed(0)}%`}</td>
                      <td className="text-right py-2">{formatCurrency(item.dailyCost)}</td>
                      <td className="text-right py-2">{formatCurrency(item.result.profitFuture)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <h4 className="font-medium mb-2">Sensibilidade do GMD</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">GMD</th>
                    <th className="text-right py-2">Peso final</th>
                    <th className="text-right py-2">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityGmd.map((item) => (
                    <tr key={item.gmd} className="border-b">
                      <td className="py-2">{item.gmd.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/dia</td>
                      <td className="text-right py-2">{item.result.futureWeightKg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
                      <td className="text-right py-2">{formatCurrency(item.result.profitFuture)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Riscos detectados automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mainResult.alerts.length ? (
              mainResult.alerts.map((alert, idx) => (
                <div key={idx} className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="size-4" />
                  <span>{alert}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="size-4" />
                <span>Sem alertas críticos para o cenário atual.</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">Preço atual usado: {formatCurrency(currentCategoryPrice)}.</div>
            <div className="text-sm text-muted-foreground">Preço futuro da simulação: {formatCurrency(effectiveFutureArrobaPrice)}.</div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={saveSimulation}><Save className="size-4 mr-2" />Salvar simulação</Button>
          <Button variant="outline" onClick={() => window.print()}><FileDown className="size-4 mr-2" />Exportar PDF</Button>
          <Badge variant="secondary">Recomendação: {decisionLabel(mainResult.decision)}</Badge>
        </div>
      </div>
    </>
  )
}

function FieldLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label>{label}</Label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => window.alert("Em breve: conteúdo de apoio (Paranoia de Oferta).")}
      >
        <CircleHelp className="size-4 text-muted-foreground" />
      </Button>
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <Input value={value} readOnly className="bg-muted/40" />
    </div>
  )
}

function CurrencyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [display, setDisplay] = useState(formatCurrencyMask(value))

  useEffect(() => {
    if (parseCurrencyMask(display) !== value) {
      setDisplay(formatCurrencyMask(value))
    }
  }, [value, display])

  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <Input
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          const raw = e.target.value
          setDisplay(raw)
          onChange(parseCurrencyMask(raw))
        }}
        onBlur={() => {
          const parsed = parseCurrencyMask(display)
          onChange(parsed)
          setDisplay(formatCurrencyMask(parsed))
        }}
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function ResultCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string
  value: string
  subtitle: string
  tone?: DecisionType
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground uppercase">{title}</div>
        <div className={`text-2xl font-bold mt-1 ${tone === "vender" ? "text-red-600" : tone === "segurar" ? "text-emerald-600" : tone === "avaliar_risco" ? "text-amber-600" : ""}`}>{value}</div>
        <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
      </CardContent>
    </Card>
  )
}
