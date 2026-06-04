# AI-DLC Audit Log

## 2026-05-31T04:50:00Z - Workflow Restart

### Raw User Input

```text
reinstalei o aidlc inicie novamente
```

### Action
- Resolved AI-DLC rule details directory to `.aidlc-rule-details/`.
- Loaded mandatory common rules and Workspace Detection.
- Scanned active docs and confirmed `aidlc-docs/` is the active documentation source.
- Created `aidlc-docs/aidlc-state.md` to restore workflow continuity after reinstall.

### Workspace Detection Result
- Brownfield project with existing backend, frontend, infrastructure, contracts, and AI-DLC docs.
- Existing active package: Fase 1 - Planejamento Multirepo e Produto Base.
- Current AI-DLC point: CONSTRUCTION / User Validation for US-063.
- `aidlc-docs-bkp/` is not used by the active workflow.

### Extension Result
- Security Baseline opt-in file detected; decision pending.
- Property-Based Testing opt-in file detected; decision pending.

## 2026-05-31T04:50:00Z - Session Continuity

### Raw User Input

```text
Using AI-DLC, analyze this project and guide me through the workflow.
```

### Action
- Loaded `aidlc-docs/aidlc-state.md`.
- Loaded active backlog from `aidlc-docs/05-backlog.md`.
- Loaded Phase 1 plan from `aidlc-docs/12-phase-1-execution-plan.md`.
- Loaded multirepo target architecture from `aidlc-docs/11-target-architecture-multirepo.md`.
- Created `aidlc-docs/session-continuity-questions.md` to capture the next workflow direction using AI-DLC question-file format.

### Continuity Result
- Current phase remains CONSTRUCTION.
- Current stage remains Build and Test / User Validation.
- Current package remains Fase 1 - Planejamento Multirepo e Produto Base.
- Recommended next action is local validation of US-063 before starting another implementation package.

## 2026-05-31T04:50:00Z - Language Preference

### Raw User Input

```text
vamos fazer em portugues brasil
```

### Action
- Set working language preference to Portugues do Brasil for user-facing AI-DLC guidance.
- Translated `aidlc-docs/session-continuity-questions.md` to Portugues do Brasil.

## 2026-05-31T04:50:00Z - Continuity Answers Processed

### Raw User Input

```text
pronto
```

### Answers Read
- Pergunta 1: A, continuar validando o pacote local atual de Calendario, Orcamentos e Metas.
- Pergunta 2: A, aplicar Security Baseline como regra bloqueante.
- Pergunta 3: A, aplicar Property-Based Testing como regra bloqueante.

### Findings
- SECURITY-05 required stronger explicit Planning input constraints.
- PBT-09 required a configured property-based testing framework.

### Action
- Enabled Security Baseline and Property-Based Testing in `aidlc-docs/aidlc-state.md`.
- Added explicit length and UUID constraints to Planning request models/routes.
- Added Hypothesis to backend dev dependencies.
- Added Planning property-based tests in `backend/tests/test_planning_properties.py`.
- Created `aidlc-docs/14-local-validation-checklist.md`.

### Verification
- `.\.venv\Scripts\python.exe -m pytest tests/test_planning_routes.py tests/test_planning_properties.py` passed.
- `.\.venv\Scripts\python.exe -m ruff check app tests/test_planning_routes.py tests/test_planning_properties.py` passed.

## 2026-05-31T04:50:00Z - Next Package Started

### Raw User Input

```text
ok proxio
```

### Interpretation
- Treated as approval to move to the next AI-DLC package after local validation.

### Action
- Marked Fase 1 - Planejamento Multirepo e Produto Base as `Validado usuario`.
- Started new current package: Planejamento e Projecao.
- Created `aidlc-docs/15-planning-projection-execution-plan.md`.
- Updated `aidlc-docs/aidlc-state.md` to Workflow Planning / Functional Design for US-071.

## 2026-05-31T04:50:00Z - Planning Projection Package Built

### Action
- Implemented `GET /v1/planning/projection`.
- Added `backend/app/services/projection_service.py`.
- Added backend example tests and property-based tests for projection invariants.
- Added frontend API types and client function for planning projection.
- Enabled the Planejamento page in the sidebar.
- Added a Planning page with horizon cards, upcoming events, goals due and assumptions.
- Updated `contracts/openapi/public-api.yaml`.
- Added `contracts/examples/planning/projection.json`.
- Created `aidlc-docs/16-planning-projection-validation-checklist.md`.

### Verification
- Backend Projection tests passed.
- Backend Projection lint passed.
- Contract JSON validation passed.
- Frontend lint passed.
- Frontend build passed.
- Local API smoke for `/v1/planning/projection?horizons=30,60,90` passed.

### Blocked Tooling
- In-app browser verification could not run because the browser/node_repl tool failed with `windows sandbox failed: spawn setup refresh`.

## 2026-05-31T05:20:07Z - Canonical AI-DLC Folder Structure

### Raw User Input

```text
a pasta aidlc-docs nao deverias esta com inception e contruction?
```

### Action
- Confirmed the AI-DLC reinstated rules expect canonical phase folders.
- Created `aidlc-docs/inception/` with reverse engineering, requirements, plans and application design indexes.
- Created `aidlc-docs/construction/` with plans, current unit design, code summary and build/test summary.
- Kept existing root-level docs as historical/executive docs to avoid breaking references.
- Updated `aidlc-docs/aidlc-state.md` with canonical artifact locations.

