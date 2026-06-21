# Plano de Execucao: Import de Cartao + Parcelas Futuras

## Estado AI-DLC

- **Fase**: CONSTRUCTION
- **Etapa atual**: Code Generation / Build and Test
- **Pacote anterior**: Alinhamento Visual com Prototipo
- **Pacote atual**: Import de Fatura de Cartao (Itau PDF) + Comprometimento Futuro de Parcelas
- **Branch**: `feature/evolve-from-ci126`
- **Extensoes ativas**: Security Baseline e Property-Based Testing como bloqueantes

## Objetivo

Importar faturas de cartao de credito do Itau a partir do PDF e derivar o
comprometimento futuro de compras parceladas (proximas faturas) a partir de UMA
unica parcela cobrada, sem gravar linhas projetadas no banco.

## Escopo Incluido

- Parser de fatura Itau (PDF), incluindo layout antigo e de duas colunas.
- Captura de parcela mesmo quando embutida em codigo de comerciante sem separador.
- IOF internacional como lancamento datado.
- Reconciliacao com o total da fatura.
- Auto-registro do cartao a partir do PDF (nunca pelo nome do arquivo): bandeira,
  4 ultimos digitos, tier do produto, fechamento/vencimento e **limite de credito**.
- Derivacao de parcelas futuras por mes-fatura no dashboard
  (`DashboardService.credit_card_installments`).
- Frontend: editar/excluir cartao (soft-delete `active=false`) e preview de import
  em lote expansivel (tabela de transacoes, duplicadas marcadas).

## Fora do Escopo

- Gravar linhas de parcelas futuras no banco (continua sendo derivacao on-the-fly).
- Outros bancos alem do Itau.
- Import de investimentos (ver backlog separado).

## Estado Atual (2026-06-19)

### Ja commitado (ultimos 5 commits, ate ea1cc9f)

- Parse de fatura Itau PDF; layout antigo; IOF datado; captura em duas colunas;
  ano sensivel a parcela; reconciliacao de total; auto-registro do cartao;
  `credit_card_pdf` liberado no check constraint de `source_files`.

### Nao commitado (working tree) — bloco coeso a revisar/commitar

- `parsers.py`: regex de coluna direita (`_ITAU_PDF_RIGHT_COL_SEP_RE`), valor
  sempre positivo com sinal no `direction`, parcela embutida em codigo de
  comerciante, limite de credito (`_ITAU_PDF_LIMIT_RE`), tier na linha seguinte,
  reconciliacao ajustada ao novo sinal.
- `import_service.py`: dedupe posicional (nao por `source_line`); grava/atualiza
  `limit_amount`; cartao novo com `active=True`; preview ate 200 itens.
- `domain/imports.py`: campo `limit_amount` em `ParsedCreditCard`.
- `api/routes/cards.py`: `list_credit_cards` filtra apenas cartoes ativos.
- `frontend/CardsPage.tsx`: duplo-clique edita; botao "Excluir cartao" (soft-delete).
- `frontend/ImportsPage.tsx`: preview em lote expansivel com tabela de transacoes.
- Scripts: `scripts/validate_future_installments.py`,
  `scripts/link_cognito_to_workspace.py` (nao rastreados).

## IMPORTANTE — reversao de UX (2026-06-19, fim da sessao)

O usuario achou a experiencia ruim depois de varias mudancas de UX empilhadas e
pediu para **reverter os experimentos de UX e manter so os bugs**. Estado final:

### MANTIDO (bugs/correcoes)
- Reativacao do cartao no import (caminho normal + duplicate_file) — `import_service`.
- `ImportsPage`: invalida `credit-cards` (+monthly-cashflow/category-ranking/
  data-quality) no upload → sem F5.
- `compactValueAbs` (utils) + uso nos KPIs de Cartoes e Transacoes → fim do "R$R$".
- `CardsPage`: `cardExpenses` usa agregado do servidor (total_expense-total_income)
  → total da fatura correto (nao trunca em 100).
