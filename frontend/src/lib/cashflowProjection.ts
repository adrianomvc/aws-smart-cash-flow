export type ProjectionConfidence = "high" | "medium" | "low";

export type ProjectionEventSource =
  | "known"
  | "recurring"
  | "installment"
  | "subscription"
  | "calendar"
  | "estimated";

export type CashFlowProjectionEvent = {
  amount: number;
  description: string;
  source: ProjectionEventSource;
  type: "income" | "expense";
};

export type CashFlowProjectionPoint = {
  date: string;
  openingBalance: number;
  expectedIncome: number;
  estimatedIncome: number;
  expectedExpenses: number;
  projectedBalance: number;
  knownIncome: number;
  knownExpenses: number;
  recurringIncome: number;
  recurringExpenses: number;
  estimatedVariableExpenses: number;
  creditCardInstallments: number;
  plannedInvestments: number;
  chartIncome: number;
  chartExpenses: number;
  confidence: ProjectionConfidence;
  events: CashFlowProjectionEvent[];
};

export type CashFlowProjectionChartPoint = {
  date: string;
  entradas: number;
  saidas: number;
  saldoProjetado: number;
  chartIncome: number;
  chartExpenses: number;
  openingBalance: number;
  confidence: ProjectionConfidence;
  eventos: string[];
  events: CashFlowProjectionEvent[];
};

export type KnownProjectionEventInput = {
  amount: number | string;
  date: string;
  description: string;
  source?: ProjectionEventSource;
  type: "income" | "expense";
};

export type CreditCardInstallmentProjectionInput = {
  amount: number | string;
  description: string;
  dueDate?: string;
};

export type RecurringProjectionInput = {
  amount: number | string;
  categoryId?: string | null;
  description: string;
  frequency?: "monthly" | "weekly";
  lastDate: string;
  monthCount?: number;
  transactionCount?: number;
  type: "income" | "expense";
};

export type VariableCategoryProjectionInput = {
  categoryId?: string | null;
  categoryName: string;
  currentMonthSpent: number | string;
  historicalMonthlyAmounts?: Array<number | string>;
  monthlyAverage?: number | string;
};

export type CashFlowProjectionInput = {
  creditCardInstallments?: CreditCardInstallmentProjectionInput[];
  currentBalance: number | string;
  horizonDays?: number;
  knownEvents?: KnownProjectionEventInput[];
  recurringItems?: RecurringProjectionInput[];
  startDate: string;
  variableCategories?: VariableCategoryProjectionInput[];
};

export type CashFlowProjectionResult = {
  chartPoints: CashFlowProjectionChartPoint[];
  firstNegativeDay: CashFlowProjectionPoint | null;
  lowestProjectedBalance: number;
  points: CashFlowProjectionPoint[];
};

export function buildRollingCashFlowProjection({
  creditCardInstallments = [],
  currentBalance,
  horizonDays = 30,
  knownEvents = [],
  recurringItems = [],
  startDate,
  variableCategories = [],
}: CashFlowProjectionInput): CashFlowProjectionResult {
  const dates = buildDateRange(startDate, horizonDays);
  const dateSet = new Set(dates);
  const byDate = new Map<string, CashFlowProjectionEvent[]>();

  for (const event of knownEvents) {
    if (!dateSet.has(event.date)) continue;
    addEvent(byDate, event.date, {
      amount: absoluteNumber(event.amount),
      description: event.description,
      source: event.source ?? "calendar",
      type: event.type,
    });
  }

  for (const installment of creditCardInstallments) {
    const dueDate = installment.dueDate ?? firstDateInRange(dates);
    if (!dueDate || !dateSet.has(dueDate)) continue;
    addEvent(byDate, dueDate, {
      amount: absoluteNumber(installment.amount),
      description: installment.description,
      source: "installment",
      type: "expense",
    });
  }

  for (const recurring of recurringItems) {
    if (!isReliableRecurring(recurring)) continue;
    for (const dueDate of recurringDates(recurring, dates)) {
      addEvent(byDate, dueDate, {
        amount: absoluteNumber(recurring.amount),
        description: recurring.description,
        source: recurring.frequency === "weekly" ? "recurring" : recurringSource(recurring.description),
        type: recurring.type,
      });
    }
  }

  distributeVariableExpenses(byDate, dates, variableCategories);

  const points: CashFlowProjectionPoint[] = [];
  let balance = Number(currentBalance) || 0;
  for (const date of dates) {
    const openingBalance = balance;
    const events = byDate.get(date) ?? [];
    const expectedIncome = sumEvents(events, "income");
    const expectedExpenses = sumEvents(events, "expense");
    balance = openingBalance + expectedIncome - expectedExpenses;
    points.push({
      date,
      openingBalance,
      expectedIncome,
      estimatedIncome: sumEvents(events.filter((event) => event.source === "estimated"), "income"),
      expectedExpenses,
      projectedBalance: balance,
      knownIncome: sumEvents(events.filter((event) => event.source === "known" || event.source === "calendar"), "income"),
      knownExpenses: sumEvents(events.filter((event) => event.source === "known" || event.source === "calendar"), "expense"),
      recurringIncome: sumEvents(events.filter((event) => event.source === "recurring"), "income"),
      recurringExpenses: sumEvents(events.filter((event) => event.source === "recurring" || event.source === "subscription"), "expense"),
      estimatedVariableExpenses: sumEvents(events.filter((event) => event.source === "estimated"), "expense"),
      creditCardInstallments: sumEvents(events.filter((event) => event.source === "installment"), "expense"),
      plannedInvestments: 0,
      chartIncome: expectedIncome,
      chartExpenses: expectedExpenses > 0 ? -expectedExpenses : 0,
      confidence: confidenceForEvents(events),
      events,
    });
  }

  const firstNegativeDay = points.find((point) => point.projectedBalance < 0) ?? null;
  const lowestProjectedBalance = points.reduce(
    (lowest, point) => Math.min(lowest, point.projectedBalance),
    points[0]?.projectedBalance ?? Number(currentBalance || 0),
  );

  return {
    chartPoints: points.map(toChartPoint),
    firstNegativeDay,
    lowestProjectedBalance,
    points,
  };
}