## 2026-05-31T05:20:07Z - Continue After Checkpoint

### Raw User Input

```text
pronto pode continuar
```

### Action
- Treated as approval to continue after the checkpoint review.
- Removed temporary backend logs `backend/uvicorn-local.err.log` and `backend/uvicorn-local.out.log`.
- Marked Planejamento e Projecao as `Validado usuario`.
- Started next AI-DLC package: Relatorios.
- Created `aidlc-docs/17-reports-execution-plan.md`.
- Updated `aidlc-docs/aidlc-state.md` to Workflow Planning / Functional Design for Reports.

## 2026-05-31T05:20:07Z - Reports Package Built

### Action
- Implemented `GET /v1/reports`.
- Added `backend/app/services/report_service.py`.
- Added backend route, service and property-based tests for reports.
- Added frontend API types and client function for reports.
- Enabled the Relatorios page in the sidebar.
- Added a Reports page with period filter, report cards and export status.
- Updated `contracts/openapi/public-api.yaml`.
- Added `contracts/examples/reports/list.json`.
- Created `aidlc-docs/18-reports-validation-checklist.md`.

### Verification
- Backend Reports tests passed.
- Backend Reports lint passed after formatting fixes.
- Contract JSON validation passed.
- Frontend lint passed.
- Frontend build passed.
## 2026-05-31T05:20:07Z - Visual Prototype Alignment Started

### Raw User Input

```text
proximo
```

### Action

- Started the AI-DLC package `Alinhamento Visual com Prototipo`.
- Did not change application code in this step.
- Created `aidlc-docs/19-visual-prototype-alignment-plan.md`.
- Created `aidlc-docs/20-visual-prototype-comparison.md`.
- Created `aidlc-docs/21-visual-validation-checklist.md`.
- Updated backlog and state to make visual validation distinct from functional
  validation.

## 2026-05-31T12:00:06Z - First Dashboard Visual Slice

### Raw User Input

```text
proximo
```

### Action

- Updated the Dashboard first fold in `frontend/src/App.tsx`.
- Updated visual styles in `frontend/src/styles.css`.
- Preserved existing backend contracts and real data sources.
- Did not implement new APIs or mock-only prototype data.
- Documented that `Runway financeiro` remains out of the first KPI row until a
  real current account balance exists or the product explicitly accepts an
  estimated version.

### Validation

- Passed `npm run lint`.
- Passed `npm run build`.
- Started local frontend dev server on `http://127.0.0.1:5178`.
- Confirmed HTTP 200 with `Invoke-WebRequest`.
- Browser automation via Playwright could not run in this environment because
  the Windows sandbox failed with `spawn setup refresh`.

## 2026-05-31T12:10:00Z - Dashboard Fold Product Review

### Raw User Input

```text
nao sei se esta fazendo sentido parece duplicado... a historia do seu dinheiro e o cockpit financeiro.... e no cokipit finnceio tem 2x compromentimento... veja se faz sentido em manter os 2
```

### Action

- Removed the intermediate `Cockpit financeiro` section header from the first
  Dashboard fold.
- Kept the story module as the single narrative entry point.
- Removed the duplicated `% comprometimento` metric card.
- Preserved the six KPI row using existing real dashboard data.

## 2026-05-31T12:18:00Z - Dashboard Fold Prototype Structure

### Raw User Input

```text
na imagem esta :
Historira: entrou, saiu, saldo do mes, compromisso futuro, saldo previsto fim do mes
a baixo: Saldo atual, fluxo liquido, burn rate, saving, comprometimento, runway
```

### Action

- Realigned the Dashboard first fold to the prototype structure.
- Story now uses `Entrou`, `Saiu`, `Saldo do mes`, `Compromissos futuros` and
  `Saldo previsto`.
- KPI row now uses `Saldo atual`, `Fluxo liquido`, `Burn rate`, `Saving rate`,
  `% comprometimento` and `Runway financeiro`.
- Marked `Saldo atual` and `Runway financeiro` as `A integrar` because the
  current dashboard contract does not include real account balance.
## 2026-05-31T12:32:00Z - Dashboard Main Chart Alignment

### Raw User Input

```text
o grafico é de barra positivas verde para entradas, saidas barra negativas e linha saldo acumulado e projeção linha pontilhada. grafico é visao dia

poderia ter algo para trocar visao mes e dia... se for mes pega do ano do filtro se for dia pega o periodo do filtro
```

### Action

- Reworked the Dashboard main chart to support `Dia` and `Mes` views.
- `Dia` view is built from real transactions in the selected period.
- `Dia` view uses green positive bars for income, negative bars for expenses,
  accumulated balance line and dotted projected balance line.
- `Mes` view keeps the previous yearly monthly trend based on the year of the
  active filter.
- Reorganized the second Dashboard fold so flow, top categories and alerts are
  visible together.

### Validation

- Passed `npm run lint`.
- Passed `npm run build`.

## 2026-05-31T12:42:00Z - Daily Chart Aggregate Fallback

### Raw User Input

```text
esa com o valor de saida unico nao esta distribuido
```

### Action

