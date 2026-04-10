# Auditoria de Segurança (RLS/LGPD) - 2026-04-09

## Escopo auditado
- Migrations SQL em `db/migrations/*`.
- Uso de Supabase no frontend (`src/lib/data-provider.tsx`).
- Teste prático com `NEXT_PUBLIC_SUPABASE_ANON_KEY` contra endpoints REST públicos.

## Evidências principais
1. Não foram encontrados comandos de RLS/policies nas migrations:
- `enable row level security`
- `create policy`
- `auth.uid()`

2. O frontend consulta tabelas/views sensíveis com `anon key`:
- `boigordo_view_usuario_configuracoes`
- `boigordo_assinaturas`
- `boigordo_pagamentos_historico`
- `boigordo_view_admin_assinantes`
- `boigordo_alertas_pro_regras`
- `boigordo_alertas_pro_destinos`
- `boigordo_execucoes_logs`
- `boigordo_grupos_notificacao`

3. Teste prático com `anon key` retornou HTTP 200 em objetos administrativos/sensíveis (ex.: logs e grupos), comprovando exposição de leitura pública se não houver políticas restritivas.

## Findings (prioridade)

### P0 - Ausência de RLS/policies em tabelas com PII e dados financeiros
Sem RLS, qualquer permissão de leitura em `public` pode expor dados de usuário, assinatura e operações.

Tabelas críticas:
- `boigordo_usuarios_perfil`
- `boigordo_assinaturas`
- `boigordo_pagamentos_historico`
- `boigordo_alertas_pro_destinos`
- `boigordo_alertas_pro_regras`
- `boigordo_alertas_pro_envios`
- `boigordo_execucoes_logs`
- `boigordo_grupos_notificacao`

### P0 - Frontend consulta superfícies administrativas diretamente
O arquivo `src/lib/data-provider.tsx` executa `select *` em várias tabelas administrativas com chave pública (anon), elevando o risco de vazamento em DevTools/Network.

### P1 - Exposição de metadados operacionais e roteamento de mensagens
`boigordo_grupos_notificacao` e `boigordo_execucoes_logs` acessíveis com `anon` revelam estrutura interna, IDs de destino e contexto operacional.

### P1 - Views administrativas sem camada explícita de autorização
Views `boigordo_view_admin_assinantes` e afins foram criadas sem políticas explícitas nas migrations.

## Plano de correção recomendado (ordem de execução)

1. **RLS obrigatório**
- `alter table ... enable row level security` para todas as tabelas sensíveis.
- Criar políticas mínimas:
  - usuário autenticado lê apenas `usuario_id = auth.uid()`
  - escrita apenas no próprio registro
  - admin via papel/claim customizado

2. **Separar acesso admin do frontend público**
- Remover consultas admin/sensíveis diretas do cliente.
- Mover para endpoints server-side com validação de sessão/papel.

3. **Views seguras**
- Reavaliar exposição de views em `public`.
- Aplicar grants mínimos e políticas por tabela base.

4. **Hardening de segredos**
- Garantir que apenas `NEXT_PUBLIC_*` estritamente necessários estejam no frontend.
- Nunca expor `service_role` no cliente.

5. **LGPD operacional**
- Mascarar PII em logs.
- Definir retenção e descarte de dados sensíveis.

## Checklist de validação pós-correção
- [ ] `anon` não lê tabelas PII/admin (HTTP 401/403 ou vazio controlado por policy).
- [ ] Usuário autenticado lê apenas seus próprios dados.
- [ ] Superadmin acessa dados globais somente via backend protegido.
- [ ] Logs e grupos não expostos ao cliente.