- IOF datado no FECHAMENTO (`parsers._itau_pdf_iof_charge`).
- NOVO: "Lancamentos da fatura" PAGINADO no proprio card (query `card-ledger`
  separada com limit/offset; controles Anterior/Proxima; nao quebra o donut de
  categorias que usa a query de 100). Pedido do usuario: navegar sem pular p/ Transacoes.

### REVERTIDO (experimentos de UX)
- Filtro por competencia em Cartoes + params `invoice_from/invoice_to` no backend.
- Enriquecimento `invoice_closing_date/due/month` no `TransactionRead`.
- Filtro de "data efetiva de consumo" em Transacoes (voltou a `coalesce(payment_date,
  transaction_date)`).
- Exibicao de 2 datas / `transactionLedgerDate` + helpers (CardsPage e Transacoes).
- Seletor de fatura em Cartoes + abrir no 1o cartao.

NOTA: as decisoes de modelo de datas (consumo vs fatura vs vencimento) ficam
documentadas abaixo como historico, mas NAO estao implementadas. Retomar com calma.

## Sessao 2026-06-19 — bugs encontrados na validacao com PDF real

PDFs reais em `G:\Meu Drive\Financas\Faturas\BKP` (Mastercard Black 2021-2024,
Visa Infinite Personnalite 2025-2026). Servidores: backend 8006, frontend 5173.

### Corrigidos
- **Cartao nao cadastrava**: o cartao ERA criado, mas como `active=False` (havia
  sido soft-deletado pelo botao "Excluir cartao") e `list_credit_cards` filtra
  ativos. Fix em `import_service._register_pdf_credit_card`: ramo de cartao
  existente agora **reativa** (`active=True`) alem de preencher o limite.
- **Re-import de cartao excluido nao voltava**: reimportar o MESMO PDF caia no
  guard de arquivo duplicado e retornava ANTES do registro. Fix: chamar
  `_register_pdf_credit_card` (best-effort) tambem no ramo `DUPLICATE_FILE`.
  Validado: status `duplicate_file` -> cartao volta `active=True`.
- **Telas vaziam ate F5**: `upload.onSuccess` (ImportsPage) nao invalidava
  `credit-cards`. Adicionado `credit-cards`, `monthly-cashflow`,
  `category-ranking`, `data-quality`.
- **"R$ R$ 80,97 no ciclo"**: `compactMoneyAbs` ja inclui "R$"; removido o prefixo
  duplicado no StageCard "Compra" (`CardsPage.tsx:487`).
- Reativei manualmente os 3 cartoes inativos no banco local.

### Filtro por mes em Cartoes — IMPLEMENTADO (competencia = fechamento, 2 datas)
Decisao do usuario: mes selecionado = mes de FECHAMENTO (competencia); mostrar 2
datas (compra + fatura).
- Backend `transactions.list_transactions`: novos params `invoice_from`/`invoice_to`
  filtram transacoes pela competencia `coalesce(closing_date, statement_month)` da
  fatura ligada (`source_file_id` -> `CreditCardStatement`). `TransactionRead` agora
  expoe `invoice_closing_date`/`invoice_due_date`/`invoice_month`, populados por um
  lookup das faturas das linhas da pagina.
- Frontend `CardsPage`: query usa `invoice_from`/`invoice_to` (do periodo) em vez de
  `date_from`/`date_to`; `CardTransactionList` mostra compra + "fatura mmm/aa"
  (`invoiceMonthLabel`). Tipo `TransactionRead` em `api.ts` ganhou os 3 campos.
- Validado ao vivo: GET com invoice de maio/2026 -> 95 (Visa, closing 13/05);
  junho -> 0. 90 testes backend + tsc frontend verdes.

### Corrigidos (sessao 2026-06-19, parte 2)
- **Total da fatura subcontava em Cartoes** (mostrava 5.021,65 em vez de 7.992,58):
  a query do cartao tem `limit=100` mas a fatura 2021_08 tem 149 transacoes, e o
  KPI somava so a pagina. Agora `cardExpenses` usa o agregado do servidor
  (`total_expense - total_income` = liquido da fatura). Verificado: 8.020,57 −
  27,99 = 7.992,58.
