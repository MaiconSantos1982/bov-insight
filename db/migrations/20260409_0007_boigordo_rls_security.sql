-- =========================================================
-- Boigordo Phase 7 - RLS & Security Hardening
-- Date: 2026-04-09
-- =========================================================

-- -------------------------------------------------------------------
-- Helper: superadmin check via JWT app_metadata
-- Expected claim:
--   auth.jwt() -> 'app_metadata' ->> 'role' = 'SUPERADMIN'
-- -------------------------------------------------------------------
create or replace function public.boigordo_is_superadmin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPERADMIN', false);
$$;

-- -------------------------------------------------------------------
-- Enable RLS on sensitive tables
-- -------------------------------------------------------------------
alter table if exists public.boigordo_usuarios_perfil enable row level security;
alter table if exists public.boigordo_assinaturas enable row level security;
alter table if exists public.boigordo_pagamentos_historico enable row level security;
alter table if exists public.boigordo_alertas_pro_destinos enable row level security;
alter table if exists public.boigordo_alertas_pro_regras enable row level security;
alter table if exists public.boigordo_alertas_pro_envios enable row level security;
alter table if exists public.boigordo_alertas_analiticos enable row level security;
alter table if exists public.boigordo_grupos_notificacao enable row level security;
alter table if exists public.boigordo_execucoes_logs enable row level security;
alter table if exists public.boigordo_parametros_escala_regional enable row level security;

-- -------------------------------------------------------------------
-- Revoke broad access on sensitive surfaces
-- -------------------------------------------------------------------
revoke all on table public.boigordo_usuarios_perfil from anon;
revoke all on table public.boigordo_assinaturas from anon;
revoke all on table public.boigordo_pagamentos_historico from anon;
revoke all on table public.boigordo_alertas_pro_destinos from anon;
revoke all on table public.boigordo_alertas_pro_regras from anon;
revoke all on table public.boigordo_alertas_pro_envios from anon;
revoke all on table public.boigordo_alertas_analiticos from anon;
revoke all on table public.boigordo_grupos_notificacao from anon;
revoke all on table public.boigordo_execucoes_logs from anon;
revoke all on table public.boigordo_parametros_escala_regional from anon;

revoke all on table public.boigordo_view_admin_assinantes from anon, authenticated;
revoke all on table public.boigordo_view_admin_churn_mensal from anon, authenticated;

-- Keep authenticated privileges explicit where app reads directly.
grant select, insert, update, delete on table public.boigordo_usuarios_perfil to authenticated;
grant select, insert, update, delete on table public.boigordo_assinaturas to authenticated;
grant select, insert, update, delete on table public.boigordo_pagamentos_historico to authenticated;
grant select, insert, update, delete on table public.boigordo_alertas_pro_destinos to authenticated;
grant select, insert, update, delete on table public.boigordo_alertas_pro_regras to authenticated;
grant select, insert, update, delete on table public.boigordo_alertas_pro_envios to authenticated;
grant select on table public.boigordo_alertas_analiticos to authenticated;
grant select on table public.boigordo_view_usuario_configuracoes to authenticated;
grant select on table public.boigordo_view_assinaturas_proximo_vencimento to authenticated;

-- -------------------------------------------------------------------
-- Drop old policies (idempotency)
-- -------------------------------------------------------------------
drop policy if exists boigordo_usuarios_perfil_select on public.boigordo_usuarios_perfil;
drop policy if exists boigordo_usuarios_perfil_insert on public.boigordo_usuarios_perfil;
drop policy if exists boigordo_usuarios_perfil_update on public.boigordo_usuarios_perfil;
drop policy if exists boigordo_usuarios_perfil_delete on public.boigordo_usuarios_perfil;

drop policy if exists boigordo_assinaturas_select on public.boigordo_assinaturas;
drop policy if exists boigordo_assinaturas_insert on public.boigordo_assinaturas;
drop policy if exists boigordo_assinaturas_update on public.boigordo_assinaturas;
drop policy if exists boigordo_assinaturas_delete on public.boigordo_assinaturas;

drop policy if exists boigordo_pagamentos_historico_select on public.boigordo_pagamentos_historico;
drop policy if exists boigordo_pagamentos_historico_insert on public.boigordo_pagamentos_historico;
drop policy if exists boigordo_pagamentos_historico_update on public.boigordo_pagamentos_historico;
drop policy if exists boigordo_pagamentos_historico_delete on public.boigordo_pagamentos_historico;

drop policy if exists boigordo_alertas_pro_destinos_select on public.boigordo_alertas_pro_destinos;
drop policy if exists boigordo_alertas_pro_destinos_insert on public.boigordo_alertas_pro_destinos;
drop policy if exists boigordo_alertas_pro_destinos_update on public.boigordo_alertas_pro_destinos;
drop policy if exists boigordo_alertas_pro_destinos_delete on public.boigordo_alertas_pro_destinos;

