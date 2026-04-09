-- =========================================================
-- Boigordo Analytics Views - Phase 2
-- Date: 2026-04-07
-- =========================================================

-- Optional parameter table for regional thresholds.
create table if not exists public.boigordo_parametros_escala_regional (
  id uuid primary key default gen_random_uuid(),
  regiao text not null unique,
  limite_curta numeric(10,4) not null default 7,
  limite_longa numeric(10,4) not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists boigordo_parametros_escala_regional_set_updated_at on public.boigordo_parametros_escala_regional;
create trigger boigordo_parametros_escala_regional_set_updated_at
before update on public.boigordo_parametros_escala_regional
for each row
execute function public.boigordo_set_updated_at();

insert into public.boigordo_parametros_escala_regional (regiao, limite_curta, limite_longa)
values ('DEFAULT', 7, 12)
on conflict (regiao) do nothing;

-- =========================================================
-- 1) boigordo_view_ciclo_pecuario_classificacao
-- =========================================================
create or replace view public.boigordo_view_ciclo_pecuario_classificacao as
with base as (
  select
    regiao,
    periodo,
    taxa_femeas_pct,
    avg(taxa_femeas_pct) over (
      partition by regiao
      order by periodo
      rows between 11 preceding and current row
    ) as media_movel_12m
  from public.boigordo_abate_femeas_historico
),
limiares as (
  select
    regiao,
    percentile_cont(0.33) within group (order by taxa_femeas_pct) as p33,
    percentile_cont(0.66) within group (order by taxa_femeas_pct) as p66
  from public.boigordo_abate_femeas_historico
  group by regiao
)
select
  b.regiao,
  b.periodo,
  b.taxa_femeas_pct,
  round(b.media_movel_12m::numeric, 4) as media_movel_12m,
  case
    when b.taxa_femeas_pct < l.p33 and b.taxa_femeas_pct < b.media_movel_12m then 'RETENCAO'
    when b.taxa_femeas_pct > l.p66 and b.taxa_femeas_pct > b.media_movel_12m then 'LIQUIDACAO'
    else 'ESTABILIDADE'
  end as fase_ciclo
from base b
join limiares l on l.regiao = b.regiao;

-- =========================================================
-- 2) boigordo_view_base_regional_stats
-- =========================================================
create or replace view public.boigordo_view_base_regional_stats as
select
  b.data,
  b.praca_local,
  b.preco_fisico_local,
  b.preco_referencia_sp,
  b.base_absoluta,
  b.base_percentual,
  round(stats.media_base_pct::numeric, 4) as media_base_pct,
  round(stats.desvio_base_pct::numeric, 4) as desvio_base_pct,
  case
    when stats.media_base_pct is null then 'BASE_NORMAL'
    when b.base_percentual < stats.media_base_pct - coalesce(stats.desvio_base_pct, 0) then 'BASE_FORTE'
    when b.base_percentual > stats.media_base_pct + coalesce(stats.desvio_base_pct, 0) then 'BASE_FRACA'
    else 'BASE_NORMAL'
  end as situacao_base
from public.boigordo_base_regional_historico b
left join lateral (
  select
    avg(x.base_percentual) as media_base_pct,
    stddev_samp(x.base_percentual) as desvio_base_pct
  from public.boigordo_base_regional_historico x
  where x.praca_local = b.praca_local
    and x.data <= b.data
    and x.data >= (b.data - interval '3 years')
) stats on true;

-- =========================================================
-- 3) boigordo_view_escala_abate_regional
-- =========================================================
create or replace view public.boigordo_view_escala_abate_regional as
with agg as (
  select
    e.regiao,
    e.data,
    sum(e.dias_escala * coalesce(nullif(e.capacidade_abate_dia, 0), 1)) /
      nullif(sum(coalesce(nullif(e.capacidade_abate_dia, 0), 1)), 0) as dias_escala_media
  from public.boigordo_escala_abate_historico e
  group by e.regiao, e.data
),
params as (
  select
    regiao,
    limite_curta,
    limite_longa
  from public.boigordo_parametros_escala_regional
)
select
  a.regiao,
  a.data,
  round(a.dias_escala_media::numeric, 4) as dias_escala_media,
  coalesce(p_reg.limite_curta, p_default.limite_curta, 7) as limite_curta,
  coalesce(p_reg.limite_longa, p_default.limite_longa, 12) as limite_longa,
  case
    when a.dias_escala_media < coalesce(p_reg.limite_curta, p_default.limite_curta, 7) then 'CURTA'
    when a.dias_escala_media > coalesce(p_reg.limite_longa, p_default.limite_longa, 12) then 'LONGA'
    else 'NORMAL'
  end as classificacao
from agg a
left join params p_reg on p_reg.regiao = a.regiao
left join params p_default on p_default.regiao = 'DEFAULT';

-- =========================================================
-- 4) boigordo_view_exportacao_resumo_mensal
-- =========================================================
create or replace view public.boigordo_view_exportacao_resumo_mensal as
with agg as (
  select
    periodo,
    sum(volume_t) as volume_total_t,
    sum(receita_usd) as receita_total_usd,
    sum(case when upper(destino) = 'CHINA' then receita_usd else 0 end) as receita_china_usd
  from public.boigordo_exportacao_bovina_historico
  group by periodo
)
select
  periodo,
  round(volume_total_t::numeric, 4) as volume_total_t,
  round(receita_total_usd::numeric, 2) as receita_total_usd,
  round(
    case
      when receita_total_usd = 0 then 0
      else (receita_china_usd / receita_total_usd) * 100
    end::numeric,
    4
  ) as dependencia_china_pct,
  round(
    case
      when volume_total_t = 0 then 0
      else (receita_total_usd / volume_total_t)
    end::numeric,
    4
  ) as preco_medio_usd_t_global
from agg;

