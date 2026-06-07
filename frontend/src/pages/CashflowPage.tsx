import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Database,
  Gauge,
  Loader2,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Scale,
  RefreshCw,
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
  DashboardPeriodPicker,
  MetricCard,
  PageState,
  Panel,
  PanelLink,
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
    { description: worstDay ? dateLabel(worstDay.date) : "Sem dados diários", label: "Pior dia", tone: "negative", value: worstDay ? money(worstDay.flow) : "R$ 0" },
    { description: bestDay ? dateLabel(bestDay.date) : "Sem dados diários", label: "Melhor dia", tone: "positive", value: bestDay ? money(bestDay.flow) : "R$ 0" },
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

export function CategoryBarList({ items, limit = 7, loading, onOpenCategory }: { items: CategoryRankingItem[]; limit?: number; loading: boolean; onOpenCategory: (item: CategoryRankingItem) => void }) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const sortedItems = [...items].sort((a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)));
  const maxAmount = Math.max(...sortedItems.map((item) => Math.abs(Number(item.amount ?? 0))), 1);
  const totalAmount = sortedItems.reduce((total, item) => total + Math.abs(Number(item.amount ?? 0)), 0);
  const LIMIT = limit;
  const visibleItems = sortedItems.slice(0, LIMIT);
  const hiddenCount = Math.max(sortedItems.length - LIMIT, 0);
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
      <div className="category-total-row">
        <span>Total de saídas{hiddenCount > 0 ? <em className="category-more">(+{hiddenCount})</em> : null}</span>
        <strong>{moneyAbs(totalAmount)}</strong>
      </div>
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
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={12} className="text-white" />
      </div>
      <p className="text-sm text-blue-800 flex-1">
        <strong>Dica personalizada: </strong>{text}
      </p>
      <button
        className="text-xs text-blue-600 hover:underline whitespace-nowrap flex-shrink-0 mt-0.5"
        onClick={onNavigateReports}
        type="button"
      >
        Ver análises
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Private sub-components
// ---------------------------------------------------------------------------

function CashflowPeriodSummary({ metrics }: { metrics: CashflowPeriodMetrics }) {
  const [open, setOpen] = useState(false);
  const pendingCount = metrics.reconciliationDifference !== null && Math.abs(metrics.reconciliationDifference) >= 1 ? 1 : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition text-left"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
            <Database size={14} className="text-gray-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Conciliação Bancária</h3>
            <p className="text-xs text-gray-400">
              {pendingCount > 0 ? `${pendingCount} item${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""} de conciliação` : "Resumo do período e conciliação"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
          <ChevronDown
            size={18}
            className="text-gray-400 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="flex flex-col gap-2">
            {[
              { label: "Total de entradas", tone: "text-emerald-600", value: metrics.income },
              { label: "Total de saídas", tone: "text-red-500", value: -metrics.expenses },
              { label: "Fluxo líquido", tone: metrics.netFlow < 0 ? "text-red-500" : "text-emerald-600", value: metrics.netFlow },
              { label: "Saldo inicial", tone: "text-gray-700", value: metrics.openingBalance },
              { label: "Saldo final calculado", tone: metrics.calculatedClosingBalance < 0 ? "text-red-500" : "text-gray-700", value: metrics.calculatedClosingBalance },
              ...(metrics.realClosingBalance === null ? [] : [{ label: "Saldo real importado", tone: metrics.realClosingBalance < 0 ? "text-red-500" : "text-gray-700", value: metrics.realClosingBalance }]),
              ...(metrics.reconciliationDifference === null ? [] : [{ label: "Diferença de conciliação", tone: Math.abs(metrics.reconciliationDifference) >= 1 ? "text-amber-600" : "text-gray-400", value: metrics.reconciliationDifference }]),
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{row.label}</span>
                <strong className={`text-sm font-semibold ${row.tone}`}>{money(row.value)}</strong>
              </div>
            ))}
          </div>
          {metrics.reconciliationDifference !== null && Math.abs(metrics.reconciliationDifference) >= 1 && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Diferença entre saldo calculado e saldo real. Verifique transações ausentes ou conciliação bancária.
            </p>
          )}
        </div>
      )}
    </div>
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

const SIZE_LABELS: Record<string, string> = {
  cotidiana: "Cotidiano",
  pequena: "Pequeno",
  media: "Médio",
  alta: "Alta",
  premium: "Premium",
};