- **"R$R$ 8 mil"**: `compactMoneyAbs` SEMPRE inclui "R$" (via `money`), mas era
  usado junto de `<span class="cur">R$</span>` nos KPIs. Criado `compactValueAbs`
  (compacto SEM simbolo) e aplicado em TransactionExplorer (Entradas/Saidas/
  Resultado) e CardsPage (3 KPIs). `compactMoneyAbs` standalone permanece.

### Corrigidos (sessao 2026-06-19, parte 3) — datas mais claras
- **IOF** agora datado no FECHAMENTO da fatura (era vencimento) —
  `_itau_pdf_iof_charge` usa `_ITAU_PDF_CLOSING_RE` (fallback due). So afeta novos
  imports; reimportar para atualizar dados existentes.
- **Data exibida em Transacoes/Cartoes**: antes mostrava `payment_date` (vencimento
  calculado), colapsando tudo no mesmo dia (ex.: "tudo 30/07"). Agora:
  helpers `transactionLedgerDate` / `transactionLedgerDateNote` em utils.ts —
  compra avulsa mostra a DATA DA COMPRA; parcelada mostra a DATA DE FECHAMENTO da
  fatura com sub-nota "compra dd/mm/aa". Aplicado em `TransactionExplorer` (celula
  de data) e `CardsPage` (CardTransactionList; sub mostra a nota ou "fatura mmm/aa").
- Validado: IOF -> 13/05; ANGLO 2/10 -> compra 24/02, fechamento 13/05.

### RESOLVIDO — modelo de datas (3 lentes)
Decisao: cada tela responde uma pergunta com sua data propria.
- **Transacoes = consumo** (gasto no dia a dia). Filtro/ordem/exibicao pela DATA
  EFETIVA DE CONSUMO: compra avulsa = data da compra; parcela = data de fechamento
  da fatura (espalha as parcelas pelos meses em vez de lumpar). Backend: o filtro de
  data em `list_transactions` agora usa um `case` (installment -> closing via
  subquery correlacionada na statement; senao transaction_date). Antes usava
  `coalesce(payment_date, transaction_date)` (vencimento), que colapsava tudo no dia
  do vencimento ("tudo 30/07").
- **Cartoes = fatura** por competencia (fechamento) — `invoice_from/invoice_to`.
- **Dashboard = ja usava `transaction_date`** (data da compra); nada a mudar — ja
  mostra o gasto espalhado pelos dias.
- Validado: Visa fatura maio -> Transacoes mostra maio=10 (9 parcelas fech.13/05 +
  1 compra de maio), abril=35, marco=49 (compras reais nos dias). Cartoes (maio) ->
  95 (fatura inteira). 27 testes de rota + tsc + lint verdes.

### IMPLEMENTADO — Cartoes com SELETOR DE FATURA (decisao do usuario)
Para acabar com a confusao "navego em julho no painel e no cartao vira agosto"
(uma fatura atravessa o mes), Cartoes deixou de usar o filtro de mes global e passou
a ter um SELETOR DE FATURA.
- `CardsPage`: nova query `cardStatements` (getCreditCardStatements por
  credit_card_id); estado `selectedInvoiceId` (default = fatura mais recente);
  `selectedInvoice` com fallback para a 1a da lista. UI: `<select>` antes dos KPIs
  com rotulo "Fatura mmm/aa · fecha dd/mm · vence dd/mm · R$ total" (helpers
  `invoiceOptionLabel`/`monthYear`/`dayMonth`).
- Os lancamentos e KPIs do cartao agora filtram por `source_file_id` da fatura
  escolhida = conteudo EXATO da fatura (95 tx, total 18.073,38 no Visa). Cartao sem
  PDF (sem source_file) cai em credit_card_id; "todos os cartoes" mantem competencia
  por periodo.
- Modelo final de datas (3 lentes): Transacoes/Dashboard = consumo (data da compra);
  Cartoes = fatura (seletor de fatura); fluxo/vencimento separado.