- Adjusted the daily chart fallback so aggregate income and expenses are spread
  across the selected period instead of being concentrated on one day.
- Preserved real transaction dates whenever transaction data is available.

## 2026-05-31T13:18:00Z - Removed Artificial Daily Distribution

### Raw User Input

```text
esta estranho o grafico com o mesmo valor e com linha reta
```

### Action

- Removed the aggregate daily distribution fallback from the Dashboard chart.
- Kept the `Dia` view based on real transaction dates only.
- Preserved the `Mes` view as the reliable aggregate fallback when daily data is
  not available for the selected period.

## 2026-06-01T00:00:00Z - Stacked Cashflow Bars

### Raw User Input

```text
grafio cde barras com colunas empilhadas
```

### Action

- Updated Dashboard chart bars to use stacked columns for both `Dia` and `Mes`
  views.
- Kept income as positive green bars and expenses as negative bars.

## 2026-06-01T00:20:00Z - Dashboard Chart Series Reset

### Raw User Input

```text
quais os valosres vc esta usando no grafico? refaça do inicio... pois tem que ser Receita,  Despesas,  Saldo acumulado, saldo projetado
```

### Action

- Reset the Dashboard chart semantics to exactly four series: `Receita`,
  `Despesas`, `Saldo acumulado` and `Saldo projetado`.
- Removed credit card payments from the chart expense calculation to avoid
  mixing `Despesas` with fatura/payment concepts.
- Kept `Saldo acumulado` as cumulative `Receita - Despesas`.

## 2026-06-01T00:40:00Z - Dashboard Chart Line Visibility

### Raw User Input

```text
o grafico de linhas nao aparece ,

dia deve levar em consideração o filro do periodo de inicio ao fim, e o mes deve levar o ano do periodo
```

### Action

- Fixed the Dashboard daily transactions query that was using `limit=500`, while
  the API accepts a maximum of `100`.
- Added paginated loading for the daily cashflow chart so the `Dia` view covers
  the full selected period instead of only a single page.
- Changed the `Mes` dashboard query to always use the full year of the active
  period.
- Filled the monthly chart with the 12 months of that year.
- Kept `Saldo acumulado` continuous after the last real transaction and rendered
  `Saldo projetado` as a dotted line in both `Dia` and `Mes`.

### Validation

- Passed `npm run build`.
- Confirmed backend `/health` returned `ok`.
- Confirmed June 2026 API data exists for the daily chart with 16 transactions.

## 2026-06-01T00:48:00Z - Expense Bar Sign Readability

### Raw User Input

```text
lembrese receita é valor positivo e despesa tem q negativar,

est estranho as barras tem dados de despesa parece positivo
```

### Action

- Preserved the existing negative expense calculation.
- Changed tooltip formatting so `Despesas` shows signed currency instead of
  absolute currency.
- Strengthened the chart zero line and expense bar color so negative bars read
  more clearly below zero.

### Validation

- Passed `npm run build`.

## 2026-06-01T01:10:00Z - Daily Cashflow Aggregate Endpoint

### Raw User Input

```text
como funciona o back retorna todas as transações do uma a uma do periodo?  a lentidao é no front ou back? o APp.tsx esta com mais de 6mil linhas

sim pode ajustar
```

### Action

- Added backend endpoint `GET /v1/dashboard/daily-cashflow`.
- Added daily aggregation in `DashboardService.daily_cashflow`.
- Kept `payments` separate from `expenses`; payment transactions do not enter
  the Dashboard chart expense series.
- Updated the frontend API client with `DailyCashflowItem` and
  `getDailyCashflow`.
- Changed the Dashboard chart to consume the daily aggregate endpoint instead
  of paginating through `/v1/transactions`.
- Extracted cashflow chart builders from `frontend/src/App.tsx` into
  `frontend/src/lib/cashflow.ts` as the first modularization step.
- Updated `contracts/openapi/public-api.yaml` with the new route.

### Validation

- Passed focused backend test:
  `pytest tests/test_dashboard_routes.py::test_dashboard_daily_cashflow_groups_by_day_and_separates_payments`.
- Passed backend lint: `ruff check app tests/test_dashboard_routes.py`.
- Passed frontend build: `npm run build`.
- Restarted local backend on `127.0.0.1:8006`.
- Confirmed `/health` returned `ok`.
- Confirmed `/v1/dashboard/daily-cashflow?date_from=2026-06-01&date_to=2026-06-30`
  returns one row per day with `expenses` and `payments` separated.

### Known Existing Test Failures

- Full `tests/test_dashboard_routes.py` still has two failures not introduced
  by this change:
  - merchant ranking expected normalized label `MERCADO LIVRE`, API returned
    `MERCADO LIVRE LOJA EXEMPLO`;
  - data quality expected one import with errors, API counted two errored
    duplicate imports.

## 2026-06-01T02:10:00Z - Dashboard Cashflow Performance and Card Installment Semantics

### Raw User Input

```text
dia esta lento para carregar. filtro o periodo e ele demora muito

entao cai no dia do fechamento e nao no dia da compra?

ok vmos continuar
```

### Action

- Confirmed the product rule for credit-card installments in cashflow:
  purchase date is operational history, closing date decides the invoice, and
  the chart should use invoice due date because that is when money leaves cash.
- Current fallback uses default card closing day `23` and due day `30` until
  card-specific settings or statement due dates are persisted.
