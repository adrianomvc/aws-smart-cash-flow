import assert from "node:assert/strict";
import test from "node:test";

import { buildRollingCashFlowProjection } from "../src/lib/cashflowProjection.js";

test("starts from current balance and applies known income and expense on the correct dates", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 5000,
    horizonDays: 3,
    knownEvents: [
      { amount: 3000, date: "2026-06-02", description: "Salário", source: "known", type: "income" },
      { amount: 500, date: "2026-06-01", description: "Aluguel", source: "known", type: "expense" },
    ],
    startDate: "2026-06-01",
  });

  assert.equal(result.points[0].openingBalance, 5000);
  assert.equal(result.points[0].expectedExpenses, 500);
  assert.equal(result.points[0].projectedBalance, 4500);
  assert.equal(result.points[1].expectedIncome, 3000);
  assert.equal(result.points[1].projectedBalance, 7500);
});

test("includes credit card installments as expenses", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    creditCardInstallments: [{ amount: 250, description: "Parcela ANGLO", dueDate: "2026-06-03" }],
    horizonDays: 3,
    startDate: "2026-06-01",
  });

  assert.equal(result.points[2].creditCardInstallments, 250);
  assert.equal(result.points[2].projectedBalance, 750);
});

test("projects reliable monthly recurrence on the likely future date", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 30,
    recurringItems: [
      {
        amount: 120,
        description: "Internet",
        lastDate: "2026-05-10",
        monthCount: 3,
        transactionCount: 3,
        type: "expense",
      },
    ],
    startDate: "2026-06-01",
  });

  const recurrenceDay = result.points.find((point) => point.date === "2026-06-10");
  assert.equal(recurrenceDay?.recurringExpenses, 120);
  assert.equal(recurrenceDay?.confidence, "high");
});

test("projects reliable recurring income as positive cash inflow", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 30,
    recurringItems: [
      {
        amount: 3000,
        description: "Salário",
        lastDate: "2026-05-30",
        monthCount: 3,
        transactionCount: 3,
        type: "income",
      },
    ],
    startDate: "2026-06-01",
  });

  const recurrenceDay = result.points.find((point) => point.date === "2026-06-30");
  const chartDay = result.chartPoints.find((point) => point.date === "2026-06-30");

  assert.equal(recurrenceDay?.recurringIncome, 3000);
  assert.equal(recurrenceDay?.expectedIncome, 3000);
  assert.equal(recurrenceDay?.projectedBalance, 4000);
  assert.equal(chartDay?.entradas, 3000);
  assert.equal(chartDay?.saidas, 0);
  assert.equal(chartDay?.saldoProjetado, 4000);
});

test("projects month-end recurrence on the last valid day of shorter months", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 30,
    recurringItems: [
      {
        amount: 5000,
        description: "Salário",
        lastDate: "2026-05-31",
        monthCount: 3,
        transactionCount: 3,
        type: "income",
      },
    ],
    startDate: "2026-06-01",
  });

  const june30 = result.chartPoints.find((point) => point.date === "2026-06-30");
  const july1 = result.chartPoints.find((point) => point.date === "2026-07-01");

  assert.equal(june30?.entradas, 5000);
  assert.equal(june30?.saldoProjetado, 6000);
  assert.equal(july1, undefined);
});

test("distributes estimated variable expenses and ignores outliers in category average", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 10,
    startDate: "2026-06-01",
    variableCategories: [
      {
        categoryName: "Mercado",
        currentMonthSpent: 100,
        historicalMonthlyAmounts: [500, 520, 510, 5000],
      },
    ],
  });

  const totalEstimated = result.points.reduce((total, point) => total + point.estimatedVariableExpenses, 0);
  assert.equal(Math.round(totalEstimated), 410);
  assert.equal(result.points[0].confidence, "medium");
});

test("detects first negative day, lowest projected balance, 30-day horizon and chart shape", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 100,
    horizonDays: 30,
    knownEvents: [
      { amount: 150, date: "2026-06-02", description: "Conta", source: "known", type: "expense" },
    ],
    startDate: "2026-06-01",
  });

  assert.equal(result.points.length, 30);
  assert.equal(result.firstNegativeDay?.date, "2026-06-02");
  assert.equal(result.lowestProjectedBalance, -50);
  assert.equal(result.chartPoints[1].entradas, 0);
  assert.equal(result.chartPoints[1].saidas, -150);
  assert.equal(result.chartPoints[1].saldoProjetado, -50);
  assert.deepEqual(result.chartPoints[1].eventos, ["Conta: 150"]);
});