drop policy if exists boigordo_alertas_pro_regras_select on public.boigordo_alertas_pro_regras;
drop policy if exists boigordo_alertas_pro_regras_insert on public.boigordo_alertas_pro_regras;
drop policy if exists boigordo_alertas_pro_regras_update on public.boigordo_alertas_pro_regras;
drop policy if exists boigordo_alertas_pro_regras_delete on public.boigordo_alertas_pro_regras;

drop policy if exists boigordo_alertas_pro_envios_select on public.boigordo_alertas_pro_envios;
drop policy if exists boigordo_alertas_pro_envios_insert on public.boigordo_alertas_pro_envios;
drop policy if exists boigordo_alertas_pro_envios_update on public.boigordo_alertas_pro_envios;
drop policy if exists boigordo_alertas_pro_envios_delete on public.boigordo_alertas_pro_envios;

drop policy if exists boigordo_alertas_analiticos_select on public.boigordo_alertas_analiticos;
drop policy if exists boigordo_alertas_analiticos_admin_write on public.boigordo_alertas_analiticos;

drop policy if exists boigordo_grupos_notificacao_admin_only on public.boigordo_grupos_notificacao;
drop policy if exists boigordo_execucoes_logs_admin_only on public.boigordo_execucoes_logs;
drop policy if exists boigordo_parametros_escala_regional_admin_only on public.boigordo_parametros_escala_regional;

-- -------------------------------------------------------------------
-- Ownership policies (user sees/manages own records)
-- -------------------------------------------------------------------
create policy boigordo_usuarios_perfil_select
  on public.boigordo_usuarios_perfil
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_usuarios_perfil_insert
  on public.boigordo_usuarios_perfil
  for insert
  to authenticated
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_usuarios_perfil_update
  on public.boigordo_usuarios_perfil
  for update
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin())
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_usuarios_perfil_delete
  on public.boigordo_usuarios_perfil
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_assinaturas_select
  on public.boigordo_assinaturas
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_assinaturas_insert
  on public.boigordo_assinaturas
  for insert
  to authenticated
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_assinaturas_update
  on public.boigordo_assinaturas
  for update
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin())
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_assinaturas_delete
  on public.boigordo_assinaturas
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_pagamentos_historico_select
  on public.boigordo_pagamentos_historico
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_pagamentos_historico_insert
  on public.boigordo_pagamentos_historico
  for insert
  to authenticated
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_pagamentos_historico_update
  on public.boigordo_pagamentos_historico
  for update
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin())
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_pagamentos_historico_delete
  on public.boigordo_pagamentos_historico
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_destinos_select
  on public.boigordo_alertas_pro_destinos
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_destinos_insert
  on public.boigordo_alertas_pro_destinos
  for insert
  to authenticated
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_destinos_update
  on public.boigordo_alertas_pro_destinos
  for update
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin())
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_destinos_delete
  on public.boigordo_alertas_pro_destinos
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_regras_select
  on public.boigordo_alertas_pro_regras
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_regras_insert
  on public.boigordo_alertas_pro_regras
  for insert
  to authenticated
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_regras_update
  on public.boigordo_alertas_pro_regras
  for update
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin())
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_regras_delete
  on public.boigordo_alertas_pro_regras
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_envios_select
  on public.boigordo_alertas_pro_envios
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_envios_insert
  on public.boigordo_alertas_pro_envios
  for insert
  to authenticated
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_envios_update
  on public.boigordo_alertas_pro_envios
  for update
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin())
  with check (usuario_id = auth.uid() or public.boigordo_is_superadmin());

create policy boigordo_alertas_pro_envios_delete
  on public.boigordo_alertas_pro_envios
  for delete
  to authenticated
  using (usuario_id = auth.uid() or public.boigordo_is_superadmin());

-- Alertas analíticos: leitura para autenticados; escrita só superadmin
create policy boigordo_alertas_analiticos_select
  on public.boigordo_alertas_analiticos
  for select
  to authenticated
  using (true);

create policy boigordo_alertas_analiticos_admin_write
  on public.boigordo_alertas_analiticos
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

-- Admin-only tables
create policy boigordo_grupos_notificacao_admin_only
  on public.boigordo_grupos_notificacao
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

create policy boigordo_execucoes_logs_admin_only
  on public.boigordo_execucoes_logs
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

create policy boigordo_parametros_escala_regional_admin_only
  on public.boigordo_parametros_escala_regional
  for all
  to authenticated
  using (public.boigordo_is_superadmin())
  with check (public.boigordo_is_superadmin());