- Optimized `DashboardService.monthly_cashflow` and `daily_cashflow` so filtered
  requests no longer load the full workspace history before applying date
  filters. Installment rows still get an expanded lookback window to preserve
  projected invoice dates.
- Converted dashboard route handlers from `async def` to sync `def`, because
  they execute synchronous SQLAlchemy work. FastAPI can now run them in the
  threadpool instead of blocking the event loop while the frontend loads
  multiple dashboard panels.

### Validation

- Restarted local backend on `127.0.0.1:8006`.
- Confirmed `/health` returned `ok`.
- Measured `/v1/dashboard/daily-cashflow?date_from=2026-04-01&date_to=2026-04-30`
  at about `0.9s`.
- Measured `/v1/dashboard/monthly-cashflow?date_from=2026-01-01&date_to=2026-12-31`
  at about `1.8s`.
- Passed focused backend tests:
  `pytest tests/test_dashboard_routes.py::test_dashboard_cashflow_places_card_installment_on_invoice_due_month tests/test_dashboard_routes.py::test_dashboard_daily_cashflow_groups_by_day_and_separates_payments tests/test_dashboard_routes.py::test_dashboard_monthly_cashflow_groups_by_month -q`.
- Passed backend lint:
  `ruff check app/api/routes/dashboard.py app/services/dashboard_service.py tests/test_dashboard_routes.py`.

### Remaining Risk

- Real statement files can encode a fatura/due month that differs from
  purchase-date-plus-closing-day inference. Future work should persist
  `statement_due_date` or `cashflow_date` during import and use that as the
  source of truth for credit-card statement rows.

## 2026-06-01T02:35:00Z - Credit Card Statement Due Date from Filename

### Raw User Input

```text
24/02/26
ANGLO
ANGLO 04/10

entao cai no dia do fechamento e nao no dia da compra?

proximo
```

### Action

- Added cashflow support for credit-card statement filenames containing a due
  date in `YYYYMMDD` format, such as `fatura-20260420.csv`.
- For credit-card debit rows from these files, daily and monthly cashflow now
  use the statement due date from the source filename as the cashflow date.
- Kept the existing fallback for files without due date in the filename:
  installments use purchase date plus configured closing day/due day; other
  card debits use transaction date.
- Optimized the source-file lookup to search only fatura months present in the
  requested filter window, while keeping the installment fallback lookback.

### Validation

- Added focused test:
  `test_dashboard_cashflow_uses_statement_due_date_from_credit_card_filename`.
- Passed focused backend tests:
  `pytest tests/test_dashboard_routes.py::test_dashboard_cashflow_uses_statement_due_date_from_credit_card_filename tests/test_dashboard_routes.py::test_dashboard_cashflow_places_card_installment_on_invoice_due_month tests/test_dashboard_routes.py::test_dashboard_daily_cashflow_groups_by_day_and_separates_payments tests/test_dashboard_routes.py::test_dashboard_monthly_cashflow_groups_by_month -q`.
- Passed backend lint:
  `ruff check app/services/dashboard_service.py tests/test_dashboard_routes.py`.
- Restarted local backend on `127.0.0.1:8006`.
- Confirmed `/health` returned `200`.
- Confirmed real data for `2026-04-20` shows card statement expenses grouped on
  the fatura due date from `fatura-20260420.csv`.

## 2026-06-01T02:50:00Z - Dashboard Cashflow UX Note

### Raw User Input

```text
proximo
```

### Action

- Updated the Dashboard cashflow panel description for the daily view to clarify
  that card expenses use invoice due date when identified.
- Kept the monthly view description unchanged.

### Validation

- Passed frontend build: `npm run build`.
- Confirmed frontend `127.0.0.1:5178` returned `200`.
- Confirmed backend `/health` returned `200`.

## 2026-06-01T03:15:00Z - Credit Cards and Statements Domain Slice

### Raw User Input

```text
ok o ideial é deixar cadastrar a fatura e qual cartao q é... no pdf tem essas informaçoes

proximo
```

### Action

- Started the next AI-DLC construction package for real credit-card and statement
  domain modeling.
- Added persisted `CreditCard` and `CreditCardStatement` models.
- Added Alembic migration `20260601_0005_credit_cards_statements.py`.
- Added backend REST endpoints:
  - `GET /v1/credit-cards`
  - `POST /v1/credit-cards`
  - `GET /v1/credit-card-statements`
  - `POST /v1/credit-card-statements`
- Added frontend API client types and functions for cards/statements.
- Updated the Cartoes screen with forms to register cards and statements, plus
  persisted lists for both.

### Validation

- Passed backend tests: `pytest tests/test_card_routes.py -q`.
- Passed backend lint:
  `ruff check app/api/routes/cards.py app/db/models.py tests/test_card_routes.py`.
- Passed frontend build: `npm run build`.
- Restarted backend on `127.0.0.1:8006`.
- Confirmed `/health` returned `200`.
- Confirmed `GET /v1/credit-cards` and `GET /v1/credit-card-statements`
  returned successful empty lists in local data.

### Remaining Risk

- Transactions/import jobs are not yet linked automatically to registered
  statements.
- PDF extraction is not implemented yet; this slice prepares the data model and
  UI entry point for the PDF parser to populate card and statement metadata.