- 33 testes (card+tx) + tsc + lint verdes.

### RESOLVIDO — datas de fechamento/vencimento (2026-06-20)
O "vence antes de fechar" NAO era o vencimento errado: o **vencimento (20/04) estava
correto**. O parser pegava como fechamento a linha **"Previsão próx. Fechamento: 13/05"**
(o fechamento do PROXIMO ciclo). Fix em `parsers.py`:
- `_itau_closing_match()` ignora "Fechamento" precedido de previs/prox/próx.
- `extract_itau_card_metadata`: `closing_day` vem de QUALQUER linha de Fechamento (o
  dia 13/22 e util), mas `closing_date` so de um Fechamento NAO-proximo (desta fatura).
- Resultado: Visa venc 20/04, closing_date None (nao mais 13/05), closing_day 13.
  Master closing_day 22. Esses PDFs so trazem o "proximo fechamento"; a data de
  fechamento DESTA fatura nao existe no texto -> None (honesto). 37 testes parser OK.
- IOF: `_itau_pdf_iof_charge` agora data no fechamento real se existir; senao ESTIMA
  pelo DIA de fechamento no mes da fatura (ex.: venc 20/04 + dia 13 -> IOF 13/04,
  junto com as compras do ciclo); fallback final = vencimento. Antes ficava 13/05
  (proximo fechamento), depois do proprio pagamento. Reimportar para corrigir dados
  ja importados (a Visa 2026_05 foi reimportada: IOF 13/04, pagamento 20/04).

## Dashboard 100% "A" (caixa/competencia de cobranca) — 2026-06-20
Antes: o GRAFICO (monthly_cashflow) datava cartao/parcela pela data de cobranca
(`_cashflow_date`), mas os KPIs/StoryStrip (`summary`) somavam por `transaction_date`
(data da compra) — parcela 12/18 caia em abr/2025 nos KPIs e em mai/2026 no grafico.
Fix: `summary()` agora soma por `_cashflow_date` (itera `_cashflow_transactions` +
filtro `_date_in_range`, igual ao grafico). Resultado: KPIs e grafico identicos
(ex.: expenses mai/2026 = 30.590,99 nos dois). Parcela conta no mes em que e cobrada;
some o efeito retroativo de uma fatura nova mexer num mes passado.
Testes: 176 passam (1 falha NAO relacionada: test_workspace_routes supabase JWT). ruff ok.

## Visualizacao de parcelas (Cartoes) — IMPLEMENTADO (2026-06-20)
Card "Compras parceladas · como vao caindo" em CardsPage:
- **Timeline proximos 6 meses**: barras com o total de parcelas que caem em cada mes.
- **Lista de compras parceladas ativas**: parcela atual/total, quantas faltam, valor
  restante, barra de progresso.
- Calculo CLIENT-SIDE a partir de `first_invoice_month`+`installment_total`+`amount`
  do endpoint `/dashboard/credit-card-installments` (o `remaining` do endpoint e
  ancorado na compra; recalculamos relativo ao mes-ancora). `instForecast` (useMemo).
- Card movido para o FIM da pagina Cartoes.
- Respeita os filtros: **cartao** (novo param `credit_card_id` no endpoint + servico,
  filtra por statements do cartao) e **periodo** (timeline ancora em `period.dateTo`).
- Layout da secao "Lancamentos/Gastos/Conciliacao" mudou de `dash-main` para
  `grid cols-3` (tres cards do mesmo tamanho).

### Observacoes / follow-ups
- IMPORTANTE (infra local): uvicorn `--reload` deixou processos zumbis segurando a
  porta 8006 (reloader pai+filho). Subir SEM `--reload` resolveu. Se o backend
  parecer rodar codigo antigo, matar a arvore do dono da porta 8006 e reiniciar.
- O banco LOCAL e **sqlite** (`backend/smart_cash_flow.db`), nao Postgres. Tipo
  `Uuid(as_uuid=False)` guarda hex SEM hifen; `.in_(<lista python>)` casa (rebind)
  mas comparar com strings literais com hifen NAO casa — usar subquery/coluna.
