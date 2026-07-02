# 25 — Performance & Cost Guardrails (Neon Network Transfer)

Contexto: a Neon estourou o limite de **Network Transfer** (~5.66 GB). A causa
principal eram endpoints de analytics que **carregavam muitas linhas de
transações para o Python e agregavam em memória**, em vez de agregar no banco.
Este documento registra o que foi feito e as regras para não regredir.

## Princípio central

> **Network Transfer da Neon = tráfego banco↔backend.** O que mais reduz a conta
> é **agregar no SQL** (trazer poucas linhas) e **não puxar listas inteiras de
> transações**. Índices ajudam latência, não bytes. Compactar payload da API
> reduz backend↔frontend, não a conta da Neon diretamente.

## O que já foi feito (branch perf, mesclada via PR #59 e seguintes)

Métodos do `DashboardService` que **deixaram de puxar linhas inteiras**:

| Método | Antes | Agora |
| --- | --- | --- |
| `summary` (income/expenses/payments/count) | full rows | `GROUP BY direction` (soma por data de fatura quando aplicável) |
| `category_ranking` / `subcategory_ranking` | full rows | `GROUP BY` + self-join do pai |
| `merchant_ranking` | full rows | `GROUP BY` (colapso "MERCADO LIVRE" via `CASE`) |
| `expense_size_profile` | full rows | buckets via `CASE` |
| `weekday_spending` | full rows | `GROUP BY` dia-da-semana (dialeto-aware) |
| `_burn_rate` / `_burn_rate_window` / `_burn_rate_90_days` | 3× full rows | `_debit_window_stats` (sum/min/count em 1 query) |
| `credit_card_payment_matches` | full rows | só `direction='payment'` |
| `_seasonal_items` | full rows | só não-cartão debit/credit |
| `spending_breakdown` | full rows ×2 | projeção de coluna (estatística de custo fixo fica em Python) |
| `data_quality` | (já era SQL) | `func.count` + joins |

Resultado: o `/dashboard/overview` e os widgets do dashboard **não puxam mais
listas inteiras de transações**.

Também: migration `0030` com índices compostos para os filtros quentes
(`transactions(workspace_id, transaction_date)`, `(workspace_id, direction,
transaction_date)`, assignments, categories, import_jobs, source_files).

### 2ª rodada — projeção de coluna nos scans que sobraram (branch `perf/load-only-shared-scans`)

A agregação SQL de `monthly_cashflow` / `daily_cashflow` / `summary` continua
inviável em SQL puro (a lógica de realocar cada parcela para o mês da fatura roda
em Python via `_cashflow_date`). Em vez de empurrar pro SQL, **atacamos o tamanho
da linha**: esses métodos usam o scan compartilhado `_transactions` /
`_cashflow_transactions`, que trazia a **entidade `Transaction` inteira** (25
colunas, incluindo `raw_description`, `source_name`, `account_or_card` e as 3
chaves `String(64)` de dedupe) mesmo usando só ~8 colunas. No período "Todos" isso
varre a base inteira — as colunas Text dominam os bytes.

| Método | Antes | Agora |
| --- | --- | --- |
| `_transactions` / `_cashflow_transactions` (shared scan) | entidade inteira | `load_only` das 8 colunas usadas (workspace_id, source_file_id, source_type, direction, amount, transaction_date, installment_current/total) |
| série mensal por categoria (`dashboard_service.py`) | entidade inteira | `load_only(transaction_date, amount)` |
| `_recurring_transactions` (recurring_expenses/incomes) | entidade inteira | `load_only(description, transaction_date, amount)` |

`load_only(..., raiseload=True)` garante que qualquer acesso a uma coluna não
carregada **estoure na hora** (erro alto no `pytest`) em vez de virar um lazy
SELECT por linha (regressão N+1 de egress). Validado: suíte `pytest` verde (185
pass; 1 fail pré-existente de JWT Supabase, sem relação, passa no CI) + `ruff`.
Isto cobre o "pendente" abaixo pelo lado do **tamanho da linha**, não da agregação.

### Ainda pendente (alto risco / baixo retorno)

- `monthly_cashflow` / `daily_cashflow` / `summary` — a **agregação** em SQL segue
  pendente (dependem de `_cashflow_date` por source_file). Já mitigados via
  `load_only` acima; só valeria mexer se a conta de egress ainda apertar.
- `recurring_expenses` / `recurring_incomes` — detecção de recorrência
  (algorítmica) segue em Python; scan já projetado via `load_only`.

## Guardrails (regras para novas telas/endpoints)

1. **Nunca carregue a lista completa de transações para fazer analytics.** Use
   `func.sum/count/min/max` + `group_by` no banco.
2. **Prefira um endpoint consolidado por tela** (`/dashboard/overview`) a vários
   endpoints individuais em paralelo.
3. **Projete colunas** quando precisar de linhas: selecione só as colunas usadas
   (ex.: `select(Transaction.description, Transaction.amount)`), nunca a entidade
   inteira, se não for usar `raw_description`, `natural_dedupe_key`, etc. Se o
   código precisa de objetos `Transaction` (não tuplas), use
   `.options(load_only(*cols, raiseload=True))` — mantém a entidade, corta as
   colunas pesadas e faz qualquer acesso esquecido estourar no teste.
4. **Portabilidade SQLite/Postgres.** Os testes rodam em SQLite. Evite funções de
   dialeto; quando inevitável, ramifique por `self.db.bind.dialect.name`
   (ex.: `strftime` vs `extract`/`date_trunc`). Coaja tipos de retorno de funções
   agregadas (`Decimal(str(row.x)).quantize(...)`); colunas tipadas mantêm o tipo.
5. **Front:** `staleTime >= 5 min`, `refetchOnWindowFocus/Reconnect = false`
   (já configurado em `main.tsx`). Após import/categorização, invalide **apenas**
   as queries afetadas — evite `invalidateQueries()` genérico.
6. **Copilot:** contexto compacto e cacheado; **não** varrer transações por
   pergunta; limite rígido do que vai ao LLM.
7. **Toda nova tela deve declarar** o impacto esperado em nº de queries e tamanho
   de payload.

## Como validar uma agregação SQL

Comparar a saída nova com a lógica antiga nos dados reais (SQLite local
populado) — exigir **0 divergências** antes de commitar — e rodar `pytest`.
Foi o método usado em todas as conversões acima.

## Estimativa de impacto

1ª rodada (agregação SQL), qualitativo: os widgets do dashboard passaram de
"puxar ~todas as linhas do período" para "trazer dezenas de linhas agregadas" por
request — a maior fonte de egress foi atacada.

2ª rodada (`load_only` nos scans compartilhados), **medido** sobre a base real
(9.216 lançamentos, 2026-07-02): o scan "Todos" caiu de **3,20 MB → 0,90 MB por
varredura (−71,7%)**. Proxy = soma dos bytes-texto das colunas trazidas (o wire
Postgres difere um pouco — UUID/numeric em binário — mas a razão se mantém). Os
maiores ganhos vêm das duas chaves de dedupe (`dedupe_key` +
`natural_dedupe_key` = 1,12 MB juntas) e dos UUIDs não usados (`import_job_id`,
`workspace_id`). `workspace_id` foi deliberadamente deixado de fora do `load_only`
(é filtro `WHERE`, nunca lido do objeto). Falta confirmar o delta no console da
Neon com uma carga controlada quando for oportuno.
