export type LivestockCategory = "boi_gordo" | "vaca" | "bezerro"

export type DecisionType = "vender" | "segurar" | "avaliar_risco"

export interface LivestockDecisionInput {
  category: LivestockCategory
  quantity: number
  currentWeightKg: number
  carcassYield: number
  purchasePricePerHead: number
  currentArrobaPrice: number
  futureArrobaPrice: number
  daysToHold: number
  gmdKgDay: number
  dailyCostPerHead: number
  freightPerHead: number
  commissionPercent: number
  taxesPerHead: number
  healthCostPerHead: number
  otherCostsPerHead: number
  capitalCostMonthlyPercent: number
  mortalityPercent: number
  costsAlreadyRealized?: number
}

export interface LivestockDecisionResult {
  currentArrobasPerHead: number
  currentArrobasTotal: number
  futureWeightKg: number
  futureArrobasPerHead: number
  futureArrobasTotal: number
  grossRevenueToday: number
  grossRevenueFuture: number
  netRevenueToday: number
  netRevenueFuture: number
  profitToday: number
  profitFuture: number
  additionalGain: number
  additionalArrobas: number
  breakEvenPrice: number
  producedArrobaCost: number | null
  safetyMarginPercent: number
  marginTodayPercent: number
  marginFuturePercent: number
  additionalWeightKgPerHead: number
  additionalCost: number
  capitalCost: number
  sellingCostsToday: number
  sellingCostsFuture: number
  totalFutureCost: number
  finalValuePerHeadToday: number
  finalValuePerHeadFuture: number
  roiFuturePercent: number
  paybackDays: number | null
  maxDailyCostPerHeadForHold: number
  decision: DecisionType
  alerts: string[]
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateLivestockDecision(input: LivestockDecisionInput): LivestockDecisionResult {
  const quantity = clampNonNegative(input.quantity)
  const currentWeightKg = clampNonNegative(input.currentWeightKg)
  const carcassYield = clampNonNegative(input.carcassYield)
  const purchasePricePerHead = clampNonNegative(input.purchasePricePerHead)
  const currentArrobaPrice = clampNonNegative(input.currentArrobaPrice)
  const futureArrobaPrice = clampNonNegative(input.futureArrobaPrice)
  const daysToHold = clampNonNegative(input.daysToHold)
  const gmdKgDay = clampNonNegative(input.gmdKgDay)
  const dailyCostPerHead = clampNonNegative(input.dailyCostPerHead)
  const freightPerHead = clampNonNegative(input.freightPerHead)
  const commissionPercent = clampNonNegative(input.commissionPercent)
  const taxesPerHead = clampNonNegative(input.taxesPerHead)
  const healthCostPerHead = clampNonNegative(input.healthCostPerHead)
  const otherCostsPerHead = clampNonNegative(input.otherCostsPerHead)
  const capitalCostMonthlyPercent = clampNonNegative(input.capitalCostMonthlyPercent)
  const mortalityPercent = clampNonNegative(input.mortalityPercent)
  const costsAlreadyRealized = clampNonNegative(input.costsAlreadyRealized || 0)

  const quantityAdjusted = quantity * (1 - mortalityPercent)
  const currentArrobasPerHead = (currentWeightKg * carcassYield) / 15
  const currentArrobasTotal = currentArrobasPerHead * quantity
  const futureWeightKg = currentWeightKg + gmdKgDay * daysToHold
  const futureArrobasPerHead = (futureWeightKg * carcassYield) / 15
  const futureArrobasTotal = futureArrobasPerHead * quantityAdjusted

  const grossRevenueToday = currentArrobasTotal * currentArrobaPrice
  const grossRevenueFuture = futureArrobasTotal * futureArrobaPrice

  const fixedSellingCostsTotal = quantity * (freightPerHead + taxesPerHead + healthCostPerHead + otherCostsPerHead)
  const commissionToday = grossRevenueToday * commissionPercent
  const commissionFuture = grossRevenueFuture * commissionPercent
  const sellingCostsToday = fixedSellingCostsTotal + commissionToday
  const sellingCostsFuture = fixedSellingCostsTotal + commissionFuture

  const netRevenueToday = grossRevenueToday - sellingCostsToday
  const netRevenueFuture = grossRevenueFuture - sellingCostsFuture

  const acquisitionCost = purchasePricePerHead * quantity
  const additionalCost = dailyCostPerHead * daysToHold * quantity
  const immobilizedCapital = acquisitionCost + costsAlreadyRealized
  const capitalCost = immobilizedCapital * capitalCostMonthlyPercent * (daysToHold / 30)

  const profitToday = netRevenueToday - acquisitionCost - costsAlreadyRealized
  const profitFuture =
    netRevenueFuture - acquisitionCost - costsAlreadyRealized - additionalCost - capitalCost
  const additionalGain = profitFuture - profitToday

  const additionalArrobas = futureArrobasTotal - currentArrobasTotal
  const producedArrobaCost = additionalArrobas > 0 ? additionalCost / additionalArrobas : null

  const totalFutureCost =
    acquisitionCost + costsAlreadyRealized + additionalCost + capitalCost + sellingCostsFuture
  const breakEvenPrice = futureArrobasTotal > 0 ? totalFutureCost / futureArrobasTotal : 0
  const safetyMarginPercent =
    futureArrobaPrice > 0 ? ((futureArrobaPrice - breakEvenPrice) / futureArrobaPrice) * 100 : 0

  const marginTodayPercent = grossRevenueToday > 0 ? (profitToday / grossRevenueToday) * 100 : 0
  const marginFuturePercent = grossRevenueFuture > 0 ? (profitFuture / grossRevenueFuture) * 100 : 0
  const additionalWeightKgPerHead = futureWeightKg - currentWeightKg
  const finalValuePerHeadToday = quantity > 0 ? grossRevenueToday / quantity : 0
  const finalValuePerHeadFuture = quantityAdjusted > 0 ? grossRevenueFuture / quantityAdjusted : 0
  const roiFuturePercent = totalFutureCost > 0 ? (profitFuture / totalFutureCost) * 100 : 0

  const incrementalProfitWithoutAdditional = netRevenueFuture - acquisitionCost - costsAlreadyRealized - capitalCost
  const paybackDays =
    dailyCostPerHead > 0 && quantity > 0
      ? (incrementalProfitWithoutAdditional / (dailyCostPerHead * quantity))
      : null

  const denominator = daysToHold * quantity
  const maxDailyCostPerHeadForHold =
    denominator > 0
      ? (netRevenueFuture - acquisitionCost - costsAlreadyRealized - capitalCost - profitToday) / denominator
      : 0

  let decision: DecisionType = "vender"
  if (profitFuture > profitToday && safetyMarginPercent > 5) {
    decision = "segurar"
  } else if (profitFuture > profitToday) {
    decision = "avaliar_risco"
  }

  const alerts: string[] = []
  if (safetyMarginPercent <= 5) {
    alerts.push("Margem de segurança abaixo de 5%.")
  }
  if (producedArrobaCost != null && producedArrobaCost > futureArrobaPrice) {
    alerts.push("O custo da arroba adicional está acima do preço futuro estimado.")
  }
  if (additionalArrobas <= 0 && daysToHold > 0) {
    alerts.push("Sem ganho de arrobas no prazo informado.")
  }

  return {
    currentArrobasPerHead: round2(currentArrobasPerHead),
    currentArrobasTotal: round2(currentArrobasTotal),
    futureWeightKg: round2(futureWeightKg),
    futureArrobasPerHead: round2(futureArrobasPerHead),
    futureArrobasTotal: round2(futureArrobasTotal),
    grossRevenueToday: round2(grossRevenueToday),
    grossRevenueFuture: round2(grossRevenueFuture),
    netRevenueToday: round2(netRevenueToday),
    netRevenueFuture: round2(netRevenueFuture),
    profitToday: round2(profitToday),
    profitFuture: round2(profitFuture),
    additionalGain: round2(additionalGain),
    additionalArrobas: round2(additionalArrobas),
    breakEvenPrice: round2(breakEvenPrice),
    producedArrobaCost: producedArrobaCost == null ? null : round2(producedArrobaCost),
    safetyMarginPercent: round2(safetyMarginPercent),
    marginTodayPercent: round2(marginTodayPercent),
    marginFuturePercent: round2(marginFuturePercent),
    additionalWeightKgPerHead: round2(additionalWeightKgPerHead),
    additionalCost: round2(additionalCost),
    capitalCost: round2(capitalCost),
    sellingCostsToday: round2(sellingCostsToday),
    sellingCostsFuture: round2(sellingCostsFuture),
    totalFutureCost: round2(totalFutureCost),
    finalValuePerHeadToday: round2(finalValuePerHeadToday),
    finalValuePerHeadFuture: round2(finalValuePerHeadFuture),
    roiFuturePercent: round2(roiFuturePercent),
    paybackDays: paybackDays == null ? null : round2(paybackDays),
    maxDailyCostPerHeadForHold: round2(maxDailyCostPerHeadForHold),
    decision,
    alerts,
  }
}