## 2026-06-02 - AI-DLC Construction Checkpoint: Importacao vinculada a fatura

### User Prompt

proximo

User also provided PDF examples location:
`G:\Meu Drive\Financas\Faturas\BKP`.

### AI-DLC Phase / Stage

- Phase: CONSTRUCTION.
- Stage: Build and Test for the card/statement import-link slice.

### Changes Made

- Backend import endpoint now accepts optional multipart field
  `credit_card_statement_id`.
- When provided with `source_kind` `auto` or `credit_card_csv`, the endpoint
  validates that the statement belongs to the active workspace before processing
  the upload.
- After a successful upload, the selected credit card statement receives the
  generated `source_file_id`.
- Frontend upload contract now sends `credit_card_statement_id` when selected.
- Imports screen now shows a `Fatura vinculada` select when layout is
  `Fatura CSV`, using registered cards/statements as options.
- Added focused backend test proving that importing a credit card CSV can link
  the generated source file to a registered statement.

### Files Changed In This Slice

- `backend/app/api/routes/imports.py`
- `backend/tests/test_import_routes.py`
- `frontend/src/lib/api.ts`
- `frontend/src/App.tsx`
- `aidlc-docs/audit.md`

### Validations

- Passed focused backend tests:
  `pytest tests/test_import_routes.py::test_create_import_links_credit_card_statement tests/test_card_routes.py -q`.
- Passed backend lint:
  `ruff check app/api/routes/imports.py tests/test_import_routes.py app/api/routes/cards.py app/db/models.py`.
- Passed frontend build: `npm run build`.

### Remaining Risk / Next Step

- PDF examples were located at `G:\Meu Drive\Financas\Faturas\BKP` after
  explicit read approval. The available samples include monthly
  `FATURA_PAO_DE_ACUCAR_ITAU_MASTERCARD_BLACK_YYYY_MM.pdf` files from 2021/08
  onward.
- PDF extraction is still not implemented; current slice links already imported
  CSV/TXT faturas to registered card statements.
- Import deletion does not yet clear `CreditCardStatement.source_file_id`; this
  should be reviewed before treating the link as a full lifecycle relation.

## 2026-06-02 - AI-DLC Backlog Update: Importacao Excel de extrato

### User Prompt

coloque na lista import de excel, o extrato da conta corrente vem em excel
tabem e tem informação do saldo diario q acho q seria importante tb

### Decision

- Added backlog item `US-003A` for bank statement Excel imports.
- Scope includes `.xlsx`/`.xls` support for conta corrente statements.
- Daily balance from the Excel statement is treated as first-class information,
  not as a synthetic transaction.

### Rationale

- Bank statement Excel files can carry daily balance information that TXT/CSV
  transaction-only imports do not provide.
- Daily balance can improve cash-flow charts, reconciliation, end-of-day balance
  validation and future projected balance checks.

### Files Changed

- `aidlc-docs/05-backlog.md`
- `aidlc-docs/audit.md`

### Open Product/Technical Questions

- Which bank Excel layouts should be supported first.
- Whether daily balances should be stored in a new table, for example
  `account_daily_balances`, or derived during import into an import metadata
  table.
- How to display daily balance in the current cash-flow chart without confusing
  it with `Saldo acumulado` derived from transactions.

## 2026-06-02 - AI-DLC Construction Checkpoint: Vinculo pos-importacao

### User Prompt

mas e se eu importar automatico csv ele aparece?

poderia vincular no arquivo apos o import?

### Decision

- Implemented post-import linking so the user can import a CSV in automatic mode
  first and link the resulting source file to a registered card statement later.
- This keeps automatic detection simple and avoids forcing the user to know the
  parser before upload.

### Changes Made

- Added backend endpoint:
  `PATCH /v1/credit-card-statements/{statement_id}/source-file`.
- Endpoint validates that both the statement and source file belong to the
  active workspace before linking.
- Added frontend API client function `updateCreditCardStatementSourceFile`.
- Added a link panel in the import detail drawer showing current statement link
  and allowing the user to select a registered statement for that imported file.
- Added backend test for linking an imported source file to a card statement.

### Files Changed In This Slice

- `backend/app/api/routes/cards.py`
- `backend/tests/test_card_routes.py`
- `frontend/src/lib/api.ts`
- `frontend/src/App.tsx`
- `aidlc-docs/audit.md`

### Validations

- Passed focused backend tests:
  `pytest tests/test_card_routes.py tests/test_import_routes.py::test_create_import_links_credit_card_statement -q`.
- Passed backend lint:
  `ruff check app/api/routes/cards.py app/api/routes/imports.py tests/test_card_routes.py tests/test_import_routes.py`.
- Passed frontend build: `npm run build`.

### Remaining Risk / Next Step

- UI currently supports linking, but not explicit unlink from the import drawer.
- Import deletion still needs lifecycle review for whether linked statements
  should be automatically cleared.

## 2026-06-02 - AI-DLC Construction Checkpoint: Filtro de tipo no historico

### User Prompt

filtro do historico poderia ter algo do tipo para facilitar

### Changes Made

- Added backend `source_kind` filter to `GET /v1/imports`.
- Supported values: `bank_statement_txt`, `credit_card_csv`, `unknown`.
- Added frontend history filter `Todos os tipos`, `Extrato TXT`, `Fatura CSV`
  and `Desconhecido`.