test("excludes one-off variable category with only 1 non-zero month from projection", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 10,
    startDate: "2026-06-01",
    variableCategories: [
      {
        // Only appeared in 1 month — should be treated as a one-off and excluded
        categoryName: "Viagem",
        currentMonthSpent: 0,
        historicalMonthlyAmounts: [0, 0, 1500],
        monthlyAverage: "1500",
      },
    ],
  });

  const totalEstimated = result.points.reduce((total, point) => total + point.estimatedVariableExpenses, 0);
  assert.equal(totalEstimated, 0, "one-off category must not contribute estimated expenses");
});

test("includes recurring variable category that appears in ≥2 of 3 lookback months", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 10,
    startDate: "2026-06-01",
    variableCategories: [
      {
        // Appeared in 2 of 3 months — qualifies as recurring under default lookbackMonths: 3
        categoryName: "Mercado",
        currentMonthSpent: 0,
        historicalMonthlyAmounts: [0, 500, 480],
        monthlyAverage: "490",
      },
    ],
  });

  const totalEstimated = result.points.reduce((total, point) => total + point.estimatedVariableExpenses, 0);
  assert.ok(totalEstimated > 0, "recurring category must contribute estimated expenses");
});

test("with lookbackMonths: 6 excludes category that appears in only 2 of 6 months", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 10,
    lookbackMonths: 6,
    startDate: "2026-06-01",
    variableCategories: [
      {
        // Appeared in only 2 months — below the ≥3 threshold for 6-month lookback
        categoryName: "Dentista",
        currentMonthSpent: 0,
        historicalMonthlyAmounts: [0, 0, 0, 0, 300, 300],
        monthlyAverage: "300",
      },
    ],
  });

  const totalEstimated = result.points.reduce((total, point) => total + point.estimatedVariableExpenses, 0);
  assert.equal(totalEstimated, 0, "2 months in 6-month window is not enough to be considered recurring");
});

test("isRecurring flag bypasses month count check for recurring items", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 30,
    recurringItems: [
      {
        amount: 200,
        description: "Streaming",
        isRecurring: true,
        lastDate: "2026-05-15",
        // Only 1 month of history — would normally be excluded without isRecurring
        monthCount: 1,
        transactionCount: 1,
        type: "expense",
      },
    ],
    startDate: "2026-06-01",
  });

  const recurrenceDay = result.points.find((point) => point.date === "2026-06-15");
  assert.equal(recurrenceDay?.recurringExpenses, 200, "isRecurring flag must allow item with low month count");
});

test("recurring item with only 1 month of history and no isRecurring flag is excluded", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 30,
    recurringItems: [
      {
        amount: 500,
        description: "Compra única",
        lastDate: "2026-05-15",
        monthCount: 1,
        transactionCount: 1,
        type: "expense",
      },
    ],
    startDate: "2026-06-01",
  });

  const totalRecurring = result.points.reduce((total, point) => total + point.recurringExpenses, 0);
  assert.equal(totalRecurring, 0, "item with only 1 month of history must be excluded as one-off");
});

test("future income appears as positive bar and increases projected balance", () => {
  const result = buildRollingCashFlowProjection({
    currentBalance: 1000,
    horizonDays: 12,
    knownEvents: [
      { amount: 5000, date: "2026-06-10", description: "Salário", source: "known", type: "income" },
      { amount: 1000, date: "2026-06-12", description: "Escola", source: "known", type: "expense" },
    ],
    startDate: "2026-06-01",
  });

  const june9 = result.points.find((point) => point.date === "2026-06-09");
  const june10 = result.chartPoints.find((point) => point.date === "2026-06-10");
  const june12 = result.chartPoints.find((point) => point.date === "2026-06-12");

  assert.equal(june9?.projectedBalance, 1000);
  assert.equal(june10?.entradas, 5000);
  assert.equal(june10?.saidas, 0);
  assert.equal(june10?.saldoProjetado, 6000);
  assert.equal(june12?.entradas, 0);
  assert.equal(june12?.saidas, -1000);
  assert.equal(june12?.saldoProjetado, 5000);
});
