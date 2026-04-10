import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface HistoricoPreco {
  id: number
  data: string
  produto: string
  valor_brl: number
  valor_usd: number
}

export interface Usuario {
  id: string
  nome: string
  telefone_whatsapp: string
  plano: string
  ativo: boolean
  criado_em: string
}

export interface Alerta {
  id: string
  usuario_id: string
  produto: string
  condicao: string
  valor_gatilho: number
  ativo: boolean
  ultimo_disparo: string | null
}

export interface RelacaoTroca {
  data_ref: string
  boi_gordo: number | null
  milho: number | null
  bezerro: number | null
  soja: number | null
}

export interface CicloPecuarioClassificacao {
  regiao: string
  periodo: string
  taxa_femeas_pct: number
  media_movel_12m: number
  fase_ciclo: 'RETENCAO' | 'ESTABILIDADE' | 'LIQUIDACAO'
}

export interface BaseRegionalStats {
  data: string
  praca_local: string
  preco_fisico_local: number
  preco_referencia_sp: number
  base_absoluta: number
  base_percentual: number
  media_base_pct: number
  desvio_base_pct: number
  situacao_base: 'BASE_FORTE' | 'BASE_NORMAL' | 'BASE_FRACA'
}

export interface EscalaAbateRegional {
  regiao: string
  data: string
  dias_escala_media: number
  limite_curta: number
  limite_longa: number
  classificacao: 'CURTA' | 'NORMAL' | 'LONGA'
}

export interface ExportacaoResumoMensal {
  periodo: string
  volume_total_t: number
  receita_total_usd: number
  dependencia_china_pct: number
  preco_medio_usd_t_global: number
}

export interface AlertaAnaliticoRecente {
  id: string
  alert_key: string
  data_ref: string
  tipo: string
  severidade: 'BAIXA' | 'MEDIA' | 'ALTA'
  titulo: string
  descricao: string
  status: 'ABERTO' | 'FECHADO'
  contexto: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface UsuarioConfiguracao {
  usuario_id: string
  nome: string
  email: string | null
  telefone_whatsapp: string
  papeis_mercado: string[]
  etapas_operacao: string[]
  cabecas_gado: number | null
  experiencia_anos: number | null
  perfil_status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO'
  plano: string | null
  assinatura_status: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA' | 'EXPIRADA' | null
  ciclo: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | null
  proximo_vencimento: string | null
  renovacao_automatica: boolean | null
  metodo_pagamento_mask: string | null
}

export interface AssinaturaProximoVencimento {
  assinatura_id: string
  usuario_id: string
  nome: string | null
  telefone_whatsapp: string | null
  plano: string
  status: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA' | 'EXPIRADA'
  ciclo: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL'
  proximo_vencimento: string
  dias_para_vencer: number
  renovacao_automatica: boolean
}

export interface AlertaProDestino {
  id: string
  usuario_id: string
  telefone_destino: string
  ativo: boolean
  tipos_alerta: string[]
  severidades: string[]
  frequencia: 'IMEDIATO' | 'DIARIO' | 'SEMANAL'
  timezone: string
  horario_silencio_inicio: string | null
  horario_silencio_fim: string | null
  created_at: string
  updated_at: string
}

export interface AlertaProRegra {
  id: string
  usuario_id: string
  produto: 'boi_gordo' | 'bezerro' | 'milho' | 'soja'
  condicao: 'acima_de' | 'abaixo_de' | 'variacao_pct'
  valor_gatilho: number
  ativo: boolean
  ultimo_disparo: string | null
  created_at: string
  updated_at: string
}

export interface PagamentoHistorico {
  id: string
  assinatura_id: string
  usuario_id: string
  competencia: string
  valor: number
  moeda: string
  status: 'PENDENTE' | 'PAGO' | 'FALHOU' | 'ESTORNADO'
  metodo_pagamento: string | null
  gateway_payment_id: string | null
  pago_em: string | null
  detalhes: Record<string, unknown>
  created_at: string
}

export interface GrupoNotificacao {
  id: string
  nome_grupo: string | null
  group_id: string
  tipos_alerta: string[]
  severidades: string[]
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface AdminAssinante {
  usuario_id: string
  nome: string
  email: string | null
  telefone_whatsapp: string
  papeis_mercado: string[]
  etapas_operacao: string[]
  cabecas_gado: number | null
  perfil_status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO'
  assinatura_id: string | null
  plano: string | null
  assinatura_status: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA' | 'EXPIRADA' | null
  ciclo: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | null
  proximo_vencimento: string | null
  renovacao_automatica: boolean | null
  cancelada_em: string | null
  ultimo_pagamento_em: string | null
}

export interface AdminChurnMensal {
  mes_ref: string
  canceladas: number
  ativas: number
  churn_pct: number
}

export interface ExecucaoLog {
  id: string
  origem: string
  tipo: string
  status: 'SUCESSO' | 'FALHA' | 'INICIADO'
  mensagem: string | null
  contexto: Record<string, unknown>
  started_at: string | null
  finished_at: string | null
  duracao_ms: number | null
  created_at: string
}

export interface AlertaProEnvio {
  id: string
  usuario_id: string
  telefone_destino: string
  mensagem_tipo: string
  status: 'ENVIADO' | 'FALHA'
  custo_estimado_brl: number
  provider_message_id: string | null
  contexto: Record<string, unknown>
  created_at: string
}

export interface AssinaturaDetalhada {
  id: string
  usuario_id: string
  plano: string
  status: 'ATIVA' | 'TRIAL' | 'INADIMPLENTE' | 'CANCELADA' | 'EXPIRADA'
  ciclo: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL'
  valor: number | null
  moeda: string
  data_inicio: string
  proximo_vencimento: string
  renovacao_automatica: boolean
  cancelada_em: string | null
  created_at: string
  updated_at: string
}

export interface BillingEvento {
  id: string
  provider: string
  provider_event_id: string
  event_type: string
  usuario_id: string | null
  assinatura_id: string | null
  status_processamento: 'PENDENTE' | 'PROCESSADO' | 'FALHA'
  tentativas: number
  received_at: string
  processed_at: string | null
  payload: Record<string, unknown>
  erro: string | null
  created_at: string
  updated_at: string
}

// Product labels mapping
export const PRODUTOS = {
  boi_gordo: { label: 'Boi Gordo', unit: '@', color: 'hsl(160, 60%, 45%)' },
  bezerro: { label: 'Bezerro', unit: 'cab', color: 'hsl(45, 90%, 55%)' },
  milho: { label: 'Milho', unit: 'sc 60kg', color: 'hsl(220, 70%, 55%)' },
  soja: { label: 'Soja', unit: 'sc 60kg', color: 'hsl(0, 75%, 55%)' },
} as const

export type ProdutoKey = keyof typeof PRODUTOS
