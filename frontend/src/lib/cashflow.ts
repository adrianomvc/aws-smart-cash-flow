type DailyCashflowItem = {
  balance?: string | number | null;
  closing_balance?: string | number | null;
  date: string;
  expenses?: string | number | null;
  income?: string | number | null;
  opening_balance?: string | number | null;
  payments?: string | number | null;
  transaction_count?: number;
};

type MonthlyCashflowItem = {
  balance?: string | number | null;
  closing_balance?: string | number | null;
  expenses?: string | number | null;
  income?: string | number | null;
  month: string;
  payments?: string | number | null;
  transaction_count?: number;
};

type ProjectionPoint = {
  date: string;
  saldoProjetado: number;
};

type DailyCashflowRow = {
  balance: number | null;
  date: string;
  expenses: number;
  income: number;
  projectedBalance: number | null;
};

type MonthlyCashflowRow = {
  balance: number | null;
  expenses: number;
  income: number;
  month: string;
  projectedBalance: number | null;
};

export function buildDailyCashflow({
  dateFrom,
  dateTo,
  items,
  projectionPoints = [],
}: {
  dateFrom: string;
  dateTo: string;
  items: DailyCashflowItem[];
  projectionPoints?: ProjectionPoint[];
}): DailyCashflowRow[] {
  const parsedStart = parseIsoDate(dateFrom);
  const parsedEnd = parseIsoDate(dateTo);
  const fallbackDate = items[0]?.date ?? isoDate(new Date());
  const start = parsedStart ?? parseIsoDate(fallbackDate) ?? new Date();
  const end = parsedEnd ?? start;
  const byDate = new Map<string, { expenses: number; income: number }>();
  const sourceByDate = new Map<string, DailyCashflowItem>();

  for (const item of items) {
    sourceByDate.set(item.date, item);
    byDate.set(item.date, {
      expenses: -Math.abs(Number(item.expenses ?? 0)),
      income: Math.abs(Number(item.income ?? 0)),
    });
  }

  const rows: DailyCashflowRow[] = [];
  const firstSourceItem = items.find((item) => Number.isFinite(Number(item.opening_balance)));
  let cumulative = Number(firstSourceItem?.opening_balance ?? 0);
  const cursor = new Date(start);
  while (cursor <= end) {
    const date = isoDate(cursor);
    const bucket = byDate.get(date) ?? { expenses: 0, income: 0 };
    const sourceItem = sourceByDate.get(date);
    cumulative += bucket.income + bucket.expenses;
    rows.push({
      balance: sourceItem?.closing_balance !== undefined ? Number(sourceItem.closing_balance) : cumulative,
      date,
      expenses: bucket.expenses,
      income: bucket.income,
      projectedBalance: null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  applyDailyProjection(rows, projectionPoints);
  return rows;
}

export function buildMonthlyCashflow(
  items: MonthlyCashflowItem[],
  periodDate: string,
  projectionPoints: ProjectionPoint[] = [],
): MonthlyCashflowRow[] {
  const [selectedYear] = periodDate.split("-");
  const monthlyItems =
    selectedYear && /^\d{4}$/.test(selectedYear)
      ? Array.from({ length: 12 }, (_, index) => {
          const month = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
          const existing = items.find((item) => item.month === month);
          return {
            balance: existing?.balance ?? "0",
            closing_balance: existing?.closing_balance,
            expenses: existing?.expenses ?? "0",
            income: existing?.income ?? "0",
            month,
            payments: existing?.payments ?? "0",
            transaction_count: existing?.transaction_count ?? 0,
          };
        })
      : items;

  let cumulative = 0;
  const rows = monthlyItems.map((item) => {
    const income = Math.abs(Number(item.income ?? 0));
    const expenses = -Math.abs(Number(item.expenses ?? 0));
    // Accrual accumulation (receitas − despesas). We intentionally do NOT use the
    // real cash closing_balance here: it includes credit-card invoice payments,
    // which would make the line dip with no matching outflow bar (the income/
    // expenses bars are accrual). Keeping the line accrual matches the bars.
    cumulative += income + expenses;
    return {
      balance: cumulative,
      expenses,
      income,
      month: item.month,
      projectedBalance: null,
    };
  });
  applyMonthlyProjection(rows, projectionPoints);
  return rows;
}

function applyDailyProjection(
  rows: DailyCashflowRow[],
  projectionPoints: ProjectionPoint[],
) {
  const projectionByDate = new Map(
    projectionPoints.map((point) => [point.date, Number(point.saldoProjetado)]),
  );
  const firstProjectionIndex = rows.findIndex((row) => projectionByDate.has(row.date));
  if (firstProjectionIndex < 0) return;
  const anchorBalance = rows[firstProjectionIndex]?.balance;
  const firstProjected = projectionByDate.get(rows[firstProjectionIndex].date);
  const projectionOffset =
    anchorBalance !== null && anchorBalance !== undefined && firstProjected !== undefined
      ? anchorBalance - firstProjected
      : 0;
  rows.forEach((row, index) => {
    const projected = projectionByDate.get(row.date);
    if (projected === undefined) return;
    row.projectedBalance = projected + projectionOffset;
    if (index > firstProjectionIndex) {
      row.balance = null;
    }
  });
}

function applyMonthlyProjection(
  rows: MonthlyCashflowRow[],
  projectionPoints: ProjectionPoint[],
) {
  const projectionByMonth = new Map<string, number>();
  for (const point of projectionPoints) {
    projectionByMonth.set(point.date.slice(0, 7), Number(point.saldoProjetado));
  }
  const firstProjectionIndex = rows.findIndex((row) => projectionByMonth.has(row.month));
  if (firstProjectionIndex < 0) return;
  const anchorBalance = rows[firstProjectionIndex]?.balance;
  const firstProjected = projectionByMonth.get(rows[firstProjectionIndex].month);
  const projectionOffset =
    anchorBalance !== null && anchorBalance !== undefined && firstProjected !== undefined
      ? anchorBalance - firstProjected
      : 0;
  rows.forEach((row, index) => {
    const projected = projectionByMonth.get(row.month);
    if (projected === undefined) return;
    row.projectedBalance = projected + projectionOffset;
    if (index > firstProjectionIndex) {
      row.balance = null;
    }
  });
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
