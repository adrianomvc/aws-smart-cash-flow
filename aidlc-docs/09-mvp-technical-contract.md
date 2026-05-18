# MVP 1 Technical Contract

## Objetivo do MVP 1

Permitir que usuarios autenticados importem arquivos TXT/CSV financeiros, visualizem importacoes/transacoes, categorizem manualmente e criem regras deterministicas simples de categorizacao.

## Escopo

Incluido:

- Login por usuario/senha via Supabase Auth.
- Workspace para isolamento de dados.
- Upload manual de TXT/CSV.
- Armazenamento do arquivo original no Supabase Storage.
- Registro de linhas brutas.
- Parsing TXT e CSV.
- Persistencia de transacoes normalizadas.
- Registro de erros por linha.
- Dedupe por arquivo e por transacao.
- Consulta de importacoes.
- Consulta de transacoes.
- CRUD basico de categorias.
- CRUD basico de regras deterministicas.
- Aplicacao de regras apos importacao.
- Indicadores basicos de dashboard para resumo mensal, serie mensal, categorias e qualidade dos dados.

Fora do MVP 1:

- PDF.
- Embedding.
- LLM.
- Conciliacao automatica.
- Dashboard avancado com orcamento, recorrencias, alertas e drill-down completo.
- App mobile nativo.

## Deploy

```text
Browser mobile/web
  -> AWS Amplify Hosting
  -> API Gateway HTTP API
  -> AWS Lambda Python
  -> Supabase Auth/PostgreSQL/Storage
```

## Autenticacao

- Frontend autentica com Supabase Auth.
- Frontend envia `Authorization: Bearer <access_token>` para a API.
- Backend valida o token Supabase antes de processar qualquer rota protegida.
- Toda rota protegida deve resolver `user_id` e `workspace_id`.
- Consultas e escritas devem sempre filtrar por `workspace_id`.

## Workspace

Regras:

- Um usuario pode pertencer a um ou mais workspaces.
- No MVP 1, criar um workspace inicial para o usuario no primeiro acesso, se nao existir.
- Para uso do casal, ambos os usuarios devem poder pertencer ao mesmo workspace.
- Roles iniciais: `owner`, `admin`, `member`.

## Storage

Bucket inicial:

- `financial-files`

Path sugerido:

```text
{workspace_id}/{source_file_id}/{original_filename}
```

Regras:

- O arquivo original deve ser preservado.
- Upload permitido no MVP 1: `.txt`, `.csv`.
- PDF deve ser rejeitado no MVP 1 com mensagem de recurso futuro.
- O backend deve registrar `storage_bucket` e `storage_path`.
- O backend deve enviar arquivo original ao storage antes de persistir `SourceFile`.
- Arquivo duplicado no mesmo workspace nao deve ser enviado ao storage novamente.

Configuracao:

- `SUPABASE_STORAGE_BUCKET`: bucket para arquivos financeiros.
- `SUPABASE_SERVICE_ROLE_KEY`: chave server-side usada apenas pelo backend para gravar no storage.
- A chave service role nao deve ser exposta ao frontend.

## Banco de Dados

### users

Usuario espelhado do Supabase Auth para dados de aplicacao.

- `id` UUID PK
- `supabase_user_id` UUID unique not null
- `email` text not null
- `display_name` text null
- `created_at` timestamptz not null

### workspaces

- `id` UUID PK
- `name` text not null
- `created_at` timestamptz not null

### workspace_members

- `id` UUID PK
- `workspace_id` UUID FK not null
- `user_id` UUID FK not null
- `role` text not null
- `created_at` timestamptz not null

Constraints:

- unique (`workspace_id`, `user_id`)
- `role` in `owner`, `admin`, `member`

### source_files

- `id` UUID PK
- `workspace_id` UUID FK not null
- `original_filename` text not null
- `content_hash` text not null
- `mime_type` text not null
- `size_bytes` bigint not null
- `storage_bucket` text not null
- `storage_path` text not null
- `source_kind` text not null
- `created_by_user_id` UUID FK not null
- `received_at` timestamptz not null

Constraints:

- unique (`workspace_id`, `content_hash`)
- `source_kind` in `bank_statement_txt`, `credit_card_csv`, `unknown`

### import_jobs

- `id` UUID PK
- `workspace_id` UUID FK not null
- `source_file_id` UUID FK not null
- `status` text not null
- `started_at` timestamptz null
- `finished_at` timestamptz null
- `total_rows` integer not null default 0
- `valid_rows` integer not null default 0
- `error_rows` integer not null default 0
- `created_at` timestamptz not null

Status:

