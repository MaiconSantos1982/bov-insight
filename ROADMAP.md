# Roadmap Técnico da Plataforma Pecuária (BovInsight)

Atualizado em: 2026-04-07  
Status: documento base para planejamento e consulta de desenvolvimento.

## Status de execução (checkpoint 2026-04-07)
- Fase 1: concluída.
- Fase 2: concluída.
- Fase 3: concluída.
- Fase 4: em andamento (engine de alertas + persistência + fechamento automático + agendamento concluídos; roteamento por grupos com fallback implementado no backend; pendente UI/admin para gestão de grupos na Fase 6).
- Fase 5: concluída para validação funcional (modelagem SQL + leitura no app + persistência de Configurações + CRUD real de Alertas Pro + painel administrativo do usuário + histórico de pagamentos entregues).
- Fase 6: concluída para homologação (dashboard admin completo com filtros/períodos e métricas de crescimento/receita/churn/MRR/ARR; submenus dedicados; assinantes com busca/filtros/paginação; grupos e mensagens com CRUD completo e confirmação de exclusão; logs de execução integrados; base SQL de custos e operação entregue).

## 1. Objetivo
Este roadmap consolida os próximos módulos analíticos da plataforma, sem repetir o que já está em produção no app atual.

Referência de baseline já existente:
- Dashboard, Relação de Troca, Sazonalidade, Análise de Gráfico e Histórico.
- Ingestão de preços em `boigordo_historico`.
- Worker de scraping/cron e envio WhatsApp no serviço `Grupos`.

## 2. Convenções obrigatórias
### 2.1. Prefixo de banco
Todas as novas tabelas, views materializadas, views e funções SQL devem iniciar com:
- `boigordo_`

Exemplos:
- `boigordo_abate_femeas_historico`
- `boigordo_base_regional_historico`
- `boigordo_view_ciclo_pecuario_classificacao`
- `boigordo_fn_recalcular_base_regional`

