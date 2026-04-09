-- =========================================================
-- Boigordo Phase 5 - Alertas Pro e Assinaturas
-- Date: 2026-04-07
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- 1) Perfil e questionário do usuário
-- =========================================================
create table if not exists public.boigordo_usuarios_perfil (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  nome text not null,
  email text,
  telefone_whatsapp text not null,
  papeis_mercado text[] not null default '{}',
  etapas_operacao text[] not null default '{}',
  cabecas_gado integer,
  experiencia_anos integer,
  observacoes text,
  dados_questionario jsonb not null default '{}'::jsonb,
  status text not null default 'ATIVO' check (status in ('ATIVO','INATIVO','BLOQUEADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boigordo_usuarios_perfil_usuario_uidx unique (usuario_id),
  constraint boigordo_usuarios_perfil_telefone_e164_chk
    check (telefone_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  constraint boigordo_usuarios_perfil_cabecas_chk
    check (cabecas_gado is null or cabecas_gado >= 0),
  constraint boigordo_usuarios_perfil_experiencia_chk
    check (experiencia_anos is null or experiencia_anos >= 0)
);

create index if not exists boigordo_usuarios_perfil_status_idx
  on public.boigordo_usuarios_perfil (status);

drop trigger if exists boigordo_usuarios_perfil_set_updated_at on public.boigordo_usuarios_perfil;
create trigger boigordo_usuarios_perfil_set_updated_at
before update on public.boigordo_usuarios_perfil
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 2) Assinaturas (pagamento e ciclo)
-- =========================================================
create table if not exists public.boigordo_assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  plano text not null default 'PRO',
  status text not null default 'ATIVA' check (status in ('ATIVA','TRIAL','INADIMPLENTE','CANCELADA','EXPIRADA')),
  ciclo text not null default 'MENSAL' check (ciclo in ('MENSAL','TRIMESTRAL','ANUAL')),
  valor numeric(12,2),
  moeda text not null default 'BRL',
  data_inicio date not null,
  proximo_vencimento date not null,
  renovacao_automatica boolean not null default true,
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  metodo_pagamento_mask text,
  ultimo_pagamento_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boigordo_assinaturas_usuario_idx
  on public.boigordo_assinaturas (usuario_id);

create index if not exists boigordo_assinaturas_status_vencimento_idx
  on public.boigordo_assinaturas (status, proximo_vencimento);

create unique index if not exists boigordo_assinaturas_ativa_por_usuario_uidx
  on public.boigordo_assinaturas (usuario_id)
  where status in ('ATIVA', 'TRIAL', 'INADIMPLENTE');

drop trigger if exists boigordo_assinaturas_set_updated_at on public.boigordo_assinaturas;
create trigger boigordo_assinaturas_set_updated_at
before update on public.boigordo_assinaturas
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 3) Histórico de pagamentos
-- =========================================================
create table if not exists public.boigordo_pagamentos_historico (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.boigordo_assinaturas(id) on delete cascade,
  usuario_id uuid not null,
  competencia date not null,
  valor numeric(12,2) not null,
  moeda text not null default 'BRL',
  status text not null check (status in ('PENDENTE','PAGO','FALHOU','ESTORNADO')),
  metodo_pagamento text,
  gateway_payment_id text,
  pago_em timestamptz,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists boigordo_pagamentos_historico_usuario_idx
  on public.boigordo_pagamentos_historico (usuario_id, competencia desc);

create index if not exists boigordo_pagamentos_historico_status_idx
  on public.boigordo_pagamentos_historico (status);

-- =========================================================
-- 4) Destinos do Alerta Pro (envio individual)
-- =========================================================
create table if not exists public.boigordo_alertas_pro_destinos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  telefone_destino text not null,
  ativo boolean not null default true,
  tipos_alerta text[] not null default '{}',
  severidades text[] not null default '{}',
  frequencia text not null default 'IMEDIATO' check (frequencia in ('IMEDIATO','DIARIO','SEMANAL')),
  timezone text not null default 'America/Sao_Paulo',
  horario_silencio_inicio time,
  horario_silencio_fim time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boigordo_alertas_pro_destinos_telefone_e164_chk
    check (telefone_destino ~ '^\+[1-9][0-9]{7,14}$'),
  constraint boigordo_alertas_pro_destinos_severidades_chk
    check (
      severidades <@ array['BAIXA','MEDIA','ALTA']::text[]
    )
);

create unique index if not exists boigordo_alertas_pro_destinos_usuario_telefone_uidx
  on public.boigordo_alertas_pro_destinos (usuario_id, telefone_destino);

create index if not exists boigordo_alertas_pro_destinos_ativo_idx
  on public.boigordo_alertas_pro_destinos (ativo);

drop trigger if exists boigordo_alertas_pro_destinos_set_updated_at on public.boigordo_alertas_pro_destinos;
create trigger boigordo_alertas_pro_destinos_set_updated_at
before update on public.boigordo_alertas_pro_destinos
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 5) Regras do Alerta Pro
-- =========================================================
create table if not exists public.boigordo_alertas_pro_regras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  produto text not null check (produto in ('boi_gordo','bezerro','milho','soja')),
  condicao text not null check (condicao in ('acima_de','abaixo_de','variacao_pct')),
  valor_gatilho numeric(14,4) not null,
  ativo boolean not null default true,
  ultimo_disparo timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boigordo_alertas_pro_regras_usuario_ativo_idx
  on public.boigordo_alertas_pro_regras (usuario_id, ativo);

create index if not exists boigordo_alertas_pro_regras_produto_idx
  on public.boigordo_alertas_pro_regras (produto);

drop trigger if exists boigordo_alertas_pro_regras_set_updated_at on public.boigordo_alertas_pro_regras;
create trigger boigordo_alertas_pro_regras_set_updated_at
before update on public.boigordo_alertas_pro_regras
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 6) Views auxiliares (painel de conta e vencimento)
-- =========================================================
create or replace view public.boigordo_view_usuario_configuracoes as
with assinatura_ativa as (
  select distinct on (usuario_id)
    usuario_id,
    plano,
    status as assinatura_status,
    ciclo,
    proximo_vencimento,
    renovacao_automatica,
    metodo_pagamento_mask,
    updated_at
  from public.boigordo_assinaturas
  order by usuario_id, updated_at desc
)
select
  p.usuario_id,
  p.nome,
  p.email,
  p.telefone_whatsapp,
  p.papeis_mercado,
  p.etapas_operacao,
  p.cabecas_gado,
  p.experiencia_anos,
  p.status as perfil_status,
  a.plano,
  a.assinatura_status,
  a.ciclo,
  a.proximo_vencimento,
  a.renovacao_automatica,
  a.metodo_pagamento_mask
from public.boigordo_usuarios_perfil p
left join assinatura_ativa a on a.usuario_id = p.usuario_id;

create or replace view public.boigordo_view_assinaturas_proximo_vencimento as
select
  s.id as assinatura_id,
  s.usuario_id,
  p.nome,
  p.telefone_whatsapp,
  s.plano,
  s.status,
  s.ciclo,
  s.proximo_vencimento,
  (s.proximo_vencimento - current_date) as dias_para_vencer,
  s.renovacao_automatica
from public.boigordo_assinaturas s
left join public.boigordo_usuarios_perfil p on p.usuario_id = s.usuario_id
where s.status in ('ATIVA','TRIAL','INADIMPLENTE')
order by s.proximo_vencimento asc;
