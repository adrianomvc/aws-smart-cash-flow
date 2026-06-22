# Plano de Execucao: Redesign UX da tela de Transacoes

## Estado AI-DLC
- **Fase**: CONSTRUCTION / Code Generation
- **Pacote**: Redesign UX de Transacoes (de "formulario de filtros" para central de revisao)
- **Branch**: `feature/evolve-from-ci126`

## Objetivo
Transformar a tela de Transacoes (`TransactionExplorer.tsx`, ~1640 linhas, 30+ estados)
numa central clara orientada a intencao: encontrar, revisar pendencias, tratar
duplicados — com menos poluicao e melhor mobile. Diagnostico completo no historico
da sessao (16 entregaveis).

## Problemas-chave
- Filtros por campo tecnico, nao por intencao; painel auto-abre e polui.
- Sem chips de filtros ativos (existe `transactionFilterSummary`, nao exibido).
- Taxonomia de status sobreposta (aba "A revisar" + filtro Revisao + Categorizado por=Sem categoria + coluna Status).
- Tabela de 11 colunas; mobile so com scroll horizontal.
- Categorizar custa cliques; sem fluxo de revisao 1-a-1.

## Fases
### Fase 1 — Quick wins (CONCLUIDA 2026-06-20, tsc+lint verdes)
- [x] Filtros avancados em PAINEL INLINE EM GRADE abaixo da toolbar (NAO drawer — o usuario
      quis ver a lista aplicando ao vivo). Abre so no clique em "Filtros" (sem auto-abrir).
      Layout: secoes (Categoria/Categorizacao/Origem/Periodo/Valor) em grid auto-fit, campos
      verticais (label + controle full-width). (Tentei drawer antes; revertido a pedido.)
- [x] Chips de filtros ATIVOS removiveis (`activeChips`) + "Limpar tudo".
- [x] Chips de filtros RAPIDOS (toggle): Sem categoria, A revisar, So cartao.
- [x] Estado vazio com acao ("Limpar filtros") quando ha filtros ativos.
- [x] `clearFilters` agora tambem limpa `sourceFileId` e `dateField`.
- [ ] (segue) Resumo do resultado no topo — KPIs ja existem; avaliar reforco na Fase 2.

Nao mexeu na logica de query nem no drilldown/reviewMode. Classe `.chip` reaproveitada.

**Alinhamento final (2026-06-20):** removida a duplicacao entre chips rapidos e chips ativos —
`Sem categoria` (catSource=__none__) e `So cartao` (sourceType=cc) so aparecem como chip rapido
(nao repetem como chip ativo). Removido o chip rapido "A revisar" (a aba "A revisar" ja cobre).
Chips rapidos finais: **Sem categoria · So cartao**.

### Fase 2 — Estruturais (em andamento)
- [x] **Lista em cards no mobile** (2026-06-20): hook `useIsMobile` (matchMedia max-720px) +
      componente `TransactionCard` (checkbox seleciona, toque abre o detalhe em drawer,
      categoria editavel inline via `CategoryPicker`, badge "Sem categoria"). Render ramifica
      tabela (desktop) / cards (mobile). CSS `.tx-card`/`.tx-card-list` em styles.css.
      Barra de selecao em massa e paginacao ja funcionam (wrap). tsc+lint verdes.
- [x] **Reduzir colunas + detalhe no drawer** (2026-06-20): tabela desktop de 11 → 6 colunas
      (checkbox, Data/Fatura, Descrição, Categoria, Conta, Valor, ações). Categoria virou UM
      seletor (`CategoryPicker`, antes `CategoryCells` em 2 colunas — removido, -50 linhas);
      Conta+Origem fundidos numa célula (conta + pill do tipo); parcela e "Sem categoria"
      viraram badges na Descrição (saíram as colunas Subcategoria/Origem/Parcela/Status). O
      drawer de detalhe (já completo) ganhou Conta/Cartão e Fatura (fecha/vence). tsc+lint verdes.
- [x] **Duplicados como MODO** (2026-06-20): ao ativar, esconde KPIs, barra de filtros, seleção,
      tabela e footer — mostra só o painel de duplicados (botão btn-primary quando ativo). Não
      empilha mais sobre a lista. **Contas** virou DRAWER (`SimpleDrawer`). As sub-visões da lista
      (Todas/Entradas/Saídas/A revisar) seguem nas abas. Falta o "Modo Revisar 1-a-1" (Fase 3).
- [ ] Extrair `useTransactionFilters()`.

