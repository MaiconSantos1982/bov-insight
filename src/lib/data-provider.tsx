"use client"

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { format, subMonths } from 'date-fns'
import {
    supabase,
    type HistoricoPreco,
    type CicloPecuarioClassificacao,
    type BaseRegionalStats,
    type ExportacaoResumoMensal,
    type AlertaAnaliticoRecente,
    type UsuarioConfiguracao,
    type AssinaturaProximoVencimento,
    type AlertaProDestino,
    type AlertaProRegra,
    type PagamentoHistorico,
    type GrupoNotificacao,
    type AdminAssinante,
    type AdminChurnMensal,
    type ExecucaoLog,
    type AlertaProEnvio,
    type AssinaturaDetalhada,
    type BillingEvento,
} from '@/lib/supabase'
import {
    generateMockAlertas,
    generateMockUsuarios,
    type MockAlerta,
    type MockUsuario,
} from '@/lib/mock-data'
import type { DateRange } from 'react-day-picker'

// Types for processed data
export interface RelacaoTrocaRow {
    data_ref: string
    boi_gordo: number | null
    milho: number | null
    bezerro: number | null
    soja: number | null
}

export interface LatestPrice {
    data: string
    produto: string
    valor_brl: number
    valor_usd: number | null
}

export interface AuthUser {
    usuario_id: string
    email: string
    nome: string | null
}

interface DataContextType {
    historicalData: HistoricoPreco[]
    cicloPecuario: CicloPecuarioClassificacao[]
    baseRegionalStats: BaseRegionalStats[]
    exportacaoResumo: ExportacaoResumoMensal[]
    alertasAnaliticos: AlertaAnaliticoRecente[]
    usuarioConfiguracao: UsuarioConfiguracao | null
    assinaturasProximoVencimento: AssinaturaProximoVencimento[]
    alertasProDestinos: AlertaProDestino[]
    alertasProRegras: AlertaProRegra[]
    pagamentosHistorico: PagamentoHistorico[]
    gruposNotificacao: GrupoNotificacao[]
    adminAssinantes: AdminAssinante[]
    adminChurnMensal: AdminChurnMensal[]
    execucoesLogs: ExecucaoLog[]
    alertasProEnvios: AlertaProEnvio[]
    assinaturasDetalhadas: AssinaturaDetalhada[]
    billingEventos: BillingEvento[]
    authUser: AuthUser | null
    isSuperAdmin: boolean
    latestPrices: Record<string, LatestPrice>
    previousPrices: Record<string, LatestPrice>
    getRelacaoTroca: (dateRange: DateRange | undefined, agrupamento: 'day' | 'week' | 'month') => RelacaoTrocaRow[]
    getSeasonality: (produto: string) => { mes: string; media: number; min: number; max: number; atual: number | null }[]
    alertas: MockAlerta[]
    setAlertas: React.Dispatch<React.SetStateAction<MockAlerta[]>>
    usuarios: MockUsuario[]
    globalDateRange: DateRange | undefined
    setGlobalDateRange: (range: DateRange | undefined) => void
    loading: boolean
}

