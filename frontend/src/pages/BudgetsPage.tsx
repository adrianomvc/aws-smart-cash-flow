import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDownCircle, Gauge, Loader2, Percent, PiggyBank, Plus } from "lucide-react";

import {
  createBudget,
  getBudgets,
  getCategoryRanking,
  getDashboardSummary,
} from "../lib/api";
import {
  apiErrorMessage,
  commitmentTone,
  formatPercentNumber,
  moneyAbs,
  orderedCategoryOptions,
  percent,
  periodRange,
  withQueryParams,
} from "../lib/utils";
import { useCategories, usePeriod } from "../hooks";
import {
  DashboardSectionHeader,
  EmptyInline,
  InlineError,
  MetricCard,
  PageState,
  Panel,
  PeriodFilter,
  QualityRow,
} from "../components/ui";
import type { ApiSession, BudgetRead, CategoryRankingItem, CategoryRead } from "../lib/api";
import type { PeriodState, TransactionDrilldown } from "../types";
import { categoryPath } from "../lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBudgetRows(items: CategoryRankingItem[]) {
  return items.slice(0, 8).map((item, index) => {
    const spent = Number(item.amount ?? 0);
    const multiplier = [1.18, 1.05, 0.92, 1.28, 1.12, 0.88, 1.2, 1.1][index] ?? 1.1;
    const limit = Math.max(100, Math.round((spent * multiplier) / 10) * 10);
    return {
      categoryId: item.category_id,
      categoryName: item.category_name,
      limit,
      ratio: spent / Math.max(limit, 1),
      spent,
    };
  });
}

function buildPersistedBudgetRows({
  budgets,
  categories,
  ranking,
}: {
  budgets?: BudgetRead[];
  categories: CategoryRead[];
  ranking: CategoryRankingItem[];
}) {
  if (!budgets?.length) return [];
  const spentByCategory = new Map(ranking.map((item) => [item.category_id, Number(item.amount ?? 0)]));
  const categoryNames = new Map(categories.map((category) => [category.id, categoryPath(category, categories)]));
  return budgets.map((budget) => {
    const spent = budget.category_id ? spentByCategory.get(budget.category_id) ?? 0 : 0;
    const limit = Number(budget.limit_amount);
    return {
      categoryId: budget.category_id,
      categoryName: budget.category_id ? categoryNames.get(budget.category_id) ?? budget.name : budget.name,
      limit,
      ratio: spent / Math.max(limit, 1),
      spent,
    };
  });
}