- `pending`
- `processing`
- `completed`
- `completed_with_errors`
- `failed`
- `duplicate_file`

### raw_transaction_lines

- `id` UUID PK
- `workspace_id` UUID FK not null
- `source_file_id` UUID FK not null
- `import_job_id` UUID FK not null
- `source_line` integer not null
- `raw_payload` jsonb not null
- `parse_status` text not null
- `created_at` timestamptz not null

Constraints:

- unique (`import_job_id`, `source_line`)
- `parse_status` in `valid`, `invalid`, `skipped`

### transactions

- `id` UUID PK
- `workspace_id` UUID FK not null
- `source_file_id` UUID FK not null
- `import_job_id` UUID FK not null
- `raw_transaction_line_id` UUID FK null
- `source_type` text not null
- `source_name` text null
- `account_or_card` text null
- `transaction_date` date not null
- `description` text not null
- `raw_description` text not null
- `amount` numeric(14,2) not null
- `currency` text not null default `BRL`
- `direction` text not null
- `installment_current` integer null
- `installment_total` integer null
- `source_line` integer null
- `dedupe_key` text not null
- `created_at` timestamptz not null

Constraints:

- unique (`workspace_id`, `dedupe_key`)
- `source_type` in `bank_statement`, `credit_card_statement`, `unknown`
- `direction` in `debit`, `credit`, `payment`

### import_errors

- `id` UUID PK
- `workspace_id` UUID FK not null
- `import_job_id` UUID FK not null
- `source_line` integer null
- `field_name` text null
- `raw_value` text null
- `error_code` text not null
- `message` text not null
- `created_at` timestamptz not null

### categories

- `id` UUID PK
- `workspace_id` UUID FK not null
- `name` text not null
- `parent_category_id` UUID FK null
- `created_at` timestamptz not null

Constraints:

- unique (`workspace_id`, `name`)

### transaction_category_assignments

- `id` UUID PK
- `workspace_id` UUID FK not null
- `transaction_id` UUID FK not null
- `category_id` UUID FK not null
- `source` text not null
- `confidence` numeric(5,4) null
- `reason` text null
- `review_status` text not null
- `created_at` timestamptz not null

Constraints:

- unique (`transaction_id`)
- `source` in `manual`, `rule`, `embedding`, `llm`
- `review_status` in `accepted`, `pending`, `corrected`

### categorization_rules

- `id` UUID PK
- `workspace_id` UUID FK not null
- `name` text not null
- `field` text not null
- `match_type` text not null
- `pattern` text not null
- `category_id` UUID FK not null
- `priority` integer not null default 100
- `active` boolean not null default true
- `created_at` timestamptz not null

Constraints:

- `field` in `description`, `raw_description`, `source_name`
- `match_type` in `contains`, `starts_with`, `equals`

## Layouts de Arquivo

### TXT Conta Corrente

Formato:

```text
dd/MM/yyyy;descricao;valor
```

Exemplo:

```text
01/07/2025;PIX TRANSF DANIELL01/07;-10,00
```

Regras:

- Separador `;`.
- 3 colunas obrigatorias.
- Valor em formato brasileiro.
- Valor negativo: `debit`.
- Valor positivo: `credit`.

### CSV Fatura

Formato:

```csv
data,lançamento,valor
```

Regras:

- Header obrigatorio.
- Data em `yyyy-MM-dd`.
- Valor decimal com ponto.
- Valor negativo com descricao `PAGAMENTO EFETUADO`: `payment`.
- Valor positivo: `debit`.

## Dedupe

Arquivo:

```text
sha256(file_bytes)
```

Transacao:

```text
sha256(workspace_id | source_file_id | source_line | transaction_date | raw_description | amount)
```

Regra:

- Mesmo arquivo no mesmo workspace deve gerar `duplicate_file`.
- Mesma transacao no mesmo workspace nao deve ser duplicada.

## Endpoints

Base path:

```text
/v1
```

### Health

`GET /health`

Resposta:

```json
{
  "status": "ok"
}
```

### Workspaces

`GET /v1/workspaces/current`

Retorna workspace ativo do usuario.

Comportamento:

- Valida token antes de resolver workspace.
- Cria usuario espelhado no banco da aplicacao quando nao existir.
- Cria workspace inicial e membership `owner` quando o usuario ainda nao tiver workspace.
- Em ambiente local sem `SUPABASE_JWT_SECRET`, aceita token de desenvolvimento apenas para scaffold local.

### Imports

`POST /v1/imports`

Upload multipart:

- `file`

Resposta:

```json
{
  "import_job_id": "uuid",
  "source_file_id": "uuid",
  "status": "completed",
  "total_rows": 10,
  "valid_rows": 9,
  "error_rows": 1
}
```

