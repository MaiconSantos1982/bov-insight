-- =========================================================
-- Boigordo Phase 7.3 - Billing/Webhooks Foundation
-- Date: 2026-04-09
-- =========================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- 1) Billing events inbox (idempotent by provider_event_id)
-- -------------------------------------------------------------------
create table if not exists public.boigordo_billing_eventos (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  usuario_id uuid,
  assinatura_id uuid,
  status_processamento text not null default 'PENDENTE'
    check (status_processamento in ('PENDENTE','PROCESSADO','FALHA')),
  tentativas integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boigordo_billing_eventos_provider_event_uidx unique (provider, provider_event_id)
);

create index if not exists boigordo_billing_eventos_status_idx
  on public.boigordo_billing_eventos (status_processamento, received_at desc);

create index if not exists boigordo_billing_eventos_usuario_idx
  on public.boigordo_billing_eventos (usuario_id, received_at desc);

drop trigger if exists boigordo_billing_eventos_set_updated_at on public.boigordo_billing_eventos;
create trigger boigordo_billing_eventos_set_updated_at
before update on public.boigordo_billing_eventos
for each row
execute function public.boigordo_set_updated_at();

-- -------------------------------------------------------------------
-- 2) Subscription status audit trail
-- -------------------------------------------------------------------
create table if not exists public.boigordo_assinaturas_eventos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid references public.boigordo_assinaturas(id) on delete set null,
  usuario_id uuid,
  evento text not null,
  status_anterior text,
  status_novo text,
  origem text not null default 'WEBHOOK',
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists boigordo_assinaturas_eventos_assinatura_idx
  on public.boigordo_assinaturas_eventos (assinatura_id, created_at desc);

create index if not exists boigordo_assinaturas_eventos_usuario_idx
  on public.boigordo_assinaturas_eventos (usuario_id, created_at desc);

-- -------------------------------------------------------------------
-- 3) Retry queue for failed webhook events
-- -------------------------------------------------------------------
create table if not exists public.boigordo_webhooks_retry_queue (
  id uuid primary key default gen_random_uuid(),
  billing_evento_id uuid not null references public.boigordo_billing_eventos(id) on delete cascade,
  run_after timestamptz not null,
  attempt integer not null default 1,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','EXECUTANDO','CONCLUIDO','FALHA_FINAL')),
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boigordo_webhooks_retry_queue_unq unique (billing_evento_id, attempt)
);

create index if not exists boigordo_webhooks_retry_queue_next_idx
  on public.boigordo_webhooks_retry_queue (status, run_after asc);

drop trigger if exists boigordo_webhooks_retry_queue_set_updated_at on public.boigordo_webhooks_retry_queue;
create trigger boigordo_webhooks_retry_queue_set_updated_at
before update on public.boigordo_webhooks_retry_queue
for each row
execute function public.boigordo_set_updated_at();

-- -------------------------------------------------------------------
-- 4) RLS - admin only surfaces for billing internals
-- -------------------------------------------------------------------
alter table if exists public.boigordo_billing_eventos enable row level security;
alter table if exists public.boigordo_assinaturas_eventos enable row level security;
alter table if exists public.boigordo_webhooks_retry_queue enable row level security;

revoke all on table public.boigordo_billing_eventos from anon;
revoke all on table public.boigordo_assinaturas_eventos from anon;
revoke all on table public.boigordo_webhooks_retry_queue from anon;

grant select, insert, update, delete on table public.boigordo_billing_eventos to authenticated;
grant select, insert, update, delete on table public.boigordo_assinaturas_eventos to authenticated;
grant select, insert, update, delete on table public.boigordo_webhooks_retry_queue to authenticated;

drop policy if exists boigordo_billing_eventos_admin_only on public.boigordo_billing_eventos;
drop policy if exists boigordo_assinaturas_eventos_admin_only on public.boigordo_assinaturas_eventos;
drop policy if exists boigordo_webhooks_retry_queue_admin_only on public.boigordo_webhooks_retry_queue;

create policy boigordo_billing_eventos_admin_only
  on public.boigordo_billing_eventos
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

create policy boigordo_assinaturas_eventos_admin_only
  on public.boigordo_assinaturas_eventos
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

create policy boigordo_webhooks_retry_queue_admin_only
  on public.boigordo_webhooks_retry_queue
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

