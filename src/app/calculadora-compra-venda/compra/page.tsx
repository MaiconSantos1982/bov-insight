"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleHelp, FileDown, Save } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Category = "boi_gordo" | "vaca" | "bezerro"

type FormState = {
  lotName: string
  category: Category
  uf: string
  praca: string
  quantity: number
  targetDays: number
  currentWeightKg: number
  expectedGmdKgDay: number
  expectedCarcassYield: number
  currentPricePerArroba: number
  expectedPricePerArroba: number
  freightPerHead: number
  commissionPercent: number
  taxesPerHead: number
  capitalCostMonthlyPercent: number
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

export default function CalculadoraCompraPage() {
  const { baseRegionalStats, latestPrices, authUser } = useData()

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
    lotName: "Lote Compra Planejada",
    category: "boi_gordo",
    uf: ufOptions[0] || "SP",
    praca: "",
    quantity: 50,
    targetDays: 60,
    currentWeightKg: 420,
    expectedGmdKgDay: 1,
    expectedCarcassYield: 0.52,
    currentPricePerArroba: latestPrices.boi_gordo?.valor_brl || 340,
    expectedPricePerArroba: latestPrices.boi_gordo?.valor_brl || 340,
    freightPerHead: 80,
    commissionPercent: 0.02,
    taxesPerHead: 25,
    capitalCostMonthlyPercent: 0.012,
  })

  const pracaOptions = useMemo(
    () => latestByPraca.filter((row) => (PRACA_TO_UF[row.praca.toUpperCase()] || "") === form.uf),
    [latestByPraca, form.uf]
  )

  const marketPricePerArroba = useMemo(() => {
    const selectedPraca = pracaOptions.find((row) => row.praca === form.praca)
    const boi = selectedPraca?.preco ?? latestPrices.boi_gordo?.valor_brl ?? 0
    if (form.category === "vaca") return boi * 0.9
    if (form.category === "bezerro") {
      const bezerroCabeca = latestPrices.bezerro?.valor_brl || 0
      const kgPrice = form.currentWeightKg > 0 ? bezerroCabeca / form.currentWeightKg : 0
      return kgPrice * 15
    }
    return boi
  }, [pracaOptions, form.praca, form.category, form.currentWeightKg, latestPrices.boi_gordo?.valor_brl, latestPrices.bezerro?.valor_brl])

  const effectiveCurrentPrice = form.currentPricePerArroba || marketPricePerArroba
  const effectiveExpectedPrice = form.expectedPricePerArroba || marketPricePerArroba

  const calculated = useMemo(() => {
    const arrobasPerHeadNow = (form.currentWeightKg * form.expectedCarcassYield) / 15
    const purchaseNowPerHead = arrobasPerHeadNow * effectiveCurrentPrice
    const purchaseFuturePerHead = arrobasPerHeadNow * effectiveExpectedPrice

    const operationalPerHead = form.freightPerHead + form.taxesPerHead + purchaseNowPerHead * form.commissionPercent
    const capitalNowPerHead = purchaseNowPerHead * form.capitalCostMonthlyPercent * (form.targetDays / 30)
    const totalNowPerHead = purchaseNowPerHead + operationalPerHead + capitalNowPerHead

    const operationalFuturePerHead = form.freightPerHead + form.taxesPerHead + purchaseFuturePerHead * form.commissionPercent
    const capitalFuturePerHead = purchaseFuturePerHead * form.capitalCostMonthlyPercent * (form.targetDays / 30)
    const totalFuturePerHead = purchaseFuturePerHead + operationalFuturePerHead + capitalFuturePerHead

    const expectedFinalWeight = form.currentWeightKg + form.expectedGmdKgDay * form.targetDays
    const expectedFinalArrobasPerHead = (expectedFinalWeight * form.expectedCarcassYield) / 15
    const expectedResaleValuePerHead = expectedFinalArrobasPerHead * effectiveExpectedPrice

    const marginNowPerHead = expectedResaleValuePerHead - totalNowPerHead
    const marginFuturePerHead = expectedResaleValuePerHead - totalFuturePerHead

    const totalNow = totalNowPerHead * form.quantity
    const totalFuture = totalFuturePerHead * form.quantity

    const economyIfWait = totalNow - totalFuture
    const recommendation = economyIfWait > 0 ? "ESPERAR COMPRA" : "COMPRAR AGORA"

    return {
      arrobasPerHeadNow,
      purchaseNowPerHead,
      purchaseFuturePerHead,
      totalNowPerHead,
      totalFuturePerHead,
      totalNow,
      totalFuture,
      expectedFinalWeight,
      expectedFinalArrobasPerHead,
      expectedResaleValuePerHead,
      marginNowPerHead,
      marginFuturePerHead,
      economyIfWait,
      recommendation,
    }
  }, [form, effectiveCurrentPrice, effectiveExpectedPrice])

  function saveSimulation() {
    const payload = {
      operation: "compra",
      ...form,
      marketPricePerArroba,
      calculated,
      savedAt: new Date().toISOString(),
      userId: authUser?.usuario_id || "anon",
    }
    const key = "livestock_purchase_simulations_local"
    const previous = JSON.parse(localStorage.getItem(key) || "[]")
    localStorage.setItem(key, JSON.stringify([payload, ...previous].slice(0, 50)))
  }

  return (
    <>
      <PageHeader
        title="Calculadora de Compra"
        description="Compare comprar agora versus esperar para comprar no período definido."
      />

      <div className="p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Compra</CardTitle>
            <CardDescription>Defina categoria, mercado e premissas para decisão de compra.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TextField label="Nome do lote" value={form.lotName} onChange={(v) => setForm((p) => ({ ...p, lotName: v }))} />

            <div className="space-y-2">
              <FieldLabel label="Categoria" />
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as Category }))}>
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
              <Select value={form.uf} onValueChange={(v) => setForm((p) => ({ ...p, uf: v }))}>
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
              <Select value={form.praca} onValueChange={(v) => setForm((p) => ({ ...p, praca: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pracaOptions.map((row) => (
                    <SelectItem key={row.praca} value={row.praca}>{row.praca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberField label="Quantidade cabeças" value={form.quantity} onChange={(v) => setForm((p) => ({ ...p, quantity: v }))} />
            <NumberField label="Dias até compra" value={form.targetDays} onChange={(v) => setForm((p) => ({ ...p, targetDays: v }))} />
            <NumberField label="Peso médio inicial (kg)" value={form.currentWeightKg} onChange={(v) => setForm((p) => ({ ...p, currentWeightKg: v }))} />
            <NumberField label="GMD esperado (kg/dia)" value={form.expectedGmdKgDay} onChange={(v) => setForm((p) => ({ ...p, expectedGmdKgDay: v }))} step={0.1} />
            <NumberField label="Rendimento carcaça esperado" value={form.expectedCarcassYield} onChange={(v) => setForm((p) => ({ ...p, expectedCarcassYield: v }))} step={0.01} />

            <ReadOnlyField label="Preço de mercado atual por @" value={formatCurrency(marketPricePerArroba)} />
            <CurrencyField label="Preço para comprar agora (@)" value={effectiveCurrentPrice} onChange={(v) => setForm((p) => ({ ...p, currentPricePerArroba: v }))} />
            <CurrencyField label="Preço esperado futuro (@)" value={effectiveExpectedPrice} onChange={(v) => setForm((p) => ({ ...p, expectedPricePerArroba: v }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custos da Compra</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CurrencyField label="Frete" value={form.freightPerHead} onChange={(v) => setForm((p) => ({ ...p, freightPerHead: v }))} />
            <CurrencyField label="Imposto" value={form.taxesPerHead} onChange={(v) => setForm((p) => ({ ...p, taxesPerHead: v }))} />
            <NumberField label="Comissão" value={form.commissionPercent} onChange={(v) => setForm((p) => ({ ...p, commissionPercent: v }))} step={0.001} />
            <NumberField label="Custo capital" value={form.capitalCostMonthlyPercent} onChange={(v) => setForm((p) => ({ ...p, capitalCostMonthlyPercent: v }))} step={0.001} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResultCard title="Compra agora (total)" value={formatCurrency(calculated.totalNow)} subtitle={`Por cabeça ${formatCurrency(calculated.totalNowPerHead)}`} />
          <ResultCard title="Compra futura (total)" value={formatCurrency(calculated.totalFuture)} subtitle={`Por cabeça ${formatCurrency(calculated.totalFuturePerHead)}`} />
          <ResultCard title="Recomendação" value={calculated.recommendation} subtitle={`Diferença ${formatCurrency(Math.abs(calculated.economyIfWait))}`} tone={calculated.economyIfWait > 0 ? "segurar" : "vender"} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Viabilidade projetada de revenda</CardTitle>
            <CardDescription>Com base no peso final e preço esperado de venda.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ResultCard title="Peso final esperado" value={`${calculated.expectedFinalWeight.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`} subtitle="Peso inicial + GMD x dias" />
            <ResultCard title="Valor revenda/cab" value={formatCurrency(calculated.expectedResaleValuePerHead)} subtitle="Usa rendimento de carcaça" />
            <ResultCard title="Margem se comprar agora" value={formatCurrency(calculated.marginNowPerHead)} subtitle="Revenda - custo total agora" />
            <ResultCard title="Margem se esperar" value={formatCurrency(calculated.marginFuturePerHead)} subtitle="Revenda - custo total futuro" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calculated.marginNowPerHead < 0 || calculated.marginFuturePerHead < 0 ? (
              <div className="flex items-center gap-2 text-amber-700"><AlertTriangle className="size-4" /><span>Margem projetada negativa em pelo menos um cenário.</span></div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="size-4" /><span>Margem projetada positiva nos cenários simulados.</span></div>
            )}
            <div className="text-sm text-muted-foreground">Preço referência praça: {formatCurrency(marketPricePerArroba)}.</div>
            <div className="text-sm text-muted-foreground">Diferença compra agora vs futura: {formatCurrency(calculated.economyIfWait)}.</div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={saveSimulation}><Save className="size-4 mr-2" />Salvar simulação</Button>
          <Button variant="outline" onClick={() => window.print()}><FileDown className="size-4 mr-2" />Exportar PDF</Button>
          <Badge variant="secondary">Decisão: {calculated.recommendation}</Badge>
        </div>
      </div>
    </>
  )
}

function FieldLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label>{label}</Label>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.alert("Em breve: conteúdo de apoio (Paranoia de Oferta).")}> 
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

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function ResultCard({ title, value, subtitle, tone }: { title: string; value: string; subtitle: string; tone?: "vender" | "segurar" | "avaliar_risco" }) {
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
