import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyCashflow } from "../src/lib/cashflow.js";

test("daily accumulated balance starts from opening balance", () => {
  const rows = buildDailyCashflow({
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    items: [
      {
        balance: "1200",
        closing_balance: "1200",
        date: "2026-06-01",
        expenses: "300",
        income: "500",
        opening_balance: "1000",
        payments: "0",
        transaction_count: 2,
      },
      {
        balance: "1100",
        closing_balance: "1100",
        date: "2026-06-02",
        expenses: "100",
        income: "0",
        opening_balance: "1200",
        payments: "0",
        transaction_count: 1,
      },
    ],
  });

  assert.equal(rows[0].income, 500);
  assert.equal(rows[0].expenses, -300);
  assert.equal(rows[0].balance, 1200);
  assert.equal(rows[1].balance, 1100);
});

test("daily projection starts at accumulated balance and replaces realized line after transition", () => {
  const rows = buildDailyCashflow({
    dateFrom: "2026-06-01",
    dateTo: "2026-06-05",
    items: [
      {
        closing_balance: "1200",
        date: "2026-06-01",
        expenses: "300",
        income: "500",
        opening_balance: "1000",
        transaction_count: 2,
      },
      {
        closing_balance: "1100",
        date: "2026-06-02",
        expenses: "100",
        income: "0",
        opening_balance: "1200",
        transaction_count: 1,
      },
    ],
    projectionPoints: [
      { date: "2026-06-03", saldoProjetado: 5000 },
      { date: "2026-06-04", saldoProjetado: 5300 },
      { date: "2026-06-05", saldoProjetado: 5100 },
    ],
  });

  assert.equal(rows[1].balance, 1100);
  assert.equal(rows[2].balance, 1100);
  assert.equal(rows[2].projectedBalance, 1100);
  assert.equal(rows[3].balance, null);
  assert.equal(rows[3].projectedBalance, 1400);
  assert.equal(rows[4].projectedBalance, 1200);
});