### Redesign da busca/filtros (barra unica com chips) — A→B→C→D
- [x] **Passo A — busca inteligente** (2026-06-20): dropdown de sugestoes no campo de busca.
      A busca textual continua ao vivo (debounce -> `q`); o dropdown oferece filtros
      estruturados que o usuario CLICA pra aplicar (sem parsing automatico arriscado):
      Valor a partir/ate (quando o texto e numero), Categoria (match por nome), atalhos
      "Sem categoria" e "So cartao". Aplica e some via onBlur. Estado `searchOpen`.
- [x] **Passo B** (2026-06-20) — Período em dropdown de presets (Mês atual/passado, Últimos 30/90d,
      Este ano, Personalizado) via `PERIOD_OPTIONS`/`rangeForPreset`/`applyPeriodPreset`; toggle
      compra/fatura embutido no bloco de Período.
- [x] **Passo C** (2026-06-20) — barra de filtros com **chips que contêm o próprio controle**.
      Cada filtro (Categoria/Conta/Tipo/Bandeira/Fatura/Valor/Categorização/Revisão) aparece como
      `.fbox` (label + controle + ✕) quando tem valor ou foi adicionado via **"+ Filtro"** (select
      lista os ausentes). **Removidos**: botão "Filtros", painel inline grande, chips rápidos e o
      bloco `activeChips`. `addedFilters` controla o que está visível.
- [x] **Passo D** (2026-06-20) — **visões salvas** em localStorage (`scf-tx-views`): "Salvar visão"
      captura o snapshot dos filtros; aparecem como chips ★ (clicar aplica, ✕ apaga). `applyView`.
      Limpezas: removidos `showFilters`, `subcategoryOptions`, estilos do drawer, import `periodRange`.
      CSS `.fbox`/`.fbox-lbl`/`.fbox-x`. tsc+lint verdes.

### Fase 3 — Automacao/inteligencia
- [x] **Modo Revisar 1-a-1** (2026-06-20): botao "Revisar 1 a 1" entra num modo focado (esconde
      KPIs/filtros/tabela). Fila = `category_review_status=queue` (sem categoria ou sugestao
      pendente). Mostra UMA transacao por vez (card grande: descricao, valor, data, conta) com
      `CategoryPicker` em destaque; ao categorizar, refetch da fila (item sai, proximo aparece).
      Anterior/Pular + atalhos de teclado ← →. Estado vazio "Tudo revisado".
      Paginação: busca 100 por lote (limite da API) mas mostra o TOTAL real ("X de N a revisar")
      e avança/volta lotes via offset (`reviewOffset`); categorizar recarrega do início.
- [x] **"Criar regra / aplicar a parecidas"** (2026-06-20): no modo Revisar, após categorizar,
      botao "Criar regra (aplicar a parecidas)" abre o `RuleFromTxModal` existente para a transacao
      atual — aplica a mesma categoria a lancamentos parecidos via regra.

### Verificacao final (2026-06-20)
- `npm run build` (tsc -b + vite build) PASSOU — 3084 modulos; so o aviso usual de chunk >500kB.
- Vite HMR sem erros; backend health 200; endpoint review-queue OK.
- Redesign de Transacoes considerado COMPLETO (todos os itens de UX/produto entregues e verificados).

### Datas em Transacoes alinhadas ao Dashboard (2026-06-20)
- Filtro de periodo agora SEMPRE por data da FATURA (cobranca) — backend `date_field`
  default = "fatura"; removido o toggle "por compra / por fatura" (mais simples,
  consistente com o Dashboard 100% A).
- Removido o rotulo "por data da fatura" do bloco de periodo (desnecessario).
- Periodo "Personalizado" agora usa um **range calendar estilo Decolar**
  (`DateRangePicker`): clica inicio -> fim, intervalo destacado, nao deixa escolher
  fim antes do inicio. Substitui os dois inputs nativos. Icone `calendar` adicionado.

### Categorizar em grupo (por comerciante) — 2026-06-20
- Backend: `GET /v1/transactions/uncategorized-groups` agrupa lancamentos DEBIT sem
  categoria por descricao normalizada -> `[{key, sample_description, count, total, ids[]}]`
  ordenado por count/total.
- Frontend: novo MODO "Categorizar em grupo" (botao ao lado de "Revisar 1 a 1"), exclusivo
  com Duplicados/Revisar. Tabela: comerciante · nº · total · seletor de categoria; escolher
  aplica em TODOS os ids do grupo (`categorizeGroup` mutation) e recarrega os grupos.
