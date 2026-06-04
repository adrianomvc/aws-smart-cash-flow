// Pure utility functions extracted from App.tsx
// No JSX, no React hooks, no component definitions.

import type {
  CategoryRead,
  DuplicateTransactionGroup,
  ProjectionFeed,
  TransactionRead,
} from "./api";
import type { ProjectionEventSource } from "./cashflowProjection";

// ---------------------------------------------------------------------------
// Types (re-declared here so this module is self-contained; App.tsx still
// owns the canonical declarations and imports from here are optional)
// ---------------------------------------------------------------------------

export type Page =
  | "dashboard"
  | "cashflow"
  | "transactions"
  | "calendar"
  | "cards"
  | "budgets"
  | "goals"
  | "planning"
  | "reports"
  | "imports"
  | "categories"
  | "rules"
  | "review"
  | "settings";

export type TransactionPeriodPreset =
  | "all"
  | "current_month"
  | "previous_month"
  | "current_year"
  | "previous_year"
  | "custom";

export type PeriodState = {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const PERCENT_FORMATTER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
export const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const CATEGORY_PALETTE = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#ffedd5", text: "#c2410c" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#cffafe", text: "#0e7490" },
  { bg: "#fef9c3", text: "#a16207" },
  { bg: "#f0fdf4", text: "#166534" },
  { bg: "#fef2f2", text: "#b91c1c" },
  { bg: "#f5f3ff", text: "#7c3aed" },
];

export const PERIOD_PRESETS: { label: string; value: TransactionPeriodPreset }[] = [
  { label: "Mês atual", value: "current_month" },
  { label: "Mês anterior", value: "previous_month" },
  { label: "Ano atual", value: "current_year" },
  { label: "Ano anterior", value: "previous_year" },
  { label: "Todos", value: "all" },
  { label: "Personalizado", value: "custom" },
];

// ---------------------------------------------------------------------------
// Money formatters
// ---------------------------------------------------------------------------

export function money(value?: string | number | null) {
  return BRL_FORMATTER.format(Number(value ?? 0));
}

export function moneyAbs(value?: string | number | null) {
  return BRL_FORMATTER.format(Math.abs(Number(value ?? 0)));
}