- Filter summary and clear action now include the selected type.
- Added focused route test for filtering import history by `source_kind`.

### Files Changed In This Slice

- `backend/app/api/routes/imports.py`
- `backend/tests/test_import_routes.py`
- `frontend/src/App.tsx`
- `aidlc-docs/audit.md`

### Validations

- Passed focused backend test:
  `pytest tests/test_import_routes.py::test_list_imports_filters_by_status_filename_and_paginates -q`.
- Passed backend lint:
  `ruff check app/api/routes/imports.py tests/test_import_routes.py`.
- Passed frontend build: `npm run build`.

## 2026-06-02 - AI-DLC Product Decision: Faturas automation-first

### User Prompt

mas o porque eu cadastraria fatura se importo tudo e deveria pegar de la essa
info... unica coisa q vi q serve desse é saber se a fatura esta em aberto ou
fechada ... mas nao quero ficar cadastrando coisas manuais o mais automatico
possivel lembrese disso mais automatico possivl com menos dados de input
manuais.

### Decision

- Fatura must not be a required manual registration flow.
- The preferred flow is import-first: CSV/PDF/Excel should detect card,
  statement month, closing date, due date, total amount and status whenever the
  file exposes those fields.
- Manual card/statement forms are fallback/correction tools only.
- The user should review/confirm ambiguous detections, not type data that can be
  inferred safely from the imported file.

### Product Implication

- Current UI wording around `Cadastrar fatura` and `Vincular arquivo a fatura`
  is too manual for the desired product behavior.
- Next card/import slice should shift the interface toward:
  - detected/suggested cards;
  - detected/suggested statements;
  - minimal confirmation when confidence is low;
  - manual edit only after detection.

### Files Changed

- `aidlc-docs/05-backlog.md`
- `aidlc-docs/audit.md`

## 2026-06-02 - AI-DLC Construction Checkpoint: UX automation-first em Cartoes

### User Prompt

ok vamos la

### Changes Made

- Reorganized the Cards page so detected/imported cards and statements appear
  before manual forms.
- Renamed the main section from manual registration language to
  `Cartões e faturas detectados`.
- Changed manual forms to `Ajustar cartão manualmente` and
  `Ajustar fatura manualmente`, making them fallback/correction flows.
- Updated empty states to guide the user to import a statement first.
- Changed import-detail wording from `Vincular arquivo à fatura` to
  `Associar importação ao cartão/fatura`.
- Changed upload select fallback from `Importar sem vínculo` to
  `Detectar depois da importação`.

### Files Changed In This Slice

- `frontend/src/App.tsx`
- `aidlc-docs/audit.md`

### Validation

- Passed frontend build: `npm run build`.

### Remaining Risk / Next Step

- This is UX alignment only. Backend still does not auto-create card/statement
  records from imported metadata; that is the next functional slice.

## 2026-06-02 - AI-DLC Construction Checkpoint: Cartao como correcao principal

### User Prompt

mas no import do arquivo ainda fica o vinculo da fatura cadastrado? nao deveria
ser cartao? preciso poder editar tb o cartao

### Decision

- Removed the pre-upload `Fatura vinculada` selector from imports because it
  encouraged manual statement linking before automatic detection.
- Kept post-import association as a correction flow, but changed UI language to
  `cartao/fatura` instead of only `fatura`.
- Added card editing so the user can correct detected card metadata instead of
  creating duplicate manual cards.

### Changes Made

- Added backend endpoint `PATCH /v1/credit-cards/{credit_card_id}`.
- Added focused backend test for editing card fields.
- Added frontend API client `updateCreditCard`.
- Cards page now lets the user click `Editar` on a detected card, fills the
  adjustment form, and saves the edit.
- Import upload now only asks for parser/layout; association happens after
  import if needed.

### Validations

- Passed backend tests: `pytest tests/test_card_routes.py -q`.
- Passed backend lint:
  `ruff check app/api/routes/cards.py tests/test_card_routes.py`.
- Passed frontend build: `npm run build`.

### Remaining Risk / Next Step

- Backend still needs automatic card/statement detection and creation from
  imported metadata. Current work removes misleading manual UI paths and enables
  card correction.

## 2026-06-02 - AI-DLC Construction Checkpoint: Associar importacao ao cartao

### User Prompt

proximo... e no import da fatura do cartao nao deveria ser o vinculo ao cartao
somente ao inves de vincukar a cartao/fatura?

### Decision

- The import correction flow should ask for the card, not the statement.
- The backend derives or updates the card statement from the imported source
  file when possible.

### Changes Made

- Added backend endpoint:
  `POST /v1/credit-cards/{credit_card_id}/statement-source-files/{source_file_id}`.
- Endpoint validates that the source file belongs to the workspace and is a
  credit card import.
- Endpoint infers statement due date from filenames containing `YYYYMMDD`, such
  as `fatura-20260420.csv`.
- Endpoint creates or updates the related `CreditCardStatement` for that card
  and due date.
- Import detail drawer now selects `Cartão`, not `Cartão/fatura`.
- Added frontend API client `associateCreditCardSourceFile`.
- Added backend test for creating a statement from card + source file.

### Validations

- Passed backend tests: `pytest tests/test_card_routes.py -q`.
- Passed backend lint:
  `ruff check app/api/routes/cards.py tests/test_card_routes.py`.
