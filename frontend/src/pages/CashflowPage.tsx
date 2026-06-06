import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  ChevronRight,
  Database,
  Gauge,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDailyCashflow,
  getDashboardSummary,
  getCategoryRanking,
  getExpenseSizeProfile,
  getMonthlyCashflow,
  getProjectionFeed,
  getRecurringExpenses,
  getSubcategoryRanking,
  getTransactions,
} from "../lib/api";
import {
  compactMoneyAbs,
  compactMoneyAxis,
  dateInputLabel,
  dateLabel,
  formatCurrencyCompactSigned,
  formatPercentNumber,
  isSingleMonthRange,
  money,
  moneyAbs,
  moneyAxisDomain,
  monthTickLabel,
  dayTickLabel,
  monthRange,
  percent,
  percentAbs,
  periodRange,
  projectionFeedToInputs,
  projectionRangeFromPeriod,
  withQueryParams,
  yearQueryFromDate,
  categoryPath,
} from "../lib/utils";
import { buildDailyCashflow, buildMonthlyCashflow } from "../lib/cashflow";
import { buildRollingCashFlowProjection } from "../lib/cashflowProjection";
import { useCategories, usePeriod } from "../hooks";
import {
  ChartBox,
  DashboardSectionHeader,
  EmptyInline,
  MetricCard,
  PageState,
  Panel,
  PanelLink,
  PeriodFilter,
} from "../components/ui";
import type {
  ApiSession,
  CategoryRankingItem,
  CategoryRead,
  DailyCashflowItem,
  DashboardSummary,
  ExpenseSizeProfileItem,
  RecurringExpenseItem,
  SubcategoryRankingItem,
  TransactionRead,
} from "../lib/api";
import type {
  CashflowCategoryRow,
  CashflowHighlight,
  CashflowPeriodMetrics,
  ExpenseSizeSegment,
  PeriodState,
  SubcategorySummary,
  TransactionDrilldown,
} from "../types";
import type { Page } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const chartPalette = ["#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#64748b", "#2563eb", "#14b8a6"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cashflowDescription(period: ReturnType<typeof usePeriod>) {
  if (period.periodPreset === "current_month" || period.periodPreset === "previous_month" || isSingleMonthRange(period.dateFrom, period.dateTo)) {
    const [year] = (period.dateFrom || period.dateTo).split("-");
    return year ? `Tendência mensal do ano ${year}, mantendo o mês selecionado nos demais indicadores.` : "Receitas, despesas e saldo por mês.";
  }
  return "Receitas, despesas e saldo por mês.";
}

function cashflowPageDescription(period: ReturnType<typeof usePeriod>, view: "day" | "month") {
  if (view === "day") return "Receitas e despesas por dia, com saldo acumulado partindo do saldo inicial.";
  return cashflowDescription(period);
}

function averageMonthlyCashflow(items: Array<{ expenses: number; income: number }>) {
  if (!items.length) return { expenses: null, income: null };
  const income = items.reduce((total, item) => total + Number(item.income ?? 0), 0) / items.length;
  const expenses = items.reduce((total, item) => total + Math.abs(Number(item.expenses ?? 0)), 0) / items.length;
  return { expenses, income };
}

function comparisonHelper(current: number | null, previous: number | null, previousMonth?: string, average?: number | null, lowerIsBetter = false) {
  if (previous !== null && previous !== undefined && previous !== 0) {
    const variation = ((Number(current ?? 0) - previous) / Math.abs(previous)) * 100;
    const sign = variation >= 0 ? "+" : "";
    const suffix = lowerIsBetter && variation < 0 ? " melhor" : "";
    return `${sign}${formatPercentNumber(variation)}% vs ${monthTickLabel(previousMonth ?? "")}${suffix}`;
  }
  if (average !== null && average !== undefined && average > 0) {
    const variation = ((Number(current ?? 0) - average) / average) * 100;
    const sign = variation >= 0 ? "+" : "";
    return `${sign}${formatPercentNumber(variation)}% vs média 3 meses`;
  }
  return "Histórico insuficiente";
}

function isOutflowTransaction(t: TransactionRead) {
  return t.direction === "debit" || t.direction === "payment" || Number(t.amount ?? 0) < 0;
}

function maxBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce<T | null>((best, item) => (best === null || getter(item) > getter(best) ? item : best), null);
}

function minBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce<T | null>((best, item) => (best === null || getter(item) < getter(best) ? item : best), null);
}

function buildCashflowPeriodMetrics(summary?: DashboardSummary, dailyItems: DailyCashflowItem[] = []): CashflowPeriodMetrics {
  const income = Number(summary?.income ?? 0);
  const expenses = Number(summary?.expenses ?? 0);
  const netFlow = income - expenses;
  const firstDay = dailyItems[0];
  const lastDay = dailyItems[dailyItems.length - 1];
  const openingBalance = firstDay ? Number(firstDay.opening_balance ?? 0) : Number(summary?.current_balance ?? 0) - netFlow;
  const calculatedClosingBalance = openingBalance + netFlow;
  const realClosingBalance = summary?.current_balance !== null && summary?.current_balance !== undefined
    ? Number(summary.current_balance)
    : lastDay?.closing_balance !== undefined ? Number(lastDay.closing_balance) : null;
  const reconciliationDifference = realClosingBalance === null ? null : realClosingBalance - calculatedClosingBalance;
  return { calculatedClosingBalance, expenses, income, netFlow, openingBalance, realClosingBalance, reconciliationDifference };
}