### 2.2. Padrões de schema
- Chave primária: `id uuid primary key default gen_random_uuid()`.
- Auditoria mínima: `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- Upsert idempotente por chave natural (`unique index`) definida por domínio.
- Datas com fuso de referência em `America/Sao_Paulo`.

### 2.3. Padrões de worker
- Sempre idempotente.
- Retry com backoff para fontes externas.
- Logging estruturado com contadores: `lidos`, `inseridos`, `atualizados`, `descartados`, `erros`.

## 3. Roadmap por fase
## Fase 1 (Fundação de dados analíticos)
Meta: criar tabelas históricas e ingestão confiável.

### 3.1. Tabela `boigordo_abate_femeas_historico`
Finalidade: cálculo do ciclo pecuário por região.

Campos:
- `id`, `created_at`, `updated_at`
- `regiao text not null`
- `periodo date not null` (referência mensal)
- `taxa_femeas_pct numeric(8,4) not null`
- `fonte text not null`

Índices:
- `unique(regiao, periodo)`
- `index(periodo)`

### 3.2. Tabela `boigordo_base_regional_historico`
Finalidade: diferencial de base entre praça local e referência SP/B3.

Campos:
- `id`, `created_at`, `updated_at`
- `data date not null`
- `praca_local text not null`
- `preco_fisico_local numeric(14,4) not null`
- `preco_referencia_sp numeric(14,4) not null`
- `base_absoluta numeric(14,4) not null`
- `base_percentual numeric(10,4) not null`
- `fonte text not null`

Índices:
- `unique(praca_local, data)`
- `index(data)`

### 3.3. Tabela `boigordo_escala_abate_historico`
Finalidade: escala de abate por planta para consolidação regional.

Campos:
- `id`, `created_at`, `updated_at`
- `planta_id text not null`
- `regiao text not null`
- `data date not null`
- `dias_escala numeric(10,4) not null`
- `capacidade_abate_dia numeric(14,4)` (opcional)
- `fonte text not null`

Índices:
- `unique(planta_id, data)`
- `index(regiao, data)`

### 3.4. Tabela `boigordo_exportacao_bovina_historico`
Finalidade: exportação de carne bovina por destino.

Campos:
- `id`, `created_at`, `updated_at`
- `periodo date not null` (mensal)
- `destino text not null`
- `volume_t numeric(14,4) not null`
- `receita_usd numeric(16,2) not null`
- `preco_medio_usd_t numeric(14,4) not null`
- `fonte text not null`

Índices:
- `unique(periodo, destino)`
- `index(periodo)`

### 3.5. Tabela opcional `boigordo_equivalente_carcaca_historico`
Finalidade: leitura da margem da indústria.

Campos:
- `id`, `created_at`, `updated_at`
- `data date not null`
- `indice_equivalente numeric(14,4) not null`
- `fonte text not null`

Índices:
- `unique(data, fonte)`

### 3.6. Workers da Fase 1
#### 3.6.1. `worker_ciclo_pecuario`
- Entrada: intervalo mensal (ex.: 24 meses).
- Processo: calcular `taxa_femeas_pct`.
- Persistência: upsert em `boigordo_abate_femeas_historico` por `(regiao, periodo)`.

#### 3.6.2. `worker_base_regional`
- Dependência: `boigordo_historico` com preço por praça.
- Processo:
1. Buscar preço local e referência SP por dia.
2. Calcular base absoluta e percentual.
3. Upsert por `(praca_local, data)`.

#### 3.6.3. `worker_escala_abate`
- Entrada: dados diários por planta.
- Persistência: upsert em `boigordo_escala_abate_historico` por `(planta_id, data)`.

#### 3.6.4. `worker_exportacao`
- Entrada: intervalo mensal SECEX.
- Persistência: upsert em `boigordo_exportacao_bovina_historico` por `(periodo, destino)`.

## Fase 2 (Camada analítica em SQL)
Meta: criar visão derivada pronta para frontend e alertas.

### 3.7. View `boigordo_view_ciclo_pecuario_classificacao`
Lógica:
1. Média móvel de 12 meses por `regiao`.
2. Percentis P33/P66 da série histórica por `regiao`.
3. Classificação:
- `RETENCAO`: abaixo de P33 e abaixo da média móvel.
- `ESTABILIDADE`: entre P33 e P66.
- `LIQUIDACAO`: acima de P66 e acima da média móvel.

Campos:
- `regiao`, `periodo`, `taxa_femeas_pct`, `media_movel_12m`, `fase_ciclo`.

### 3.8. View `boigordo_view_base_regional_stats`
Lógica:
1. Janela móvel de 3 anos por praça.
2. Média e desvio padrão da `base_percentual`.
3. Classificação:
- `BASE_FORTE`: abaixo de `media - 1*desvio`.
- `BASE_NORMAL`: dentro de `±1 desvio`.
- `BASE_FRACA`: acima de `media + 1*desvio`.

Campos:
- `data`, `praca_local`, `preco_fisico_local`, `preco_referencia_sp`,
- `base_absoluta`, `base_percentual`, `media_base_pct`, `desvio_base_pct`, `situacao_base`.

### 3.9. View `boigordo_view_escala_abate_regional`
Lógica:
1. Escala média ponderada por capacidade:
- `dias_escala_media = sum(dias_escala * capacidade_abate_dia) / sum(capacidade_abate_dia)`.
2. Classificação por limites parametrizados:
- `CURTA`, `NORMAL`, `LONGA`.

Campos:
- `regiao`, `data`, `dias_escala_media`, `classificacao`.

### 3.10. View `boigordo_view_exportacao_resumo_mensal`
Lógica:
1. `volume_total_t = sum(volume_t)`.
2. `receita_total_usd = sum(receita_usd)`.
3. `dependencia_china_pct = receita_china / receita_total_usd * 100`.
4. `preco_medio_usd_t_global = receita_total_usd / volume_total_t`.

Campos:
- `periodo`, `volume_total_t`, `receita_total_usd`, `dependencia_china_pct`, `preco_medio_usd_t_global`.

## Fase 3 (APIs internas e integração com frontend)
Meta: disponibilizar dados novos no app principal.

### 3.11. Endpoints/queries a expor
- Série e classificação de ciclo pecuário por região.
- Série da base regional com status forte/normal/fraca.
- Série de escala de abate regional com status curta/normal/longa.
- Resumo de exportação com participação por destino.

### 3.12. Módulos de UI novos
- Tela `Ciclo Pecuário`.
- Tela `Base Regional`.
- Tela `Escala de Abate`.
- Tela `Exportações`.
- Cards de risco/macrotendência no Dashboard (feature flag).

## Fase 4 (Alertas analíticos e operação)
Meta: gerar ação prática a partir dos novos sinais.

### 3.13. Novos gatilhos de alerta
- Mudança de fase do ciclo (`RETENCAO -> LIQUIDACAO`, etc.).
- Base regional entrando em `BASE_FORTE`/`BASE_FRACA`.
- Escala regional em `CURTA`/`LONGA`.
- Dependência China acima de limite configurável.

### 3.14. Integração de notificação
- Reaproveitar pipeline do serviço `Grupos` para formatação e envio.
- Canal de envio:
  - `Alerta Analítico`: envio para grupo WhatsApp configurado.
  - `Alerta Pro`: envio individual por usuário (telefone cadastrado).
- Templates por tipo de alerta, com contexto regional e variação mensal.
- Previsão de roteamento por grupo (já na modelagem da Fase 4):
  - criar base de configuração de grupos com:
    - `group_id`
    - tipos de mensagem permitidos
    - severidades permitidas (ex.: apenas `ALTA` e `MEDIA`)
    - status ativo/inativo
  - engine de alertas deve consultar essa configuração antes de enviar, para decidir destino por regra.
  - fallback operacional: se não houver regra específica, usar grupo padrão definido no ambiente.

### 3.14.1. Pré-modelagem técnica (Fase 4)
- Criar especificação da tabela `boigordo_grupos_notificacao` (implementação completa no painel admin da Fase 6):
  - `id uuid pk`
  - `nome_grupo text`
  - `group_id text not null`
  - `tipos_alerta text[] not null` (ex.: `['CICLO_PECUARIO','EXPORTACAO']`)
  - `severidades text[] not null` (ex.: `['ALTA','MEDIA']`)
  - `ativo boolean default true`
  - `created_at`, `updated_at`
- Chaves/índices sugeridos:
  - `unique(group_id)`
  - `index(ativo)`

## Fase 5 (Alertas Pro e área de configurações do usuário)
Meta: habilitar gestão individual de alertas e perfil completo do assinante.

### 3.15. Alertas Pro (envio individual)
- No módulo de Alertas Pro, usuário define o telefone de recebimento.
- Validar telefone (formato E.164) e status de elegibilidade para envio.
- Persistir preferências de canal/frequência de alerta por usuário.

### 3.16. Configurações da conta
- Dados pessoais:
  - nome
  - telefone
- Questionário de perfil do mercado (a evoluir):
  - papel no mercado (criador, vendedor, comprador etc.)
  - atuação (recria, engorda, ciclo completo etc.)
  - experiência no setor
  - tamanho da operação (ex.: número de cabeças)
- Dados de pagamento:
  - método de pagamento
  - status da assinatura
  - histórico resumido
- Painel de assinatura:
  - próximo vencimento
  - ciclo da assinatura
  - renovação (automática/manual)
- Painel administrativo do usuário:
  - visão consolidada da conta, plano e preferências.

## Fase 6 (Painel administrativo e gestão geral)
Meta: dar visão operacional e financeira da base de assinantes.

### 3.17. Painel admin de assinantes
- Cadastro de assinantes com:
  - dados principais
  - pagamento
  - vencimento
  - status da assinatura
- Filtros e busca por status, período e perfil.

### 3.19. Controle de grupos de notificação (Admin)
- Tela de gestão de grupos WhatsApp:
  - cadastrar múltiplos grupos
  - informar/editar `group_id`
  - definir quais tipos de mensagem cada grupo recebe
  - definir severidades por grupo (ex.: `ALTA`/`MEDIA`)
  - ativar/desativar grupo
- Regras de roteamento:
  - um alerta pode ser enviado para 1..N grupos compatíveis com tipo+severidade
  - evitar duplicidade de envio para o mesmo `group_id` na mesma execução
  - registrar log de decisão de roteamento (grupo elegível, grupo ignorado, motivo)

### 3.18. Indicadores operacionais e financeiros
- Churn e indicadores de retenção.
- Controles operacionais de planos e acessos.
- Custos operacionais de Alertas Pro enviados.
- Logs de execuções (workers, notificações, falhas e retentativas).

## 4. Priorização (ordem sugerida)
1. Fase 1 completa (tabelas + workers + carga inicial 36 meses).
2. Fase 2 completa (views estáveis e validadas).
3. Fase 3 (UI e APIs de consulta).
4. Fase 4 (alertas analíticos e automações).

## 5. Critérios de pronto por módulo
### 5.1. Dados
- Carga histórica sem duplicidade.
- Upsert validado com reprocessamento do mesmo período.
- Cobertura mínima de 95% dos períodos esperados.

### 5.2. Cálculo
- Teste de consistência para fórmulas-chave.
- Validação amostral manual com planilha de controle.

### 5.3. UI
- Tempo de resposta aceitável com paginação/limitação.
- Estados de vazio, erro e loading implementados.

### 5.4. Operação
- Logs por execução.
- Alertas de falha por worker.
- Runbook de recuperação.

## 6. Backlog técnico complementar
- Criar migration SQL versionada para todo objeto `boigordo_*`.
- Criar `boigordo_parametros_analiticos` para thresholds por região.
- Implementar testes de integração dos workers.
- Definir política de reprocessamento retroativo (D-7, D-30, D-90).
- Padronizar dicionário de regiões/praças.
- Automatizar atualização de `boigordo_historico` (boi gordo, bezerro, milho, soja) com ingestão agendada e idempotente após fechamento da Fase 4.

## 7. Riscos e mitigação
- Fontes externas instáveis:
  - Mitigar com cache, retry e fallback de última observação válida.
- Divergência metodológica entre fontes:
  - Versionar `fonte` e `metodologia` nas tabelas.
- Crescimento de volume:
  - Índices compostos e política de particionamento por data se necessário.

## 8. Entregáveis de implementação
Para cada fase, entregar:
1. Migration SQL.
2. Worker com comando de execução manual e cron.
3. Dashboard de monitoramento de execução.
4. Documentação de uso e troubleshooting.