- Passed frontend build: `npm run build`.

### Remaining Risk / Next Step

- Date inference currently depends on filename containing `YYYYMMDD`. PDF/CSV
  content parsing should replace this fallback when statement metadata is
  available inside the file.

## 2026-06-02 - AI-DLC Construction Checkpoint: Fallback de vencimento por transacoes

### User Prompt

Could not infer statement due date from filename
erro ao vincular cartao a fatura

visa_infinit.csv Completo 94/94 0 0 14/05/26

### Changes Made

- Card association no longer requires the filename to contain `YYYYMMDD`.
- If the filename does not expose a due date, the backend now looks at the last
  transaction date for that source file.
- It then estimates the statement due date using the selected card's
  `closing_day` and `due_day`.
- Added regression test for a credit card import file without a date in the
  filename.

### Validations

- Passed backend tests: `pytest tests/test_card_routes.py -q`.
- Passed backend lint:
  `ruff check app/api/routes/cards.py tests/test_card_routes.py`.

## 2026-06-02 - AI-DLC Construction Checkpoint: Total estimado da fatura importada

### User Prompt

proximo

### Changes Made

- When associating a credit card import file to a card, the backend now estimates
  the related statement `total_amount` from imported transactions in that source
  file.
- The estimate sums credit card statement rows with directions `debit` and
  `credit`.
- Rows with direction `payment` are ignored, because payment of the fatura should
  be reconciled from the bank statement instead of changing the statement's
  purchase/credit total.
- Existing statement links are updated with the recalculated total when
  available.

### Validations

- Passed backend tests: `pytest tests/test_card_routes.py -q`.
- Passed backend lint:
  `ruff check app/api/routes/cards.py tests/test_card_routes.py`.

### Remaining Risk / Next Step

- The statement total is estimated from the normalized transaction rows, not yet
  from a PDF/CSV header total when the file provides an explicit official fatura
  amount.
- Next automation-first step should reconcile bank-statement fatura payments with
  detected credit card statements and update statement status (`open`, `closed`,
  `paid`, or `partial`).

## 2026-06-02 - AI-DLC Construction Checkpoint: Reserva visual de indicadores futuros

### User Prompt

para os indicadores q ainda nao sao possiveis deixar espaço na tela ja reservado

### Changes Made

- Dashboard now keeps reserved visual slots for advanced indicators that exist in
  the prototype/spec but are not yet safely computable from current data.
- Added reserved cards for `Burn rate 90 dias`, `Burn rate 12 meses`,
  `Safe Spend`, `Financial Health Score`, and `Sugestão da IA`.
- Kept existing real/partial indicators in the main KPI row, including
  `Saldo atual` and `Runway financeiro` as reserved values.
- Added a `reserved` visual state to `MetricCard` so future indicators reserve
  layout space without presenting invented numbers.

### Validations

- Passed frontend lint: `npm run lint`.
- Passed frontend build: `npm run build`.

### Remaining Risk / Next Step

- Human visual validation is still needed against `1a - Dashboard.png` and
  `1b - dashboard2.png` to confirm whether reserved indicators should stay in a
  separate row or be redistributed exactly like the prototype.

## 2026-06-02 - AI-DLC Construction Checkpoint: Blocos da Visao Geral 1a

### User Prompt