export function toChartPoint(point: CashFlowProjectionPoint): CashFlowProjectionChartPoint {
  return {
    date: point.date,
    entradas: point.chartIncome,
    saidas: point.chartExpenses,
    saldoProjetado: point.projectedBalance,
    chartIncome: point.chartIncome,
    chartExpenses: point.chartExpenses,
    openingBalance: point.openingBalance,
    confidence: point.confidence,
    eventos: point.events.map((event) => `${event.description}: ${event.amount}`),
    events: point.events,
  };
}

function distributeVariableExpenses(
  byDate: Map<string, CashFlowProjectionEvent[]>,
  dates: string[],
  categories: VariableCategoryProjectionInput[],
) {
  for (const category of categories) {
    const monthlyAverage = robustMonthlyAverage(category);
    const currentSpent = absoluteNumber(category.currentMonthSpent);
    const remaining = Math.max(0, monthlyAverage - currentSpent);
    if (remaining <= 0 || !dates.length) continue;
    const dailyAmount = remaining / dates.length;
    for (const date of dates) {
      addEvent(byDate, date, {
        amount: dailyAmount,
        description: `Estimativa variável: ${category.categoryName}`,
        source: "estimated",
        type: "expense",
      });
    }
  }
}

function robustMonthlyAverage(category: VariableCategoryProjectionInput) {
  const history = (category.historicalMonthlyAmounts ?? [])
    .map(absoluteNumber)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  if (history.length >= 3) {
    const median = history[Math.floor(history.length / 2)] ?? 0;
    const withoutOutliers = history.filter((value) => median <= 0 || value <= median * 3);
    const usable = withoutOutliers.length ? withoutOutliers : history;
    return average(usable);
  }
  return absoluteNumber(category.monthlyAverage);
}

function recurringDates(recurring: RecurringProjectionInput, dates: string[]) {
  const result: string[] = [];
  const dateSet = new Set(dates);
  const cursor = parseIsoDate(recurring.lastDate);
  if (!cursor) return result;
  const first = parseIsoDate(dates[0] ?? "");
  const last = parseIsoDate(dates[dates.length - 1] ?? "");
  if (!first || !last) return result;
  const preferredMonthDay = cursor.getDate();

  while (cursor < first) {
    if (recurring.frequency === "weekly") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setTime(nextMonthlyDate(cursor, preferredMonthDay).getTime());
    }
  }
  while (cursor <= last) {
    const date = isoDate(cursor);
    if (dateSet.has(date)) result.push(date);
    if (recurring.frequency === "weekly") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setTime(nextMonthlyDate(cursor, preferredMonthDay).getTime());
    }
  }
  return result;
}

function confidenceForEvents(events: CashFlowProjectionEvent[]): ProjectionConfidence {
  if (!events.length) return "low";
  if (events.every((event) => ["known", "calendar", "installment", "subscription"].includes(event.source))) {
    return "high";
  }
  if (events.some((event) => event.source === "estimated")) return "medium";
  return "medium";
}

function isReliableRecurring(recurring: RecurringProjectionInput) {
  return (recurring.monthCount ?? 0) >= 3 || (recurring.transactionCount ?? 0) >= 3;
}

function recurringSource(description: string): ProjectionEventSource {
  return /assinatura|internet|netflix|spotify|plano|mensalidade/i.test(description)
    ? "subscription"
    : "recurring";
}

function addEvent(byDate: Map<string, CashFlowProjectionEvent[]>, date: string, event: CashFlowProjectionEvent) {
  byDate.set(date, [...(byDate.get(date) ?? []), event]);
}

function sumEvents(events: CashFlowProjectionEvent[], type: "income" | "expense") {
  return events
    .filter((event) => event.type === type)
    .reduce((total, event) => total + absoluteNumber(event.amount), 0);
}

function buildDateRange(startDate: string, horizonDays: number) {
  const start = parseIsoDate(startDate) ?? new Date();
  return Array.from({ length: Math.max(0, horizonDays) }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return isoDate(date);
  });
}

function firstDateInRange(dates: string[]) {
  return dates[0] ?? null;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function absoluteNumber(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.abs(numeric) : 0;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function nextMonthlyDate(value: Date, preferredMonthDay: number) {
  const targetMonth = value.getMonth() + 1;
  const targetYear = value.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(preferredMonthDay, lastDay));
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