export function formatCurrencyCompact(value?: string | number | null) {
  const numeric = Math.abs(Number(value ?? 0));
  if (numeric < 1000) return money(numeric);
  if (numeric < 1000000) {
    const compact = numeric / 1000;
    return `R$ ${compact.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  const compact = numeric / 1000000;
  return `R$ ${compact.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

export function formatCurrencyCompactSigned(value?: string | number | null) {
  const numeric = Number(value ?? 0);
  const sign = numeric < 0 ? "-" : "";
  return `${sign}${formatCurrencyCompact(numeric)}`;
}

export function compactMoneyAbs(value?: string | number | null) {
  return formatCurrencyCompact(value);
}

export function compactMoneyAxis(value: string | number) {
  const raw = Number(value);
  const numeric = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  if (numeric < 1000) return `${sign}${numeric.toLocaleString("pt-BR")}`;
  if (numeric < 1000000) {
    return `${sign}${(numeric / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return `${sign}${(numeric / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

export function moneyAxisDomain<T extends Record<string, unknown>>(
  items: T[],
  keys: Array<keyof T>,
  allowNegative: boolean,
): [number, number] {
  const values = items.flatMap((item) =>
    keys.map((key) => Number(item[key] ?? 0)).filter((value) => Number.isFinite(value)),
  );
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const lower = allowNegative && min < 0 ? -niceMoneyCeiling(Math.abs(min) * 1.15) : 0;
  const upper = niceMoneyCeiling(Math.max(100, max) * 1.15);
  return [lower, upper];
}

function niceMoneyCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

// ---------------------------------------------------------------------------
// Percent / number formatters
// ---------------------------------------------------------------------------

export function percent(value?: string | null) {
  if (!value) return "0%";
  return `${formatPercentNumber(Number(value) * 100)}%`;
}

export function percentAbs(value?: string | null) {
  if (!value) return "0%";
  return `${formatPercentNumber(Math.abs(Number(value) * 100))}%`;
}

export function formatPercentNumber(value: number) {
  return PERCENT_FORMATTER.format(value);
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

export function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateLabel(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
      new Date(Number(year), Number(month) - 1, Number(day)),
    );
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
    new Date(value),
  );
}

export function dateInputLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function monthYearLabel(value: string) {
  if (!value) return "período selecionado";
  return monthTickLabel(value.slice(0, 7));
}

export function yearLabel(value: string) {
  const [year] = value.split("-");
  return year || "período selecionado";
}

export function monthTickLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${labels[month - 1]}/${String(year).slice(-2)}`;
}

export function dayTickLabel(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${date.getDate()} ${labels[date.getMonth()]}`;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function monthRange(value: string) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;
  return {
    dateFrom: isoDate(new Date(year, month - 1, 1)),
    dateTo: isoDate(new Date(year, month, 0)),
  };
}

export function daysFromToday(value: string) {
  const target = parseIsoDate(value);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

// ---------------------------------------------------------------------------
// Period / range helpers
// ---------------------------------------------------------------------------

export function periodRange(preset: TransactionPeriodPreset) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  if (preset === "all" || preset === "custom") {
    return { dateFrom: "", dateTo: "" };
  }
  if (preset === "current_year") {
    return {
      dateFrom: isoDate(new Date(currentYear, 0, 1)),
      dateTo: isoDate(new Date(currentYear, 11, 31)),
    };
  }
  if (preset === "previous_year") {
    return {
      dateFrom: isoDate(new Date(currentYear - 1, 0, 1)),
      dateTo: isoDate(new Date(currentYear - 1, 11, 31)),
    };
  }
  if (preset === "previous_month") {
    return {
      dateFrom: isoDate(new Date(currentYear, currentMonth - 1, 1)),
      dateTo: isoDate(new Date(currentYear, currentMonth, 0)),
    };
  }
  return {
    dateFrom: isoDate(new Date(currentYear, currentMonth, 1)),
    dateTo: isoDate(now),
  };
}

export function nextDaysRange(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(days - 1, 0));
  return {
    dateFrom: isoDate(start),
    dateTo: isoDate(end),
  };
}

export function projectionRangeFromPeriod(dateFrom: string, dateTo: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedStart = parseIsoDate(dateFrom);
  const parsedEnd = parseIsoDate(dateTo);
  const end = parsedEnd ?? new Date(today.getTime() + 29 * 86_400_000);
  end.setHours(0, 0, 0, 0);
  if (end < today) return null;
  const start = parsedStart && parsedStart > today ? parsedStart : today;
  start.setHours(0, 0, 0, 0);
  if (start > end) return null;
  return {
    dateFrom: isoDate(start),
    dateTo: isoDate(end),
    horizonDays: Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
  };
}

export function periodSummary({
  dateFrom,
  dateTo,
  periodPreset,
}: {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
}) {
  if (periodPreset === "current_month") return monthYearLabel(dateFrom || dateTo);
  if (periodPreset === "previous_month") return monthYearLabel(dateFrom || dateTo);
  if (periodPreset === "current_year") return yearLabel(dateFrom || dateTo);
  if (periodPreset === "previous_year") return yearLabel(dateFrom || dateTo);
  if (dateFrom && dateTo) return `${dateInputLabel(dateFrom)} a ${dateInputLabel(dateTo)}`;
  if (dateFrom) return `desde ${dateInputLabel(dateFrom)}`;
  if (dateTo) return `até ${dateInputLabel(dateTo)}`;
  return "";
}

export function isSingleMonthRange(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  return Boolean(start && end && start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth());
}

export function rangeMonthCount(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

export function trailingMonthsQuery(dateTo: string, monthCount: number) {
  const end = parseIsoDate(dateTo);
  if (!end) return "";
  const start = new Date(end.getFullYear(), end.getMonth() - monthCount + 1, 1);
  const params = new URLSearchParams();
  params.set("date_from", isoDate(start));
  params.set("date_to", isoDate(end));
  return `?${params.toString()}`;
}

export function yearQueryFromDate(value: string) {
  const [year] = value.split("-");
  if (!year) return "";
  const params = new URLSearchParams();
  params.set("date_from", `${year}-01-01`);
  params.set("date_to", `${year}-12-31`);
  return `?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export function categoryPath(category: CategoryRead, categories: CategoryRead[]) {
  if (!category.parent_category_id) return category.name;
  const parent = categories.find((item) => item.id === category.parent_category_id);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export function orderedCategoryOptions(categories: CategoryRead[]) {
  return orderedCategoryTree(categories).map((category) => ({
    id: category.id,
    label: categoryPath(category, categories),
  }));
}

export function orderedCategoryTree(categories: CategoryRead[]) {
  const byParent = new Map<string, CategoryRead[]>();
  for (const category of categories) {
    const parentKey = category.parent_category_id ?? "root";
    byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), category]);
  }
  for (const [parentKey, items] of byParent) {
    byParent.set(parentKey, sortCategoriesByName(items));
  }
  const ordered: CategoryRead[] = [];
  for (const root of byParent.get("root") ?? []) {
    ordered.push(root);
    ordered.push(...(byParent.get(root.id) ?? []));
  }
  return ordered;
}

export function sortCategoriesByName(categories: CategoryRead[]) {
  return [...categories].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
  );
}

export function categoryColor(id: string) {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------

export function amountClass(transaction: TransactionRead) {
  if (transaction.direction === "credit") return "positive";
  if (transaction.direction === "payment") return "muted-strong";
  return "negative";
}

export function installmentLabel(transaction: Pick<TransactionRead, "installment_current" | "installment_total">) {
  if (!transaction.installment_current || !transaction.installment_total) return "-";
  return `${transaction.installment_current}/${transaction.installment_total}`;
}

export function installmentSummaryLabel(transaction: Pick<TransactionRead, "installment_current" | "installment_total">) {
  if (!transaction.installment_current || !transaction.installment_total) return "-";
  const remaining = Math.max(transaction.installment_total - transaction.installment_current, 0);
  if (remaining === 0) return `${installmentLabel(transaction)} · última parcela`;
  return `${installmentLabel(transaction)} · faltam ${remaining}`;
}

export function sourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    bank_statement: "Conta corrente",
    credit_card_statement: "Cartão de crédito",
    unknown: "Manual/Outras",
  };
  return labels[sourceType] ?? sourceType;
}

export function commitmentTone(value?: string | null): "positive" | "negative" | "warning" {
  if (!value) return "warning";
  const ratio = Number(value);
  if (ratio < 0.7) return "positive";
  if (ratio < 0.85) return "warning";
  return "negative";
}

export function transactionFilterSummary({
  categoryId,
  categories,
  dateFrom,
  dateTo,
  direction,
  duplicateGroupCount,
  importJobId,
  periodPreset,
  reviewMode,
  search,
  sourceType,
  weekday,
}: {
  categoryId: string;
  categories: CategoryRead[];
  dateFrom: string;
  dateTo: string;
  direction: string;
  duplicateGroupCount: number;
  importJobId: string;
  periodPreset: TransactionPeriodPreset;
  reviewMode: boolean;
  search: string;
  sourceType: string;
  weekday?: number;
}) {
  const parts: string[] = [];
  if (reviewMode) parts.push("pendentes de categoria");
  if (duplicateGroupCount) parts.push(`grupo com ${duplicateGroupCount} possíveis duplicados`);
  if (search) parts.push(`busca "${search}"`);
  if (sourceType) parts.push(sourceTypeLabel(sourceType));
  if (direction) parts.push(directionLabel(direction));
  if (weekday !== undefined) parts.push(weekdayLabel(weekday));
  if (importJobId) parts.push("importação selecionada");
  if (!reviewMode && categoryId) {
    const category = categories.find((item) => item.id === categoryId);
    parts.push(category ? categoryPath(category, categories) : "categoria selecionada");
  }
  const period = periodSummary({ dateFrom, dateTo, periodPreset });
  if (period) parts.push(period);
  return parts.length ? `Filtros ativos: ${parts.join(" · ")}` : "Mostrando todos os lançamentos disponíveis.";
}

// ---------------------------------------------------------------------------
// Deduplicate helpers
// ---------------------------------------------------------------------------

export function duplicatePrimaryId(group: DuplicateTransactionGroup) {
  return (
    group.items.find((item) => item.natural_dedupe_key === group.current_natural_dedupe_key)?.id ??
    group.items[0]?.id ??
    ""
  );
}

export function dedupeStatus(
  transaction: Pick<TransactionRead, "id" | "natural_dedupe_key">,
  expectedKey = "",
  primaryId = "",
) {
  if (expectedKey && transaction.natural_dedupe_key === expectedKey) return "principal";
  if (primaryId && transaction.id === primaryId) return "suggested";
  return "review";
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function withQueryParams(query: string, params: Record<string, string>) {
  const search = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  Object.entries(params).forEach(([key, value]) => search.set(key, value));
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function pageMeta(page: Page) {
  const pages: Record<Page, { description: string; title: string }> = {
    cashflow: {
      description: "Entenda entradas, saídas, faturas e tendência mensal do dinheiro.",
      title: "Fluxo de caixa",
    },
    calendar: {
      description: "Veja compromissos, recorrências e parcelas que impactam os próximos dias.",
      title: "Calendário financeiro",
    },
    cards: {
      description: "Acompanhe fatura, parcelas, compras no cartão e conciliação com a conta.",
      title: "Cartões",
    },
    budgets: {
      description: "Monitore limites por categoria e identifique onde ajustar o mês.",
      title: "Orçamentos",
    },
    categories: {
      description: "Organize categorias e subcategorias para deixar os indicadores confiáveis.",
      title: "Categorias",
    },
    dashboard: {
      description: "Acompanhe a história do seu dinheiro e os sinais que pedem atenção.",
      title: "Visão geral",
    },
    imports: {
      description: "Carregue extratos e faturas, revise a prévia e acompanhe o que entrou na base.",
      title: "Importações",
    },
    goals: {
      description: "Acompanhe objetivos financeiros e a capacidade mensal para avançar.",
      title: "Metas",
    },
    planning: {
      description: "Veja horizontes de caixa, riscos e premissas para os próximos passos.",
      title: "Planejamento",
    },
    reports: {
      description: "Consolide leituras financeiras e prepare exportações futuras.",
      title: "Relatórios",
    },
    review: {
      description: "Resolva pendências de classificação e aumente a qualidade dos dados.",
      title: "Revisão",
    },
    rules: {
      description: "Ensine o sistema a classificar lançamentos recorrentes automaticamente.",
      title: "Regras",
    },
    settings: {
      description: "Acompanhe o ambiente atual e execute manutenções controladas.",
      title: "Configurações",
    },
    transactions: {
      description: "Encontre lançamentos, revise categorias e entenda a origem dos dados.",
      title: "Transações",
    },
  };
  return pages[page];
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  try {
    const payload = JSON.parse(error.message) as { detail?: string };
    return payload.detail || fallback;
  } catch {
    return error.message || fallback;
  }
}

export function projectionFeedToInputs(feed: ProjectionFeed) {
  return {
    currentBalance: feed.current_balance !== null ? Number(feed.current_balance) : undefined,
    knownEvents: feed.known_events.map((ev) => ({
      amount: ev.amount,
      date: ev.date,
      description: ev.description,
      source: ev.source as ProjectionEventSource,
      type: ev.type,
    })),
    recurringItems: feed.recurring_items.map((item) => ({
      amount: item.amount,
      categoryId: item.category_id,
      description: item.description,
      frequency: item.frequency,
      lastDate: item.last_date,
      monthCount: item.month_count,
      transactionCount: item.transaction_count,
      type: item.type,
    })),
    creditCardInstallments: feed.credit_card_installments.map((inst) => ({
      amount: inst.amount,
      description: inst.description,
      dueDate: inst.due_date,
    })),
    variableCategories: feed.variable_categories.map((cat) => ({
      categoryId: cat.category_id,
      categoryName: cat.category_name,
      currentMonthSpent: cat.current_month_spent,
      historicalMonthlyAmounts: cat.historical_monthly_amounts,
      monthlyAverage: cat.monthly_average,
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV export (DOM usage — no React hooks)
// ---------------------------------------------------------------------------

export function exportTransactionsCSV(transactions: TransactionRead[], filename = "transacoes") {
  const headers = ["Data", "Descrição", "Descrição original", "Tipo", "Valor", "Categoria", "Fonte", "Status"];
  const rows = transactions.map((t) => [
    t.transaction_date,
    `"${t.description.replace(/"/g, '""')}"`,
    `"${t.raw_description.replace(/"/g, '""')}"`,
    directionLabel(t.direction),
    t.amount,
    t.category ? "Confirmado" : "Pendente",
    sourceTypeLabel(t.source_type),
    t.category ? "Com categoria" : "Sem categoria",
  ]);
  const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Internal label helpers (also used by transactionFilterSummary above)
// ---------------------------------------------------------------------------

export function directionLabel(direction: string) {
  const labels: Record<string, string> = {
    debit: "Despesa",
    credit: "Receita/Crédito",
    payment: "Pagamento de fatura",
  };
  return labels[direction] ?? direction;
}

export function weekdayLabel(value: number) {
  const labels = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  return labels[value] ?? "Dia da semana";
}
