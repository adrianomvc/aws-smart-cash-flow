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

### Ainda pendente (alto risco / baixo retorno)

- `monthly_cashflow` / `daily_cashflow` — dependem da **data de fatura**
  (`_cashflow_date` por source_file); difícil em SQL puro.
- `recurring_expenses` / `recurring_incomes` — detecção de recorrência
  (algorítmica).

## Guardrails (regras para novas telas/endpoints)

1. **Nunca carregue a lista completa de transações para fazer analytics.** Use
   `func.sum/count/min/max` + `group_by` no banco.
2. **Prefira um endpoint consolidado por tela** (`/dashboard/overview`) a vários
   endpoints individuais em paralelo.
3. **Projete colunas** quando precisar de linhas: selecione só as colunas usadas
   (ex.: `select(Transaction.description, Transaction.amount)`), nunca a entidade
   inteira, se não for usar `raw_description`, `natural_dedupe_key`, etc.
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

Não mensurável agora (Neon fora de cota até ~01/07). Qualitativo: os widgets do
dashboard passaram de "puxar ~todas as linhas do período" para "trazer dezenas de
linhas agregadas" por request — a maior fonte de egress foi atacada.