- `due_date`/`statement_month` da fatura Visa vieram errados do parse (due
  20/04/2026, esperado ~maio). A COMPETENCIA usa `closing_date` (13/05, correto),
  entao o filtro funciona; corrigir o parse de vencimento e um follow-up.
- UX: periodo default de Cartoes e o mes atual (junho); como so ha faturas que
  fecham em maio, abre vazio. Considerar default = ultimo mes com fatura.
- Limite de CREDITO ainda nao capturado no layout Visa (regex so achou "Limite de
  saque"). Total casa em modo plain.
- Scripts throwaway: `scripts/reset_and_reimport_visa.py` (reset+reimport+verifica
  competencia), `probe_real_statement.py`, `repro_card_register.py`,
  `repro_reimport_deleted_card.py`.

### Notas de parsing (secundario)
- Em modo `plain` o total casa ("Total desta fatura 18.073,38"); `total=None` so
  aparece se forcar modo `layout` (palavras coladas). Nao e bug do fluxo real.
- Limite de CREDITO ainda nao capturado no layout Visa (so achou "Limite de saque
  2.500,00" e "Limite total utilizado"); regex `_ITAU_PDF_LIMIT_RE` nao casou.
- Scripts de diagnostico (throwaway): `scripts/probe_real_statement.py`,
  `scripts/repro_card_register.py`, `scripts/repro_reimport_deleted_card.py`.

## Requisitos Funcionais

### RF-001: Parser de fatura Itau

Identificar cartao pelo PDF; extrair transacoes (debito/credito/pagamento) com
data, descricao, valor positivo + direcao, parcela atual/total.

### RF-002: Comprometimento futuro

A partir da parcela cobrada (ex.: 3/10), derivar para cada mes-fatura seguinte a
parcela correspondente e o valor futuro, sem persistir linhas projetadas.

### RF-003: Gestao de cartoes no frontend

Listar apenas ativos; editar via duplo-clique; excluir via soft-delete.

### RF-004: Preview de import em lote

Mostrar por arquivo: status, contagens (validas/duplicadas/erros) e tabela
expansivel de transacoes com marcacao de duplicadas.

## Requisitos Nao Funcionais

### Seguranca
- Endpoints autenticados e filtrados por `workspace_id`.
- Identidade do cartao sempre derivada do conteudo do PDF, nunca do nome do arquivo.

### Testes e PBT
- `extract_installment` cobre parcela com/sem separador e codigos de comerciante.
- Reconciliacao de total tolera arredondamento de centavos.
- Derivacao de parcela por mes-fatura deve ser deterministica.

## Validacao (checklist)

- [x] `pytest tests/test_parsers.py` — 37 passam (2026-06-19).
- [x] `scripts/validate_future_installments.py` deriva 4/10..10/10 de uma unica 3/10.
- [ ] Suite completa do backend (`pytest`) verde no escopo alterado.
- [ ] `ruff check` no escopo alterado.
- [ ] `npm run lint` e `npm run build` no frontend.
- [ ] Validacao manual com PDF real: cartao auto-registrado com limite correto,
      parcelas futuras aparecendo na proxima fatura do dashboard.
- [ ] Smoke local: backend 8006 + frontend 5173 (ambos de pe em 2026-06-19).

## Pontos de Verificacao no Codigo

- `backend/app/services/parsers.py`: `extract_itau_card_metadata`,
  `parse_itau_credit_card_statement_text`, `_itau_pdf_total_reconciliation`.
- `backend/app/services/import_service.py`: dedupe posicional + auto-registro.
- `backend/app/services/dashboard_service.py`: `credit_card_installments`,
  `_credit_card_installments_due`, `get_installment_for_target_month`.

## Definition of Done

- Bloco nao commitado revisado e commitado (sugestao: separar parser backend /
  cards delete / imports preview).
- Suite focada + lint + build verdes.
- Validacao manual com PDF real registrada neste arquivo.
- `aidlc-state.md` atualizado para este pacote.
