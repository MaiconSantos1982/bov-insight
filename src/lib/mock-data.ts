import { format, subDays, subMonths, subYears, startOfYear, endOfYear, eachMonthOfInterval, eachDayOfInterval, addDays } from 'date-fns'

// Seed random with consistent results
function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
}

// Generate realistic price data
function generatePrice(basePrice: number, volatility: number, trend: number, seed: number): number {
    const random = seededRandom(seed)
    const change = (random - 0.5) * 2 * volatility + trend
    return Math.max(basePrice * 0.5, basePrice + change)
}

export interface MockHistorico {
    data: string
    produto: string
    valor_brl: number
    valor_usd: number
}

export interface MockRelacaoTroca {
    data_ref: string
    boi_gordo: number | null
    milho: number | null
    bezerro: number | null
    soja: number | null
}

// Generate mock historical data for the last N years
export function generateHistoricalData(years: number = 3): MockHistorico[] {
    const data: MockHistorico[] = []
    const endDate = new Date()
    const startDate = subYears(endDate, years)

    const days = eachDayOfInterval({ start: startDate, end: endDate })

    // Base prices and their evolution
    let boiGordo = 240 // R$/@
    let bezerro = 2200 // R$/cabeça
    let milho = 58 // R$/sc 60kg
    let soja = 125 // R$/sc 60kg

    days.forEach((day, index) => {
        // Skip weekends
        const dayOfWeek = day.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) return

        const seed = index * 4
        const monthOfYear = day.getMonth()

        // Seasonal factors for cattle market
        const boiSeasonal = monthOfYear >= 3 && monthOfYear <= 6 ? 0.15 : monthOfYear >= 8 && monthOfYear <= 11 ? -0.12 : 0
        const bezerroSeasonal = monthOfYear >= 4 && monthOfYear <= 7 ? 0.2 : monthOfYear >= 9 ? -0.15 : 0
        const milhoSeasonal = monthOfYear >= 6 && monthOfYear <= 8 ? -0.2 : monthOfYear >= 1 && monthOfYear <= 3 ? 0.1 : 0
        const sojaSeasonal = monthOfYear >= 1 && monthOfYear <= 3 ? -0.15 : monthOfYear >= 8 && monthOfYear <= 10 ? 0.1 : 0

        boiGordo = generatePrice(boiGordo, 1.5, boiSeasonal, seed)
        bezerro = generatePrice(bezerro, 15, bezerroSeasonal, seed + 1)
        milho = generatePrice(milho, 0.4, milhoSeasonal, seed + 2)
        soja = generatePrice(soja, 0.6, sojaSeasonal, seed + 3)

        // Clamp realistic ranges
        boiGordo = Math.max(180, Math.min(340, boiGordo))
        bezerro = Math.max(1500, Math.min(3200, bezerro))
        milho = Math.max(35, Math.min(90, milho))
        soja = Math.max(80, Math.min(180, soja))

        const dateStr = format(day, 'yyyy-MM-dd')
        const usdRate = 5.0 + seededRandom(seed + 100) * 0.8

        data.push(
            { data: dateStr, produto: 'boi_gordo', valor_brl: Math.round(boiGordo * 100) / 100, valor_usd: Math.round((boiGordo / usdRate) * 100) / 100 },
            { data: dateStr, produto: 'bezerro', valor_brl: Math.round(bezerro * 100) / 100, valor_usd: Math.round((bezerro / usdRate) * 100) / 100 },
            { data: dateStr, produto: 'milho', valor_brl: Math.round(milho * 100) / 100, valor_usd: Math.round((milho / usdRate) * 100) / 100 },
            { data: dateStr, produto: 'soja', valor_brl: Math.round(soja * 100) / 100, valor_usd: Math.round((soja / usdRate) * 100) / 100 },
        )
    })

    return data
}

// Get latest prices (last trading day)
export function getLatestPrices(data: MockHistorico[]): Record<string, MockHistorico> {
    const latest: Record<string, MockHistorico> = {}
    const sortedData = [...data].sort((a, b) => b.data.localeCompare(a.data))

    for (const item of sortedData) {
        if (!latest[item.produto]) {
            latest[item.produto] = item
        }
        if (Object.keys(latest).length === 4) break
    }

    return latest
}

// Get previous day prices for comparison
export function getPreviousPrices(data: MockHistorico[]): Record<string, MockHistorico> {
    const dates = [...new Set(data.map(d => d.data))].sort().reverse()
    const previousDate = dates[1]

    const previous: Record<string, MockHistorico> = {}
    for (const item of data) {
        if (item.data === previousDate) {
            previous[item.produto] = item
        }
    }

    return previous
}