- Fluxo ideal: grupo zera a maioria -> Revisar 1 a 1 para os casos unicos.
- Colunas do grupo ordenaveis por clique (Comerciante/Lancamentos/Total).
- Checkbox "Criar regra para futuras" (default ON): ao categorizar um grupo, alem de
  aplicar nos atuais, cria uma regra `contains` (3 primeiras palavras do comerciante ->
  categoria) via `createRule`, para auto-categorizar importacoes futuras. `ruleTokens()`.
- Paginacao server-side (endpoint ganhou offset + sort_by/sort_dir + q + amount_min/max):
  controles Anterior/Proxima + seletor 25/50/100 por pagina (igual a lista). Ordenacao por
  clique no titulo (server-side). Teto de ids por grupo = 500.
- A BUSCA e o filtro de VALOR agora tambem filtram os modos Grupo e Revisar 1 a 1
  (queries passam q + amount_min/max; pagina/indice reiniciam ao mudar).
- (Obs.: a aplicacao itera updateTransactionCategory por id; grupos grandes podem demorar —
  futura otimizacao: endpoint bulk de categorizacao.)

### Normalizacao p/ agrupar (2026-06-21)
Objetivo: tirar ruido do FIM que fragmenta o agrupamento de recorrentes/parceladas.
Feito em `_normalize_transaction_description` (parsers.py), 80 testes verdes:
- Remove "PARC NN" / "PARCNN" no fim (`_drop_trailing_parc_suffix`).
- Remove data colada a palavra no fim, ex.: "DINALVA22/05" (`_drop_trailing_date_suffix`,
  so quando grudada a letra — mantem "LOJA 11/10" do teste).
- Descarta digitos longos so quando ISOLADOS (antes do split letra/digito); digitos
  colados a letras passam a ser preservados.
FEITO depois (2026-06-21), 37 testes parser verdes:
- DATA = data da transacao: `normalize_transaction_description(raw, transaction_date)` recebe
  a data; `_drop_trailing_date_suffix` remove "DD/MM" final se bater com a data da transacao
  (ou se grudado a letra); mantem "LOJA 11 10" quando NAO e a data. Threaded no parser Itau
  (~1113) e no re-normalizar (transactions.py:976, usa transaction.transaction_date).
- PARC -> parcela: `extract_installment` detecta "PARC N" -> (N, None) e "PARC N/M" -> (N,M).
  Total None quando so ha N (sem projecao/X-de-M ate ter o M).
Pendente/decisao do usuario:
- PLACA (EWR2311 em "IPVA-SPEWR2311"): ainda removida por `_drop_trailing_pos_code` + alias
  `"INT": ()`. Usuario quer AVALIAR impacto antes (ver outras transacoes). Trade-off: manter =
  legibilidade/+grupos; dropar = melhor bulk categorize. EM ABERTO.
- Aplicar a dados existentes: rodar "Normalizar descricoes" (re-normaliza usando a data).

### Pendente (so refactor tecnico, sem ganho visual)
- [ ] Extrair `useTransactionFilters()` — alto risco de regressao, baixa prioridade. Deixar por ultimo.
      NAO feito de proposito: a tela acabou de mudar muito; refatorar 30+ estados agora so adiciona
      risco sem mudanca visivel. Fazer apenas quando for mexer estruturalmente na tela de novo.

## Arquivos
- `frontend/src/pages/TransactionExplorer.tsx` (principal)
- `frontend/src/pages/ImportsPage.tsx` (`TransactionsPage` wrapper)
- `frontend/src/lib/utils.ts` (`transactionFilterSummary` -> chips)
- `frontend/src/components/ui.tsx` (novos: chips, cards)
- `frontend/src/styles.css`
- `frontend/src/hooks.ts` (`useTransactionFilters` na Fase 2)
- Backend: nada na Fase 1 (filtros ja existem na API).

## Riscos
- Componente enorme e acoplado (30+ estados) — refatorar (Fase 2) com risco de regressao; Fase 1 so reorganiza UI.
- Preservar `drilldown` (`key={drilldownKey}` + initial*) e `reviewMode`.
- Acessibilidade do drawer (foco/ESC).

## Criterios de Aceite (Fase 1)
- Filtros avancados nao aparecem por padrao (so no drawer).
- Ver os filtros ativos como chips e remover individualmente.
- Estado vazio oferece "Limpar filtros".
- Lint + tsc verdes; drilldown e reviewMode intactos.