function buildCashflowHighlights(transactions: TransactionRead[], dailyRows: Array<{ balance: number | null; date: string; expenses: number; income: number; projectedBalance: number | null }>): CashflowHighlight[] {
  const incomes = transactions.filter((t) => t.direction === "credit");
  const expenses = transactions.filter(isOutflowTransaction);
  const largestIncome = maxBy(incomes, (t) => Math.abs(Number(t.amount ?? 0)));
  const largestExpense = maxBy(expenses, (t) => Math.abs(Number(t.amount ?? 0)));
  const days = dailyRows.map((row) => ({ ...row, flow: row.income + row.expenses }));
  const activeDays = days.filter((row) => row.income !== 0 || row.expenses !== 0);
  const bestDay = maxBy(activeDays, (row) => row.flow);
  const worstDay = minBy(activeDays, (row) => row.flow);
  const lowestBalance = minBy(dailyRows, (row) => Number(row.projectedBalance ?? row.balance ?? 0));
  return [
    { description: largestIncome ? `${largestIncome.description} · ${dateInputLabel(largestIncome.transaction_date)}` : "Sem entrada no período", label: "Maior entrada", tone: "positive", value: largestIncome ? moneyAbs(largestIncome.amount) : "R$ 0" },
    { description: largestExpense ? `${largestExpense.description} · ${dateInputLabel(largestExpense.transaction_date)}` : "Sem saída no período", label: "Maior saída", tone: "negative", value: largestExpense ? money(-Math.abs(Number(largestExpense.amount ?? 0))) : "R$ 0" },
    { description: bestDay ? dateLabel(bestDay.date) : "Sem dados diários", label: "Melhor dia", tone: "positive", value: bestDay ? money(bestDay.flow) : "R$ 0" },
    { description: worstDay ? dateLabel(worstDay.date) : "Sem dados diários", label: "Pior dia", tone: "negative", value: worstDay ? money(worstDay.flow) : "R$ 0" },
    { description: lowestBalance ? dateLabel(lowestBalance.date) : "Sem projeção", label: "Saldo mínimo previsto", tone: Number(lowestBalance?.projectedBalance ?? lowestBalance?.balance ?? 0) < 0 ? "negative" : "info", value: lowestBalance ? money(lowestBalance.projectedBalance ?? lowestBalance.balance ?? 0) : "R$ 0" },
  ];
}

function buildIncomeCategoryRows(transactions: TransactionRead[], categories: CategoryRead[]): CashflowCategoryRow[] {
  const categoryNames = new Map(categories.map((c) => [c.id, categoryPath(c, categories)]));
  const grouped = new Map<string, number>();
  transactions.filter((t) => t.direction === "credit").forEach((t) => {
    const label = t.category?.category_id ? categoryNames.get(t.category.category_id) ?? "Receita categorizada" : "Sem categoria";
    grouped.set(label, (grouped.get(label) ?? 0) + Math.abs(Number(t.amount ?? 0)));
  });
  const total = Array.from(grouped.values()).reduce((sum, v) => sum + v, 0);
  return Array.from(grouped.entries()).map(([label, amount]) => ({ amount, label, share: total > 0 ? amount / total : 0 })).sort((a, b) => b.amount - a.amount);
}

function buildExpenseSizeProfile(items: ExpenseSizeProfileItem[]): ExpenseSizeSegment[] {
  const toneByKey = new Map([["cotidiana", "info" as const], ["pequena", "info" as const], ["media", "warning" as const], ["alta", "negative" as const], ["premium", "negative" as const]]);
  return items.map((item) => ({ average: Number(item.average_amount ?? 0), count: item.count, helper: item.helper, label: item.label, share: Number(item.share_ratio ?? 0), tone: toneByKey.get(item.key) ?? "info", total: Number(item.total ?? 0) }));
}

function buildSubcategoryRows(items: SubcategoryRankingItem[], categoriesById: Map<string, CategoryRead>): SubcategorySummary[] {
  return items.map((item) => {
    const cat = item.category_id ? categoriesById.get(item.category_id) : null;
    const parentCategoryId = cat?.parent_category_id ?? item.category_id;
    return { averageTicket: Number(item.average_amount ?? 0), categoryId: item.category_id, parentCategoryId, direction: "debit", percentageOfCategory: Number(item.share_ratio ?? 0), subcategory: item.subcategory_name, total: Number(item.amount ?? 0), transactionCount: item.count };
  });
}

export function compactCategoryDistribution(items: CategoryRankingItem[]) {
  const sorted = [...items].map((item) => ({ ...item, amountValue: Math.abs(Number(item.amount ?? 0)) })).sort((a, b) => b.amountValue - a.amountValue);
  const total = sorted.reduce((sum, item) => sum + item.amountValue, 0);
  const visible = sorted.filter((item, index) => index < 5 && item.amountValue / Math.max(total, 1) >= 0.04);
  const otherAmount = sorted.slice(visible.length).reduce((sum, item) => sum + item.amountValue, 0);
  if (otherAmount > 0) {
    visible.push({ amount: String(otherAmount), amountValue: otherAmount, average_amount: String(otherAmount), category_id: null, category_name: "Outros", count: sorted.slice(visible.length).reduce((sum, item) => sum + item.count, 0), share_ratio: String(otherAmount / Math.max(total, 1)) });
  }
  return visible;
}

// ---------------------------------------------------------------------------
// Exported sub-components (shared with DashboardPage)
// ---------------------------------------------------------------------------