`GET /v1/imports`

Query params:

- `status`
- `limit`
- `offset`

`GET /v1/imports/{import_job_id}`

`GET /v1/imports/{import_job_id}/errors`

### Transactions

`GET /v1/transactions`

Query params:

- `date_from`
- `date_to`
- `category_id`
- `source_type`
- `q`
- `limit`
- `offset`

`PATCH /v1/transactions/{transaction_id}/category`

Payload:

```json
{
  "category_id": "uuid"
}
```

### Categories

`GET /v1/categories`

`POST /v1/categories`

Payload:

```json
{
  "name": "Transporte",
  "parent_category_id": null
}
```

`PATCH /v1/categories/{category_id}`

`DELETE /v1/categories/{category_id}`

### Categorization Rules

`GET /v1/categorization-rules`

`POST /v1/categorization-rules`

Payload:

```json
{
  "name": "Uber",
  "field": "description",
  "match_type": "contains",
  "pattern": "UBER",
  "category_id": "uuid",
  "priority": 10,
  "active": true
}
```

`PATCH /v1/categorization-rules/{rule_id}`

`DELETE /v1/categorization-rules/{rule_id}`

`POST /v1/categorization-rules/apply`

Aplica regras ativas nas transacoes sem categoria manual.

### Dashboard

`GET /v1/dashboard/summary`

Query params:

- `date_from`
- `date_to`

Resposta:

```json
{
  "workspace_id": "uuid",
  "date_from": "2026-05-01",
  "date_to": "2026-05-31",
  "income": "1000.00",
  "expenses": "650.00",
  "payments": "200.00",
  "balance": "350.00",
  "savings_rate": "0.3500",
  "transaction_count": 20
}
```

`GET /v1/dashboard/monthly-cashflow`

Retorna receitas, despesas, pagamentos e saldo por mes.

`GET /v1/dashboard/category-ranking`

Retorna ranking de despesas por categoria, agrupando transacoes sem categoria como `Sem categoria`.

`GET /v1/dashboard/data-quality`

Retorna contadores de qualidade da base: transacoes categorizadas, sem categoria, importacoes com erro e importacoes duplicadas.

## Regras de Categorizacao no MVP 1

Ordem:

1. Se houver categoria manual, preservar.
2. Aplicar regras ativas por prioridade crescente.
3. Primeira regra que casar define categoria.
4. Registrar assignment com `source = rule`, `confidence = 1.0`, `review_status = accepted`.

Matching:

- Comparacao case-insensitive.
- Normalizacao basica de espacos.
- `contains`, `starts_with`, `equals`.

## Fluxo de Importacao

1. Usuario faz upload.
2. Backend valida token.
3. Backend resolve workspace.
4. Backend valida extensao.
5. Backend calcula hash.
6. Backend verifica duplicidade de arquivo.
7. Backend salva arquivo no Supabase Storage.
8. Backend cria `source_file`.
9. Backend cria `import_job`.
10. Backend detecta layout.
11. Backend grava linhas brutas.
12. Backend parseia linhas.
13. Backend persiste transacoes validas.
14. Backend persiste erros.
15. Backend aplica regras deterministicas.
16. Backend finaliza status.

## Tratamento de Erros

Erros de usuario:

- arquivo nao suportado;
- header CSV invalido;
- linha invalida;
- valor invalido;
- data invalida.

Erros de sistema:

- falha no storage;
- falha no banco;
- falha inesperada do parser.

Regra:

- Erro de linha nao deve falhar a importacao inteira.
- Erro de sistema pode marcar importacao como `failed`.

## Limites do MVP

- Upload individual por arquivo.
- Processamento sincrono por arquivo no MVP 1.
- Para carga historica, frontend deve enviar arquivos em lotes pequenos.
- PDF rejeitado no MVP.
- Embedding e LLM fora do caminho de importacao.
- Logs nao devem conter descricao completa nem valores financeiros quando nao necessario.

## Testes Obrigatorios

Backend:

- Parser TXT valido.
- Parser TXT com linha invalida.
- Parser CSV valido.
- Parser CSV com header invalido.
- Conversao de valor brasileiro.
- Conversao de valor decimal CSV.
- Dedupe de arquivo.
- Dedupe de transacao.
- Aplicacao de regra `contains`.
- Categoria manual prevalece sobre regra.
- Resumo mensal de dashboard.
- Ranking de categorias.
- Qualidade dos dados.

Frontend:

- Login.
- Upload TXT/CSV.
- Lista de importacoes.
- Lista de transacoes.
- Alteracao manual de categoria.
- Cadastro de regra.
