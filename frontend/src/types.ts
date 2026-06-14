/**
 * TypeScript type definitions extracted from App.tsx
 * This file contains all type and interface definitions used throughout the application
 */

import type { ApiSession } from "./lib/api";

/**
 * All available pages/routes in the application
 */
export type Page =
  | "dashboard"
  | "cashflow"
  | "transactions"
  | "calendar"
  | "cards"
  | "budgets"
  | "goals"
  | "planning"
  | "scenarios"
  | "investments"
  | "reports"
  | "imports"
  | "categories"
  | "rules"
  | "review"
  | "settings";

/**
 * Transaction period preset options for filtering
 */
export type TransactionPeriodPreset =
  | "all"
  | "current_month"
  | "previous_month"
  | "current_year"
  | "previous_year"
  | "custom";

/**
 * State for managing period selection in transactions
 */
export type PeriodState = {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
};

/**
 * Drilldown parameters for transaction filtering
 */
export type TransactionDrilldown = {
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  direction?: string;
  importJobId?: string;
  sourceFileId?: string;
  label?: string;
  periodPreset?: TransactionPeriodPreset;
  search?: string;
  sourceType?: string;
  weekday?: number;
} | null;

/**
 * Drilldown parameters for import filtering
 */
export type ImportDrilldown = {
  issueFilter?: string;
  label?: string;
  statusFilter?: string;
} | null;

/**
 * Form state for rule creation/editing
 */
export type RuleFormState = {
  id: string | null;
  name: string;
  field: string;
  match_type: string;
  pattern: string;
  category_id: string;
  target_direction: string;
  priority: number;
  active: boolean;
};

/**
 * Result of uploading an import file
 */
export type UploadImportResult = Awaited<ReturnType<typeof import("./lib/api").uploadImport>>;

/**
 * Result of a single file in a batch upload
 */
export type BatchUploadResult =
  | { fileName: string; result: UploadImportResult; status: "success" }
  | { errorMessage: string; fileName: string; status: "error" };

/**
 * Progress tracking for batch imports
 */
export type BatchUploadProgress = {
  currentFileName: string;
  done: number;
  label: string;
  total: number;
};

/**
 * Result of previewing a batch of import files
 */
export type BatchPreviewResult =
  | { file: File; fileName: string; preview: import("./lib/api").ImportPreviewResult; status: "success" }
  | { errorMessage: string; file: File; fileName: string; status: "error" };

/**
 * Cashflow metrics for a specific period
 */
export type CashflowPeriodMetrics = {
  calculatedClosingBalance: number;
  reconciliationDifference: number | null;
  expenses: number;
  income: number;
  netFlow: number;
  openingBalance: number;
  realClosingBalance: number | null;
};

/**
 * Single row in a cashflow category breakdown
 */
export type CashflowCategoryRow = {
  amount: number;
  label: string;
  share: number;
};

/**
 * Highlighted metric for display in cashflow overview
 */
export type CashflowHighlight = {
  description: string;
  label: string;
  tone: "info" | "negative" | "positive" | "warning";
  value: string;
};

/**
 * Expense segmentation by size
 */
export type ExpenseSizeSegment = {
  average: number;
  count: number;
  helper: string;
  label: string;
  share: number;
  tone: "info" | "negative" | "warning";
  total: number;
};

/**
 * Summary of a single subcategory
 */
export type SubcategorySummary = {
  averageTicket: number;
  categoryId: string | null;
  parentCategoryId: string | null;
  direction: string;
  percentageOfCategory: number;
  subcategory: string;
  total: number;
  transactionCount: number;
};

/**
 * Event item for calendar display
 */
export type CalendarEvent = {
  amount: string | number;
  category?: string | null;
  categoryColor?: string | null;
  date: string;
  detail: string;
  direction?: string;
  forecast?: boolean;
  recurring?: boolean;
  kind: string;
  label: string;
  search?: string;
  tone: "info" | "negative" | "positive" | "warning";
};

/**
 * Re-export ApiSession from lib/api for convenience
 */
export type { ApiSession };