vamos la o q sinto falta aqui:
Distribuição das depezas por grafico pizza
Top Categorias grafico de bar igual a tela 1a (link ver todas

Catoes credito valor fatura atual, parcelado futuro comprometimento com cartao
% da receita (link ver detalhes)
Fluxo de caixa projetado com alerta de saldo negativo em x dias
Insgh e Alerta com poucos itens para nao quebrare (link ver todos)

Orçamento Mes (link ver orçamento)
Metas em andamento (link ver todas)
Proximos ompromisos (link ver calendario)
Dicas personalizadas

### Changes Made

- Reorganized Dashboard/Visao Geral to include the missing prototype blocks:
  `Distribuicao das despesas`, `Top categorias`, `Cartoes de credito`,
  `Fluxo de caixa projetado`, `Insights e alertas`, `Orcamento do mes`,
  `Metas em andamento`, `Proximos compromissos`, and `Dica personalizada`.
- Added donut/pizza chart for expense distribution from category ranking data.
- Replaced the old top-category list with compact bar rows and a `Ver todas`
  action.
- Added credit-card snapshot with current statement total, future installments,
  and card commitment as percentage of period income.
- Added projected cashflow snapshot with negative-balance alert when projected
  balance crosses below zero.
- Limited Dashboard alerts to three items to avoid breaking the layout.
- Added compact budget, goal, timeline, and personalized-tip components using
  existing APIs and derived data.

### Validations

- Passed frontend lint: `npm run lint`.
- Passed frontend build: `npm run build`.
- Confirmed local frontend server responds at `http://127.0.0.1:5178`.

### Remaining Risk / Next Step

- Human visual validation is needed in the browser against `1a - Dashboard.png`.
- Some Dashboard blocks still use derived/fallback data from existing endpoints
  until dedicated contracts are finalized.

## 2026-06-02 - AI-DLC Construction Checkpoint: Refinamento compacto da Visao Geral

### User Prompt

Use a tela atual como baseline e faça apenas os ajustes necessários de layout e
refinamento visual na **Visão geral / Dashboard**.

### Changes Made

- Preserved the existing Dashboard components and reorganized the main financial
  reading area into two desktop columns:
  left column with `Evolução do fluxo de caixa` and `Top categorias`; right
  column with `Próximos compromissos` and `Distribuição das despesas`.
- Reduced the main cashflow chart height and internal chart margins while
  keeping Dia/Mês, revenue bars, expense bars, accumulated balance and projected
  balance.
- Kept only one `Próximos compromissos` block on the Dashboard and added
  `Ver todos (N)` footer when more commitments exist.
- Kept `Dica personalizada` as a final horizontal footer strip.
- Kept `Cartões de crédito` and `Fluxo de caixa projetado` in a two-column
  section and changed projected-cashflow action text to `Ver projeção completa`.
- Added card commitment status labels (`Excelente`, `Atenção`, `Risco`).
- Cleaned the planning section into three columns: `Orçamento do mês`,
  `Metas em andamento`, and `Insights e alertas`.
- Reduced the incomplete-indicator area to four cards under
  `Indicadores em evolução`: `Runway financeiro`, `Burn rate 90 dias`,
  `Safe Spend`, and `Financial Health Score`.
- Added `Período analisado` label to the period filter.
- Added compact category distribution grouping via `Outros`.
- Replaced the old simple projected balance with a hybrid projected balance
  estimate using known events, future installments, recurring expenses,
  category-level variable expense estimates and fallback only when needed.

### Validations

- Passed frontend lint: `npm run lint`.
- Passed frontend build: `npm run build`.
- Confirmed local frontend server responds at `http://127.0.0.1:5178`.

### Validation Limitation

- Browser screenshot validation could not be completed because the in-app
  browser runtime failed to start in the sandbox during this turn.

### Remaining Risk / Next Step

- Human validation is still needed in the local browser for desktop and mobile
  layout balance.
- The hybrid projection is still frontend-derived from existing endpoints; a
  dedicated projection API contract should own this calculation in a later
  construction step.
## 2026-06-02 - AI-DLC Construction Checkpoint: Importacao de extrato Excel e saldo diario

- Fase AI-DLC: Construction.
- Escopo executado: adicionar suporte a extrato Excel `.xls` de conta corrente como fonte de importacao, persistir saldo diario em tabela propria e expor saldo atual no dashboard.
- Backend:
  - Novo `source_kind`: `bank_statement_excel`.
  - Novo modelo/tabela: `account_balances`.
  - Nova migration: `20260602_0006_account_balances.py`.
  - Parser Excel calibrado com arquivos reais em `G:\Meu Drive\Financas\Extratos\Excel`.
  - Importacao Excel gera transacoes a partir da coluna `valor (R$)` e saldos diarios a partir da coluna `saldos (R$)`.
  - Dashboard summary passa a retornar `current_balance`, `current_balance_date` e `current_balance_account`.
- Frontend:
  - Tela de importacao agora permite selecionar `Extrato Excel`.
  - Lista/filtro de importacoes reconhece `Extrato Excel`.
  - Card `Saldo atual` usa saldo real importado quando disponivel.
  - Card `Runway financeiro` calcula meses quando existem saldo atual e burn rate.
- Decisoes assumidas:
  - Suporte inicial restrito a `.xls`, porque os exemplos reais do Itau sao Excel binario e `xlrd` nao le `.xlsx`.
  - Saldo diario nao entra como transacao; fica em tabela propria para evitar distorcer receitas/despesas.
  - Reimportacao do mesmo arquivo por hash fica como duplicada, mesmo quando o arquivo anterior tinha apenas erros.
- Validacoes executadas:
  - Parser validado contra arquivos reais `.xls` do diretorio informado; resultado sem erros de parse nos arquivos inspecionados.
  - Backend: `python -m pytest tests\test_parsers.py tests\test_import_routes.py tests\test_dashboard_routes.py -q` -> 59 passed.
  - Backend: `python -m ruff check app tests` -> passed.
  - Frontend: `npm run lint` -> passed.
  - Frontend: `npm run build` -> passed.
- Riscos e pendencias:
  - Precisa aplicar migration no banco local/ambiente antes de importar Excel na API em execucao.
  - `.xlsx` ainda nao foi implementado.
  - Validacao visual/browser nao foi executada nesta fatia.
## Code Generation / Local Adjustment
**Timestamp**: 2026-06-04T00:00:00Z
**User Input**: "projecao do fluxo de caixa tem q aparecer para o periodo filtrado"
**AI Response**: "Adjusted the Fluxo de Caixa evolution projection to use the filtered period range while preserving the fixed 30-day projection card behavior."
**Context**: Construction phase, incremental frontend projection alignment.

---
## Code Generation / Local Adjustment
**Timestamp**: 2026-06-04T00:00:00Z
**User Input**: "linha do saldo acumulado tem que ir ate o dia q nao tem dado depois fica a linha da projeção. lembre-se a projecao tem q iniciar no mesmo valor da linha saldo acumulado."
**AI Response**: "Adjusted cashflow chart projection alignment so projected balance starts at the accumulated balance transition point and realized balance is hidden after projection takes over."
**Context**: Construction phase, incremental frontend chart calculation fix.

---
