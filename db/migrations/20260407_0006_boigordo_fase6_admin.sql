-- =========================================================
-- Boigordo Phase 6 - Admin e Gestão Geral
-- Date: 2026-04-07
-- =========================================================

create extension if not exists pgcrypto;

-- Ajuste para churn e ciclo de cancelamento
alter table public.boigordo_assinaturas
  add column if not exists cancelada_em date null;

-- Custos operacionais de Alertas Pro enviados
create table if not exists public.boigordo_alertas_pro_envios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  telefone_destino text not null,
  mensagem_tipo text not null default 'ALERTA_PRO',
  status text not null check (status in ('ENVIADO','FALHA')),
  custo_estimado_brl numeric(12,4) not null default 0,
  provider_message_id text,
  contexto jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists boigordo_alertas_pro_envios_created_at_idx
  on public.boigordo_alertas_pro_envios (created_at desc);

create index if not exists boigordo_alertas_pro_envios_usuario_idx
  on public.boigordo_alertas_pro_envios (usuario_id, created_at desc);

-- Logs de execuções (workers, notificações, integrações)
create table if not exists public.boigordo_execucoes_logs (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  tipo text not null,
  status text not null check (status in ('SUCESSO','FALHA','INICIADO')),
  mensagem text,
  contexto jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  duracao_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists boigordo_execucoes_logs_created_at_idx
  on public.boigordo_execucoes_logs (created_at desc);

create index if not exists boigordo_execucoes_logs_tipo_status_idx
  on public.boigordo_execucoes_logs (tipo, status);

-- View de assinantes para admin
create or replace view public.boigordo_view_admin_assinantes as
with pagamentos as (
  select
    usuario_id,
    max(pago_em) as ultimo_pagamento_em
  from public.boigordo_pagamentos_historico
  where status = 'PAGO'
  group by usuario_id
)
select
  p.usuario_id,
  p.nome,
  p.email,
  p.telefone_whatsapp,
  p.papeis_mercado,
  p.etapas_operacao,
  p.cabecas_gado,
  p.status as perfil_status,
  a.id as assinatura_id,
  a.plano,
  a.status as assinatura_status,
  a.ciclo,
  a.proximo_vencimento,
  a.renovacao_automatica,
  a.cancelada_em,
  pg.ultimo_pagamento_em
from public.boigordo_usuarios_perfil p
left join public.boigordo_assinaturas a on a.usuario_id = p.usuario_id
left join pagamentos pg on pg.usuario_id = p.usuario_id
order by p.nome asc;

-- View de churn mensal
create or replace view public.boigordo_view_admin_churn_mensal as
with base as (
  select
    date_trunc('month', coalesce(cancelada_em::timestamp, created_at))::date as mes_ref,
    count(*) filter (where status in ('CANCELADA','EXPIRADA') and cancelada_em is not null) as canceladas,
    count(*) filter (where status in ('ATIVA','TRIAL','INADIMPLENTE')) as ativas
  from public.boigordo_assinaturas
  group by 1
)
select
  mes_ref,
  canceladas,
  ativas,
  case when (canceladas + ativas) = 0 then 0
       else round((canceladas::numeric / (canceladas + ativas)::numeric) * 100, 2)
  end as churn_pct
from base
order by mes_ref desc;
