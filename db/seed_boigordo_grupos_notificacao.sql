/* ========================================================
   Seed inicial - grupos de notificacao analitica
   Arquivo: db/seed_boigordo_grupos_notificacao.sql
   ======================================================== */

-- Exemplo 1: grupo geral (recebe todos os tipos e severidades)
insert into public.boigordo_grupos_notificacao (
  nome_grupo,
  group_id,
  tipos_alerta,
  severidades,
  ativo
)
values (
  'Grupo Geral Analitico',
  'ID_GRUPO_GERAL_AQUI',
  '{}',
  '{}',
  true
)
on conflict (group_id) do update
set
  nome_grupo = excluded.nome_grupo,
  tipos_alerta = excluded.tipos_alerta,
  severidades = excluded.severidades,
  ativo = excluded.ativo,
  updated_at = now();

-- Exemplo 2: grupo critico (apenas severidade alta e media)
insert into public.boigordo_grupos_notificacao (
  nome_grupo,
  group_id,
  tipos_alerta,
  severidades,
  ativo
)
values (
  'Grupo Critico',
  'ID_GRUPO_CRITICO_AQUI',
  '{}',
  array['ALTA','MEDIA']::text[],
  true
)
on conflict (group_id) do update
set
  nome_grupo = excluded.nome_grupo,
  tipos_alerta = excluded.tipos_alerta,
  severidades = excluded.severidades,
  ativo = excluded.ativo,
  updated_at = now();

-- Consulta de conferência
select id, nome_grupo, group_id, tipos_alerta, severidades, ativo
from public.boigordo_grupos_notificacao
order by ativo desc, created_at asc;
