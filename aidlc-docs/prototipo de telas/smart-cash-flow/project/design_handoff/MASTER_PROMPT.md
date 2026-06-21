# MASTER PROMPT — Implantar protótipo completo no SmartCashFlow

> Cole este prompt no Claude Desktop com o MCP filesystem apontando para a pasta `aws-smart-cash-flow/`.
> Execute **um bloco por vez**, na ordem indicada. Aguarde confirmação antes de avançar.

---

## CONTEXTO OBRIGATÓRIO (execute primeiro)

```
Você vai implantar o design completo do protótipo SmartCashFlow no projeto React/TypeScript.

Leia estes arquivos de referência ANTES de qualquer modificação:

PROTÓTIPO VISUAL (fonte da verdade visual):
- design_handoff/prototype_screens/styles.css          → design system completo
- design_handoff/prototype_screens/app.jsx             → shell, sidebar, header, router
- design_handoff/prototype_screens/data.js             → estrutura de dados e categorias
- design_handoff/prototype_screens/charts.jsx          → componentes de gráficos

REPO ATUAL (o que existe):
- frontend/src/App.tsx                  → shell atual
- frontend/src/lib/api.ts               → todas as funções de API disponíveis
- frontend/src/types.ts                 → tipos TypeScript
- frontend/src/components/ui.tsx        → componentes UI atuais

COMPONENTES COMPARTILHADOS GERADOS:
- design_handoff/inject/proto-ui.tsx    → componentes TypeScript do protótipo
- design_handoff/inject/scf-design-system.css → CSS do protótipo

Confirme que leu todos os arquivos antes de continuar.
```

---

## BLOCO 1 — Design System CSS

```
Leia:
- design_handoff/prototype_screens/styles.css   (CSS completo do protótipo)
- design_handoff/inject/scf-design-system.css   (versão portada)
- frontend/src/styles.css                        (CSS atual do repo)

Tarefa:
1. SUBSTITUA o conteúdo de frontend/src/styles.css pelo conteúdo de
   design_handoff/inject/scf-design-system.css
2. Preserve qualquer classe exclusiva do repo atual que NÃO exista no
   arquivo novo (verifique antes de deletar)
3. Copie as imagens de design_handoff/prototype_screens/assets/ para
   frontend/src/assets/ (logo e ícone)
4. Adicione o import de fontes no frontend/index.html:
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## BLOCO 2 — Componentes compartilhados

```
Leia:
- design_handoff/inject/proto-ui.tsx
- frontend/src/components/ui.tsx

Tarefa:
1. Crie o arquivo frontend/src/components/proto-ui.tsx com o conteúdo de
   design_handoff/inject/proto-ui.tsx
2. NÃO delete o ui.tsx atual — mantenha ambos
3. Verifique se todos os imports de proto-ui.tsx estão corretos para o projeto
```

---

## BLOCO 3 — App Shell (sidebar + header)

```
Leia:
- design_handoff/prototype_screens/app.jsx      (shell do protótipo — seções AppShell, Sidebar, Header)
- frontend/src/App.tsx                          (shell atual)