export function CategoryBarList({ items, loading, onOpenCategory }: { items: CategoryRankingItem[]; loading: boolean; onOpenCategory: (item: CategoryRankingItem) => void }) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const sortedItems = [...items].sort((a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)));
  const maxAmount = Math.max(...sortedItems.map((item) => Math.abs(Number(item.amount ?? 0))), 1);
  const totalAmount = sortedItems.reduce((total, item) => total + Math.abs(Number(item.amount ?? 0)), 0);
  const visibleItems = sortedItems.slice(0, 5);
  const hiddenCount = Math.max(sortedItems.length - visibleItems.length, 0);
  return (
    <div className="category-bar-list">
      {visibleItems.map((item, index) => {
        const amount = Math.abs(Number(item.amount ?? 0));
        const shareRatio = totalAmount > 0 ? amount / totalAmount : Number(item.share_ratio ?? 0);
        return (
          <button className="category-bar-row" key={item.category_id ?? item.category_name} onClick={() => onOpenCategory(item)} type="button">
            <span>{item.category_name}</span>
            <div className="category-bar-track"><i style={{ background: chartPalette[index % chartPalette.length], width: `${Math.max((amount / maxAmount) * 100, 4)}%` }} /></div>
            <b><strong>{moneyAbs(amount)}</strong><small>{percent(String(shareRatio))}</small></b>
          </button>
        );
      })}
      {hiddenCount > 0 ? <small className="category-more">+{hiddenCount} categoria{hiddenCount === 1 ? "" : "s"} no período</small> : null}
      <div className="category-total-row"><span>Total de saídas</span><strong>{moneyAbs(totalAmount)}</strong></div>
    </div>
  );
}

