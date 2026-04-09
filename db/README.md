# Database Migrations

Este diretório contém migrations SQL da plataforma.

## Convenção
- Todo objeto novo deve começar com `boigordo_`.
- Migrations com timestamp no nome:
  - `YYYYMMDD_NNNN_descricao.sql`

## Migration inicial
- Arquivo: `migrations/20260407_0001_boigordo_analytics_foundation.sql`
- Cria tabelas da Fase 1 do roadmap:
  - `boigordo_abate_femeas_historico`
  - `boigordo_base_regional_historico`
  - `boigordo_escala_abate_historico`
  - `boigordo_exportacao_bovina_historico`
  - `boigordo_equivalente_carcaca_historico`

## Migration Fase 2
- Arquivo: `migrations/20260407_0002_boigordo_analytics_views.sql`
- Cria:
  - `boigordo_parametros_escala_regional`
  - `boigordo_view_ciclo_pecuario_classificacao`
  - `boigordo_view_base_regional_stats`
  - `boigordo_view_escala_abate_regional`
  - `boigordo_view_exportacao_resumo_mensal`

## Migration Fase 4 (alertas analíticos)
- Arquivo: `migrations/20260407_0003_boigordo_alertas_analiticos.sql`
- Cria:
  - `boigordo_alertas_analiticos`
  - `boigordo_view_alertas_analiticos_recentes`

## Migration Fase 4 complemento (roteamento por grupos)
- Arquivo: `migrations/20260407_0004_boigordo_grupos_notificacao.sql`
- Cria:
  - `boigordo_grupos_notificacao`
  - `boigordo_view_grupos_notificacao`
- Altera:
  - `boigordo_alertas_analiticos` (`enviado_grupo_at`, `ultimo_erro_envio`)

## Migration Fase 5 (alertas pro, perfil e assinatura)
- Arquivo: `migrations/20260407_0005_boigordo_fase5_alertas_pro_e_assinaturas.sql`
- Cria:
  - `boigordo_usuarios_perfil`
  - `boigordo_assinaturas`
  - `boigordo_pagamentos_historico`
  - `boigordo_alertas_pro_destinos`
  - `boigordo_alertas_pro_regras`
  - `boigordo_view_usuario_configuracoes`
  - `boigordo_view_assinaturas_proximo_vencimento`

## Migration Fase 6 (admin e gestão geral)
- Arquivo: `migrations/20260407_0006_boigordo_fase6_admin.sql`
- Cria:
  - `boigordo_alertas_pro_envios`
  - `boigordo_execucoes_logs`
  - `boigordo_view_admin_assinantes`
  - `boigordo_view_admin_churn_mensal`
- Altera:
  - `boigordo_assinaturas` (`cancelada_em`)

## Execução no Supabase
Executar o conteúdo da migration no SQL Editor do projeto Supabase.