function budgetTone(ratio: number): "negative" | "positive" | "warning" {
  if (ratio > 1) return "negative";
  if (ratio >= 0.85) return "warning";
  return "positive";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function BudgetsPage({
  onOpenTransactions,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [budgetPeriod, setBudgetPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [budgetForm, setBudgetForm] = useState(() => {
    const range = periodRange("current_month");
    return {
      categoryId: "",
      limitAmount: "",
      name: "",
      periodEnd: range.dateTo,
      periodStart: range.dateFrom,
    };
  });
  const queryClient = useQueryClient();
  const period = usePeriod(budgetPeriod, setBudgetPeriod);
  const ranking = useQuery({
    queryKey: ["budgets-category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const persistedBudgets = useQuery({
    queryKey: ["budgets", session.token, period.query],
    queryFn: () => getBudgets(session, period.query),
  });
  const categories = useCategories(session);
  const createBudgetMutation = useMutation({
    mutationFn: () =>
      createBudget(session, {
        category_id: budgetForm.categoryId || null,
        limit_amount: budgetForm.limitAmount,
        name: budgetForm.name,
        period_end: budgetForm.periodEnd,
        period_start: budgetForm.periodStart,
      }),
    onSuccess: () => {
      setBudgetForm((current) => ({ ...current, categoryId: "", limitAmount: "", name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
  const summary = useQuery({
    queryKey: ["budgets-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedRows = buildPersistedBudgetRows({
    budgets: persistedBudgets.data?.items,
    categories: categories.data?.items ?? [],
    ranking: ranking.data?.items ?? [],
  });
  const rows = persistedRows.length ? persistedRows : buildBudgetRows(ranking.data?.items ?? []);
  const overBudget = rows.filter((row) => row.ratio > 1).length;
  const nearLimit = rows.filter((row) => row.ratio >= 0.85 && row.ratio <= 1).length;
  const totalBudget = rows.reduce((total, row) => total + row.limit, 0);
  const totalSpent = rows.reduce((total, row) => total + row.spent, 0);

  return (
    <section className="page-stack">
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <PeriodFilter
          dateFrom={period.dateFrom}
          dateTo={period.dateTo}
          periodPreset={period.periodPreset}
          onPreset={period.setPeriodPreset}
          onDateFrom={period.setDateFrom}
          onDateTo={period.setDateTo}
        />
      </div>
      <div className="metric-grid executive">
        <MetricCard icon={PiggyBank} label="Orçado" value={moneyAbs(totalBudget)} helper="Limites iniciais sugeridos" tone="info" />
        <MetricCard icon={ArrowDownCircle} label="Realizado" value={moneyAbs(totalSpent)} helper="Despesas categorizadas do período" tone="negative" />
        <MetricCard icon={Percent} label="Uso geral" value={`${formatPercentNumber((totalSpent / Math.max(totalBudget, 1)) * 100)}%`} helper="Realizado sobre limite" tone={totalSpent > totalBudget ? "negative" : "positive"} />
        <MetricCard icon={AlertCircle} label="Acima do limite" value={String(overBudget)} helper={`${nearLimit} perto do limite`} tone={overBudget ? "negative" : "positive"} />
        <MetricCard icon={Gauge} label="Comprometimento" value={percent(summary.data?.commitment_rate)} helper="Indicador do dashboard" tone={commitmentTone(summary.data?.commitment_rate)} />
      </div>
      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Orçamentos"
          title="Controle por categoria"
          description="Primeira versão com limites sugeridos a partir do histórico. O CRUD real entra com o backend de Planning."
        />
        <div className="dashboard-grid analysis-grid">
          <Panel title="Categorias monitoradas" description="Clique em uma categoria para revisar os lançamentos que consumiram o orçamento.">
            <div className="budget-list">
              {ranking.isLoading || persistedBudgets.isLoading || categories.isLoading ? (
                <PageState icon={Loader2} title="Carregando orçamentos" description="Buscando categorias do período." spin compact />
              ) : null}
              {!ranking.isLoading && !persistedBudgets.isLoading && !categories.isLoading && !rows.length ? (
                <EmptyInline message="Cadastre orçamentos ou categorize transações para sugerir limites." />
              ) : null}
              {rows.map((row) => (
                <button
                  className="budget-row"
                  key={row.categoryName}
                  onClick={() =>
                    onOpenTransactions({
                      categoryId: row.categoryId ?? undefined,
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      direction: "debit",
                      label: row.categoryName,
                      periodPreset: period.periodPreset,
                    })
                  }
                  type="button"
                >
                  <div>
                    <strong>{row.categoryName}</strong>
                    <small>{moneyAbs(row.spent)} de {moneyAbs(row.limit)}</small>
                  </div>
                  <span className="progress-track" aria-label={`${row.categoryName}: ${formatPercentNumber(row.ratio * 100)}%`}>
                    <i className={budgetTone(row.ratio)} style={{ width: `${Math.min(row.ratio * 100, 100)}%` }} />
                  </span>
                  <b className={budgetTone(row.ratio)}>{formatPercentNumber(row.ratio * 100)}%</b>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Política inicial" description="Faixas usadas nesta primeira versão visual.">
            <div className="settings-list">
              <QualityRow label="Dentro do orçamento" value="até 85%" />
              <QualityRow label="Atenção" value="85% a 100%" />
              <QualityRow label="Acima do limite" value="acima de 100%" />
              <QualityRow label="Fonte dos limites" value={persistedRows.length ? "Planning API" : "Sugestão histórica"} />
            </div>
          </Panel>
        </div>
      </section>
      <Panel title="Novo orçamento" description="Defina limites mensais por categoria ou por um agrupamento livre.">
        <form
          className="inline-form form-grid two-columns"
          onSubmit={(event) => {
            event.preventDefault();
            createBudgetMutation.mutate();
          }}
        >
          <label>
            Nome
            <input required value={budgetForm.name} onChange={(event) => setBudgetForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Categoria
            <select value={budgetForm.categoryId} onChange={(event) => setBudgetForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">Sem categoria vinculada</option>
              {orderedCategoryOptions(categories.data?.items ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </label>
          <label>
            Início
            <input required type="date" value={budgetForm.periodStart} onChange={(event) => setBudgetForm((current) => ({ ...current, periodStart: event.target.value }))} />
          </label>
          <label>
            Fim
            <input required type="date" value={budgetForm.periodEnd} onChange={(event) => setBudgetForm((current) => ({ ...current, periodEnd: event.target.value }))} />
          </label>
          <label>
            Limite
            <input min="0.01" required step="0.01" type="number" value={budgetForm.limitAmount} onChange={(event) => setBudgetForm((current) => ({ ...current, limitAmount: event.target.value }))} />
          </label>
          <button className="primary-button" disabled={createBudgetMutation.isPending} type="submit">
            {createBudgetMutation.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Criar orçamento
          </button>
        </form>
        {createBudgetMutation.isError ? <InlineError message={apiErrorMessage(createBudgetMutation.error, "Falha ao criar orçamento.")} /> : null}
      </Panel>
    </section>
  );
}