export function PersonalizedTip({ balance, onNavigateReports, recurring, savingsRate }: { balance: number; onNavigateReports: () => void; recurring: RecurringExpenseItem[]; savingsRate?: string | null }) {
  const topRecurring = recurring[0];
  const savingValue = Number(savingsRate ?? 0);
  const text = topRecurring
    ? `Revise ${topRecurring.description}: último valor ${moneyAbs(topRecurring.last_amount)} e média ${moneyAbs(topRecurring.average_amount)}.`
    : savingValue > 0 ? `Seu saving rate está positivo em ${percentAbs(savingsRate)}. Vale direcionar parte da sobra para uma meta.`
    : balance < 0 ? "Seu saldo está negativo. Priorize revisar categorias com maior crescimento e compromissos próximos."
    : "Continue categorizando as transações para melhorar as recomendações automáticas.";
  return (
    <section className="personalized-tip">
      <span><Sparkles size={18} /></span>
      <div><strong>Dica personalizada</strong><p>{text}</p></div>
      <button className="secondary-button" onClick={onNavigateReports} type="button">Ver análises</button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Private sub-components
// ---------------------------------------------------------------------------

function CashflowPeriodSummary({ metrics }: { metrics: CashflowPeriodMetrics }) {
  const totalMovement = Math.max(metrics.income + metrics.expenses, 1);
  const rows = [
    { label: "Total de entradas", tone: "positive", value: metrics.income, weight: metrics.income / totalMovement },
    { label: "Total de saídas", tone: "negative", value: -metrics.expenses, weight: metrics.expenses / totalMovement },
    { label: "Fluxo líquido", tone: metrics.netFlow < 0 ? "negative" : "positive", value: metrics.netFlow, weight: Math.abs(metrics.netFlow) / totalMovement },
    { label: "Saldo inicial", tone: "info", value: metrics.openingBalance },
    { label: "Saldo final calculado", tone: metrics.calculatedClosingBalance < 0 ? "negative" : "positive", value: metrics.calculatedClosingBalance },
    ...(metrics.realClosingBalance === null ? [] : [{ label: "Saldo real importado", tone: metrics.realClosingBalance < 0 ? "negative" : "positive", value: metrics.realClosingBalance }]),
    ...(metrics.reconciliationDifference === null ? [] : [{ label: "Diferença de conciliação", tone: Math.abs(metrics.reconciliationDifference) >= 1 ? "warning" : "info", value: metrics.reconciliationDifference }]),
  ];
  return (
    <Panel title="Resumo do Período">
      <div className="cashflow-summary-list">
        {rows.map((row) => (
          <div className="cashflow-summary-row" key={row.label}>
            <span>{row.label}</span>
            <strong className={row.tone}>{money(row.value)}</strong>
            {"weight" in row ? <small>{formatPercentNumber((row.weight ?? 0) * 100)}%</small> : null}
          </div>
        ))}
      </div>
      {metrics.reconciliationDifference !== null && Math.abs(metrics.reconciliationDifference) >= 1 ? (
        <p className="cashflow-reconciliation-note">Diferença entre saldo calculado e saldo real. Verifique transações ausentes ou conciliação bancária.</p>
      ) : null}
    </Panel>
  );
}

function CashflowEvolutionTooltip({ active, payload, view }: { active?: boolean; payload?: Array<{ payload?: { balance?: number | null; date?: string; expenses?: number; income?: number; month?: string; projectedBalance?: number | null }; value?: number }>; view: "day" | "month" }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const label = view === "month" ? monthTickLabel(point.month ?? "") : dateLabel(point.date ?? "");
  return (
    <div className="chart-tooltip cashflow-tooltip">
      <strong>{label}</strong>
      <span className="income">Entradas: {moneyAbs(point.income ?? 0)}</span>
      <span className="expense">Saídas: {moneyAbs(point.expenses ?? 0)}</span>
      {point.balance !== null && point.balance !== undefined ? <span>Saldo acumulado: {money(point.balance)}</span> : null}
      {point.projectedBalance !== null && point.projectedBalance !== undefined ? <small>Saldo projetado: {money(point.projectedBalance)}</small> : null}
    </div>
  );
}

function CashflowIncomeExpenseDonut({ expenses, income, onOpenDetails }: { expenses: number; income: number; onOpenDetails: () => void }) {
  const values = [{ amount: Math.abs(income), label: "Entradas", tone: "positive" }, { amount: Math.abs(expenses), label: "Saídas", tone: "negative" }];
  const total = values.reduce((sum, item) => sum + item.amount, 0);
  const netFlow = income - expenses;
  return (
    <Panel title="Entradas vs Saídas" description="Proporção entre dinheiro que entrou e saiu.">
      <div className="cashflow-donut-card">
        <div className="donut-chart compact">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
              <Pie data={values} dataKey="amount" nameKey="label" innerRadius="62%" outerRadius="86%" paddingAngle={2} stroke="none">
                <Cell fill="#22c55e" /><Cell fill="#ef4444" />
              </Pie>
              <Tooltip allowEscapeViewBox={{ x: true, y: true }} formatter={(value, name) => [moneyAbs(String(value)), String(name)]} wrapperStyle={{ pointerEvents: "none", zIndex: 30 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center"><span>Fluxo líquido</span><strong>{formatCurrencyCompactSigned(netFlow)}</strong></div>
        </div>
        <div className="donut-legend">
          {values.map((item) => (
            <div className="cashflow-donut-row" key={item.label}>
              <span>{item.label}</span>
              <strong className={item.tone}>{moneyAbs(item.amount)}</strong>
              <small>{total > 0 ? `${formatPercentNumber((item.amount / total) * 100)}%` : "0%"}</small>
            </div>
          ))}
        </div>
        <button className="panel-link" onClick={onOpenDetails} type="button">Ver detalhes das entradas e saídas <ChevronRight size={14} /></button>
      </div>
    </Panel>
  );
}

function CashflowHighlights({ items }: { items: CashflowHighlight[] }) {
  return (
    <div className="cashflow-highlight-grid">
      {items.map((item) => (
        <div className={`cashflow-highlight ${item.tone}`} key={item.label}>
          <span>{item.label}</span><strong>{item.value}</strong><small>{item.description}</small>
        </div>
      ))}
    </div>
  );
}

function CashflowCategoryRows({ emptyMessage, items, loading, tone }: { emptyMessage: string; items: CashflowCategoryRow[]; loading: boolean; tone: "negative" | "positive" }) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message={emptyMessage} />;
  const maxAmount = Math.max(...items.map((item) => item.amount), 1);
  return (
    <div className="cashflow-category-list">
      {items.slice(0, 7).map((item, index) => (
        <div className="category-bar-row static" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <div className="category-bar-track"><i style={{ background: tone === "positive" ? "#22c55e" : chartPalette[index % chartPalette.length], width: `${Math.max((item.amount / maxAmount) * 100, 4)}%` }} /></div>
          <b><strong>{moneyAbs(item.amount)}</strong><small>{percent(String(item.share))}</small></b>
        </div>
      ))}
    </div>
  );
}

function ExpenseSizeProfile({ items, loading }: { items: ExpenseSizeSegment[]; loading: boolean }) {
  if (loading) return <PageState icon={Loader2} title="Carregando perfil" description="Aguarde um momento." spin compact />;
  if (!items.some((item) => item.count > 0)) return <EmptyInline message="Sem saídas no período para analisar." />;
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  return (
    <div className="expense-size-list">
      {items.map((item) => (
        <div className={`expense-size-row ${item.tone}`} key={item.label}>
          <div><strong>{item.label}</strong><small>{item.helper}</small></div>
          <div className="expense-size-track" aria-hidden="true"><i style={{ width: `${Math.max((item.total / maxTotal) * 100, item.count > 0 ? 5 : 0)}%` }} /></div>
          <b>
            <strong>{moneyAbs(item.total)}</strong>
            <small>{item.count} transaç{item.count === 1 ? "ão" : "ões"} · {formatPercentNumber(item.share * 100)}%</small>
            <small>Ticket médio {moneyAbs(item.average)}</small>
          </b>
        </div>
      ))}
    </div>
  );
}

function SubcategoryBreakdown({ categoryColorMap, categoryLabelMap, items, loading, onOpen, showCategoryLabel }: { categoryColorMap?: Map<string | null, string>; categoryLabelMap?: Map<string, string>; items: SubcategorySummary[]; loading: boolean; onOpen: (item: SubcategorySummary) => void; showCategoryLabel?: boolean }) {
  if (loading) return <PageState icon={Loader2} title="Carregando subcategorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem subcategorias no período." />;
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  const visibleItems = items.slice(0, 5);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);
  return (
    <div className="subcategory-list">
      {visibleItems.map((item) => {
        const color = categoryColorMap?.get(item.parentCategoryId) ?? "#64748b";
        const lookupId = item.parentCategoryId ?? "__uncategorized__";
        const categoryLabel = showCategoryLabel ? (categoryLabelMap?.get(lookupId) ?? null) : null;
        return (
          <button className="subcategory-row" key={`${item.subcategory}-${item.categoryId ?? "none"}`} onClick={() => onOpen(item)} type="button">
            <span>
              <strong>{item.subcategory}</strong>
              <small>{categoryLabel ? <>{categoryLabel} · </> : null}{formatPercentNumber(item.percentageOfCategory * 100)}% da categoria · {item.transactionCount} transaç{item.transactionCount === 1 ? "ão" : "ões"}</small>
            </span>
            <div className="subcategory-track" aria-hidden="true"><i style={{ background: color, width: `${Math.max((item.total / maxTotal) * 100, 5)}%` }} /></div>
            <b><strong>{moneyAbs(item.total)}</strong><small>Ticket médio {moneyAbs(item.averageTicket)}</small></b>
          </button>
        );
      })}
      {hiddenCount > 0 ? <small className="subcategory-more">+{hiddenCount} subcategoria{hiddenCount === 1 ? "" : "s"} no período</small> : null}
    </div>
  );
}

function RecurringWeightList({ items, loading, onOpen }: { items: RecurringExpenseItem[]; loading: boolean; onOpen: (item: RecurringExpenseItem) => void }) {
  if (loading) return <PageState icon={Loader2} title="Carregando recorrências" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhum gasto recorrente encontrado." />;
  const sortedItems = [...items].sort((a, b) => Math.abs(Number(b.average_amount ?? 0)) - Math.abs(Number(a.average_amount ?? 0)));
  return (
    <div className="compact-timeline-list">
      {sortedItems.slice(0, 6).map((item) => (
        <button className="compact-timeline-row warning" key={item.description} onClick={() => onOpen(item)} type="button">
          <span><strong>{item.description}</strong><small>{item.category_name ?? "Sem categoria"} · {item.month_count} mês{item.month_count === 1 ? "" : "es"}</small></span>
          <b>{moneyAbs(item.average_amount)}</b>
        </button>
      ))}
    </div>
  );
}

function CashflowComparison({ monthlyData, periodDate, summary }: { monthlyData: Array<{ balance: number | null; expenses: number; income: number; month: string }>; periodDate: string; summary?: DashboardSummary }) {
  const populatedMonths = monthlyData.filter((item) => item.income !== 0 || item.expenses !== 0 || item.balance !== null);
  const selectedMonth = periodDate?.slice(0, 7);
  const selectedIndex = populatedMonths.findIndex((item) => item.month === selectedMonth);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : populatedMonths.length - 1;
  const current = populatedMonths[currentIndex];
  const previous = currentIndex > 0 ? populatedMonths[currentIndex - 1] : null;
  const previousMonths = currentIndex > 0 ? populatedMonths.slice(Math.max(0, currentIndex - 3), currentIndex) : [];
  const currentIncome = current ? Number(current.income ?? 0) : Number(summary?.income ?? 0);
  const currentExpenses = current ? Math.abs(Number(current.expenses ?? 0)) : Number(summary?.expenses ?? 0);
  const currentNetFlow = currentIncome - currentExpenses;
  const currentClosingBalance = current?.balance ?? Number(summary?.current_balance ?? summary?.balance ?? 0);
  const previousIncome = previous ? Number(previous.income ?? 0) : null;
  const previousExpenses = previous ? Math.abs(Number(previous.expenses ?? 0)) : null;
  const previousNetFlow = previousIncome === null || previousExpenses === null ? null : previousIncome - previousExpenses;
  const previousClosingBalance = previous?.balance ?? null;
  const average3 = averageMonthlyCashflow(previousMonths);
  const rows = [
    { helper: comparisonHelper(currentNetFlow, previousNetFlow, previous?.month), label: "Fluxo líquido", tone: currentNetFlow < 0 ? "negative" : "positive", value: currentNetFlow },
    { helper: comparisonHelper(currentIncome, previousIncome, previous?.month, average3.income), label: "Entradas", tone: "positive", value: currentIncome },
    { helper: comparisonHelper(currentExpenses, previousExpenses, previous?.month, average3.expenses, true), label: "Saídas", tone: "negative", value: currentExpenses },
    { helper: comparisonHelper(currentClosingBalance, previousClosingBalance, previous?.month), label: "Saldo final", tone: Number(currentClosingBalance ?? 0) < 0 ? "negative" : "positive", value: currentClosingBalance },
  ];
  if (!current && !summary) return <EmptyInline message="Histórico insuficiente para comparação." />;
  return (
    <div className="comparison-mini-grid">
      {rows.map((row) => (
        <div className="comparison-mini-card" key={row.label}>
          <span>{row.label}</span>
          <strong className={row.tone}>{row.label === "Saídas" ? moneyAbs(row.value) : money(row.value)}</strong>
          <small>{row.helper}</small>
        </div>
      ))}
    </div>
  );
}

function CashflowSeasonality({ data, loading }: { data: Array<{ expenses: number; income: number; month: string }>; loading: boolean }) {
  const seasonalityData = data.map((item) => ({ entradas: Math.abs(Number(item.income ?? 0)), month: item.month, saidas: Math.abs(Number(item.expenses ?? 0)) }));
  const populated = seasonalityData.filter((item) => item.entradas !== 0 || item.saidas !== 0);
  if (loading) return <PageState icon={Loader2} title="Carregando sazonalidade" description="Aguarde um momento." spin compact />;
  if (populated.length < 3) return <EmptyInline message="Ainda não há histórico suficiente para análise sazonal." />;
  return (
    <ChartBox loading={false} empty={false}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={seasonalityData} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis dataKey="month" tickFormatter={monthTickLabel} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip formatter={(value, name) => [moneyAbs(String(value)), String(name)]} labelFormatter={monthTickLabel} />
          <Legend />
          <Bar name="Entradas" dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar name="Saídas" dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CashflowPage({
  onNavigate,
  onOpenTransactions,
  session,
}: {
  onNavigate: (page: Page) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [cashflowPeriod, setCashflowPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_year");
    return { ...range, periodPreset: "current_year" };
  });
  const period = usePeriod(cashflowPeriod, setCashflowPeriod);
  const [cashflowView, setCashflowView] = useState<"day" | "month">("day");
  const [showCashflowCalculation, setShowCashflowCalculation] = useState(false);
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const cashflowYearQuery = yearQueryFromDate(period.dateFrom || period.dateTo);
  const evolutionProjectionRange = useMemo(() => projectionRangeFromPeriod(period.dateFrom, period.dateTo), [period.dateFrom, period.dateTo]);

  const summary = useQuery({ queryKey: ["cashflow-summary", session.token, period.query], queryFn: () => getDashboardSummary(session, period.query) });
  const cashflow = useQuery({ queryKey: ["cashflow-monthly", session.token, cashflowYearQuery], queryFn: () => getMonthlyCashflow(session, cashflowYearQuery) });
  const dailyCashflowQuery = useQuery({ queryKey: ["cashflow-daily", session.token, period.query], queryFn: () => getDailyCashflow(session, period.query) });
  const ranking = useQuery({ queryKey: ["cashflow-category-ranking", session.token, period.query], queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })) });
  const recurring = useQuery({ queryKey: ["cashflow-recurring-expenses", session.token, period.recurringQuery], queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })) });
  const projectionFeed = useQuery({ queryKey: ["projection-feed", session.token], queryFn: () => getProjectionFeed(session, 90), staleTime: 5 * 60 * 1000 });
  const feedInputs = projectionFeed.data ? projectionFeedToInputs(projectionFeed.data) : null;
  const incomeTransactions = useQuery({ queryKey: ["cashflow-income-transactions", session.token, period.query], queryFn: () => getTransactions(session, withQueryParams(period.query, { direction: "credit", limit: "100", sort_by: "amount", sort_dir: "desc" })) });
  const expenseTransactions = useQuery({ queryKey: ["cashflow-expense-transactions", session.token, period.query], queryFn: () => getTransactions(session, withQueryParams(period.query, { direction: "debit", limit: "100", sort_by: "amount", sort_dir: "desc" })) });
  const paymentTransactions = useQuery({ queryKey: ["cashflow-payment-transactions", session.token, period.query], queryFn: () => getTransactions(session, withQueryParams(period.query, { direction: "payment", limit: "100", sort_by: "amount", sort_dir: "desc" })) });
  const expenseSizeProfileQuery = useQuery({ queryKey: ["cashflow-expense-size-profile", session.token, period.query], queryFn: () => getExpenseSizeProfile(session, period.query) });
  const categories = useCategories(session);
  const subcategoryQuery = useMemo(() => selectedExpenseCategoryId && selectedExpenseCategoryId !== "__uncategorized__" ? withQueryParams(period.query, { category_id: selectedExpenseCategoryId, limit: "10" }) : withQueryParams(period.query, { limit: "10" }), [period.query, selectedExpenseCategoryId]);
  const subcategoryRanking = useQuery({ queryKey: ["cashflow-subcategory-ranking", session.token, subcategoryQuery], queryFn: () => getSubcategoryRanking(session, subcategoryQuery) });

  const categoryItems = ranking.data?.items ?? [];
  const balance = Number(summary.data?.balance ?? 0);
  const currentBalance = summary.data?.current_balance;
  const currentBalanceValue = currentBalance === null || currentBalance === undefined ? null : Number(currentBalance);
  const evolutionProjectionResult = useMemo(() => evolutionProjectionRange ? buildRollingCashFlowProjection({ currentBalance: feedInputs?.currentBalance ?? currentBalanceValue ?? balance, creditCardInstallments: feedInputs?.creditCardInstallments, horizonDays: evolutionProjectionRange.horizonDays, knownEvents: feedInputs?.knownEvents, recurringItems: feedInputs?.recurringItems, startDate: evolutionProjectionRange.dateFrom, variableCategories: feedInputs?.variableCategories }) : null, [balance, currentBalanceValue, evolutionProjectionRange, feedInputs]);
  const evolutionProjectionCashflow = evolutionProjectionResult?.chartPoints ?? [];
  const dailyCashflow = useMemo(() => buildDailyCashflow({ dateFrom: period.dateFrom, dateTo: period.dateTo, items: dailyCashflowQuery.data?.items ?? [], projectionPoints: evolutionProjectionCashflow }), [dailyCashflowQuery.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow]);
  const monthlyCashflow = useMemo(() => buildMonthlyCashflow(cashflow.data?.items ?? [], period.dateFrom || period.dateTo, evolutionProjectionCashflow), [cashflow.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow]);
  const cashflowAxisDomain = useMemo(() => cashflowView !== "month" ? moneyAxisDomain(dailyCashflow, ["income", "expenses", "balance", "projectedBalance"], true) : moneyAxisDomain(monthlyCashflow, ["income", "expenses", "balance", "projectedBalance"], true), [cashflowView, dailyCashflow, monthlyCashflow]);
  const cashflowRows = cashflowView === "month" ? monthlyCashflow : dailyCashflow;
  const hasCashflowRows = cashflowRows.some((item) => item.income !== 0 || item.expenses !== 0 || item.balance !== null || item.projectedBalance !== null);
  const periodSummaryMetrics = useMemo(() => buildCashflowPeriodMetrics(summary.data, dailyCashflowQuery.data?.items ?? []), [dailyCashflowQuery.data?.items, summary.data]);
  const highlights = useMemo(() => buildCashflowHighlights([...(incomeTransactions.data?.items ?? []), ...(expenseTransactions.data?.items ?? []), ...(paymentTransactions.data?.items ?? [])], dailyCashflow), [dailyCashflow, expenseTransactions.data?.items, incomeTransactions.data?.items, paymentTransactions.data?.items]);
  const incomeCategories = useMemo(() => buildIncomeCategoryRows(incomeTransactions.data?.items ?? [], categories.data?.items ?? []), [categories.data?.items, incomeTransactions.data?.items]);
  const expenseSizeProfile = useMemo(() => buildExpenseSizeProfile(expenseSizeProfileQuery.data?.items ?? []), [expenseSizeProfileQuery.data?.items]);
  const subcategoryFilterOptions = useMemo(() => categoryItems.map((item) => ({ id: item.category_id ?? "__uncategorized__", label: item.category_name })), [categoryItems]);
  const selectedExpenseCategory = subcategoryFilterOptions.find((item) => item.id === selectedExpenseCategoryId) ?? null;
  const categoriesById = useMemo(() => new Map((categories.data?.items ?? []).map((c) => [c.id, c])), [categories.data?.items]);
  const subcategoryRows = useMemo(() => {
    const raw = subcategoryRanking.data?.items ?? [];
    const filtered = selectedExpenseCategoryId === "__uncategorized__" ? raw.filter((item) => item.category_id === null) : raw;
    return buildSubcategoryRows(filtered, categoriesById);
  }, [categoriesById, selectedExpenseCategoryId, subcategoryRanking.data?.items]);
  const subcategoryColorMap = useMemo(() => new Map(categoryItems.map((item, index) => [item.category_id, chartPalette[index % chartPalette.length]])), [categoryItems]);
  const subcategoryLabelMap = useMemo(() => new Map(subcategoryFilterOptions.map((item) => [item.id, item.label])), [subcategoryFilterOptions]);

  function openCashflowPointTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    const range = cashflowView === "month" ? monthRange(data.activeLabel) : { dateFrom: data.activeLabel, dateTo: data.activeLabel };
    if (!range) return;
    onOpenTransactions({ dateFrom: range.dateFrom, dateTo: range.dateTo, label: cashflowView === "month" ? `Fluxo mensal ${monthTickLabel(data.activeLabel)}` : `Fluxo diário ${dateLabel(data.activeLabel)}`, periodPreset: "custom" });
  }
  function openMetricTransactions(direction?: string, label = "Fluxo de caixa") {
    onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction, label, periodPreset: period.periodPreset });
  }
  function openCategoryTransactions(item: CategoryRankingItem) {
    if (!item.category_id) { onNavigate("review"); return; }
    onOpenTransactions({ categoryId: item.category_id, dateFrom: period.dateFrom, dateTo: period.dateTo, label: item.category_name, periodPreset: period.periodPreset });
  }

  return (
    <section className="page-stack">
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <PeriodFilter dateFrom={period.dateFrom} dateTo={period.dateTo} periodPreset={period.periodPreset} onPreset={period.setPeriodPreset} onDateFrom={period.setDateFrom} onDateTo={period.setDateTo} />
      </div>
      <div className="metric-grid executive cashflow-kpis" aria-label="Indicadores principais de fluxo de caixa">
        <MetricCard icon={ArrowUpCircle} label="Entradas" title={moneyAbs(summary.data?.income)} value={compactMoneyAbs(summary.data?.income)} helper="Receitas no período" tone="positive" onClick={() => openMetricTransactions("credit", "Entradas do período")} />
        <MetricCard icon={ArrowDownCircle} label="Saídas" title={moneyAbs(summary.data?.expenses)} value={compactMoneyAbs(summary.data?.expenses)} helper="Despesas no período" tone="negative" onClick={() => openMetricTransactions("debit", "Saídas do período")} />
        <MetricCard icon={BarChart3} label="Fluxo líquido" title={money(summary.data?.balance)} value={formatCurrencyCompactSigned(summary.data?.balance)} helper="Entradas - saídas" tone={Number(summary.data?.balance ?? 0) < 0 ? "negative" : "positive"} />
        <MetricCard icon={Database} label="Saldo inicial" title={money(periodSummaryMetrics.openingBalance)} value={formatCurrencyCompactSigned(periodSummaryMetrics.openingBalance)} helper="Início do período" tone="info" />
        <MetricCard icon={Gauge} label="Saldo real" title={periodSummaryMetrics.realClosingBalance === null ? undefined : money(periodSummaryMetrics.realClosingBalance)} value={periodSummaryMetrics.realClosingBalance === null ? "Sem saldo real" : formatCurrencyCompactSigned(periodSummaryMetrics.realClosingBalance)} helper={summary.data?.current_balance_date ? `Real em ${dateInputLabel(summary.data.current_balance_date)}` : "Sem saldo importado"} tone={periodSummaryMetrics.realClosingBalance === null ? "info" : periodSummaryMetrics.realClosingBalance < 0 ? "negative" : "positive"} />
      </div>
      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Análise do período" title="Evolução do Fluxo de Caixa" description="Entradas, saídas e saldo acumulado ao longo do período." />
        <div className="cashflow-main-grid">
          <div className="cashflow-primary">
            <Panel title="Evolução do Fluxo de Caixa" description={cashflowPageDescription(period, cashflowView)}>
              <button className="calculation-note" onClick={() => setShowCashflowCalculation((c) => !c)} type="button"><Gauge size={16} /><span>Como calculamos?</span></button>
              {showCashflowCalculation ? (
                <div className="calculation-details">
                  <p>A evolução mostra entradas, saídas e saldo acumulado no período selecionado.</p>
                  <p>Quando há projeção, o saldo projetado parte do saldo atual e evolui dia a dia: saldo anterior + entradas previstas - saídas previstas. Receitas futuras entram como barras positivas; saídas futuras entram como barras negativas.</p>
                </div>
              ) : null}
              <div className="chart-view-toggle" aria-label="Alternar visão do fluxo">
                <button className={cashflowView === "day" ? "active" : ""} onClick={() => setCashflowView("day")} type="button">Dia</button>
                <button className={cashflowView === "month" ? "active" : ""} onClick={() => setCashflowView("month")} type="button">Mês</button>
              </div>
              <ChartBox loading={cashflowView === "month" ? cashflow.isLoading : dailyCashflowQuery.isLoading} empty={!hasCashflowRows} size="large">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart barCategoryGap="28%" barGap={0} data={cashflowRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} onClick={openCashflowPointTransactions} stackOffset="sign" style={{ cursor: "pointer" }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                    <XAxis dataKey={cashflowView === "month" ? "month" : "date"} tickFormatter={cashflowView === "month" ? monthTickLabel : dayTickLabel} tickLine={false} axisLine={false} />
                    <YAxis allowDataOverflow={false} domain={cashflowAxisDomain} tickFormatter={compactMoneyAxis} tickLine={false} axisLine={false} width={64} />
                    <Tooltip allowEscapeViewBox={{ x: true, y: true }} content={<CashflowEvolutionTooltip view={cashflowView} />} wrapperStyle={{ maxWidth: 220, pointerEvents: "none", zIndex: 30 }} />
                    <Legend align="center" verticalAlign="top" wrapperStyle={{ lineHeight: "20px", paddingBottom: 8 }} />
                    <Bar name="Receita" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="cashflow" />
                    <Bar name="Saídas" dataKey="expenses" fill="#ef4444" isAnimationActive={false} radius={[0, 0, 4, 4]} stackId="cashflow" />
                    <Line activeDot={{ r: 5 }} connectNulls name="Saldo acumulado" type="monotone" dataKey="balance" stroke="#312e81" strokeWidth={3} dot={false} isAnimationActive={false} />
                    <Line activeDot={{ r: 5 }} connectNulls name="Saldo projetado" type="monotone" dataKey="projectedBalance" stroke="#64748b" strokeDasharray="6 5" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartBox>
            </Panel>
            <CashflowHighlights items={highlights} />
          </div>
        </div>
      </section>
      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Análises" title="Categorias, recorrências e sazonalidade" description="Entenda quais entradas, saídas e padrões explicam o fluxo do período." />
        <div className="dashboard-grid cashflow-analysis-grid">
          <CashflowIncomeExpenseDonut income={Number(summary.data?.income ?? 0)} expenses={Number(summary.data?.expenses ?? 0)} onOpenDetails={() => openMetricTransactions(undefined, "Entradas e saídas")} />
          <Panel title="Entradas por categoria" description="Principais origens de dinheiro no período." action={<PanelLink label="Ver análise completa" onClick={() => openMetricTransactions("credit", "Entradas por categoria")} />}>
            <CashflowCategoryRows items={incomeCategories} loading={incomeTransactions.isLoading || categories.isLoading} emptyMessage="Sem entradas no período." tone="positive" />
          </Panel>
          <Panel title="Sazonalidade" description="Leitura mensal de entradas e saídas.">
            <CashflowSeasonality data={monthlyCashflow} loading={cashflow.isLoading} />
          </Panel>
          <Panel title="Saídas por categoria" description="Principais destinos de dinheiro no período." action={<PanelLink label="Ver análise completa" onClick={() => onNavigate("cashflow")} />}>
            <CategoryBarList items={ranking.data?.items ?? []} loading={ranking.isLoading} onOpenCategory={openCategoryTransactions} />
          </Panel>
          <Panel title={selectedExpenseCategory ? `Subcategorias de ${selectedExpenseCategory.label}` : "Subcategorias"}>
            <p className="panel-note compact">Detalhe consolidado pela mesma base de Saídas por categoria.</p>
            <label className="inline-filter-label">
              Categoria
              <select value={selectedExpenseCategoryId} onChange={(e) => setSelectedExpenseCategoryId(e.target.value)}>
                <option value="">Todas</option>
                {subcategoryFilterOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <SubcategoryBreakdown categoryColorMap={subcategoryColorMap} categoryLabelMap={subcategoryLabelMap} items={subcategoryRows} loading={subcategoryRanking.isLoading} showCategoryLabel={!selectedExpenseCategoryId} onOpen={(item) => onOpenTransactions({ categoryId: item.categoryId ?? selectedExpenseCategory?.id, dateFrom: period.dateFrom, dateTo: period.dateTo, direction: item.direction, label: selectedExpenseCategory ? `${selectedExpenseCategory.label} / ${item.subcategory}` : item.subcategory, periodPreset: period.periodPreset })} />
          </Panel>
          <Panel title="Perfil das saídas" description="Quantidade e volume por tamanho de transação.">
            <ExpenseSizeProfile items={expenseSizeProfile} loading={expenseSizeProfileQuery.isLoading} />
          </Panel>
          <Panel title="Recorrências que mais pesam" description="Gastos que aparecem em mais de um mês." action={<PanelLink label="Ver recorrências" onClick={() => openMetricTransactions("debit", "Recorrências")} />}>
            <RecurringWeightList items={recurring.data?.items ?? []} loading={recurring.isLoading} onOpen={(item) => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, label: item.description, periodPreset: period.periodPreset, search: item.description })} />
          </Panel>
          <Panel title="Análise comparativa" description="Comparação rápida com a média mensal do período.">
            <CashflowComparison monthlyData={monthlyCashflow} periodDate={period.dateFrom || period.dateTo} summary={summary.data} />
          </Panel>
          <CashflowPeriodSummary metrics={periodSummaryMetrics} />
        </div>
      </section>
      <PersonalizedTip balance={Number(summary.data?.current_balance ?? summary.data?.balance ?? 0)} onNavigateReports={() => onNavigate("reports")} recurring={recurring.data?.items ?? []} savingsRate={summary.data?.savings_rate} />
    </section>
  );
}
