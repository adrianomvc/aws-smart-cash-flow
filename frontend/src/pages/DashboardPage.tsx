import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileWarning,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
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
  getBudgets,
  getCalendarEvents,
  getCategoryGrowthAlerts,
  getCategoryRanking,
  getCreditCardInstallments,
  getCreditCardStatements,
  getDailyCashflow,
  getDashboardSummary,
  getDataQuality,
  getGoals,
  getMonthlyCashflow,
  getProjectionFeed,
  getRecurringExpenses,
  getRecurringIncomes,
  getTransactions,
} from "../lib/api";
import {
  buildBudgetRows,
  buildCalendarEvents,
  calendarEventStatusLabel,
  calendarEventTone,
  calendarEventTypeLabel,
  compactMoneyAbs,
  compactMoneyAxis,
  dateInputLabel,
  dateLabel,
  dayTickLabel,
  formatCurrencyCompact,
  formatCurrencyCompactSigned,
  formatPercentNumber,
  isoDate,
  money,
  moneyAbs,
  moneyAxisDomain,
  monthRange,
  monthTickLabel,
  nextDaysRange,
  percent,
  periodSummary,
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
  InlineSuccess,
  PageState,
  Panel,
  PanelLink,
} from "../components/ui";
import { CategoryBarList, PersonalizedTip, compactCategoryDistribution } from "./CashflowPage";
import type {
  ApiSession,
  BudgetRead,
  CategoryGrowthAlertItem,
  CategoryRankingItem,
  CategoryRead,
  DataQuality,
  DashboardSummary,
  GoalRead,
  RecurringExpenseItem,
} from "../lib/api";
import type {
  CalendarEvent,
  ImportDrilldown,
  PeriodState,
  TransactionDrilldown,
} from "../types";
import type { Page } from "../types";
import type { CashFlowProjectionChartPoint, CashFlowProjectionPoint } from "../lib/cashflowProjection";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const chartPalette = ["#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#64748b", "#2563eb", "#14b8a6"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dashboardCashflowDescription(period: ReturnType<typeof usePeriod>, view: "day" | "month") {
  if (view === "day") return "Receitas e despesas por dia do caixa; cartão usa vencimento da fatura quando identificado.";
  return "Receitas, despesas e saldo por mês.";
}

function chartSeriesLabel(name: string) {
  const labels: Record<string, string> = { amount: "Valor", balance: "Saldo", expenses: "Despesas", income: "Receita", payments: "Pgto. fatura", projectedBalance: "Saldo projetado" };
  return labels[name] ?? name;
}

function chartMoneyLabel(value: string, name: string) {
  if (["expenses", "Despesas"].includes(name)) return money(value);
  return ["balance", "projectedBalance", "Saldo", "Saldo acumulado", "Saldo previsto", "Saldo projetado"].includes(name) ? money(value) : moneyAbs(value);
}

function signedPercent(value?: string | null) {
  if (!value) return "0%";
  const numberValue = Number(value) * 100;
  return `${numberValue > 0 ? "+" : ""}${formatPercentNumber(numberValue)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function commitmentStatus(value: number | null): { label: string; tone: "positive" | "negative" | "warning" | "info" } {
  if (value === null) return { label: "Sem receita no período", tone: "info" };
  if (value < 0.5) return { label: "Excelente", tone: "positive" };
  if (value < 0.8) return { label: "Atenção", tone: "warning" };
  return { label: "Risco", tone: "negative" };
}

function financialHealthLabel(score: number) {
  if (score >= 80) return "Saudável";
  if (score >= 60) return "Atenção leve";
  if (score >= 40) return "Atenção";
  return "Risco";
}

function financialHealthTone(score: number): "positive" | "negative" | "warning" | "info" {
  if (score >= 80) return "positive";
  if (score >= 40) return "warning";
  return "negative";
}

function budgetTone(ratio: number): "negative" | "positive" | "warning" {
  if (ratio > 1) return "negative";
  if (ratio >= 0.85) return "warning";
  return "positive";
}

function alertSeverityLabel(tone: "info" | "negative" | "warning") {
  if (tone === "negative") return "Crítico";
  if (tone === "warning") return "Atenção";
  return "Informação";
}

function buildPersistedBudgetRows({ budgets, categories, ranking }: { budgets?: BudgetRead[]; categories: CategoryRead[]; ranking: CategoryRankingItem[] }) {
  if (!budgets?.length) return [];
  const spentByCategory = new Map(ranking.map((item) => [item.category_id, Number(item.amount ?? 0)]));
  const categoryNames = new Map(categories.map((c) => [c.id, categoryPath(c, categories)]));
  return budgets.map((budget) => {
    const spent = budget.category_id ? spentByCategory.get(budget.category_id) ?? 0 : 0;
    const limit = Number(budget.limit_amount);
    return { categoryId: budget.category_id, categoryName: budget.category_id ? categoryNames.get(budget.category_id) ?? budget.name : budget.name, limit, ratio: spent / Math.max(limit, 1), spent };
  });
}

function buildGoalRows(summary?: DashboardSummary, persistedGoals?: GoalRead[]) {
  if (persistedGoals?.length) {
    return persistedGoals.map((goal) => ({ current: Number(goal.current_amount), deadline: goal.target_date ? `Meta para ${goal.target_date}` : "Sem prazo definido", description: goal.description ?? "Meta cadastrada no planejamento.", name: goal.name, ratio: Number(goal.current_amount) / Math.max(Number(goal.target_amount), 1), status: goal.status, target: Number(goal.target_amount) }));
  }
  const balance = Math.max(Number(summary?.balance ?? 0), 0);
  const monthlyBoost = Math.min(balance, 1200);
  const goals = [
    { current: 16500 + monthlyBoost, deadline: "Meta para 90 dias", description: "Cobrir despesas essenciais com mais previsibilidade.", name: "Reserva de emergência", status: "Em avanço", target: 24000 },
    { current: 4200 + monthlyBoost * 0.3, deadline: "Meta para 6 meses", description: "Separar recursos para uma viagem familiar planejada.", name: "Viagem em família", status: "No ritmo", target: 12000 },
    { current: 2800 + monthlyBoost * 0.2, deadline: "Meta para 12 meses", description: "Construir uma base de investimento recorrente.", name: "Carteira de longo prazo", status: "Inicial", target: 18000 },
  ];
  return goals.map((goal) => ({ ...goal, ratio: goal.current / Math.max(goal.target, 1) }));
}

function dashboardAlerts({ categoryGrowth, period, quality, recurring, summary }: { categoryGrowth: CategoryGrowthAlertItem[]; period: ReturnType<typeof usePeriod>; quality?: DataQuality; recurring: RecurringExpenseItem[]; summary?: DashboardSummary }) {
  type Alert = { description: string; icon: LucideIcon; importDrilldown?: ImportDrilldown; target?: Page; title: string; tone: "info" | "negative" | "warning"; transactionDrilldown?: TransactionDrilldown };
  const alerts: Alert[] = [];
  const balance = Number(summary?.balance ?? 0);
  const qualityRatio = Number(quality?.categorized_ratio ?? 0);
  const uncategorized = quality?.uncategorized_count ?? 0;
  const importsWithErrors = quality?.imports_with_errors ?? 0;
  if (balance < 0) alerts.push({ description: `Saldo negativo de ${moneyAbs(balance)} no período.`, icon: AlertCircle, title: "Saldo negativo", tone: "negative" });
  if (qualityRatio > 0 && qualityRatio < 0.7) alerts.push({ description: `${percent(quality?.categorized_ratio)} das transações estão categorizadas.`, icon: ShieldCheck, target: "review", title: "Qualidade baixa", tone: "warning" });
  if (uncategorized > 0) alerts.push({ description: `${uncategorized} transação${uncategorized === 1 ? "" : "ões"} sem categoria.`, icon: ShieldCheck, target: "review", title: "Revisão pendente", tone: "warning" });
  if (importsWithErrors > 0) alerts.push({ description: `${importsWithErrors} importação${importsWithErrors === 1 ? "" : "ões"} com erro.`, icon: FileWarning, importDrilldown: { issueFilter: "with_errors", label: "Importações com erro" }, target: "imports", title: "Importação com erro", tone: "negative" });
  categoryGrowth.forEach((item) => alerts.push({ description: `${item.category_name} subiu ${percent(item.change_ratio)} (${moneyAbs(item.change_amount)}) contra o período anterior.`, icon: BarChart3, title: "Categoria em alta", tone: "warning", transactionDrilldown: { categoryId: item.category_id, dateFrom: period.dateFrom, dateTo: period.dateTo, label: item.category_name, periodPreset: period.periodPreset } }));
  recurring.filter((item) => Number(item.change_ratio ?? 0) >= 0.3 && Number(item.last_amount) >= 50).slice(0, 3).forEach((item) => alerts.push({ description: `${item.description} subiu ${signedPercent(item.change_ratio)}: último ${moneyAbs(item.last_amount)} contra média ${moneyAbs(item.average_amount)}.`, icon: RefreshCw, title: "Recorrente em alta", tone: "warning", transactionDrilldown: { dateFrom: period.dateFrom, dateTo: period.dateTo, direction: "debit", label: item.description, periodPreset: period.periodPreset, search: item.description } }));
  return alerts;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DashboardFlowStory({ futureCommitments, onOpenAnalysis, periodLabel, projectionLoading = false, projectedBalance, summary, summaryLoading = false }: { futureCommitments?: number | null; onOpenAnalysis?: () => void; periodLabel: string; projectionLoading?: boolean; projectedBalance?: number | null; summary?: DashboardSummary; summaryLoading?: boolean }) {
  const balance = Number(summary?.balance ?? 0);
  const mappedFutureCommitments = futureCommitments ?? Number(summary?.payments ?? 0);
  const expectedBalance = projectedBalance ?? balance - mappedFutureCommitments;
  const steps: Array<{ helper: string; icon: LucideIcon; label: string; title: string; tone: "info" | "negative" | "positive" | "warning"; value: string }> = [
    { helper: summaryLoading ? "dados em atualização" : "receitas no período", icon: ArrowUpCircle, label: "Entrou", title: summaryLoading ? "Carregando receitas" : moneyAbs(summary?.income), tone: summaryLoading ? "info" : "positive", value: summaryLoading ? "Carregando" : formatCurrencyCompact(summary?.income) },
    { helper: summaryLoading ? "dados em atualização" : "despesas no período", icon: BarChart3, label: "Saiu", title: summaryLoading ? "Carregando despesas" : moneyAbs(summary?.expenses), tone: summaryLoading ? "info" : "negative", value: summaryLoading ? "Carregando" : formatCurrencyCompact(summary?.expenses) },
    { helper: summaryLoading ? "dados em atualização" : balance < 0 ? "resultado negativo" : "resultado positivo", icon: BarChart3, label: "Saldo do mês", title: summaryLoading ? "Carregando saldo do mês" : moneyAbs(summary?.balance), tone: summaryLoading ? "info" : balance < 0 ? "negative" : "positive", value: summaryLoading ? "Carregando" : formatCurrencyCompactSigned(summary?.balance) },
    { helper: projectionLoading ? "projeção em atualização" : projectedBalance === null || projectedBalance === undefined ? "fatura mapeada" : "saídas conhecidas em 30 dias", icon: CreditCard, label: "Compromissos futuros", title: projectionLoading ? "Calculando compromissos" : moneyAbs(mappedFutureCommitments), tone: "info", value: projectionLoading ? "Calculando" : formatCurrencyCompact(mappedFutureCommitments) },
    { helper: projectionLoading ? "projeção em atualização" : projectedBalance === null || projectedBalance === undefined ? "após compromissos mapeados" : "projeção dos próximos 30 dias", icon: CalendarDays, label: "Saldo previsto", title: projectionLoading ? "Calculando saldo previsto" : money(expectedBalance), tone: projectionLoading ? "info" : expectedBalance < 0 ? "negative" : "positive", value: projectionLoading ? "Calculando" : formatCurrencyCompactSigned(expectedBalance) },
  ];
  return (
    <section className="flow-story" aria-label="História do fluxo de caixa">
      <div className="flow-story-header">
        <div><span>A história do seu dinheiro</span><strong>{periodLabel}</strong></div>
        {onOpenAnalysis ? <button className="panel-link" onClick={onOpenAnalysis} type="button">Ver análises completas<ChevronRight size={14} /></button> : null}
      </div>
      <div className="flow-story-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div className="flow-story-step" key={step.label}>
              <span className={`flow-story-icon ${step.tone}`}><Icon size={22} /></span>
              <div><small>{step.label}</small><strong className={step.tone} title={step.title}>{step.value}</strong><p>{step.helper}</p></div>
              {index < steps.length - 1 ? <ChevronRight className="flow-story-arrow" size={18} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CategoryDonutTooltip({ active, payload, total }: { active?: boolean; payload?: Array<{ payload?: CategoryRankingItem & { amountValue?: number } }>; total: number }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  const amount = Number((item as Record<string, unknown>).amountValue ?? item.amount ?? 0);
  const ratio = total > 0 ? amount / total : Number(item.share_ratio ?? 0);
  return (
    <div className="chart-tooltip donut-tooltip">
      <strong>{item.category_name}</strong>
      <span>{moneyAbs(String(amount))}</span>
      <small>{percent(String(ratio))} do total</small>
    </div>
  );
}

function CategoryDonut({ items, loading, onOpenCategory }: { items: CategoryRankingItem[]; loading: boolean; onOpenCategory: (item: CategoryRankingItem) => void }) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const chartItems = compactCategoryDistribution(items);
  const total = chartItems.reduce((sum, item) => sum + Number(item.amountValue ?? 0), 0);
  return (
    <div className="donut-summary">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 28, bottom: 4, left: 28 }}>
            <Pie data={chartItems} dataKey="amountValue" nameKey="category_name" innerRadius="62%" outerRadius="86%" paddingAngle={2} stroke="none">
              {chartItems.map((item, index: number) => (
                <Cell key={item.category_id ?? item.category_name} fill={chartPalette[index % chartPalette.length]} />
              ))}
            </Pie>
            <Tooltip allowEscapeViewBox={{ x: true, y: true }} content={<CategoryDonutTooltip total={total} />} wrapperStyle={{ pointerEvents: "none", zIndex: 30 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center"><strong>{compactMoneyAbs(total)}</strong><span>Total</span></div>
      </div>
      <div className="donut-legend">
        {chartItems.slice(0, 5).map((item: any, index: number) => (
          <button className="donut-legend-row" key={item.category_id ?? item.category_name} onClick={() => onOpenCategory(item)} type="button">
            <i style={{ background: chartPalette[index % chartPalette.length] }} />
            <span>{item.category_name}</span>
            <strong>{percent(item.share_ratio)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChangeChip({ ratio }: { ratio: string | null }) {
  if (ratio === null || ratio === undefined) return null;
  const val = Number(ratio);
  if (isNaN(val) || val === 0) return null;
  const pct = Math.abs(val * 100).toFixed(0);
  const up = val > 0;
  return (
    <em className={`recurring-change recurring-change--${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {pct}%
    </em>
  );
}

function RecurringList({ items, loading, onOpenTransactions, period }: { items: RecurringExpenseItem[]; loading: boolean; onOpenTransactions: (drilldown?: TransactionDrilldown) => void; period: ReturnType<typeof usePeriod> }) {
  if (loading) return <PageState icon={Loader2} title="Carregando recorrentes" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhum pagamento recorrente identificado." />;
  const LIMIT = 8;
  const sorted = [...items].sort((a, b) => Number(b.average_amount) - Number(a.average_amount));
  const visible = sorted.slice(0, LIMIT);
  const hiddenCount = Math.max(sorted.length - LIMIT, 0);
  const total = sorted.reduce((s, i) => s + Number(i.average_amount ?? 0), 0);
  return (
    <div className="recurring-list">
      {visible.map((item) => (
        <button
          className="recurring-row"
          key={item.description}
          type="button"
          onClick={() => onOpenTransactions({
            dateFrom: period.dateFrom,
            dateTo: period.dateTo,
            direction: "debit",
            label: item.description,
            periodPreset: period.periodPreset,
            search: item.description,
          })}
        >
          <div className="recurring-info">
            <strong>{item.description}</strong>
            <small>{item.category_name ?? "Sem categoria"} · {item.month_count} {item.month_count === 1 ? "mês" : "meses"}</small>
          </div>
          <div className="recurring-value">
            <b>{moneyAbs(item.average_amount)}</b>
            <ChangeChip ratio={item.change_ratio} />
          </div>
        </button>
      ))}
      <div className="recurring-footer">
        <span>Total recorrente / mês{hiddenCount > 0 ? <em className="category-more">(+{hiddenCount})</em> : null}</span>
        <strong>{moneyAbs(String(total))}</strong>
      </div>
    </div>
  );
}

function CreditCardSnapshot({ commitmentRate, currentStatementTotal, futureInstallments, installmentCount, loading }: { commitmentRate: number | null; currentStatementTotal: number; futureInstallments: string | number; installmentCount: number; loading: boolean }) {
  if (loading) return <PageState icon={Loader2} title="Carregando cartões" description="Aguarde um momento." spin compact />;
  const status = commitmentStatus(commitmentRate);
  return (
    <div className="snapshot-grid cards">
      <div><span>Fatura atual</span><strong>{moneyAbs(currentStatementTotal)}</strong><small>Detectada/importada no período</small></div>
      <div><span>Parcelado futuro</span><strong>{moneyAbs(futureInstallments)}</strong><small>{installmentCount} parcela{installmentCount === 1 ? "" : "s"} ativa{installmentCount === 1 ? "" : "s"}</small></div>
      <div className="wide">
        <span>Comprometimento com cartão</span>
        <strong>{commitmentRate === null ? "Sem receita" : `${formatPercentNumber(commitmentRate * 100)}%`}</strong>
        <small>{status.label} · % da receita do período</small>
        <span className="progress-track large" aria-label="Comprometimento com cartão">
          <i className={status.tone} style={{ width: `${Math.min((commitmentRate ?? 0) * 100, 100)}%` }} />
        </span>
      </div>
    </div>
  );
}

function ProjectionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: CashFlowProjectionChartPoint }> }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const point = payload[0].payload;
  const confidenceLabel: Record<string, string> = { high: "alta", low: "baixa", medium: "média" };
  const visibleEvents = point.events.slice(0, 3);
  const hiddenEvents = Math.max(point.events.length - visibleEvents.length, 0);
  return (
    <div className="chart-tooltip projection-tooltip">
      <strong>{dateLabel(point.date)}</strong>
      <span>Entradas: {moneyAbs(point.entradas)}</span>
      <span>Saídas: {moneyAbs(point.saidas)}</span>
      <span>Saldo: {money(point.saldoProjetado)}</span>
      {point.events.length ? (
        <div>
          <small>Eventos</small>
          {visibleEvents.map((event) => <small className={event.type} key={`${point.date}-${event.description}-${event.source}`}>{event.type === "income" ? "Entrada" : "Saída"} · {event.description}: {moneyAbs(event.amount)}</small>)}
          {hiddenEvents > 0 ? <small>+{hiddenEvents} evento{hiddenEvents === 1 ? "" : "s"}</small> : null}
        </div>
      ) : null}
      <small>Confiança: {confidenceLabel[point.confidence] ?? point.confidence}</small>
    </div>
  );
}