// Simulate RPC: obter_relacao_troca
export function obterRelacaoTroca(
    data: MockHistorico[],
    dataInicio: string,
    dataFim: string,
    agrupamento: 'day' | 'week' | 'month'
): MockRelacaoTroca[] {
    const filtered = data.filter(d => d.data >= dataInicio && d.data <= dataFim)

    const grouped: Record<string, { boi_gordo: number[], milho: number[], bezerro: number[], soja: number[] }> = {}

    for (const item of filtered) {
        let key: string
        const date = new Date(item.data + 'T12:00:00')

        if (agrupamento === 'month') {
            key = format(date, 'yyyy-MM-01')
        } else if (agrupamento === 'week') {
            const dayOfWeek = date.getDay()
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const monday = addDays(date, diff)
            key = format(monday, 'yyyy-MM-dd')
        } else {
            key = item.data
        }

        if (!grouped[key]) {
            grouped[key] = { boi_gordo: [], milho: [], bezerro: [], soja: [] }
        }

        const produto = item.produto as keyof typeof grouped[string]
        if (grouped[key][produto]) {
            grouped[key][produto].push(item.valor_brl)
        }
    }

    return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, values]) => ({
            data_ref: dateKey,
            boi_gordo: values.boi_gordo.length ? Math.round(avg(values.boi_gordo) * 100) / 100 : null,
            milho: values.milho.length ? Math.round(avg(values.milho) * 100) / 100 : null,
            bezerro: values.bezerro.length ? Math.round(avg(values.bezerro) * 100) / 100 : null,
            soja: values.soja.length ? Math.round(avg(values.soja) * 100) / 100 : null,
        }))
}

function avg(arr: number[]): number {
    return arr.reduce((sum, v) => sum + v, 0) / arr.length
}

// Generate seasonality data - average prices by month across years
export function generateSeasonalityData(data: MockHistorico[], produto: string): { mes: string, media: number, min: number, max: number, atual: number | null }[] {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const byMonth: Record<number, number[]> = {}

    const productData = data.filter(d => d.produto === produto)

    for (const item of productData) {
        const month = new Date(item.data + 'T12:00:00').getMonth()
        if (!byMonth[month]) byMonth[month] = []
        byMonth[month].push(item.valor_brl)
    }

    const currentYear = new Date().getFullYear()

    return months.map((mes, index) => {
        const values = byMonth[index] || []
        const currentYearValues = productData
            .filter(d => {
                const date = new Date(d.data + 'T12:00:00')
                return date.getMonth() === index && date.getFullYear() === currentYear
            })
            .map(d => d.valor_brl)

        return {
            mes,
            media: values.length ? Math.round(avg(values) * 100) / 100 : 0,
            min: values.length ? Math.round(Math.min(...values) * 100) / 100 : 0,
            max: values.length ? Math.round(Math.max(...values) * 100) / 100 : 0,
            atual: currentYearValues.length ? Math.round(avg(currentYearValues) * 100) / 100 : null,
        }
    })
}

// Mock alerts
export interface MockAlerta {
    id: string
    usuario_id: string
    produto: string
    condicao: 'acima_de' | 'abaixo_de'
    valor_gatilho: number
    ativo: boolean
    ultimo_disparo: string | null
    usuario_nome?: string
}

export function generateMockAlertas(): MockAlerta[] {
    return [
        { id: '1', usuario_id: 'u1', produto: 'boi_gordo', condicao: 'acima_de', valor_gatilho: 300, ativo: true, ultimo_disparo: null, usuario_nome: 'João Silva' },
        { id: '2', usuario_id: 'u1', produto: 'milho', condicao: 'abaixo_de', valor_gatilho: 50, ativo: true, ultimo_disparo: '2026-03-01T18:00:00Z', usuario_nome: 'João Silva' },
        { id: '3', usuario_id: 'u2', produto: 'bezerro', condicao: 'abaixo_de', valor_gatilho: 2000, ativo: false, ultimo_disparo: '2026-02-28T18:00:00Z', usuario_nome: 'Maria Cardoso' },
        { id: '4', usuario_id: 'u2', produto: 'soja', condicao: 'acima_de', valor_gatilho: 140, ativo: true, ultimo_disparo: null, usuario_nome: 'Maria Cardoso' },
        { id: '5', usuario_id: 'u3', produto: 'boi_gordo', condicao: 'abaixo_de', valor_gatilho: 220, ativo: true, ultimo_disparo: null, usuario_nome: 'Pedro Gomes' },
        { id: '6', usuario_id: 'u3', produto: 'milho', condicao: 'acima_de', valor_gatilho: 70, ativo: true, ultimo_disparo: '2026-02-25T18:00:00Z', usuario_nome: 'Pedro Gomes' },
    ]
}

// Mock users
export interface MockUsuario {
    id: string
    nome: string
    telefone_whatsapp: string
    plano: string
    ativo: boolean
    criado_em: string
}

export function generateMockUsuarios(): MockUsuario[] {
    return [
        { id: 'u1', nome: 'João Silva', telefone_whatsapp: '+5511999990001', plano: 'pro', ativo: true, criado_em: '2025-06-15T10:00:00Z' },
        { id: 'u2', nome: 'Maria Cardoso', telefone_whatsapp: '+5511999990002', plano: 'pro', ativo: true, criado_em: '2025-08-20T14:30:00Z' },
        { id: 'u3', nome: 'Pedro Gomes', telefone_whatsapp: '+5511999990003', plano: 'pro', ativo: true, criado_em: '2025-11-01T09:15:00Z' },
        { id: 'u4', nome: 'Ana Ferreira', telefone_whatsapp: '+5511999990004', plano: 'pro', ativo: false, criado_em: '2025-04-10T16:45:00Z' },
    ]
}
