-- =========================================================
-- Boigordo Phase 7.x - Admin Assinantes View Fallback
-- Date: 2026-04-10
-- =========================================================

create or replace view public.boigordo_view_admin_assinantes as
with pagamentos as (
  select
    usuario_id,
    max(pago_em) as ultimo_pagamento_em
  from public.boigordo_pagamentos_historico
  where status = 'PAGO'
  group by usuario_id
),
base_assinaturas as (
  select
    coalesce(p.usuario_id, a.usuario_id) as usuario_id,
    coalesce(nullif(p.nome, ''), 'Sem nome') as nome,
    p.email,
    coalesce(p.telefone_whatsapp, '') as telefone_whatsapp,
    coalesce(p.papeis_mercado, '{}'::text[]) as papeis_mercado,
    coalesce(p.etapas_operacao, '{}'::text[]) as etapas_operacao,
    p.cabecas_gado,
    coalesce(p.status, 'ATIVO') as perfil_status,
    a.id as assinatura_id,
    a.plano,
    a.status as assinatura_status,
    a.ciclo,
    a.proximo_vencimento,
    a.renovacao_automatica,
    a.cancelada_em
  from public.boigordo_assinaturas a
  left join public.boigordo_usuarios_perfil p on p.usuario_id = a.usuario_id
),
somente_perfil as (
  select
    p.usuario_id,
    coalesce(nullif(p.nome, ''), 'Sem nome') as nome,
    p.email,
    coalesce(p.telefone_whatsapp, '') as telefone_whatsapp,
    coalesce(p.papeis_mercado, '{}'::text[]) as papeis_mercado,
    coalesce(p.etapas_operacao, '{}'::text[]) as etapas_operacao,
    p.cabecas_gado,
    p.status as perfil_status,
    null::uuid as assinatura_id,
    null::text as plano,
    null::text as assinatura_status,
    null::text as ciclo,
    null::date as proximo_vencimento,
    null::boolean as renovacao_automatica,
    null::date as cancelada_em
  from public.boigordo_usuarios_perfil p
  where not exists (
    select 1
    from public.boigordo_assinaturas a
    where a.usuario_id = p.usuario_id
  )
)
select
  b.usuario_id,
  b.nome,
  b.email,
  b.telefone_whatsapp,
  b.papeis_mercado,
  b.etapas_operacao,
  b.cabecas_gado,
  b.perfil_status,
  b.assinatura_id,
  b.plano,
  b.assinatura_status,
  b.ciclo,
  b.proximo_vencimento,
  b.renovacao_automatica,
  b.cancelada_em,
  pg.ultimo_pagamento_em
from (
  select * from base_assinaturas
  union all
  select * from somente_perfil
) b
left join pagamentos pg on pg.usuario_id = b.usuario_id
order by b.nome asc;

alter view if exists public.boigordo_view_admin_assinantes set (security_invoker = true);
grant select on table public.boigordo_view_admin_assinantes to anon;
