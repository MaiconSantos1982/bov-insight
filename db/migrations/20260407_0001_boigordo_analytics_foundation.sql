-- =========================================================
-- Boigordo Analytics Foundation - Phase 1
-- Date: 2026-04-07
-- =========================================================

create extension if not exists pgcrypto;

-- Shared trigger function to keep updated_at in sync.
create or replace function public.boigordo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 1) boigordo_abate_femeas_historico
-- =========================================================
create table if not exists public.boigordo_abate_femeas_historico (
  id uuid primary key default gen_random_uuid(),
  regiao text not null,
  periodo date not null,
  taxa_femeas_pct numeric(8,4) not null,
  fonte text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists boigordo_abate_femeas_historico_regiao_periodo_uidx
  on public.boigordo_abate_femeas_historico (regiao, periodo);

create index if not exists boigordo_abate_femeas_historico_periodo_idx
  on public.boigordo_abate_femeas_historico (periodo);

drop trigger if exists boigordo_abate_femeas_historico_set_updated_at on public.boigordo_abate_femeas_historico;
create trigger boigordo_abate_femeas_historico_set_updated_at
before update on public.boigordo_abate_femeas_historico
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 2) boigordo_base_regional_historico
-- =========================================================
create table if not exists public.boigordo_base_regional_historico (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  praca_local text not null,
  preco_fisico_local numeric(14,4) not null,
  preco_referencia_sp numeric(14,4) not null,
  base_absoluta numeric(14,4) not null,
  base_percentual numeric(10,4) not null,
  fonte text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists boigordo_base_regional_historico_praca_data_uidx
  on public.boigordo_base_regional_historico (praca_local, data);

create index if not exists boigordo_base_regional_historico_data_idx
  on public.boigordo_base_regional_historico (data);

drop trigger if exists boigordo_base_regional_historico_set_updated_at on public.boigordo_base_regional_historico;
create trigger boigordo_base_regional_historico_set_updated_at
before update on public.boigordo_base_regional_historico
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 3) boigordo_escala_abate_historico
-- =========================================================
create table if not exists public.boigordo_escala_abate_historico (
  id uuid primary key default gen_random_uuid(),
  planta_id text not null,
  regiao text not null,
  data date not null,
  dias_escala numeric(10,4) not null,
  capacidade_abate_dia numeric(14,4),
  fonte text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists boigordo_escala_abate_historico_planta_data_uidx
  on public.boigordo_escala_abate_historico (planta_id, data);

create index if not exists boigordo_escala_abate_historico_regiao_data_idx
  on public.boigordo_escala_abate_historico (regiao, data);

drop trigger if exists boigordo_escala_abate_historico_set_updated_at on public.boigordo_escala_abate_historico;
create trigger boigordo_escala_abate_historico_set_updated_at
before update on public.boigordo_escala_abate_historico
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 4) boigordo_exportacao_bovina_historico
-- =========================================================
create table if not exists public.boigordo_exportacao_bovina_historico (
  id uuid primary key default gen_random_uuid(),
  periodo date not null,
  destino text not null,
  volume_t numeric(14,4) not null,
  receita_usd numeric(16,2) not null,
  preco_medio_usd_t numeric(14,4) not null,
  fonte text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists boigordo_exportacao_bovina_historico_periodo_destino_uidx
  on public.boigordo_exportacao_bovina_historico (periodo, destino);

create index if not exists boigordo_exportacao_bovina_historico_periodo_idx
  on public.boigordo_exportacao_bovina_historico (periodo);

drop trigger if exists boigordo_exportacao_bovina_historico_set_updated_at on public.boigordo_exportacao_bovina_historico;
create trigger boigordo_exportacao_bovina_historico_set_updated_at
before update on public.boigordo_exportacao_bovina_historico
for each row
execute function public.boigordo_set_updated_at();

-- =========================================================
-- 5) boigordo_equivalente_carcaca_historico (optional)
-- =========================================================
create table if not exists public.boigordo_equivalente_carcaca_historico (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  indice_equivalente numeric(14,4) not null,
  fonte text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists boigordo_equivalente_carcaca_historico_data_fonte_uidx
  on public.boigordo_equivalente_carcaca_historico (data, fonte);

create index if not exists boigordo_equivalente_carcaca_historico_data_idx
  on public.boigordo_equivalente_carcaca_historico (data);

drop trigger if exists boigordo_equivalente_carcaca_historico_set_updated_at on public.boigordo_equivalente_carcaca_historico;
create trigger boigordo_equivalente_carcaca_historico_set_updated_at
before update on public.boigordo_equivalente_carcaca_historico
for each row
execute function public.boigordo_set_updated_at();

