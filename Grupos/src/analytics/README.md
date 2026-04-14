# Analytics Workers

Workers analíticos com upsert direto nas tabelas `boigordo_*` via Supabase REST.

## Requisitos
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Endpoints fonte de dados:
  - `ANALYTICS_CICLO_URL`
  - `ANALYTICS_BASE_REGIONAL_URL`
  - `ANALYTICS_EXPORTACAO_URL`
- Regras/agenda de alertas:
  - `ANALYTICS_ALERT_CHINA_THRESHOLD_PCT` (default `70`)
  - `ANALYTICS_ALERT_CRON` (opcional, ex.: `*/30 * * * *`)

As fontes aceitam:
- URL HTTP/HTTPS
- `file://caminho/arquivo.json`
- caminho local (`./data/analytics/ciclo.json`)

## Scripts
- `npm run analytics:source` (inicia API local de dados em `:4010`)
- `npm run analytics:healthcheck`
- `npm run analytics:ciclo`
- `npm run analytics:base`
- `npm run analytics:exportacao`
- `npm run analytics:alertas`

## Fluxo local recomendado (sem túnel)
1. Subir fonte local:
```bash
npm run analytics:source
```
2. Em outro terminal, validar conexão com Supabase:
```bash
npm run analytics:healthcheck
```
3. Rodar cargas:
```bash
npm run analytics:ciclo
npm run analytics:base
npm run analytics:exportacao
npm run analytics:alertas
```

## Comportamento do engine de alertas
- Gera alertas novos/atualizados com status `ABERTO`.
- Fecha automaticamente alertas antigos (`FECHADO`) quando:
  - a condição deixou de ocorrer; ou
  - existe alerta mais recente para a mesma `alert_key`.
- Envia alertas pendentes para WhatsApp em grupos elegíveis por regra:
  - tabela `boigordo_grupos_notificacao` (tipo + severidade);
  - fallback para `WHATSAPP_GROUP_ID` quando não houver regra específica.
- Marca `enviado_grupo_at` ao concluir envio com sucesso.

## Execução com intervalo customizado
```bash
npx ts-node src/analytics/run.ts ciclo --from 2024-01-01 --to 2026-04-07
npx ts-node src/analytics/run.ts base --from 2026-01-01 --to 2026-04-07
npx ts-node src/analytics/run.ts exportacao --from 2024-01-01 --to 2026-04-07
```

## Alternativa sem servidor local (arquivo direto)
Exemplo:
```bash
ANALYTICS_CICLO_URL=file://data/analytics/ciclo.json npx ts-node src/analytics/run.ts ciclo
```

## Formatos esperados das fontes

### Ciclo (`ANALYTICS_CICLO_URL`)
```json
[
  { "regiao": "BRASIL", "periodo": "2026-03-01", "taxa_femeas_pct": 44.2, "fonte": "IBGE" }
]
```

### Base regional (`ANALYTICS_BASE_REGIONAL_URL`)
```json
[
  {
    "data": "2026-04-07",
    "praca_local": "GOIANIA",
    "preco_fisico_local": 302.15,
    "preco_referencia_sp": 308.40,
    "fonte": "CEPEA"
  }
]
```

### Exportação (`ANALYTICS_EXPORTACAO_URL`)
```json
[
  {
    "periodo": "2026-03-01",
    "destino": "CHINA",
    "volume_t": 152340.12,
    "receita_usd": 689002341.2,
    "preco_medio_usd_t": 4523.11,
    "fonte": "SECEX"
  }
]
```