const DataContext = createContext<DataContextType | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [historicalData, setHistoricalData] = useState<HistoricoPreco[]>([])
    const [cicloPecuario, setCicloPecuario] = useState<CicloPecuarioClassificacao[]>([])
    const [baseRegionalStats, setBaseRegionalStats] = useState<BaseRegionalStats[]>([])
    const [exportacaoResumo, setExportacaoResumo] = useState<ExportacaoResumoMensal[]>([])
    const [alertasAnaliticos, setAlertasAnaliticos] = useState<AlertaAnaliticoRecente[]>([])
    const [usuarioConfiguracao, setUsuarioConfiguracao] = useState<UsuarioConfiguracao | null>(null)
    const [assinaturasProximoVencimento, setAssinaturasProximoVencimento] = useState<AssinaturaProximoVencimento[]>([])
    const [alertasProDestinos, setAlertasProDestinos] = useState<AlertaProDestino[]>([])
    const [alertasProRegras, setAlertasProRegras] = useState<AlertaProRegra[]>([])
    const [pagamentosHistorico, setPagamentosHistorico] = useState<PagamentoHistorico[]>([])
    const [gruposNotificacao, setGruposNotificacao] = useState<GrupoNotificacao[]>([])
    const [adminAssinantes, setAdminAssinantes] = useState<AdminAssinante[]>([])
    const [adminChurnMensal, setAdminChurnMensal] = useState<AdminChurnMensal[]>([])
    const [execucoesLogs, setExecucoesLogs] = useState<ExecucaoLog[]>([])
    const [alertasProEnvios, setAlertasProEnvios] = useState<AlertaProEnvio[]>([])
    const [assinaturasDetalhadas, setAssinaturasDetalhadas] = useState<AssinaturaDetalhada[]>([])
    const [billingEventos, setBillingEventos] = useState<BillingEvento[]>([])
    const [authUser, setAuthUser] = useState<AuthUser | null>(null)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [alertas, setAlertas] = useState<MockAlerta[]>(() => generateMockAlertas())
    const usuarios = useMemo(() => generateMockUsuarios(), [])

    const [globalDateRange, setGlobalDateRange] = useState<DateRange | undefined>({
        from: subMonths(new Date(), 6),
        to: new Date(),
    })

    // Fetch historical data from Supabase (last 3 years, paginated)
    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            setUsuarioConfiguracao(null)
            setAlertasProDestinos([])
            setAlertasProRegras([])
            setPagamentosHistorico([])
            setAuthUser(null)
            setIsSuperAdmin(false)
            try {
                async function fetchAllRows<T>(
                    table: string,
                    options?: {
                        orderBy?: string
                        ascending?: boolean
                        fromDateField?: string
                        fromDateValue?: string
                        maxRows?: number
                    }
                ): Promise<T[]> {
                    const pageSize = 1000
                    let from = 0
                    let hasMore = true
                    const rows: T[] = []
                    const maxRows = options?.maxRows

                    while (hasMore) {
                        if (typeof maxRows === "number" && rows.length >= maxRows) {
                            break
                        }

                        const pageEnd = typeof maxRows === "number"
                            ? Math.min(from + pageSize - 1, maxRows - 1)
                            : from + pageSize - 1

                        if (pageEnd < from) {
                            break
                        }

                        let query = supabase
                            .from(table)
                            .select('*')
                            .order(options?.orderBy || 'created_at', { ascending: options?.ascending ?? true })
                            .range(from, pageEnd)

                        if (options?.fromDateField && options?.fromDateValue) {
                            query = query.gte(options.fromDateField, options.fromDateValue)
                        }

                        const { data, error } = await query
                        if (error) {
                            console.error(`Erro ao buscar ${table}:`, error)
                            break
                        }

                        const chunk = (data || []) as T[]
                        rows.push(...chunk)
                        const expectedChunkSize = pageEnd - from + 1
                        from += pageSize
                        hasMore = chunk.length === expectedChunkSize
                    }

                    return rows
                }

                const threeYearsAgo = format(subMonths(new Date(), 36), 'yyyy-MM-dd')
                const allData = await fetchAllRows<HistoricoPreco>('boigordo_historico', {
                    orderBy: 'data',
                    ascending: true,
                    fromDateField: 'data',
                    fromDateValue: threeYearsAgo,
                    maxRows: 10000,
                })

                console.log(`[BovInsight] Carregados ${allData.length} registros do Supabase`)
                if (allData.length > 0) {
                    setHistoricalData(allData)
                }

                let sessionUserId: string | null = null
                let sessionUserEmail: string | null = null
                try {
                    const authMeRes = await fetch('/api/auth/me', { cache: 'no-store' })
                    if (authMeRes.ok) {
                        const authMeJson = await authMeRes.json() as { ok: boolean; user?: { usuario_id?: string; email?: string; nome?: string | null } }
                        sessionUserId = authMeJson?.user?.usuario_id || null
                        sessionUserEmail = authMeJson?.user?.email?.toLowerCase() || null
                        if (sessionUserId && sessionUserEmail) {
                            setAuthUser({
                                usuario_id: sessionUserId,
                                email: sessionUserEmail,
                                nome: authMeJson?.user?.nome || null,
                            })
                        } else {
                            setAuthUser(null)
                        }
                    }
                } catch (err) {
                    console.error('Falha ao identificar sessão atual:', err)
                    setAuthUser(null)
                }
                const isCurrentUserSuperAdmin = isSuperAdminEmail(sessionUserEmail)
                setIsSuperAdmin(isCurrentUserSuperAdmin)
                const shouldLoadAdmin = Boolean(sessionUserId && isCurrentUserSuperAdmin)

                const [cicloRows, baseRows, exportRows, alertasRes, usuarioConfigRes, assinaturasRes, destinosRes, regrasRes, pagamentosRes, gruposRes, adminAssinantesHttpRes, churnRes, logsRes, enviosRes, assinaturasDetalhadasHttpRes, billingEventosHttpRes] = await Promise.all([
                    fetchAllRows<CicloPecuarioClassificacao>('boigordo_view_ciclo_pecuario_classificacao', {
                        orderBy: 'periodo',
                        ascending: true,
                    }),
                    fetchAllRows<BaseRegionalStats>('boigordo_view_base_regional_stats', {
                        orderBy: 'data',
                        ascending: false,
                        fromDateField: 'data',
                        fromDateValue: threeYearsAgo,
                        // Evita paginação profunda via offset na view (timeout em alguns projetos Supabase).
                        maxRows: 2000,
                    }),
                    fetchAllRows<ExportacaoResumoMensal>('boigordo_view_exportacao_resumo_mensal', {
                        orderBy: 'periodo',
                        ascending: true,
                    }),
                    supabase
                        .from('boigordo_alertas_analiticos')
                        .select('*')
                        .order('data_ref', { ascending: false })
                        .limit(200),
                    supabase
                        .from('boigordo_view_usuario_configuracoes')
                        .select('*')
                        .order('nome', { ascending: true })
                        .limit(200),
                    supabase
                        .from('boigordo_view_assinaturas_proximo_vencimento')
                        .select('*')
                        .order('proximo_vencimento', { ascending: true })
                        .limit(100),
                    supabase
                        .from('boigordo_alertas_pro_destinos')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(100),
                    supabase
                        .from('boigordo_alertas_pro_regras')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(200),
                    supabase
                        .from('boigordo_pagamentos_historico')
                        .select('*')
                        .order('competencia', { ascending: false })
                        .limit(300),
                    supabase
                        .from('boigordo_grupos_notificacao')
                        .select('*')
                        .order('created_at', { ascending: true })
                        .limit(200),
                    shouldLoadAdmin ? fetch('/api/admin/assinantes', { cache: 'no-store' }) : Promise.resolve(null),
                    supabase
                        .from('boigordo_view_admin_churn_mensal')
                        .select('*')
                        .order('mes_ref', { ascending: false })
                        .limit(60),
                    supabase
                        .from('boigordo_execucoes_logs')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(300),
                    supabase
                        .from('boigordo_alertas_pro_envios')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(500),
                    shouldLoadAdmin ? fetch('/api/admin/assinaturas', { cache: 'no-store' }) : Promise.resolve(null),
                    shouldLoadAdmin ? fetch('/api/admin/billing-eventos', { cache: 'no-store' }) : Promise.resolve(null),
                ])

                setCicloPecuario(cicloRows)
                setBaseRegionalStats([...baseRows].sort((a, b) => a.data.localeCompare(b.data)))
                setExportacaoResumo(exportRows)

                if (alertasRes.error) {
                    console.error('Erro ao buscar boigordo_alertas_analiticos:', alertasRes.error)
                } else {
                    setAlertasAnaliticos((alertasRes.data || []) as AlertaAnaliticoRecente[])
                }

                if (usuarioConfigRes.error) {
                    console.error('Erro ao buscar boigordo_view_usuario_configuracoes:', usuarioConfigRes.error)
                } else {
                    const rows = (usuarioConfigRes.data || []) as UsuarioConfiguracao[]
                    const row = sessionUserId
                        ? rows.find((item) => item.usuario_id === sessionUserId)
                        : undefined
                    setUsuarioConfiguracao(row || null)
                }

                if (assinaturasRes.error) {
                    console.error('Erro ao buscar boigordo_view_assinaturas_proximo_vencimento:', assinaturasRes.error)
                } else {
                    setAssinaturasProximoVencimento((assinaturasRes.data || []) as AssinaturaProximoVencimento[])
                }

                if (destinosRes.error) {
                    console.error('Erro ao buscar boigordo_alertas_pro_destinos:', destinosRes.error)
                } else {
                    const rows = (destinosRes.data || []) as AlertaProDestino[]
                    setAlertasProDestinos(sessionUserId ? rows.filter((item) => item.usuario_id === sessionUserId) : [])
                }

                if (regrasRes.error) {
                    console.error('Erro ao buscar boigordo_alertas_pro_regras:', regrasRes.error)
                } else {
                    const rows = (regrasRes.data || []) as AlertaProRegra[]
                    setAlertasProRegras(sessionUserId ? rows.filter((item) => item.usuario_id === sessionUserId) : [])
                }

                if (pagamentosRes.error) {
                    console.error('Erro ao buscar boigordo_pagamentos_historico:', pagamentosRes.error)
                } else {
                    const rows = (pagamentosRes.data || []) as PagamentoHistorico[]
                    setPagamentosHistorico(sessionUserId ? rows.filter((item) => item.usuario_id === sessionUserId) : [])
                }

                if (gruposRes.error) {
                    console.error('Erro ao buscar boigordo_grupos_notificacao:', gruposRes.error)
                } else {
                    setGruposNotificacao((gruposRes.data || []) as GrupoNotificacao[])
                }

                if (adminAssinantesHttpRes) {
                    try {
                        const adminAssinantesJson = await adminAssinantesHttpRes.json() as { ok: boolean; rows?: AdminAssinante[]; error?: string }
                        if (!adminAssinantesHttpRes.ok || !adminAssinantesJson.ok) {
                            console.error('Erro ao buscar boigordo_view_admin_assinantes via API:', adminAssinantesJson.error || adminAssinantesHttpRes.statusText)
                        } else {
                            setAdminAssinantes((adminAssinantesJson.rows || []) as AdminAssinante[])
                        }
                    } catch (err) {
                        console.error('Falha ao decodificar resposta de admin-assinantes:', err)
                    }
                } else {
                    setAdminAssinantes([])
                }

                if (churnRes.error) {
                    console.error('Erro ao buscar boigordo_view_admin_churn_mensal:', churnRes.error)
                } else {
                    setAdminChurnMensal((churnRes.data || []) as AdminChurnMensal[])
                }

                if (logsRes.error) {
                    console.error('Erro ao buscar boigordo_execucoes_logs:', logsRes.error)
                } else {
                    setExecucoesLogs((logsRes.data || []) as ExecucaoLog[])
                }

                if (enviosRes.error) {
                    console.error('Erro ao buscar boigordo_alertas_pro_envios:', enviosRes.error)
                } else {
                    setAlertasProEnvios((enviosRes.data || []) as AlertaProEnvio[])
                }

                if (assinaturasDetalhadasHttpRes) {
                    try {
                        const assinaturasJson = await assinaturasDetalhadasHttpRes.json() as { ok: boolean; rows?: AssinaturaDetalhada[]; error?: string }
                        if (!assinaturasDetalhadasHttpRes.ok || !assinaturasJson.ok) {
                            console.error('Erro ao buscar boigordo_assinaturas via API:', assinaturasJson.error || assinaturasDetalhadasHttpRes.statusText)
                        } else {
                            setAssinaturasDetalhadas((assinaturasJson.rows || []) as AssinaturaDetalhada[])
                        }
                    } catch (err) {
                        console.error('Falha ao decodificar resposta de assinaturas:', err)
                    }
                } else {
                    setAssinaturasDetalhadas([])
                }

                if (billingEventosHttpRes) {
                    try {
                        const billingJson = await billingEventosHttpRes.json() as { ok: boolean; rows?: BillingEvento[]; error?: string }
                        if (!billingEventosHttpRes.ok || !billingJson.ok) {
                            console.error('Erro ao buscar boigordo_billing_eventos via API:', billingJson.error || billingEventosHttpRes.statusText)
                        } else {
                            setBillingEventos((billingJson.rows || []) as BillingEvento[])
                        }
                    } catch (err) {
                        console.error('Falha ao decodificar resposta de billing-eventos:', err)
                    }
                } else {
                    setBillingEventos([])
                }
            } catch (err) {
                console.error('Erro na conexão com Supabase:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    // Get latest prices (last trading day)
    const latestPrices = useMemo(() => {
        const latest: Record<string, LatestPrice> = {}
        const sortedData = [...historicalData].sort((a, b) => b.data.localeCompare(a.data))

        for (const item of sortedData) {
            if (!latest[item.produto]) {
                latest[item.produto] = {
                    data: item.data,
                    produto: item.produto,
                    valor_brl: item.valor_brl,
                    valor_usd: item.valor_usd,
                }
            }
            if (Object.keys(latest).length === 4) break
        }

        return latest
    }, [historicalData])

    // Get previous day prices
    const previousPrices = useMemo(() => {
        const dates = [...new Set(historicalData.map(d => d.data))].sort().reverse()
        const previousDate = dates[1]
        const previous: Record<string, LatestPrice> = {}

        for (const item of historicalData) {
            if (item.data === previousDate) {
                previous[item.produto] = {
                    data: item.data,
                    produto: item.produto,
                    valor_brl: item.valor_brl,
                    valor_usd: item.valor_usd,
                }
            }
        }

        return previous
    }, [historicalData])

    // Client-side grouping for relação de troca
    const getRelacaoTroca = useCallback((dateRange: DateRange | undefined, agrupamento: 'day' | 'week' | 'month') => {
        const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(subMonths(new Date(), 6), 'yyyy-MM-dd')
        const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

        const filtered = historicalData.filter(d => d.data >= from && d.data <= to)

        const grouped: Record<string, {
            boi_gordo: number[];
            milho: number[];
            bezerro: number[];
            soja: number[];
            data_ref: string;
        }> = {}

        for (const item of filtered) {
            let key: string
            const date = new Date(item.data + 'T12:00:00')

            if (agrupamento === 'month') {
                key = format(date, 'yyyy-MM-01')
            } else if (agrupamento === 'week') {
                const dayOfWeek = date.getDay()
                const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
                const monday = new Date(date)
                monday.setDate(date.getDate() + diff)
                key = format(monday, 'yyyy-MM-dd')
            } else {
                key = item.data
            }

            if (!grouped[key]) {
                grouped[key] = {
                    boi_gordo: [],
                    milho: [],
                    bezerro: [],
                    soja: [],
                    // Para semana, usamos a data mais recente da janela.
                    // Para dia/mês, fica equivalente ao próprio bucket.
                    data_ref: item.data,
                }
            }

            const produto = item.produto as 'boi_gordo' | 'milho' | 'bezerro' | 'soja'
            if (grouped[key][produto]) {
                grouped[key][produto].push(item.valor_brl)
            }
            if (item.data > grouped[key].data_ref) {
                grouped[key].data_ref = item.data
            }
        }

        return Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, values]) => ({
                data_ref: agrupamento === 'week' ? values.data_ref : dateKey,
                boi_gordo: values.boi_gordo.length ? Math.round(avg(values.boi_gordo) * 100) / 100 : null,
                milho: values.milho.length ? Math.round(avg(values.milho) * 100) / 100 : null,
                bezerro: values.bezerro.length ? Math.round(avg(values.bezerro) * 100) / 100 : null,
                soja: values.soja.length ? Math.round(avg(values.soja) * 100) / 100 : null,
            }))
    }, [historicalData])

    // Seasonality: average by month across all years
    const getSeasonality = useCallback((produto: string) => {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const byMonth: Record<number, number[]> = {}
        const productData = historicalData.filter(d => d.produto === produto)
        const currentYear = new Date().getFullYear()

        for (const item of productData) {
            const month = new Date(item.data + 'T12:00:00').getMonth()
            if (!byMonth[month]) byMonth[month] = []
            byMonth[month].push(item.valor_brl)
        }

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
    }, [historicalData])

    return (
        <DataContext.Provider value={{
            historicalData,
            cicloPecuario,
            baseRegionalStats,
            exportacaoResumo,
            alertasAnaliticos,
            usuarioConfiguracao,
            assinaturasProximoVencimento,
            alertasProDestinos,
            alertasProRegras,
            pagamentosHistorico,
            gruposNotificacao,
            adminAssinantes,
            adminChurnMensal,
            execucoesLogs,
            alertasProEnvios,
            assinaturasDetalhadas,
            billingEventos,
            authUser,
            isSuperAdmin,
            latestPrices,
            previousPrices,
            getRelacaoTroca,
            getSeasonality,
            alertas,
            setAlertas,
            usuarios,
            globalDateRange,
            setGlobalDateRange,
            loading,
        }}>
            {children}
        </DataContext.Provider>
    )
}

function isSuperAdminEmail(email: string | null): boolean {
    if (!email) return false
    const normalizedEmail = email.toLowerCase()
    const fromEnv = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)

    return normalizedEmail === 'maiconsantos1982@gmail.com' || fromEnv.includes(normalizedEmail)
}

function avg(arr: number[]): number {
    return arr.reduce((sum, v) => sum + v, 0) / arr.length
}

export function useData() {
    const context = useContext(DataContext)
    if (!context) throw new Error('useData must be used within DataProvider')
    return context
}
