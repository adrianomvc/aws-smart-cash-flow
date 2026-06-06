# Auditoria Visual US-056 — Hierarquia Consistente

Data: 2026-06-06

## Resumo

| Área | Status | Severidade |
|------|--------|------------|
| Loading states | Principalmente OK — 2 exceções | Baixa |
| Empty states | Consistente | — |
| Error states | Inconsistente — 2 páginas silenciosas | Alta |
| Cards/métricas | Misto — 3 páginas com divs customizadas | Média |
| Ações destrutivas | Inconsistente — CategoriesPage sem confirm | Alta |
| Badges | Consistente — 1 exceção pontual | Baixa |

---

## Detalhamento

### 1. Loading states

**Problema:** ImportsPage usa `div.loading-state` inline; PlanningPage usa `PageState` sem `compact`.

Correções:
- `ImportsPage` `ActiveAccountsPanel` linha 76: trocar `<div className="loading-state">` por `<PageState icon={Loader2} label="Carregando contas..." compact />`
- `PlanningPage` linha 66: adicionar `compact` ao `PageState` de seção

---

### 2. Error states

**Problema (alta):** DashboardPage e CashflowPage não exibem nenhum feedback quando queries de API falham. Usuário vê tela em branco sem saber o motivo.

Correções:
- `DashboardPage`: adicionar `InlineError` condicional nas queries de `summary`, `cashflow`, `ranking`, `recurring`, `quality` quando `isError === true`
- `CashflowPage`: idem para queries principais

---

### 3. Cards e métricas

**Problema:** DashboardPage, CategoriesPage e SettingsPage criam cards com `div` inline em vez de usar `MetricCard`.

Correções:
- `DashboardPage` hero-cards (linhas 588-603): avaliar migração para `MetricCard` ou manter `div.hero-card` se o layout do hero precisar de CSS próprio
- `CategoriesPage` linhas 163-167: trocar `div.transaction-summary-card` por `MetricCard`
- `SettingsPage` linhas 117-137: trocar `div.transaction-summary-card` por `MetricCard`

---

### 4. Ações destrutivas sem confirmação

**Problema (alta):** CategoriesPage deleta categoria (linha 192) e regra (linha 283) diretamente via `remove.mutate()` sem `window.confirm`. Risco de exclusão acidental.

Correções:
- `CategoriesPage` linha 192: adicionar `if (window.confirm('Excluir categoria...?'))` antes de `remove.mutate(c.id)`
- `CategoriesPage` linha 283: idem para regra

---

### 5. Badges

**Problema:** `TransactionExplorer` linha 192 usa `<span className="status-badge ...">` inline em vez do componente `StatusBadge`.

Correção:
- Trocar span inline por `<StatusBadge status={...} label={...} />`

---

## Ordem de implementação sugerida

1. Ações destrutivas sem confirm — CategoriesPage (alta, baixo risco, 2 linhas)
2. Error states invisíveis — DashboardPage e CashflowPage (alta, médio risco)
3. Cards com div customizada — CategoriesPage e SettingsPage (média, baixo risco)
4. Loading state — ImportsPage e PlanningPage (baixa, baixo risco)
5. Badge inline — TransactionExplorer (baixa, baixo risco)
