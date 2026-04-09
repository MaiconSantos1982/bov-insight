-- =========================================================
-- Boigordo Notification Groups - Phase 4 Complement
-- Date: 2026-04-07
-- =========================================================

create table if not exists public.boigordo_grupos_notificacao (
  id uuid primary key default gen_random_uuid(),
  nome_grupo text,
  group_id text not null,
  tipos_alerta text[] not null default '{}',
  severidades text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boigordo_grupos_notificacao_severidades_chk
    check (
      severidades <@ array['BAIXA','MEDIA','ALTA']::text[]
    )
);

create unique index if not exists boigordo_grupos_notificacao_group_id_uidx
  on public.boigordo_grupos_notificacao (group_id);

create index if not exists boigordo_grupos_notificacao_ativo_idx
  on public.boigordo_grupos_notificacao (ativo);

drop trigger if exists boigordo_grupos_notificacao_set_updated_at on public.boigordo_grupos_notificacao;
create trigger boigordo_grupos_notificacao_set_updated_at
before update on public.boigordo_grupos_notificacao
for each row
execute function public.boigordo_set_updated_at();

alter table public.boigordo_alertas_analiticos
  add column if not exists enviado_grupo_at timestamptz null,
  add column if not exists ultimo_erro_envio text null;

create index if not exists boigordo_alertas_analiticos_enviado_grupo_at_idx
  on public.boigordo_alertas_analiticos (enviado_grupo_at);

create or replace view public.boigordo_view_grupos_notificacao as
select
  id,
  nome_grupo,
  group_id,
  tipos_alerta,
  severidades,
  ativo,
  created_at,
  updated_at
from public.boigordo_grupos_notificacao
order by ativo desc, created_at asc;