O protótipo tem:
- Sidebar dark navy (var(--side-bg) = #0b1020) com 256px de largura
- Logo no topo: frontend/src/assets/logo-smartcash-flow-main.png
- Grupos de nav: Analisar / Planejar / Evoluir / Operar
- Item ativo: gradiente verde+azul no fundo, borda esquerda verde
- Badge "em breve" nos itens desabilitados
- Rodapé: workspace name + botão logout
- Header: título da página + período picker + sino de notificações
- Mobile: menu hambúrguer que abre sidebar como overlay

Tarefa:
Atualize o AppShell e sidebar no frontend/src/App.tsx para ter EXATAMENTE
o visual do protótipo. Use as CSS classes do styles.css novo:
.side, .side-brand, .nav-item, .nav-item.active, .nav-badge,
.nav-group, .nav-label, .side-foot, .ws-switch
```

---

## BLOCO 4 — Dashboard

```
Leia:
- design_handoff/prototype_screens/screen_dashboard.jsx   (visual completo)
- design_handoff/inject/DashboardPage.tsx                 (versão TypeScript gerada)
- frontend/src/pages/DashboardPage.tsx                    (atual)
- frontend/src/lib/api.ts                                 (funções disponíveis)

Substitua frontend/src/pages/DashboardPage.tsx pelo conteúdo de
design_handoff/inject/DashboardPage.tsx.

Ajuste os imports se necessário para o caminho correto.
Teste que não há erros de TypeScript antes de confirmar.
```

---

## BLOCO 5 — Fluxo de Caixa

```
Leia:
- design_handoff/prototype_screens/screen_cashflow.jsx
- frontend/src/pages/CashflowPage.tsx
- frontend/src/lib/api.ts

O protótipo tem:
- 4 KPIs: Receitas, Despesas, Saldo, Saving rate (com ProvBadge)
- Seletor de período: M0 / M-1 / 3M / 1A / 📅 custom
- Gráfico de área (Recharts AreaChart): receitas vs despesas 12 meses
- Card "Categorias de maior impacto" com expansão de subcategorias
  (mesmo componente TopCats do Dashboard)
- Card Sankey simplificado (pode usar tabela de fluxo se Sankey for complexo)

API calls:
- getDashboardSummary(session, query)
- getMonthlyCashflow(session, query)
- getCategoryRanking(session, query)
- getSubcategoryRanking(session, query)

Reescreva o CashflowPage.tsx com este visual EXATO.
```

---

## BLOCO 6 — Transações

```
Leia:
- design_handoff/prototype_screens/screen_transactions.jsx
- frontend/src/pages/ImportsPage.tsx   (contém TransactionsPage)
- frontend/src/lib/api.ts

O protótipo tem:
- Barra de busca + filtros (período, categoria, direção, origem)
- Tabela com colunas: data, descrição, origem, categoria (badge colorido), valor, direção
- Linha clicável: abre drawer lateral com detalhes
- Drawer: descrição raw, data, valor, categoria editável (dropdown)
- Paginação
- Badge de proveniência por transação
- Destaque de duplicatas (badge vermelho)

API calls:
- getTransactions(session, query)
- getCategories(session)
- updateTransactionCategory(session, id, categoryId)

Reescreva a TransactionsPage com este visual.
```

---

## BLOCO 7 — Importações

```
Leia:
- design_handoff/prototype_screens/screen_transactions.jsx  (seção imports)
- frontend/src/pages/ImportsPage.tsx
- frontend/src/lib/api.ts

O protótipo tem:
- Drop zone de upload com drag-and-drop
- Lista de importações: nome arquivo, data, status badge, contadores
- Status badges: completed (verde), completed_with_errors (âmbar), failed (vermelho), duplicate_file
- Clique no import: expande erros por linha
- Botão "Aplicar regras" global
- Preview antes de confirmar upload

API calls:
- getImports, uploadImport, previewImport, deleteImport, applyRules

Reescreva ImportsPage mantendo toda a funcionalidade atual.
```

---

## BLOCO 8 — Categorias + Regras

```
Leia:
- design_handoff/prototype_screens/screen_categories.jsx
- frontend/src/pages/CategoriesPage.tsx

O protótipo tem para Categorias:
- Grid de categorias com cor (dot colorido) e contagem de transações
- Botão "Nova categoria" → modal inline
- Subcategorias indentadas abaixo da categoria pai
- Edição inline do nome

Para Regras:
- Tabela: nome, campo, tipo match, padrão, categoria destino, prioridade, ativo
- Toggle ativo/inativo inline
- Botão "Nova regra" → formulário expansível
- Botão "Aplicar todas as regras"
- Preview de impacto por regra (quantas transações afeta)

Reescreva CategoriesPage.tsx, RulesPage e ReviewPage com este visual.
```

---

## BLOCO 9 — Calendário

```
Leia:
- design_handoff/prototype_screens/screen_planmisc.jsx  (seção Calendar)
- frontend/src/pages/CalendarPage.tsx

O protótipo tem:
- Grade mensal clássica (7 colunas, semanas)
- Eventos coloridos por tipo: income (verde), expense (vermelho), card_payment (azul)
- Lateral: lista do dia selecionado
- Botão "Novo evento" → modal
- Navegação mês anterior / próximo
- Resumo semanal: total entradas vs saídas da semana

API: getCalendarEvents, createCalendarEvent

Reescreva CalendarPage com este visual.
```

---

## BLOCO 10 — Cartões

```
Leia:
- design_handoff/prototype_screens/screen_cards.jsx
- frontend/src/pages/CardsPage.tsx

O protótipo tem:
- Cards de cartão com gradiente (cor por emissor)
- Mostra: nome, últimos 4 dígitos, data fechamento, data vencimento, limite
- Barra de utilização do limite
- Lista de faturas por cartão
- Aba Parcelas: tabela de parcelas ativas com valor futuro
- Botão "Novo cartão" → modal

API: getCreditCards, getCreditCardStatements, getCreditCardInstallments

Reescreva CardsPage com este visual.
```

---

## BLOCO 11 — Orçamentos

```
Leia:
- design_handoff/prototype_screens/screen_planmisc.jsx  (seção Budgets)
- frontend/src/pages/BudgetsPage.tsx

O protótipo tem:
- Cards de orçamento por categoria
- Barra de progresso: real vs planejado (verde < 85%, âmbar 85–100%, vermelho > 100%)
- Valor gasto vs limite
- Alerta quando próximo do limite
- Modal "Novo orçamento": nome, categoria, período, limite, alerta %

Reescreva BudgetsPage com este visual.
```

---

## BLOCO 12 — Metas

```
Leia:
- design_handoff/prototype_screens/screen_planmisc.jsx  (seção Goals)
- frontend/src/pages/GoalsPage.tsx

O protótipo tem:
- Cards de meta com ícone, nome, progresso (barra + %)
- Valor atual / valor alvo / prazo
- Status: active (azul), paused (cinza), completed (verde)
- Modal "Nova meta": nome, descrição, valor alvo, valor atual, prazo, prioridade
- Botão de atualizar valor atual

Reescreva GoalsPage com este visual.
```

---

## BLOCO 13 — Planejamento

```
Leia:
- design_handoff/prototype_screens/screen_planmisc.jsx  (seção Planning)
- frontend/src/pages/PlanningPage.tsx

O protótipo tem:
- 3 horizontes: 30 / 60 / 90 dias com KPIs (receita projetada, despesa, saldo)
- Risk level badge: low/medium/high
- Lista de eventos futuros
- Lista de metas próximas do prazo
- Pressupostos listados

API: getPlanningProjection, getProjectionFeed

Reescreva PlanningPage com este visual.
```

---

## BLOCO 14 — Relatórios

```
Leia:
- frontend/src/pages/ReportsPage.tsx
- frontend/src/lib/api.ts  (getReports)

O protótipo tem cards de relatório com:
- Ícone + título + descrição
- Métrica primária e secundária em destaque
- Status badge
- Link para a página destino

Reescreva ReportsPage com este visual usando os dados de getReports.
```

---

## BLOCO 15 — Configurações (Settings + mobile)

```
Leia:
- design_handoff/prototype_screens/screen_account.jsx
- design_handoff/prototype_screens/screen_settings_panels.jsx
- frontend/src/pages/SettingsPage.tsx

O protótipo tem:
DESKTOP: sidebar 240px sticky + painel de conteúdo à direita
MOBILE (≤880px): lista de itens com chevron → toque abre painel → botão "← Configurações"

Painéis:
- Perfil: nome, email, avatar
- Segurança: troca senha
- Preferências: moeda, dia início mês, tema claro/escuro
- Categorias: atalho
- Regras: atalho
- Contas e Bancos: lista com status de conexão
- Importação: config parsers
- Notificações: toggles
- Backup: export JSON
- Assinatura: planos
- Sobre: versão

Reescreva SettingsPage com navegação mobile iOS completa.
```

---

## BLOCO 16 — Verificação final

```
Após todos os blocos anteriores, faça uma verificação completa:

1. Leia frontend/src/App.tsx e confirme que todas as 14 rotas existem:
   dashboard, cashflow, transactions, calendar, cards, budgets,
   goals, planning, reports, imports, categories, rules, review, settings

2. Verifique que cada página importa os componentes de proto-ui.tsx corretamente

3. Verifique que não há erros de TypeScript nos arquivos modificados

4. Confirme que frontend/src/styles.css tem os tokens CSS (--bg, --acc, --neg, etc.)

5. Confirme que frontend/index.html tem o import das fontes Sora + JetBrains Mono

6. Reporte qualquer erro ou componente faltando.
```

---

## DICAS IMPORTANTES

- Sempre leia o arquivo de protótipo (`.jsx`) e o arquivo atual do repo ANTES de editar
- Use `var(--acc)`, `var(--neg)`, `var(--info)` para cores — nunca hex direto
- Use `var(--font-display)` para títulos e valores numéricos grandes
- Use `var(--font-mono)` para valores monetários tabulares
- Todos os valores monetários: `R$ X.XXX` com separador pt-BR
- Toda API call usa `useQuery` do TanStack Query com `staleTime: 3 * 60 * 1000`
- Endpoints que não existem ainda: mostre estado vazio elegante (não lance erro)
- Mobile-first: teste sempre com viewport ≤ 480px em mente
