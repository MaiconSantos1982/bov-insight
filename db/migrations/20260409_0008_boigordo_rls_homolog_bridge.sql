-- =========================================================
-- Boigordo Phase 7.1 - Homologation Bridge after RLS
-- Date: 2026-04-09
-- =========================================================
-- Objetivo:
-- 1) Manter módulos analíticos públicos funcionando no frontend.
-- 2) Evitar vazamento de PII/admin para anon.
-- 3) Reduzir erro de permissão em telas ainda sem autenticação.

-- -------------------------------------------------------------------
-- Views sensíveis devem respeitar RLS do invocador (não do owner)
-- -------------------------------------------------------------------
alter view if exists public.boigordo_view_usuario_configuracoes set (security_invoker = true);
alter view if exists public.boigordo_view_assinaturas_proximo_vencimento set (security_invoker = true);
alter view if exists public.boigordo_view_admin_assinantes set (security_invoker = true);
alter view if exists public.boigordo_view_admin_churn_mensal set (security_invoker = true);

-- -------------------------------------------------------------------
-- Conjunto público (anon): analytics não-PII
-- -------------------------------------------------------------------
grant select on table public.boigordo_abate_femeas_historico to anon;
grant select on table public.boigordo_base_regional_historico to anon;
grant select on table public.boigordo_escala_abate_historico to anon;
grant select on table public.boigordo_exportacao_bovina_historico to anon;
grant select on table public.boigordo_equivalente_carcaca_historico to anon;

grant select on table public.boigordo_view_ciclo_pecuario_classificacao to anon;
grant select on table public.boigordo_view_base_regional_stats to anon;
grant select on table public.boigordo_view_escala_abate_regional to anon;
grant select on table public.boigordo_view_exportacao_resumo_mensal to anon;
grant select on table public.boigordo_view_alertas_analiticos_recentes to anon;

-- Alertas analíticos: leitura pública de conteúdo não-PII
grant select on table public.boigordo_alertas_analiticos to anon;

drop policy if exists boigordo_alertas_analiticos_select_anon on public.boigordo_alertas_analiticos;
create policy boigordo_alertas_analiticos_select_anon
  on public.boigordo_alertas_analiticos
  for select
  to anon
  using (true);

-- Tabelas base analytics: leitura pública
drop policy if exists boigordo_abate_femeas_historico_select_anon on public.boigordo_abate_femeas_historico;
create policy boigordo_abate_femeas_historico_select_anon
  on public.boigordo_abate_femeas_historico
  for select
  to anon
  using (true);

drop policy if exists boigordo_base_regional_historico_select_anon on public.boigordo_base_regional_historico;
create policy boigordo_base_regional_historico_select_anon
  on public.boigordo_base_regional_historico
  for select
  to anon
  using (true);

drop policy if exists boigordo_escala_abate_historico_select_anon on public.boigordo_escala_abate_historico;
create policy boigordo_escala_abate_historico_select_anon
  on public.boigordo_escala_abate_historico
  for select
  to anon
  using (true);

drop policy if exists boigordo_exportacao_bovina_historico_select_anon on public.boigordo_exportacao_bovina_historico;
create policy boigordo_exportacao_bovina_historico_select_anon
  on public.boigordo_exportacao_bovina_historico
  for select
  to anon
  using (true);

drop policy if exists boigordo_equivalente_carcaca_historico_select_anon on public.boigordo_equivalente_carcaca_historico;
create policy boigordo_equivalente_carcaca_historico_select_anon
  on public.boigordo_equivalente_carcaca_historico
  for select
  to anon
  using (true);

-- -------------------------------------------------------------------
-- Conjunto sensível (anon): permitir SELECT porém sem linhas
-- evita falha de permissão nas telas durante homologação sem login
-- -------------------------------------------------------------------
grant select on table public.boigordo_usuarios_perfil to anon;
grant select on table public.boigordo_assinaturas to anon;
grant select on table public.boigordo_pagamentos_historico to anon;
grant select on table public.boigordo_alertas_pro_destinos to anon;
grant select on table public.boigordo_alertas_pro_regras to anon;
grant select on table public.boigordo_alertas_pro_envios to anon;
grant select on table public.boigordo_grupos_notificacao to anon;
grant select on table public.boigordo_execucoes_logs to anon;
grant select on table public.boigordo_parametros_escala_regional to anon;

grant select on table public.boigordo_view_usuario_configuracoes to anon;
grant select on table public.boigordo_view_assinaturas_proximo_vencimento to anon;
grant select on table public.boigordo_view_admin_assinantes to anon;
grant select on table public.boigordo_view_admin_churn_mensal to anon;

drop policy if exists boigordo_usuarios_perfil_select_anon_none on public.boigordo_usuarios_perfil;
create policy boigordo_usuarios_perfil_select_anon_none
  on public.boigordo_usuarios_perfil
  for select
  to anon
  using (false);

drop policy if exists boigordo_assinaturas_select_anon_none on public.boigordo_assinaturas;
create policy boigordo_assinaturas_select_anon_none
  on public.boigordo_assinaturas
  for select
  to anon
  using (false);

drop policy if exists boigordo_pagamentos_historico_select_anon_none on public.boigordo_pagamentos_historico;
create policy boigordo_pagamentos_historico_select_anon_none
  on public.boigordo_pagamentos_historico
  for select
  to anon
  using (false);

drop policy if exists boigordo_alertas_pro_destinos_select_anon_none on public.boigordo_alertas_pro_destinos;
create policy boigordo_alertas_pro_destinos_select_anon_none
  on public.boigordo_alertas_pro_destinos
  for select
  to anon
  using (false);

drop policy if exists boigordo_alertas_pro_regras_select_anon_none on public.boigordo_alertas_pro_regras;
create policy boigordo_alertas_pro_regras_select_anon_none
  on public.boigordo_alertas_pro_regras
  for select
  to anon
  using (false);

drop policy if exists boigordo_alertas_pro_envios_select_anon_none on public.boigordo_alertas_pro_envios;
create policy boigordo_alertas_pro_envios_select_anon_none
  on public.boigordo_alertas_pro_envios
  for select
  to anon
  using (false);

drop policy if exists boigordo_grupos_notificacao_select_anon_none on public.boigordo_grupos_notificacao;
create policy boigordo_grupos_notificacao_select_anon_none
  on public.boigordo_grupos_notificacao
  for select
  to anon
  using (false);

drop policy if exists boigordo_execucoes_logs_select_anon_none on public.boigordo_execucoes_logs;
create policy boigordo_execucoes_logs_select_anon_none
  on public.boigordo_execucoes_logs
  for select
  to anon
  using (false);

drop policy if exists boigordo_parametros_escala_regional_select_anon_none on public.boigordo_parametros_escala_regional;
create policy boigordo_parametros_escala_regional_select_anon_none
  on public.boigordo_parametros_escala_regional
  for select
  to anon
  using (false);

