-- =========================================================
-- Boigordo Analytic Alerts - Phase 4
-- Date: 2026-04-07
-- =========================================================

create table if not exists public.boigordo_alertas_analiticos (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  data_ref date not null,
  tipo text not null,
  severidade text not null check (severidade in ('BAIXA', 'MEDIA', 'ALTA')),
  titulo text not null,
  descricao text not null,
  status text not null default 'ABERTO' check (status in ('ABERTO', 'FECHADO')),
  contexto jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists boigordo_alertas_analiticos_alert_key_data_ref_uidx
  on public.boigordo_alertas_analiticos (alert_key, data_ref);

create index if not exists boigordo_alertas_analiticos_status_idx
  on public.boigordo_alertas_analiticos (status);

create index if not exists boigordo_alertas_analiticos_data_ref_idx
  on public.boigordo_alertas_analiticos (data_ref desc);

drop trigger if exists boigordo_alertas_analiticos_set_updated_at on public.boigordo_alertas_analiticos;
create trigger boigordo_alertas_analiticos_set_updated_at
before update on public.boigordo_alertas_analiticos
for each row
execute function public.boigordo_set_updated_at();

create or replace view public.boigordo_view_alertas_analiticos_recentes as
select
  id,
  alert_key,
  data_ref,
  tipo,
  severidade,
  titulo,
  descricao,
  status,
  contexto,
  created_at,
  updated_at
from public.boigordo_alertas_analiticos
order by data_ref desc, created_at desc;

