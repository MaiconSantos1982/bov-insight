-- =========================================================
-- Boigordo Phase 7.2 - AuthZ Foundation (Superadmin + Roles)
-- Date: 2026-04-09
-- =========================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- 1) User roles registry (DB-side fallback for superadmin checks)
-- -------------------------------------------------------------------
create table if not exists public.boigordo_usuarios_roles (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  role text not null check (role in ('SUPERADMIN','ASSINANTE','BLOQUEADO')),
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boigordo_usuarios_roles_usuario_uidx unique (usuario_id)
);

create index if not exists boigordo_usuarios_roles_role_idx
  on public.boigordo_usuarios_roles (role, ativo);

drop trigger if exists boigordo_usuarios_roles_set_updated_at on public.boigordo_usuarios_roles;
create trigger boigordo_usuarios_roles_set_updated_at
before update on public.boigordo_usuarios_roles
for each row
execute function public.boigordo_set_updated_at();

-- -------------------------------------------------------------------
-- 2) Helper functions for authorization
-- -------------------------------------------------------------------
create or replace function public.boigordo_is_superadmin_claim()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPERADMIN', false);
$$;

create or replace function public.boigordo_is_superadmin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_claim boolean;
  v_db boolean;
begin
  v_uid := auth.uid();
  v_claim := public.boigordo_is_superadmin_claim();

  if v_claim then
    return true;
  end if;

  if v_uid is null then
    return false;
  end if;

  select exists (
    select 1
    from public.boigordo_usuarios_roles r
    where r.usuario_id = v_uid
      and r.ativo = true
      and r.role = 'SUPERADMIN'
  )
  into v_db;

  return coalesce(v_db, false);
end;
$$;

-- -------------------------------------------------------------------
-- 3) RLS + policies on roles table
-- -------------------------------------------------------------------
alter table if exists public.boigordo_usuarios_roles enable row level security;

revoke all on table public.boigordo_usuarios_roles from anon;
grant select, insert, update, delete on table public.boigordo_usuarios_roles to authenticated;

drop policy if exists boigordo_usuarios_roles_select on public.boigordo_usuarios_roles;
drop policy if exists boigordo_usuarios_roles_insert on public.boigordo_usuarios_roles;
drop policy if exists boigordo_usuarios_roles_update on public.boigordo_usuarios_roles;
drop policy if exists boigordo_usuarios_roles_delete on public.boigordo_usuarios_roles;

create policy boigordo_usuarios_roles_select
  on public.boigordo_usuarios_roles
  for select
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.boigordo_is_superadmin_claim()
  );

create policy boigordo_usuarios_roles_insert
  on public.boigordo_usuarios_roles
  for insert
  to authenticated
  with check (public.boigordo_is_superadmin_claim());

create policy boigordo_usuarios_roles_update
  on public.boigordo_usuarios_roles
  for update
  to authenticated
  using (public.boigordo_is_superadmin_claim())
  with check (public.boigordo_is_superadmin_claim());

create policy boigordo_usuarios_roles_delete
  on public.boigordo_usuarios_roles
  for delete
  to authenticated
  using (public.boigordo_is_superadmin_claim());

-- -------------------------------------------------------------------
-- 4) Seed-friendly helper view for quick validation
-- -------------------------------------------------------------------
create or replace view public.boigordo_view_meu_papel as
select
  auth.uid() as usuario_id,
  public.boigordo_is_superadmin_claim() as superadmin_claim,
  public.boigordo_is_superadmin() as superadmin_final;

grant select on table public.boigordo_view_meu_papel to authenticated;