function ProjectedCashflowSnapshot({ data, loading, lowestProjectedBalance, onNavigatePlanning, risk }: { data: CashFlowProjectionChartPoint[]; loading: boolean; lowestProjectedBalance: number; onNavigatePlanning: () => void; risk: CashFlowProjectionPoint | null }) {
  const [showCalculation, setShowCalculation] = useState(false);
  if (loading) return <PageState icon={Loader2} title="Carregando projeção" description="Aguarde um momento." spin compact />;
  if (!data.length) return <EmptyInline message="Sem dados para projetar o período." />;
  const riskDays = risk ? Math.floor((new Date(risk.date).getTime() - new Date(isoDate(new Date())).getTime()) / 86400000) : null;
  return (
    <div className="projected-snapshot">
      <button className="calculation-note" onClick={() => setShowCalculation((c) => !c)} type="button"><Gauge size={16} /><span>Como calculamos?</span></button>
      {showCalculation ? (
        <div className="calculation-details">
          <p>A projeção parte do saldo atual e calcula dia a dia: saldo do dia anterior + entradas previstas - saídas previstas.</p>
          <p>Entradas incluem receitas futuras conhecidas e recorrências. Saídas incluem compromissos, parcelas, contas recorrentes, assinaturas e gastos variáveis estimados pelo histórico. Dados conhecidos têm prioridade sobre estimativas.</p>
        </div>
      ) : null}
      <ChartBox loading={false} empty={!data.length}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 42, bottom: 0, left: 4 }} stackOffset="sign">
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="#475569" />
            <ReferenceLine x={data[0]?.date} stroke="#94a3b8" strokeDasharray="4 4" />
            <XAxis dataKey="date" tickFormatter={dayTickLabel} tickLine={false} axisLine={false} />
            <YAxis hide domain={moneyAxisDomain(data, ["entradas", "saidas", "saldoProjetado"], true)} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Tooltip allowEscapeViewBox={{ x: true, y: true }} content={<ProjectionTooltip />} wrapperStyle={{ maxWidth: 240, pointerEvents: "none", zIndex: 30 }} />
            <Bar name="Entradas previstas" dataKey="entradas" fill="#0f9f6e" radius={[4, 4, 0, 0]} stackId="flow" />
            <Bar name="Saídas previstas" dataKey="saidas" fill="#dc2626" radius={[0, 0, 4, 4]} stackId="flow" />
            <Line activeDot={{ r: 5 }} name="Saldo projetado" type="monotone" dataKey="saldoProjetado" stroke="#64748b" strokeDasharray="6 5" strokeWidth={2} dot={(props: Record<string, unknown>) => { const payload = props.payload as CashFlowProjectionChartPoint | undefined; if (!payload || payload.saldoProjetado >= 0) return <g />; return <circle cx={props.cx as number} cy={props.cy as number} fill="#dc2626" r={3} />; }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>
      <div className={risk ? "projection-alert negative" : "projection-alert positive"}>
        {risk ? (
          <><AlertCircle size={16} /><span>Atenção: seu saldo pode ficar negativo em {riskDays} dia{riskDays === 1 ? "" : "s"}. Data prevista: {dateLabel(risk.date)}. Menor saldo projetado: {money(lowestProjectedBalance)}.</span></>
        ) : (
          <><CheckCircle2 size={16} /><span>Nenhum risco de saldo negativo nos próximos 30 dias. Menor saldo projetado: {money(lowestProjectedBalance)}.</span></>
        )}
        <button className="panel-link" onClick={onNavigatePlanning} type="button">Ver projeção completa <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

function CompactTimelineList({ items, loading, onOpenTransactions, onShowAll, total }: { items: CalendarEvent[]; loading: boolean; onOpenTransactions: (event: CalendarEvent) => void; onShowAll: () => void; total: number }) {
  if (loading) return <PageState icon={Loader2} title="Carregando compromissos" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem compromissos mapeados para o período." />;
  return (
    <div className="compact-timeline-list">
      {items.map((event) => (
        <button className={`compact-timeline-row ${event.tone}`} key={`${event.kind}-${event.label}-${event.date}`} onClick={() => onOpenTransactions(event)} type="button">
          <span><strong>{event.label}</strong><small>{dateInputLabel(event.date)} · {event.kind} · {event.detail}</small></span>
          <b>{moneyAbs(event.amount)}</b>
        </button>
      ))}
      {total > items.length ? <button className="panel-link timeline-footer-link" onClick={onShowAll} type="button">Ver todos ({total})<ChevronRight size={14} /></button> : null}
    </div>
  );
}

function BudgetSnapshot({ loading, onNavigateBudgets, onOpenCategory, rows }: { loading: boolean; onNavigateBudgets: () => void; onOpenCategory: (row: ReturnType<typeof buildPersistedBudgetRows>[number]) => void; rows: ReturnType<typeof buildPersistedBudgetRows> }) {
  if (loading) return <PageState icon={Loader2} title="Carregando orçamento" description="Aguarde um momento." spin compact />;
  if (!rows.length) return (
    <div className="budget-empty-cta">
      <PiggyBank size={32} className="budget-empty-icon" />
      <p>Nenhum orçamento cadastrado</p>
      <button className="primary-button" onClick={onNavigateBudgets} type="button">
        <PlusCircle size={16} />
        Cadastrar orçamento
      </button>
    </div>
  );
  const planned = rows.reduce((total, row) => total + row.limit, 0);
  const realized = rows.reduce((total, row) => total + row.spent, 0);
  const consumed = realized / Math.max(planned, 1);
  return (
    <div className="budget-list compact">
      <div className="budget-summary-line">
        <span><strong>{moneyAbs(realized)}</strong><small>realizado de {moneyAbs(planned)} planejado</small></span>
        <b className={budgetTone(consumed)}>{formatPercentNumber(consumed * 100)}%</b>
      </div>
      {rows.map((row) => (
        <button className="budget-row compact" key={row.categoryName} onClick={() => onOpenCategory(row)} type="button">
          <div><strong>{row.categoryName}</strong><small>{moneyAbs(row.spent)} de {moneyAbs(row.limit)}</small></div>
          <span className="progress-track" aria-label={`${row.categoryName}: ${formatPercentNumber(row.ratio * 100)}%`}><i className={budgetTone(row.ratio)} style={{ width: `${Math.min(row.ratio * 100, 100)}%` }} /></span>
          <b className={budgetTone(row.ratio)}>{formatPercentNumber(row.ratio * 100)}%</b>
        </button>
      ))}
    </div>
  );
}

function GoalSnapshot({ loading, rows }: { loading: boolean; rows: ReturnType<typeof buildGoalRows> }) {
  if (loading) return <PageState icon={Loader2} title="Carregando metas" description="Aguarde um momento." spin compact />;
  if (!rows.length) return <EmptyInline message="Nenhuma meta ativa no período." />;
  return (
    <div className="goal-list compact">
      {rows.map((goal) => (
        <div className="goal-row compact" key={goal.name}>
          <div><strong>{goal.name}</strong><small>{moneyAbs(goal.current)} de {moneyAbs(goal.target)}</small></div>
          <span className="progress-track" aria-label={`${goal.name}: ${formatPercentNumber(goal.ratio * 100)}%`}><i className={goal.ratio >= 0.7 ? "positive" : "info"} style={{ width: `${Math.min(goal.ratio * 100, 100)}%` }} /></span>
          <b>{formatPercentNumber(goal.ratio * 100)}%</b>
        </div>
      ))}
    </div>
  );
}

function DashboardAlerts({ categoryGrowth, onNavigate, onOpenImports, onOpenTransactions, period, quality, recurring, summary }: { categoryGrowth: CategoryGrowthAlertItem[]; onNavigate: (page: Page) => void; onOpenImports: (drilldown?: ImportDrilldown) => void; onOpenTransactions: (drilldown?: TransactionDrilldown) => void; period: ReturnType<typeof usePeriod>; quality?: DataQuality; recurring: RecurringExpenseItem[]; summary?: DashboardSummary }) {
  const alerts = dashboardAlerts({ categoryGrowth, period, quality, recurring, summary }).slice(0, 3);
  if (!alerts.length) return <InlineSuccess message="Nenhum alerta relevante para o período." />;
  return (
    <div className="alert-list">
      {alerts.map((alert) => {
        const Icon = alert.icon;
        const target = alert.target;
        const isClickable = target || alert.transactionDrilldown;
        const className = `alert-item ${alert.tone}${isClickable ? " clickable" : ""}`;
        const content = <><Icon size={18} /><span><strong>{alert.title}<em>{alertSeverityLabel(alert.tone)}</em></strong><small>{alert.description}</small></span></>;
        if (isClickable) {
          return (
            <button className={className} key={`${alert.title}-${alert.description}`} onClick={() => { if (alert.importDrilldown) { onOpenImports(alert.importDrilldown); return; } if (alert.transactionDrilldown) { onOpenTransactions(alert.transactionDrilldown); return; } if (!target) return; onNavigate(target); }} type="button">{content}</button>
          );
        }
        return <div className={className} key={`${alert.title}-${alert.description}`}>{content}</div>;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardPage({
  dashboardPeriod,
  onNavigate,
  onOpenImports,
  onOpenTransactions,
  session,
  setDashboardPeriod,
  workspaceName,
}: {
  dashboardPeriod: PeriodState;
  onNavigate: (page: Page) => void;
  onOpenImports: (drilldown?: ImportDrilldown) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
  setDashboardPeriod: Dispatch<SetStateAction<PeriodState>>;
  workspaceName?: string;
}) {
  const period = usePeriod(dashboardPeriod, setDashboardPeriod);
  const [cashflowView, setCashflowView] = useState<"day" | "month">("day");
  const cashflowYearQuery = yearQueryFromDate(period.dateFrom || period.dateTo);
  const evolutionProjectionRange = useMemo(() => projectionRangeFromPeriod(period.dateFrom, period.dateTo), [period.dateFrom, period.dateTo]);
  const projection30Range = useMemo(() => nextDaysRange(30), []);
  const projection30Query = useMemo(() => withQueryParams("", { date_from: projection30Range.dateFrom, date_to: projection30Range.dateTo }), [projection30Range.dateFrom, projection30Range.dateTo]);

  const summary = useQuery({ queryKey: ["dashboard-summary", session.token, period.query], queryFn: () => getDashboardSummary(session, period.query) });
  const cashflow = useQuery({ queryKey: ["monthly-cashflow", session.token, cashflowYearQuery], queryFn: () => getMonthlyCashflow(session, cashflowYearQuery) });
  const dailyCashflowQuery = useQuery({ queryKey: ["daily-cashflow", session.token, period.query], queryFn: () => getDailyCashflow(session, period.query) });
  const ranking = useQuery({ queryKey: ["category-ranking", session.token, period.query], queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })) });
  const recurring = useQuery({ queryKey: ["recurring-expenses", session.token, period.recurringQuery], queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })) });
  const recurringIncome = useQuery({ queryKey: ["recurring-incomes", session.token, period.recurringQuery], queryFn: () => getRecurringIncomes(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })) });
  const quality = useQuery({ queryKey: ["data-quality", session.token, period.query], queryFn: () => getDataQuality(session, period.query) });
  const categoryGrowth = useQuery({ queryKey: ["category-growth-alerts", session.token, period.query], queryFn: () => getCategoryGrowthAlerts(session, withQueryParams(period.query, { limit: "3" })) });
  const installments = useQuery({ queryKey: ["dashboard-credit-card-installments", session.token, period.dateTo], queryFn: () => getCreditCardInstallments(session, period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" })) });
  const projection30Installments = useQuery({ queryKey: ["dashboard-projection-30-credit-card-installments", session.token, projection30Range.dateTo], queryFn: () => getCreditCardInstallments(session, withQueryParams(projection30Query, { limit: "100" })) });
  const statements = useQuery({ queryKey: ["dashboard-credit-card-statements", session.token, period.query], queryFn: () => getCreditCardStatements(session, period.query) });
  const budgets = useQuery({ queryKey: ["dashboard-budgets", session.token, period.query], queryFn: () => getBudgets(session, period.query) });
  const categories = useCategories(session);
  const goals = useQuery({ queryKey: ["dashboard-goals", session.token], queryFn: () => getGoals(session), staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const persistedEvents = useQuery({ queryKey: ["dashboard-calendar-events", session.token, period.query], queryFn: () => getCalendarEvents(session, period.query), staleTime: 2 * 60 * 1000 });
  const projection30PersistedEvents = useQuery({ queryKey: ["dashboard-projection-30-calendar-events", session.token, projection30Query], queryFn: () => getCalendarEvents(session, projection30Query) });
  const projectionFeed = useQuery({ queryKey: ["projection-feed", session.token], queryFn: () => getProjectionFeed(session, 90), staleTime: 5 * 60 * 1000 });
  const feedInputs = projectionFeed.data ? projectionFeedToInputs(projectionFeed.data) : null;
  const recentTransactions = useQuery({ queryKey: ["dashboard-recent-transactions", session.token, period.query], queryFn: () => getTransactions(session, withQueryParams(period.query, { limit: "6", sort_by: "transaction_date", sort_dir: "desc" })) });
  void recurringIncome; void projection30PersistedEvents;

  const balance = Number(summary.data?.balance ?? 0);
  const categoryItems = ranking.data?.items ?? [];
  const calendarEvents = useMemo(() => buildCalendarEvents({ apiEvents: persistedEvents.data?.items, installments: installments.data?.items ?? [], recurring: recurring.data?.items ?? [], transactions: recentTransactions.data?.items ?? [] }), [installments.data?.items, persistedEvents.data?.items, recurring.data?.items, recentTransactions.data?.items]);
  const currentBalance = summary.data?.current_balance;
  const currentBalanceValue = currentBalance === null || currentBalance === undefined ? null : Number(currentBalance);
  const monthlyBurnRate = Number(summary.data?.burn_rate ?? 0);
  const burnRate90Days = Number(summary.data?.burn_rate_90_days ?? 0);
  const runwayBurnRate = burnRate90Days > 0 ? burnRate90Days : monthlyBurnRate;
  const runwayMonths = currentBalanceValue !== null && currentBalanceValue > 0 && runwayBurnRate > 0 ? currentBalanceValue / runwayBurnRate : null;
  const safeSpend = summary.data?.safe_spend;
  const safeSpendValue = safeSpend === null || safeSpend === undefined ? null : Number(safeSpend);
  const healthScore = summary.data?.financial_health_score ?? null;
  const projection30Result = useMemo(() => buildRollingCashFlowProjection({ currentBalance: feedInputs?.currentBalance ?? currentBalanceValue ?? balance, creditCardInstallments: feedInputs?.creditCardInstallments, horizonDays: 30, knownEvents: feedInputs?.knownEvents, recurringItems: feedInputs?.recurringItems, startDate: projection30Range.dateFrom, variableCategories: feedInputs?.variableCategories }), [balance, currentBalanceValue, feedInputs, projection30Range.dateFrom]);
  const projection30Cashflow = projection30Result.chartPoints;
  const evolutionProjectionResult = useMemo(() => evolutionProjectionRange ? buildRollingCashFlowProjection({ currentBalance: feedInputs?.currentBalance ?? currentBalanceValue ?? balance, creditCardInstallments: feedInputs?.creditCardInstallments, horizonDays: evolutionProjectionRange.horizonDays, knownEvents: feedInputs?.knownEvents, recurringItems: feedInputs?.recurringItems, startDate: evolutionProjectionRange.dateFrom, variableCategories: feedInputs?.variableCategories }) : null, [balance, currentBalanceValue, evolutionProjectionRange, feedInputs]);
  const evolutionProjectionCashflow = evolutionProjectionResult?.chartPoints ?? [];
  const dailyCashflow = useMemo(() => buildDailyCashflow({ dateFrom: period.dateFrom, dateTo: period.dateTo, items: dailyCashflowQuery.data?.items ?? [], projectionPoints: evolutionProjectionCashflow }), [dailyCashflowQuery.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow]);
  const monthlyCashflow = useMemo(() => buildMonthlyCashflow(cashflow.data?.items ?? [], period.dateFrom || period.dateTo, evolutionProjectionCashflow), [cashflow.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow]);
  const dailyCashflowAxisDomain = useMemo(() => moneyAxisDomain(dailyCashflow, ["income", "expenses", "balance", "projectedBalance"], true), [dailyCashflow]);
  const monthlyCashflowAxisDomain = useMemo(() => moneyAxisDomain(monthlyCashflow, ["income", "expenses", "balance", "projectedBalance"], true), [monthlyCashflow]);
  const hasDailyCashflow = dailyCashflow.some((item) => item.income !== 0 || item.expenses !== 0);
  const showDailyCashflow = cashflowView === "day";
  const statementTotal = (statements.data?.items ?? []).reduce((total, statement) => total + Number(statement.total_amount ?? 0), 0);
  const currentStatementTotal = statementTotal || Number(summary.data?.payments ?? 0);
  const cardCommitment = Number(summary.data?.income ?? 0) > 0 ? currentStatementTotal / Number(summary.data?.income ?? 0) : null;
  const dashboardBudgetRows = buildPersistedBudgetRows({ budgets: budgets.data?.items, categories: categories.data?.items ?? [], ranking: categoryItems });
  const dashboardGoalRows = buildGoalRows(summary.data, goals.data?.items);
  const projectionRisk = projection30Result.firstNegativeDay;
  const projection30Loading = summary.isLoading || projection30PersistedEvents.isLoading || projection30Installments.isLoading || recurring.isLoading || recurringIncome.isLoading || ranking.isLoading;
  const projection30Points = projection30Result.points;
  const projection30FinalBalance = projection30Points.length ? projection30Points[projection30Points.length - 1].projectedBalance : null;
  const projection30KnownCommitments = projection30Points.reduce((total, point) => total + point.knownExpenses + point.recurringExpenses + point.creditCardInstallments + point.plannedInvestments, 0);

  function openDailyTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    onOpenTransactions({ dateFrom: data.activeLabel, dateTo: data.activeLabel, label: `Fluxo diário ${dateLabel(data.activeLabel)}`, periodPreset: "custom" });
  }
  function openMonthlyDashboardTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    const range = monthRange(data.activeLabel);
    if (!range) return;
    onOpenTransactions({ dateFrom: range.dateFrom, dateTo: range.dateTo, label: `Fluxo mensal ${monthTickLabel(data.activeLabel)}`, periodPreset: "custom" });
  }
  function openCategoryTransactions(item: CategoryRankingItem) {
    if (!item.category_id) { onNavigate("review"); return; }
    onOpenTransactions({ categoryId: item.category_id, dateFrom: period.dateFrom, dateTo: period.dateTo, label: item.category_name, periodPreset: period.periodPreset });
  }

  const healthTone = healthScore === null ? "info" : financialHealthTone(healthScore);
  const healthScoreClass = healthTone === "positive" ? "" : healthTone === "warning" ? " warning" : " negative";
  const projectionRiskDays = projectionRisk ? Math.floor((new Date(projectionRisk.date).getTime() - new Date(isoDate(new Date())).getTime()) / 86400000) : null;

  return (
    <section className="page-stack">
      {/* DashboardHero — substitui os dois blocos de MetricCards */}
      <div className="dashboard-hero" aria-label="Resumo financeiro">
        <div className="hero-top">
          <div className="hero-greeting">
            <strong>Olá{workspaceName ? `, ${workspaceName}` : ""} 👋</strong>
            <span>Resumo financeiro do período</span>
          </div>
          {healthScore !== null ? (
            <div className="health-badge">
              <span className={`health-score${healthScoreClass}`}>{healthScore}</span>
              <div className="health-label">
                <span>Saúde financeira</span>
                <strong className={healthScoreClass.trim()}>{financialHealthLabel(healthScore)}</strong>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hero-cards">
          <div className="hero-card">
            <small>Saldo atual em conta</small>
            <strong>{currentBalanceValue === null ? "Sem saldo" : formatCurrencyCompact(currentBalanceValue)}</strong>
            <p>{summary.data?.current_balance_date ? `Extrato em ${dateInputLabel(summary.data.current_balance_date)}` : "Sem saldo importado"}</p>
          </div>
          <div className={`hero-card${safeSpendValue === null ? "" : safeSpendValue >= 0 ? " highlight" : " warn"}`}>
            <small>Pode gastar com segurança</small>
            <strong>{safeSpendValue === null ? "Sem cálculo" : formatCurrencyCompactSigned(safeSpend)}</strong>
            <p>{safeSpendValue !== null && safeSpendValue < 0 ? "⚠️ Comprometimento alto" : "Após compromissos · 30 dias"}</p>
          </div>
          <div className={`hero-card${runwayMonths !== null && runwayMonths < 6 ? " warn" : ""}`}>
            <small>Fôlego financeiro</small>
            <strong>{runwayMonths === null ? "Sem cálculo" : `${formatNumber(runwayMonths)} meses`}</strong>
            <p>{runwayMonths === null ? "Sem saldo atual" : "Saldo atual / gastos"}</p>
          </div>
        </div>

        {!projection30Loading ? (
          projectionRisk ? (
            <div className="hero-conclusion risk">
              ⚠️ Atenção: saldo pode ficar negativo em {projectionRiskDays} dia{projectionRiskDays === 1 ? "" : "s"}.
            </div>
          ) : (
            <div className="hero-conclusion">
              ✅ Nenhum risco de saldo negativo nos próximos 30 dias. Menor saldo: {money(projection30Result.lowestProjectedBalance)}.
            </div>
          )
        ) : null}
      </div>

      <DashboardFlowStory futureCommitments={projection30Loading ? null : projection30KnownCommitments} onOpenAnalysis={() => onNavigate("reports")} periodLabel={periodSummary(period)} projectionLoading={projection30Loading} projectedBalance={projection30Loading ? null : projection30FinalBalance} summaryLoading={summary.isLoading} summary={summary.data} />


      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Cartões e projeção" title="Caixa projetado, fatura e parcelado" description="Veja primeiro o caixa dos próximos dias e depois o impacto dos cartões." />
        <div className="dashboard-grid operations-grid">
          <Panel title="Fluxo de caixa projetado — próximos 30 dias" description="Parte do saldo atual e projeta entradas, saídas e saldo dia a dia.">
            <ProjectedCashflowSnapshot data={projection30Cashflow} loading={projection30Loading} lowestProjectedBalance={projection30Result.lowestProjectedBalance} onNavigatePlanning={() => onNavigate("planning")} risk={projectionRisk} />
          </Panel>
          <Panel title="Cartões de crédito" description="Resumo executivo da fatura e do parcelado futuro." action={<PanelLink label="Ver detalhes" onClick={() => onNavigate("cards")} />}>
            <CreditCardSnapshot commitmentRate={cardCommitment} currentStatementTotal={currentStatementTotal} futureInstallments={installments.data?.total_future_amount ?? "0"} installmentCount={installments.data?.active_count ?? 0} loading={statements.isLoading || installments.isLoading || summary.isLoading} />
          </Panel>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Leitura principal" title="Fluxo, categorias e alertas" description="Acompanhe a evolução do caixa, os maiores gastos e os sinais que pedem revisão." />
        <div className="dashboard-grid cockpit-grid">
          <div className="cockpit-left">
            <Panel title="Evolução do fluxo de caixa" description={dashboardCashflowDescription(period, cashflowView)}>
              <div className="chart-view-toggle" aria-label="Alternar visão do gráfico">
                <button className={cashflowView === "day" ? "active" : ""} onClick={() => setCashflowView("day")} type="button">Dia</button>
                <button className={cashflowView === "month" ? "active" : ""} onClick={() => setCashflowView("month")} type="button">Mês</button>
              </div>
              <ChartBox loading={showDailyCashflow ? dailyCashflowQuery.isLoading : cashflow.isLoading} empty={showDailyCashflow ? !hasDailyCashflow : !cashflow.data?.items.length} size="large">
                <ResponsiveContainer width="100%" height="100%">
                  {showDailyCashflow ? (
                    <ComposedChart barCategoryGap="28%" barGap={0} data={dailyCashflow} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} onClick={openDailyTransactions} stackOffset="sign" style={{ cursor: "pointer" }}>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <XAxis dataKey="date" tickFormatter={dayTickLabel} tickLine={false} axisLine={false} />
                      <YAxis allowDataOverflow={false} domain={dailyCashflowAxisDomain} tickFormatter={compactMoneyAxis} tickLine={false} axisLine={false} width={64} />
                      <Tooltip formatter={(value, name) => [chartMoneyLabel(String(value), String(name)), chartSeriesLabel(String(name))]} labelFormatter={dateLabel} />
                      <Legend />
                      <Bar name="Receita" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="cashflow" />
                      <Bar name="Despesas" dataKey="expenses" fill="#ef4444" isAnimationActive={false} radius={[0, 0, 4, 4]} stackId="cashflow" />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo acumulado" type="monotone" dataKey="balance" stroke="#312e81" strokeWidth={3} dot={false} isAnimationActive={false} />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo projetado" type="monotone" dataKey="projectedBalance" stroke="#64748b" strokeDasharray="6 5" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  ) : (
                    <ComposedChart barCategoryGap="28%" barGap={0} data={monthlyCashflow} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} onClick={openMonthlyDashboardTransactions} stackOffset="sign" style={{ cursor: "pointer" }}>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <XAxis dataKey="month" tickFormatter={monthTickLabel} tickLine={false} axisLine={false} />
                      <YAxis allowDataOverflow={false} domain={monthlyCashflowAxisDomain} tickFormatter={compactMoneyAxis} tickLine={false} axisLine={false} width={64} />
                      <Tooltip formatter={(value, name) => [chartMoneyLabel(String(value), String(name)), chartSeriesLabel(String(name))]} labelFormatter={monthTickLabel} />
                      <Legend />
                      <Bar name="Receita" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="cashflow" />
                      <Bar name="Despesas" dataKey="expenses" fill="#ef4444" isAnimationActive={false} radius={[0, 0, 4, 4]} stackId="cashflow" />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo acumulado" type="monotone" dataKey="balance" stroke="#312e81" strokeWidth={3} dot={false} isAnimationActive={false} />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo projetado" type="monotone" dataKey="projectedBalance" stroke="#64748b" strokeDasharray="6 5" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </ChartBox>
            </Panel>
            <Panel title="Top categorias" description="Maiores gastos classificados no período." action={<PanelLink label="Ver todas" onClick={() => onNavigate("cashflow")} />}>
              <CategoryBarList items={categoryItems} limit={5} loading={ranking.isLoading} onOpenCategory={openCategoryTransactions} />
            </Panel>
          </div>
          <div className="cockpit-right">
            <Panel title="Próximos compromissos" description="Eventos, recorrências e parcelas que aparecem no horizonte do filtro." action={<PanelLink label="Ver calendário" onClick={() => onNavigate("calendar")} />}>
              <CompactTimelineList items={calendarEvents.slice(0, 5)} total={calendarEvents.length} onShowAll={() => onNavigate("calendar")} loading={persistedEvents.isLoading || recurring.isLoading || installments.isLoading || recentTransactions.isLoading} onOpenTransactions={(event) => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction: event.direction, label: event.label, periodPreset: period.periodPreset, search: event.search })} />
            </Panel>
            <Panel title="Pagamentos recorrentes" description="Despesas fixas e recorrentes identificadas no período.">
              <RecurringList items={recurring.data?.items ?? []} loading={recurring.isLoading} onOpenTransactions={onOpenTransactions} period={period} />
            </Panel>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Planejamento" title="Orçamento, metas e alertas" description="Blocos compactos para acompanhar o mês sem quebrar a primeira visão." />
        <div className="dashboard-grid insight-grid">
          <Panel title="Orçamento do mês" description="Categorias monitoradas no período." action={<PanelLink label="Ver orçamento" onClick={() => onNavigate("budgets")} />}>
            <BudgetSnapshot loading={ranking.isLoading || budgets.isLoading || categories.isLoading} rows={dashboardBudgetRows.slice(0, 4)} onNavigateBudgets={() => onNavigate("budgets")} onOpenCategory={(row) => onOpenTransactions({ categoryId: row.categoryId ?? undefined, dateFrom: period.dateFrom, dateTo: period.dateTo, direction: "debit", label: row.categoryName, periodPreset: period.periodPreset })} />
          </Panel>
          <Panel title="Metas em andamento" description="Progresso das metas financeiras principais." action={<PanelLink label="Ver todas" onClick={() => onNavigate("goals")} />}>
            <GoalSnapshot loading={goals.isLoading || summary.isLoading} rows={(goals.data?.items ?? []).length ? dashboardGoalRows.slice(0, 3) : []} />
          </Panel>
          <Panel title="Insights e alertas" description="Poucos itens, priorizados para não poluir a tela." action={<PanelLink label="Ver todos" onClick={() => onNavigate("reports")} />}>
            <DashboardAlerts categoryGrowth={categoryGrowth.data?.items ?? []} onOpenTransactions={onOpenTransactions} onNavigate={onNavigate} onOpenImports={onOpenImports} period={period} quality={quality.data} recurring={recurring.data?.items ?? []} summary={summary.data} />
          </Panel>
        </div>
      </section>

      <PersonalizedTip balance={currentBalanceValue ?? balance} onNavigateReports={() => onNavigate("reports")} recurring={recurring.data?.items ?? []} savingsRate={summary.data?.savings_rate} />
    </section>
  );
}