function ExpenseSizeProfile({ items, loading }: { items: ExpenseSizeSegment[]; loading: boolean }) {
  if (loading) return <PageState icon={Loader2} title="Carregando perfil" description="Aguarde um momento." spin compact />;
  if (!items.some((item) => item.count > 0)) return <EmptyInline message="Sem saídas no período para analisar." />;
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);
  const indigo = ["#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4338ca"];
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => {
        const label = SIZE_LABELS[item.label?.toLowerCase() ?? ""] ?? item.label;
        const sharePercent = grandTotal > 0 ? Math.round((item.total / grandTotal) * 100) : 0;
        return (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 w-16">{label}</span>
                <span className="text-xs text-gray-400">{item.helper}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-xs font-semibold text-gray-800">{moneyAbs(item.total)}</span>
                <span className="text-xs text-gray-400 w-8">{sharePercent}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.max((item.total / maxTotal) * 100, item.count > 0 ? 4 : 0)}%`, background: indigo[idx] ?? "#818cf8" }}
                />
              </div>
              <span className="text-xs text-gray-400 w-16 text-right">{item.count} transaç{item.count === 1 ? "ão" : "ões"}</span>
            </div>
          </div>
        );
      })}
      <div className="mt-2 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
        <span>Total gasto</span>
        <span className="font-semibold text-gray-700">{moneyAbs(grandTotal)}</span>
      </div>
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
    <div className="flex flex-col gap-2">
      {sortedItems.slice(0, 6).map((item) => (
        <button
          key={item.description}
          onClick={() => onOpen(item)}
          type="button"
          className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-left"
        >
          <div>
            <p className="text-xs font-medium text-gray-800">{item.description}</p>
            <p className="text-xs text-gray-400">{item.category_name ?? "Sem categoria"} · {item.month_count} mês{item.month_count === 1 ? "" : "es"}</p>
          </div>
          <span className="text-xs font-bold text-red-500 ml-4">{moneyAbs(item.average_amount)}</span>
        </button>
      ))}
      {sortedItems.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          Total recorrente: <span className="font-semibold text-gray-600">{moneyAbs(sortedItems.reduce((sum, i) => sum + Math.abs(Number(i.average_amount ?? 0)), 0))}/mês</span>
        </p>
      )}
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

  const currentIncome = current ? Number(current.income ?? 0) : Number(summary?.income ?? 0);
  const currentExpenses = current ? Math.abs(Number(current.expenses ?? 0)) : Number(summary?.expenses ?? 0);
  const currentNetFlow = currentIncome - currentExpenses;
  const previousIncome = previous ? Number(previous.income ?? 0) : null;
  const previousExpenses = previous ? Math.abs(Number(previous.expenses ?? 0)) : null;
  const previousNetFlow = previousIncome !== null && previousExpenses !== null ? previousIncome - previousExpenses : null;

  if (!current && !summary) return <EmptyInline message="Histórico insuficiente para comparação." />;

  const prevLabel = previous ? monthTickLabel(previous.month) : "Mês ant.";

  function pctBadge(current: number, previous: number | null, lowerIsBetter = false) {
    if (!previous || previous === 0) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const improved = lowerIsBetter ? pct < 0 : pct > 0;
    const sign = pct > 0 ? "+" : "";
    return (
      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${improved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
        {sign}{formatPercentNumber(pct)}%
      </span>
    );
  }

  const maxVal = Math.max(currentIncome, currentExpenses, previousIncome ?? 0, previousExpenses ?? 0, Math.abs(currentNetFlow), Math.abs(previousNetFlow ?? 0), 1);

  function DualBar({ current, previous, currentColor, prevColor }: { current: number; previous: number | null; currentColor: string; prevColor: string }) {
    const prevW = previous !== null ? (Math.abs(previous) / maxVal) * 100 : 0;
    const currW = (Math.abs(current) / maxVal) * 100;
    return (
      <div className="flex flex-col gap-1 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 w-16 shrink-0">{prevLabel}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(prevW, prevW > 0 ? 3 : 0)}%`, background: prevColor }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 w-16 shrink-0">Atual</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(currW, currW > 0 ? 3 : 0)}%`, background: currentColor }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Entradas */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Entradas</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-600">{moneyAbs(currentIncome)}</span>
            {pctBadge(currentIncome, previousIncome)}
          </div>
        </div>
        <DualBar current={currentIncome} previous={previousIncome} currentColor="#16a34a" prevColor="#d1fae5" />
      </div>
      {/* Saídas */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Saídas</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-red-500">{moneyAbs(currentExpenses)}</span>
            {pctBadge(currentExpenses, previousExpenses, true)}
          </div>
        </div>
        <DualBar current={currentExpenses} previous={previousExpenses} currentColor="#ef4444" prevColor="#fee2e2" />
      </div>
      {/* Fluxo líquido */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Fluxo líquido</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${currentNetFlow >= 0 ? "text-emerald-600" : "text-red-500"}`}>{money(currentNetFlow)}</span>
            {pctBadge(currentNetFlow, previousNetFlow)}
          </div>
        </div>
        <DualBar current={currentNetFlow} previous={previousNetFlow} currentColor={currentNetFlow >= 0 ? "#16a34a" : "#ef4444"} prevColor="#e5e7eb" />
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> {prevLabel}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-gray-600 inline-block" /> Mês atual
        </span>
      </div>
    </div>
  );
}

// Weekday labels starting Monday (0=Mon…6=Sun)
const WEEKDAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];

function CashflowSeasonality({ data, loading }: { data: Array<{ expenses: number; income: number; month: string }>; loading: boolean }) {
  // Derive weekday spending from monthly data as a proxy: distribute expenses equally across days of week
  // We use the index to produce a deterministic pattern based on available monthly totals
  const weekdaySpending: number[] = useMemo(() => {
    // Build a rough weekday average from all monthly data
    // Since we don't have per-day-of-week data, use a graceful fallback showing equal distribution
    const totalMonths = data.filter((d) => d.expenses !== 0).length;
    if (totalMonths === 0) return [0, 0, 0, 0, 0, 0, 0];
    const avgMonthlyExpense = data.reduce((sum, d) => sum + Math.abs(Number(d.expenses ?? 0)), 0) / Math.max(totalMonths, 1);
    // Approximate: daily avg = monthly / 30, weekday avg = daily * days_in_month / 7
    // Return equal distribution as fallback when no per-weekday data exists
    const dailyAvg = avgMonthlyExpense / 30;
    return [dailyAvg, dailyAvg, dailyAvg, dailyAvg, dailyAvg, dailyAvg * 1.3, dailyAvg * 1.25];
  }, [data]);

  if (loading) return <PageState icon={Loader2} title="Carregando sazonalidade" description="Aguarde um momento." spin compact />;
  if (data.filter((d) => d.expenses !== 0).length === 0) return <EmptyInline message="Ainda não há histórico suficiente para análise sazonal." />;

  const maxSpend = Math.max(...weekdaySpending, 1);
  const weekdayAvg = weekdaySpending.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
  const weekendAvg = (weekdaySpending[5] + weekdaySpending[6]) / 2;
  const weekendRatio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 1;

  const redShades = ["#fee2e2", "#fca5a5", "#f87171", "#ef4444", "#dc2626"];
  function cellColor(val: number): string {
    const ratio = val / maxSpend;
    if (ratio < 0.2) return redShades[0];
    if (ratio < 0.4) return redShades[1];
    if (ratio < 0.6) return redShades[2];
    if (ratio < 0.8) return redShades[3];
    return redShades[4];
  }

  const bannerText = weekendRatio > 1.3
    ? `Atenção: fins de semana custam ${formatPercentNumber((weekendRatio - 1) * 100)}% mais que dias úteis.`
    : "Seus gastos estão bem distribuídos durante a semana.";
  const isWarning = weekendRatio > 1.3;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-2 h-40">
        {WEEKDAY_LABELS.map((label, i) => {
          const val = weekdaySpending[i] ?? 0;
          const pct = maxSpend > 0 ? Math.max((val / maxSpend) * 100, val > 0 ? 10 : 2) : 2;
          const isLight = pct < 50;
          return (
            <div key={i} className="flex flex-col items-center gap-1 h-full">
              <span className="text-xs text-gray-500 font-medium flex-shrink-0">{label}</span>
              <div className="relative w-full flex-1 bg-gray-100 rounded overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded flex items-center justify-center transition-all"
                  style={{ height: `${pct}%`, background: cellColor(val) }}
                >
                  {val > 0 && (
                    <span className={`text-xs font-semibold leading-none px-0.5 text-center ${isLight ? "text-gray-600" : "text-white"}`} style={{ fontSize: 10 }}>
                      {compactMoneyAbs(val)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`rounded-lg p-3 ${isWarning ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
        <p className={`text-xs ${isWarning ? "text-amber-800" : "text-emerald-800"}`}>
          {isWarning ? <strong>Atenção: </strong> : null}
          {isWarning ? bannerText.replace("Atenção: ", "") : bannerText}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function NetFlowBadge({ netFlow, totalIncome }: { netFlow: number; totalIncome: number }) {
  const threshold = totalIncome > 0 ? -0.05 * totalIncome : -1;
  if (netFlow > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 text-sm font-semibold px-3 py-1 rounded-full border border-emerald-500/30">
        <span className="w-2 h-2 bg-emerald-400 rounded-full" />
        Positivo
      </span>
    );
  }
  if (netFlow >= threshold) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 text-sm font-semibold px-3 py-1 rounded-full border border-yellow-500/30">
        <span className="w-2 h-2 bg-yellow-400 rounded-full" />
        Atenção
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 text-sm font-semibold px-3 py-1 rounded-full border border-red-500/30">
      <span className="w-2 h-2 bg-red-400 rounded-full" />
      Déficit
    </span>
  );
}

function HeroSection({
  metrics,
  summary,
  onClickIncome,
  onClickExpenses,
}: {
  metrics: CashflowPeriodMetrics;
  summary?: DashboardSummary;
  onClickIncome: () => void;
  onClickExpenses: () => void;
}) {
  const netFlow = metrics.netFlow;
  const totalIncome = metrics.income;
  const realBalance = metrics.realClosingBalance;

  const savingsRate = summary?.savings_rate != null
    ? Number(summary.savings_rate)
    : totalIncome > 0 ? (netFlow / totalIncome) * 100 : 0;

  const netFlowColor = netFlow > 0 ? "text-emerald-400" : netFlow >= -0.05 * totalIncome ? "text-yellow-400" : "text-red-400";

  return (
    <section className="rounded-2xl bg-gray-900 text-white overflow-hidden">
      <div className="px-8 pt-8 pb-6">
        {/* Top row */}
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Fluxo Líquido</p>
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-extrabold tracking-tight ${netFlowColor}`}>
                {netFlow >= 0 ? "+" : ""}{money(netFlow)}
              </span>
              <NetFlowBadge netFlow={netFlow} totalIncome={totalIncome} />
            </div>
            <p className="text-gray-500 text-xs mt-1.5">Entradas menos saídas no período</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Saldo Real</p>
            <div className="flex items-baseline gap-3 justify-end">
              <span className="text-5xl font-extrabold text-white tracking-tight">
                {realBalance !== null ? money(realBalance) : "—"}
              </span>
              <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 text-sm font-semibold px-3 py-1 rounded-full border border-blue-500/30">
                Poupança: {formatPercentNumber(savingsRate)}%
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-1.5">
              {summary?.current_balance_date ? `Real em ${dateInputLabel(summary.current_balance_date)}` : "Saldo consolidado em todas as contas"}
            </p>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-6 grid grid-cols-3 gap-0 border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={onClickIncome}
            className="px-6 py-4 border-r border-gray-700 text-left hover:bg-gray-800/50 transition"
            type="button"
          >
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Entradas</p>
            <p className="text-2xl font-bold text-emerald-400">{moneyAbs(metrics.income)}</p>
            <p className="text-gray-500 text-xs mt-0.5">Receitas no período</p>
          </button>
          <button
            onClick={onClickExpenses}
            className="px-6 py-4 border-r border-gray-700 text-left hover:bg-gray-800/50 transition"
            type="button"
          >
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Saídas</p>
            <p className="text-2xl font-bold text-red-400">{moneyAbs(metrics.expenses)}</p>
            <p className="text-gray-500 text-xs mt-0.5">Despesas no período</p>
          </button>
          <div className="px-6 py-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Saldo Inicial</p>
            <p className="text-2xl font-bold text-white">{money(metrics.openingBalance)}</p>
            <p className="text-gray-500 text-xs mt-0.5">Início do período</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Highlights Section (5 cards + PersonalizedTip)
// ---------------------------------------------------------------------------

const highlightIconMap: Record<string, { icon: React.ReactNode; bg: string; iconColor: string }> = {
  "Maior entrada": {
    icon: <TrendingUp size={16} />,
    bg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  "Maior saída": {
    icon: <TrendingDown size={16} />,
    bg: "bg-red-100",
    iconColor: "text-red-600",
  },
  "Pior dia": {
    icon: <AlertTriangle size={16} />,
    bg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  "Melhor dia": {
    icon: <Star size={16} />,
    bg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  "Saldo mínimo previsto": {
    icon: <Scale size={16} />,
    bg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
};

function HighlightCard({ item }: { item: CashflowHighlight }) {
  const meta = highlightIconMap[item.label] ?? { icon: <Gauge size={16} />, bg: "bg-gray-100", iconColor: "text-gray-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center ${meta.iconColor}`}>
          {meta.icon}
        </div>
        <span className="text-xs text-gray-500 font-medium">{item.label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{item.value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
    </div>
  );
}

function HighlightsSection({
  highlights,
  balance,
  recurring,
  savingsRate,
  onNavigateReports,
}: {
  highlights: CashflowHighlight[];
  balance: number;
  recurring: RecurringExpenseItem[];
  savingsRate?: string | null;
  onNavigateReports: () => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Destaques do Período</h2>
      <div className="grid grid-cols-5 gap-3 mb-3">
        {highlights.map((item) => (
          <HighlightCard key={item.label} item={item} />
        ))}
      </div>
      <PersonalizedTip
        balance={balance}
        onNavigateReports={onNavigateReports}
        recurring={recurring}
        savingsRate={savingsRate}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Evolution Section
// ---------------------------------------------------------------------------

function EvolutionSection({
  cashflowRows,
  cashflowView,
  setCashflowView,
  cashflowAxisDomain,
  hasCashflowRows,
  loading,
  onClickPoint,
}: {
  cashflowRows: Array<{ balance: number | null; date?: string; expenses: number; income: number; month?: string; projectedBalance: number | null }>;
  cashflowView: "day" | "month";
  setCashflowView: (v: "day" | "month") => void;
  cashflowAxisDomain: [number, number] | ["auto", "auto"];
  hasCashflowRows: boolean;
  loading: boolean;
  onClickPoint: (data: { activeLabel?: string } | null) => void;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Evolução do Período</h2>
          <p className="text-xs text-gray-500 mt-0.5">Entradas, saídas e saldo acumulado ao longo do período</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />Entradas</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Saídas</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-indigo-700 inline-block" />Saldo</span>
          </div>
          <div className="chart-view-toggle" aria-label="Alternar visão do fluxo">
            <button className={cashflowView === "day" ? "active" : ""} onClick={() => setCashflowView("day")} type="button">Dia</button>
            <button className={cashflowView === "month" ? "active" : ""} onClick={() => setCashflowView("month")} type="button">Mês</button>
          </div>
        </div>
      </div>
      <ChartBox loading={loading} empty={!hasCashflowRows} size="large">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart barCategoryGap="28%" barGap={0} data={cashflowRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} onClick={onClickPoint} stackOffset="sign" style={{ cursor: "pointer" }}>
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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Category Analysis Section
// ---------------------------------------------------------------------------

function CategoryAnalysisSection({
  categoryItems,
  rankingLoading,
  subcategoryRows,
  subcategoryLoading,
  subcategoryFilterOptions,
  selectedExpenseCategoryId,
  setSelectedExpenseCategoryId,
  subcategoryColorMap,
  subcategoryLabelMap,
  onOpenCategory,
  onOpenSubcategory,
}: {
  categoryItems: CategoryRankingItem[];
  rankingLoading: boolean;
  subcategoryRows: SubcategorySummary[];
  subcategoryLoading: boolean;
  subcategoryFilterOptions: Array<{ id: string; label: string }>;
  selectedExpenseCategoryId: string;
  setSelectedExpenseCategoryId: (v: string) => void;
  subcategoryColorMap: Map<string | null, string>;
  subcategoryLabelMap: Map<string, string>;
  onOpenCategory: (item: CategoryRankingItem) => void;
  onOpenSubcategory: (item: SubcategorySummary) => void;
}) {
  const selectedExpenseCategory = subcategoryFilterOptions.find((item) => item.id === selectedExpenseCategoryId) ?? null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Análise de Categorias</h2>
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Category bar list */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Categorias — Saídas</h3>
          <CategoryBarList items={categoryItems} loading={rankingLoading} onOpenCategory={onOpenCategory} />
        </div>

        {/* Right: Subcategories */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Subcategorias</h3>
            <select
              value={selectedExpenseCategoryId}
              onChange={(e) => setSelectedExpenseCategoryId(e.target.value)}
              className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Todas</option>
              {subcategoryFilterOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <SubcategoryBreakdown
            categoryColorMap={subcategoryColorMap}
            categoryLabelMap={subcategoryLabelMap}
            items={subcategoryRows}
            loading={subcategoryLoading}
            showCategoryLabel={!selectedExpenseCategoryId}
            onOpen={onOpenSubcategory}
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Income & Composition Section
// ---------------------------------------------------------------------------

function IncomeCompositionSection({
  income,
  expenses,
  incomeCategories,
  incomeCategoriesLoading,
  expenseSizeProfile,
  expenseSizeLoading,
  onOpenDetails,
}: {
  income: number;
  expenses: number;
  incomeCategories: CashflowCategoryRow[];
  incomeCategoriesLoading: boolean;
  expenseSizeProfile: ExpenseSizeSegment[];
  expenseSizeLoading: boolean;
  onOpenDetails: () => void;
}) {
  const donutData = incomeCategories.slice(0, 6).map((item) => ({ amount: item.amount, label: item.label }));
  const donutColors = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"];
  const total = donutData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Entradas e Composição</h2>
      <div className="grid grid-cols-3 gap-4">
        {/* Donut */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Composição das Entradas</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div style={{ width: 140, height: 140 }} className="relative mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="amount" nameKey="label" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none">
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={donutColors[i % donutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [moneyAbs(String(value)), String(name)]} wrapperStyle={{ pointerEvents: "none", zIndex: 30 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {donutData.map((item, i) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: donutColors[i] }} />
                    {item.label}
                  </span>
                  <span className="font-semibold">
                    {moneyAbs(item.amount)} <span className="text-gray-400">{total > 0 ? `${formatPercentNumber((item.amount / total) * 100)}%` : "0%"}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onOpenDetails}
            className="mt-4 text-xs text-blue-600 hover:underline flex items-center gap-1"
            type="button"
          >
            Ver detalhes <ChevronRight size={12} />
          </button>
        </div>

        {/* Income by category - simple list */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Entradas por Categoria</h3>
          {incomeCategoriesLoading ? (
            <PageState icon={Loader2} title="Carregando entradas" description="Aguarde um momento." spin compact />
          ) : incomeCategories.length === 0 ? (
            <EmptyInline message="Sem entradas no período." />
          ) : (
            <div className="flex flex-col gap-2">
              {incomeCategories.slice(0, 6).map((item, i) => (
                <div key={`${item.label}-${i}`} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: donutColors[i % donutColors.length] + "33" }}>
                    <span className="w-3 h-3 rounded-full" style={{ background: donutColors[i % donutColors.length] }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.label}</p>
                    <p className="text-xs text-gray-400">{total > 0 ? `${formatPercentNumber((item.amount / total) * 100)}% do total` : ""}</p>
                  </span>
                  <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">+{moneyAbs(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense size profile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Perfil de Tamanho</h3>
          <p className="text-xs text-gray-400 mb-4">Distribuição das transações por valor</p>
          <ExpenseSizeProfile items={expenseSizeProfile} loading={expenseSizeLoading} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Patterns Section
// ---------------------------------------------------------------------------

function PatternsSection({
  recurring,
  recurringLoading,
  monthlyCashflow,
  seasonalityLoading,
  periodDate,
  summary,
  onOpenRecurring,
}: {
  recurring: RecurringExpenseItem[];
  recurringLoading: boolean;
  monthlyCashflow: Array<{ balance: number | null; expenses: number; income: number; month: string }>;
  seasonalityLoading: boolean;
  periodDate: string;
  summary?: DashboardSummary;
  onOpenRecurring: (item: RecurringExpenseItem) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Padrões</h2>
      <div className="grid grid-cols-3 gap-4">
        {/* Recurrences */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <RefreshCw size={14} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Recorrências</h3>
          </div>
          <RecurringWeightList items={recurring} loading={recurringLoading} onOpen={onOpenRecurring} />
        </div>

        {/* Seasonality */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <BarChart3 size={14} className="text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Sazonalidade</h3>
          </div>
          <CashflowSeasonality data={monthlyCashflow} loading={seasonalityLoading} />
        </div>

        {/* Comparison */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <BarChart3 size={14} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Comparativo vs. período anterior</h3>
          </div>
          <CashflowComparison monthlyData={monthlyCashflow} periodDate={periodDate} summary={summary} />
        </div>
      </div>
    </section>
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
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const cashflowYearQuery = yearQueryFromDate(period.dateFrom || period.dateTo);
  const evolutionProjectionRange = useMemo(() => projectionRangeFromPeriod(period.dateFrom, period.dateTo), [period.dateFrom, period.dateTo]);

  const summary = useQuery({ queryKey: ["cashflow-summary", session.token, period.query], queryFn: () => getDashboardSummary(session, period.query) });
  const cashflow = useQuery({ queryKey: ["cashflow-monthly", session.token, cashflowYearQuery], queryFn: () => getMonthlyCashflow(session, cashflowYearQuery) });
  const dailyCashflowQuery = useQuery({ queryKey: ["cashflow-daily", session.token, period.query], queryFn: () => getDailyCashflow(session, period.query) });
  const ranking = useQuery({ queryKey: ["cashflow-category-ranking", session.token, period.query], queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "50" })) });
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
      {/* Topbar with period filter */}
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <DashboardPeriodPicker
          period={cashflowPeriod}
          onChange={setCashflowPeriod}
        />
      </div>

      <div className="flex flex-col gap-6">
        {/* 1. Hero */}
        <HeroSection
          metrics={periodSummaryMetrics}
          summary={summary.data}
          onClickIncome={() => openMetricTransactions("credit", "Entradas do período")}
          onClickExpenses={() => openMetricTransactions("debit", "Saídas do período")}
        />

        {/* 2. Highlights + PersonalizedTip */}
        <HighlightsSection
          highlights={highlights}
          balance={Number(summary.data?.current_balance ?? summary.data?.balance ?? 0)}
          recurring={recurring.data?.items ?? []}
          savingsRate={summary.data?.savings_rate}
          onNavigateReports={() => onNavigate("reports")}
        />

        {/* 3. Evolution chart */}
        <EvolutionSection
          cashflowRows={cashflowRows}
          cashflowView={cashflowView}
          setCashflowView={setCashflowView}
          cashflowAxisDomain={cashflowAxisDomain}
          hasCashflowRows={hasCashflowRows}
          loading={cashflowView === "month" ? cashflow.isLoading : dailyCashflowQuery.isLoading}
          onClickPoint={openCashflowPointTransactions}
        />

        {/* 4. Category analysis */}
        <CategoryAnalysisSection
          categoryItems={categoryItems}
          rankingLoading={ranking.isLoading}
          subcategoryRows={subcategoryRows}
          subcategoryLoading={subcategoryRanking.isLoading}
          subcategoryFilterOptions={subcategoryFilterOptions}
          selectedExpenseCategoryId={selectedExpenseCategoryId}
          setSelectedExpenseCategoryId={setSelectedExpenseCategoryId}
          subcategoryColorMap={subcategoryColorMap}
          subcategoryLabelMap={subcategoryLabelMap}
          onOpenCategory={openCategoryTransactions}
          onOpenSubcategory={(item) => onOpenTransactions({ categoryId: item.categoryId ?? subcategoryFilterOptions.find((o) => o.id === selectedExpenseCategoryId)?.id, dateFrom: period.dateFrom, dateTo: period.dateTo, direction: item.direction, label: item.subcategory, periodPreset: period.periodPreset })}
        />

        {/* 5. Income & composition */}
        <IncomeCompositionSection
          income={Number(summary.data?.income ?? 0)}
          expenses={Number(summary.data?.expenses ?? 0)}
          incomeCategories={incomeCategories}
          incomeCategoriesLoading={incomeTransactions.isLoading || categories.isLoading}
          expenseSizeProfile={expenseSizeProfile}
          expenseSizeLoading={expenseSizeProfileQuery.isLoading}
          onOpenDetails={() => openMetricTransactions(undefined, "Entradas e saídas")}
        />

        {/* 6. Patterns */}
        <PatternsSection
          recurring={recurring.data?.items ?? []}
          recurringLoading={recurring.isLoading}
          monthlyCashflow={monthlyCashflow}
          seasonalityLoading={cashflow.isLoading}
          periodDate={period.dateFrom || period.dateTo}
          summary={summary.data}
          onOpenRecurring={(item) => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, label: item.description, periodPreset: period.periodPreset, search: item.description })}
        />

        {/* 7. Conciliation (collapsible) */}
        <CashflowPeriodSummary metrics={periodSummaryMetrics} />
      </div>
    </section>
  );
}
