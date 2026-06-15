const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";

export type SessionMode = "local" | "supabase" | "cognito";

export type ApiSession = {
  token: string;
  mode: SessionMode;
};

export type WorkspaceCurrent = {
  user_id: string;
  user_name: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
  has_transactions: boolean;
  created_at: string;
};

export type SourceFileRead = {
  id: string;
  original_filename: string;
  source_kind: string;
  mime_type: string;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  received_at: string;
};

export type ImportJobRead = {
  id: string;
  source_file_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  created_at: string;
  source_file: SourceFileRead | null;
};

export type ImportErrorRead = {
  id: string;
  import_job_id: string;
  source_line: number | null;
  field_name: string | null;
  raw_value: string | null;
  error_code: string;
  message: string;
  created_at: string;
};

export type CategoryRead = {
  id: string;
  name: string;
  parent_category_id: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
};

export type CategoryAssignmentRead = {
  category_id: string;
  source: string;
  confidence: string | null;
  review_status: string;
};

export type TransactionRead = {
  id: string;
  source_file_id: string;
  import_job_id: string;
  source_type: string;
  source_name: string | null;
  account_or_card: string | null;
  transaction_date: string;
  payment_date: string | null;
  description: string;
  raw_description: string;
  amount: string;
  currency: string;
  direction: string;
  installment_current: number | null;
  installment_total: number | null;
  source_line: number | null;
  natural_dedupe_key: string | null;
  category: CategoryAssignmentRead | null;
};

export type ManualTransactionPayload = {
  transaction_date: string;
  description: string;
  amount: string;
  direction: string;
  category_id: string | null;
};

export type CategorizationRuleRead = {
  id: string;
  workspace_id?: string;
  name: string;
  field: string;
  match_type: string;
  pattern: string;
  category_id: string | null;
  target_direction: string | null;
  priority: number;
  active: boolean;
  amount_ref?: string | null;
  amount_tolerance?: string | null;
  day_min?: number | null;
  day_max?: number | null;
  direction_filter?: string | null;
  created_at: string;
};

export type RuleSuggestion = {
  match_type: string;
  field: string;
  pattern: string;
  amount_ref: string | null;
  amount_tolerance: string | null;
  day_min: number | null;
  day_max: number | null;
  direction_filter: string | null;
  suggested_name: string;
  affected_count: number;
};

export type ImportPreviewItem = {
  source_line: number;
  transaction_date: string;
  description: string;
  amount: string;
  direction: string;
  duplicate: boolean;
};

export type ImportPreviewResult = {
  filename: string;
  source_kind: string;
  duplicate_file: boolean;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  items: ImportPreviewItem[];
  errors: Array<{
    source_line: number | null;
    field_name: string | null;
    raw_value: string | null;
    error_code: string;
    message: string;
  }>;
};

export type RulePreviewItem = {
  transaction_id: string;
  transaction_date: string;
  description: string;
  amount: string;
  current_direction: string;
  target_direction: string | null;
  current_category_id: string | null;
  target_category_id: string | null;
  category_source: string | null;
  would_change_category: boolean;
  would_change_direction: boolean;
  skipped_manual_category: boolean;
};

export type RulePreview = {
  workspace_id: string;
  total_count: number;
  change_count: number;
  category_change_count: number;
  direction_change_count: number;
  skipped_manual_count: number;
  items: RulePreviewItem[];
};

export type DashboardSummary = {
  workspace_id: string;
  date_from: string | null;
  date_to: string | null;
  income: string;
  expenses: string;
  payments: string;
  balance: string;
  savings_rate: string | null;
  commitment_rate: string | null;
  burn_rate: string;
  burn_rate_months: number;
  burn_rate_basis: string;
  burn_rate_90_days: string;
  burn_rate_90_days_window: number;
  burn_rate_90_days_basis: string;
  safe_spend: string | null;
  safe_spend_reserve_minimum: string | null;
  safe_spend_basis: string;
  financial_health_score: number | null;
  financial_health_basis: string;
  transaction_count: number;
  current_balance: string | null;
  current_balance_date: string | null;
  current_balance_account: string | null;
  commitment_limit: string;
  commitment_over_limit: boolean;
  savings_target: string;
  savings_on_target: boolean;
  protected_reserve: string;
  burn_rate_window_months: number;
};

export type WorkspacePreferences = {
  workspace_id: string;
  currency: string;
  savings_target_pct: string;
  commitment_limit_pct: string;
  risk_profile: string;
  burn_rate_window_months: number;
  protected_reserve: string;
};

export type PreferencesPayload = {
  currency?: string;
  savings_target_pct?: string;
  commitment_limit_pct?: string;
  risk_profile?: string;
  burn_rate_window_months?: number;
  protected_reserve?: string;
};

export type MonthlyCashflowItem = {
  month: string;
  income: string;
  expenses: string;
  payments: string;
  balance: string;
  opening_balance: string;
  closing_balance: string;
  transaction_count: number;
};

export type DailyCashflowItem = {
  date: string;
  income: string;
  expenses: string;
  payments: string;
  balance: string;
  opening_balance: string;
  closing_balance: string;
  transaction_count: number;
};

export type WeekdaySpendingItem = {
  weekday: number;
  weekday_name: string;
  amount: string;
  count: number;
  average_amount: string;
  share_ratio: string | null;
};

export type CategoryRankingItem = {
  category_id: string | null;
  category_name: string;
  color: string | null;
  icon: string | null;
  amount: string;
  count: number;
  share_ratio: string | null;
  average_amount: string;
  last_transaction_date: string | null;
};

export type SubcategoryRankingItem = {
  category_id: string | null;
  subcategory_name: string;
  color: string | null;
  amount: string;
  count: number;
  share_ratio: string | null;
  average_amount: string;
};

export type ExpenseSizeProfileItem = {
  key: string;
  label: string;
  helper: string;
  total: string;
  count: number;
  share_ratio: string;
  average_amount: string;
};

export type SizeBucketItem = {
  key: string;
  label: string;
  helper: string;
  count: number;
  total: string;
  average: string;
  share_ratio: string;
};

export type CostTypeStat = { count: number; total: string };

export type FixedCostItem = {
  description: string;
  category_name: string | null;
  total: string;
  count: number;
  monthly_amount: string;
};

export type SpendingBreakdown = {
  workspace_id: string;
  total_expense: string;
  size_buckets: SizeBucketItem[];
  fixed: CostTypeStat;
  variable: CostTypeStat;
  fixed_items: FixedCostItem[];
};

export type MerchantRankingItem = {
  description: string;
  amount: string;
  count: number;
};

export type RecurringExpenseItem = {
  description: string;
  category_id: string | null;
  category_name: string | null;
  average_amount: string;
  last_amount: string;
  transaction_count: number;
  month_count: number;
  last_transaction_date: string;
  change_ratio: string | null;
  status: string;
};

export type CategoryGrowthAlertItem = {
  category_id: string;
  category_name: string;
  current_amount: string;
  previous_amount: string;
  change_amount: string;
  change_ratio: string;
  current_count: number;
  previous_count: number;
  previous_date_from: string;
  previous_date_to: string;
};

export type CreditCardPaymentMatchItem = {
  bank_transaction_id: string;
  card_transaction_id: string;
  amount: string;
  bank_date: string;
  card_date: string;
  date_delta_days: number;
  bank_description: string;
  card_description: string;
};

export type CreditCardInstallmentItem = {
  description: string;
  amount: string;
  installment_current: number;
  installment_total: number;
  remaining_installments: number;
  future_amount: string;
  first_invoice_month: string;
  last_transaction_date: string;
  transaction_count: number;
};

export type CreditCardInstallmentsResponse = {
  workspace_id: string;
  active_count: number;
  closing_day: number;
  due_day: number;
  total_future_amount: string;
  items: CreditCardInstallmentItem[];
};

export type CreditCardRead = {
  id: string;
  workspace_id: string;
  name: string;
  issuer: string | null;
  brand: string | null;
  last_four: string | null;
  color: string | null;
  closing_day: number;
  due_day: number;
  limit_amount: string | null;
  active: boolean;
  created_at: string;
};

export type CreditCardStatementRead = {
  id: string;
  workspace_id: string;
  credit_card_id: string;
  source_file_id: string | null;
  source_file_name: string | null;
  statement_month: string;
  closing_date: string | null;
  due_date: string;
  total_amount: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export type DataQuality = {
  workspace_id: string;
  transaction_count: number;
  categorized_count: number;
  uncategorized_count: number;
  categorized_ratio: string | null;
  imports_with_errors: number;
  duplicate_imports: number;
};

export type DescriptionNormalizationResult = {
  workspace_id: string;
  scanned_count: number;
  changed_count: number;
  natural_key_changed_count: number;
  duplicate_key_conflict_count: number;
};

export type DuplicateTransactionRead = {
  id: string;
  source_file_id: string;
  import_job_id: string;
  source_filename: string | null;
  source_type: string;
  transaction_date: string;
  description: string;
  raw_description: string;
  amount: string;
  direction: string;
  source_line: number | null;
  natural_dedupe_key: string | null;
  current_natural_dedupe_key: string;
};

export type DuplicateTransactionGroup = {
  current_natural_dedupe_key: string;
  count: number;
  items: DuplicateTransactionRead[];
};

export type DuplicateTransactionListResponse = {
  workspace_id: string;
  groups: DuplicateTransactionGroup[];
  total_groups: number;
  total_transactions: number;
  limit: number;
  offset: number;
};

export type CalendarEventRead = {
  id: string;
  workspace_id: string;
  title: string;
  event_type: string;
  amount: string | null;
  due_date: string;
  recurrence: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export type BudgetRead = {
  id: string;
  workspace_id: string;
  name: string;
  category_id: string | null;
  period_start: string;
  period_end: string | null;
  recurring: boolean;
  limit_amount: string;
  alert_threshold: string;
  active: boolean;
  created_at: string;
};

export type GoalRead = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  target_amount: string;
  current_amount: string;
  target_date: string | null;
  tracking_mode: string;
  linked_account: string | null;
  aporte_match_text: string | null;
  aporte_min: string | null;
  aporte_max: string | null;
  color: string | null;
  icon: string | null;
  status: string;
  priority: number;
  created_at: string;
};

export type AccountItem = {
  account_name: string;
  balance: string;
  balance_date: string;
};

export type ProjectionPoint = {
  month: string;
  probable: string;
  best: string;
  worst: string;
};

export type ProjectionCommitment = {
  date: string;
  title: string;
  kind: string;
  amount: string;
  income: boolean;
  monthly: boolean;
};

export type PlanningProjection = {
  workspace_id: string;
  horizon_days: number;
  start_balance: string;
  recurring_income: string;
  recurring_expense: string;
  variable_average: string;
  monthly_net: string;
  points: ProjectionPoint[];
  end_best: string;
  end_probable: string;
  end_worst: string;
  min_balance: string;
  variation: string;
  variation_pct: string;
  risk_level: string;
  risk_reason: string;
  commitments: ProjectionCommitment[];
  assumptions: string[];
};

export type ProjectionFeed = {
  workspace_id: string;
  current_balance: string | null;
  current_balance_date: string | null;
  current_balance_account: string | null;
  known_events: Array<{
    amount: string;
    date: string;
    description: string;
    source: string;
    type: "income" | "expense";
  }>;
  recurring_items: Array<{
    description: string;
    amount: string;
    average_amount: string;
    type: "income" | "expense";
    last_date: string;
    month_count: number;
    transaction_count: number;
    category_id: string | null;
    frequency: "monthly" | "weekly";
  }>;
  credit_card_installments: Array<{
    amount: string;
    description: string;
    due_date: string;
  }>;
  variable_categories: Array<{
    category_id: string | null;
    category_name: string;
    current_month_spent: string;
    historical_monthly_amounts: string[];
    monthly_average: string;
  }>;
};

export type ActiveAccountItem = {
  id: string;
  kind: "bank" | "credit_card";
  name: string;
  current_balance: string | null;
  balance_date: string | null;
  limit_amount: string | null;
  used_amount: string | null;
  available_amount: string | null;
  issuer: string | null;
  brand: string | null;
  last_four: string | null;
  closing_day: number | null;
  due_day: number | null;
  active: boolean;
};

export type ReportCardRead = {
  id: string;
  title: string;
  description: string;
  status: string;
  primary_metric: string;
  secondary_metric: string;
  target_page: string;
};

export type ReportListResponse = {
  workspace_id: string;
  date_from: string | null;
  date_to: string | null;
  export_status: string;
  items: ReportCardRead[];
};

export type CalendarEventPayload = {
  title: string;
  event_type: string;
  amount: string | null;
  due_date: string;
  recurrence: string;
  status?: string;
  notes?: string | null;
};

export type BudgetPayload = {
  name: string;
  category_id: string | null;
  period_start: string;
  period_end: string | null;
  recurring?: boolean;
  limit_amount: string;
  alert_threshold?: string;
  active?: boolean;
};

export type BudgetRecommendation = {
  category_id: string | null;
  months: number;
  total: string;
  average: string;
};

export type CreditCardPayload = {
  name: string;
  issuer?: string | null;
  brand?: string | null;
  last_four?: string | null;
  color?: string | null;
  closing_day?: number | null;
  due_day?: number | null;
  limit_amount?: string | null;
};

export type CreditCardStatementPayload = {
  credit_card_id: string;
  statement_month: string;
  closing_date?: string | null;
  due_date: string;
  total_amount?: string | null;
  status?: string;
  source_file_id?: string | null;
  notes?: string | null;
};

export type GoalPayload = {
  name: string;
  description?: string | null;
  target_amount: string;
  current_amount: string;
  target_date?: string | null;
  tracking_mode?: string;
  linked_account?: string | null;
  aporte_match_text?: string | null;
  aporte_min?: string | null;
  aporte_max?: string | null;
  color?: string | null;
  icon?: string | null;
  status?: string;
  priority?: number;
};

export type ListResponse<T> = {
  workspace_id: string;
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

type ApiOptions = {
  method?: string;
  body?: BodyInit | object;
  headers?: HeadersInit;
};

// The Cognito layer registers a provider that returns a fresh (auto-refreshed)
// ID token, so requests never carry an expired token.
let cognitoTokenProvider: (() => Promise<string | null>) | null = null;
export function setCognitoTokenProvider(fn: () => Promise<string | null>) {
  cognitoTokenProvider = fn;
}

async function apiRequest<T>(path: string, session: ApiSession, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let token = session.token;
  if (session.mode === "cognito" && cognitoTokenProvider) {
    const fresh = await cognitoTokenProvider();
    if (fresh) token = fresh;
  }
  headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getCurrentWorkspace(session: ApiSession) {
  return apiRequest<WorkspaceCurrent>("/workspaces/current", session);
}

export function getDashboardSummary(session: ApiSession, query: string) {
  return apiRequest<DashboardSummary>(`/dashboard/summary${query}`, session);
}

export function getMonthlyCashflow(session: ApiSession, query: string) {
  return apiRequest<ListResponse<MonthlyCashflowItem>>(`/dashboard/monthly-cashflow${query}`, session);
}

export function getDailyCashflow(session: ApiSession, query: string) {
  return apiRequest<ListResponse<DailyCashflowItem>>(`/dashboard/daily-cashflow${query}`, session);
}

export function getWeekdaySpending(session: ApiSession, query: string) {
  return apiRequest<ListResponse<WeekdaySpendingItem>>(`/dashboard/weekday-spending${query}`, session);
}

export function getCategoryRanking(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CategoryRankingItem>>(`/dashboard/category-ranking${query}`, session);
}

export function getSubcategoryRanking(session: ApiSession, query: string) {
  return apiRequest<ListResponse<SubcategoryRankingItem>>(`/dashboard/subcategory-ranking${query}`, session);
}

export function getExpenseSizeProfile(session: ApiSession, query: string) {
  return apiRequest<ListResponse<ExpenseSizeProfileItem>>(`/dashboard/expense-size-profile${query}`, session);
}

export function getSpendingBreakdown(session: ApiSession, query: string) {
  return apiRequest<SpendingBreakdown>(`/dashboard/spending-breakdown${query}`, session);
}

export type CategoryTrendSeries = {
  category_id: string | null;
  category_name: string;
  total: string;
  points: string[];
};

export type CategoryTrends = {
  workspace_id: string;
  months: string[];
  series: CategoryTrendSeries[];
};

export function getCategoryTrends(session: ApiSession, query: string) {
  return apiRequest<CategoryTrends>(`/dashboard/category-trends${query}`, session);
}

export function getMerchantRanking(session: ApiSession, query: string) {
  return apiRequest<ListResponse<MerchantRankingItem>>(`/dashboard/merchant-ranking${query}`, session);
}

export function getRecurringExpenses(session: ApiSession, query: string) {
  return apiRequest<ListResponse<RecurringExpenseItem>>(`/dashboard/recurring-expenses${query}`, session);
}

export function getRecurringIncomes(session: ApiSession, query: string) {
  return apiRequest<ListResponse<RecurringExpenseItem>>(`/dashboard/recurring-incomes${query}`, session);
}

export function getCategoryGrowthAlerts(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CategoryGrowthAlertItem>>(`/dashboard/category-growth-alerts${query}`, session);
}

export function getCreditCardPaymentMatches(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CreditCardPaymentMatchItem>>(`/dashboard/credit-card-payment-matches${query}`, session);
}

export function getCreditCardInstallments(session: ApiSession, query: string) {
  return apiRequest<CreditCardInstallmentsResponse>(`/dashboard/credit-card-installments${query}`, session);
}

export function getProjectionFeed(session: ApiSession, horizonDays = 90, lookbackMonths: 3 | 6 = 3) {
  return apiRequest<ProjectionFeed>(
    `/dashboard/projection-feed?horizon_days=${horizonDays}&lookback_months=${lookbackMonths}`,
    session,
  );
}

export function getCreditCards(session: ApiSession) {
  return apiRequest<ListResponse<CreditCardRead>>("/credit-cards", session);
}

export function autoAssociateCreditCardFiles(session: ApiSession) {
  return apiRequest<{ linked: number }>("/credit-cards/auto-associate", session, { method: "POST" });
}

export type StatementReportItem = {
  statement_id: string;
  credit_card_id: string;
  card_name: string;
  source_file_id: string | null;
  source_file_name: string | null;
  statement_month: string;
  due_date: string;
  status: string;
  file_total: string | null;
  paid_amount: string | null;
  paid_date: string | null;
};

export function getCreditCardStatementReport(session: ApiSession) {
  return apiRequest<{ workspace_id: string; items: StatementReportItem[] }>("/credit-card-statement-report", session);
}

export function createCreditCard(session: ApiSession, payload: CreditCardPayload) {
  return apiRequest<CreditCardRead>("/credit-cards", session, {
    method: "POST",
    body: payload,
  });
}

export function updateCreditCard(session: ApiSession, cardId: string, payload: Partial<CreditCardPayload> & { active?: boolean }) {
  return apiRequest<CreditCardRead>(`/credit-cards/${cardId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function getCreditCardStatements(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CreditCardStatementRead>>(`/credit-card-statements${query}`, session);
}

export function createCreditCardStatement(session: ApiSession, payload: CreditCardStatementPayload) {
  return apiRequest<CreditCardStatementRead>("/credit-card-statements", session, {
    method: "POST",
    body: payload,
  });
}

export function updateCreditCardStatementSourceFile(session: ApiSession, statementId: string, sourceFileId: string | null) {
  return apiRequest<CreditCardStatementRead>(`/credit-card-statements/${statementId}/source-file`, session, {
    method: "PATCH",
    body: { source_file_id: sourceFileId },
  });
}

export function associateCreditCardSourceFile(session: ApiSession, cardId: string, sourceFileId: string) {
  return apiRequest<CreditCardStatementRead>(`/credit-cards/${cardId}/statement-source-files/${sourceFileId}`, session, {
    method: "POST",
  });
}

export function unlinkCreditCardSourceFile(session: ApiSession, sourceFileId: string) {
  return apiRequest<void>(`/credit-card-source-files/${sourceFileId}/link`, session, {
    method: "DELETE",
  });
}

export type CreditCardSourceFileItem = {
  source_file_id: string;
  original_filename: string;
  received_at: string;
  total: string | null;
  reference_month: string | null;
  linked_credit_card_id: string | null;
  linked_card_name: string | null;
  due_date: string | null;
  status: string | null;
  paid_amount: string | null;
  paid_date: string | null;
};

export function getCreditCardSourceFiles(session: ApiSession) {
  return apiRequest<{ workspace_id: string; items: CreditCardSourceFileItem[] }>("/credit-card-source-files", session);
}

export function getDataQuality(session: ApiSession, query: string) {
  return apiRequest<DataQuality>(`/dashboard/data-quality${query}`, session);
}

export function getCalendarEvents(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CalendarEventRead>>(`/calendar/events${query}`, session);
}

export function createCalendarEvent(session: ApiSession, payload: CalendarEventPayload) {
  return apiRequest<CalendarEventRead>("/calendar/events", session, {
    method: "POST",
    body: payload,
  });
}

export function getBudgets(session: ApiSession, query: string) {
  return apiRequest<ListResponse<BudgetRead>>(`/budgets${query}`, session);
}

export function createBudget(session: ApiSession, payload: BudgetPayload) {
  return apiRequest<BudgetRead>("/budgets", session, {
    method: "POST",
    body: payload,
  });
}

export function updateBudget(session: ApiSession, budgetId: string, payload: Partial<BudgetPayload>) {
  return apiRequest<BudgetRead>(`/budgets/${budgetId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteBudget(session: ApiSession, budgetId: string) {
  return apiRequest<void>(`/budgets/${budgetId}`, session, {
    method: "DELETE",
  });
}

export function getBudgetRecommendation(session: ApiSession, categoryId: string, months = 3) {
  return apiRequest<BudgetRecommendation>(`/budgets/recommendation?category_id=${categoryId}&months=${months}`, session);
}

export function getGoals(session: ApiSession) {
  return apiRequest<ListResponse<GoalRead>>("/goals", session);
}

export function getPlanningProjection(session: ApiSession, horizonDays = 365) {
  return apiRequest<PlanningProjection>(`/planning/projection?horizon_days=${horizonDays}`, session);
}

export function getReports(session: ApiSession, query: string) {
  return apiRequest<ReportListResponse>(`/reports${query}`, session);
}

export function createGoal(session: ApiSession, payload: GoalPayload) {
  return apiRequest<GoalRead>("/goals", session, {
    method: "POST",
    body: payload,
  });
}

export function updateGoal(session: ApiSession, goalId: string, payload: Partial<GoalPayload>) {
  return apiRequest<GoalRead>(`/goals/${goalId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteGoal(session: ApiSession, goalId: string) {
  return apiRequest<void>(`/goals/${goalId}`, session, {
    method: "DELETE",
  });
}

export function getAccounts(session: ApiSession) {
  return apiRequest<{ workspace_id: string; items: AccountItem[] }>("/accounts", session);
}

export function getPreferences(session: ApiSession) {
  return apiRequest<WorkspacePreferences>("/preferences", session);
}

export function updatePreferences(session: ApiSession, payload: PreferencesPayload) {
  return apiRequest<WorkspacePreferences>("/preferences", session, { method: "PATCH", body: payload });
}

export type ContributionItem = {
  id: string;
  transaction_date: string;
  description: string;
  amount: string;
  direction: string;
};

type ContributionList = { goal_id: string; items: ContributionItem[]; total: string };

export function getGoalContributions(session: ApiSession, goalId: string) {
  return apiRequest<ContributionList>(`/goals/${goalId}/contributions`, session);
}

export function getContributionCandidates(session: ApiSession, goalId: string, q = "") {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiRequest<ContributionList>(`/goals/${goalId}/contribution-candidates${query}`, session);
}

export function addGoalContribution(session: ApiSession, goalId: string, transactionId: string) {
  return apiRequest<void>(`/goals/${goalId}/contributions/${transactionId}`, session, { method: "POST" });
}

export function removeGoalContribution(session: ApiSession, goalId: string, transactionId: string) {
  return apiRequest<void>(`/goals/${goalId}/contributions/${transactionId}`, session, { method: "DELETE" });
}

export function getImports(session: ApiSession, query = "?limit=20") {
  return apiRequest<ListResponse<ImportJobRead>>(`/imports${query}`, session);
}

export function getImportErrors(session: ApiSession, importId: string) {
  return apiRequest<ListResponse<ImportErrorRead>>(`/imports/${importId}/errors`, session);
}

export function deleteImport(session: ApiSession, importId: string) {
  return apiRequest<void>(`/imports/${importId}`, session, { method: "DELETE" });
}

export function previewImport(session: ApiSession, file: File, sourceKind = "auto") {
  const data = new FormData();
  data.append("file", file);
  data.append("source_kind", sourceKind);
  return apiRequest<ImportPreviewResult>("/imports/preview", session, { method: "POST", body: data });
}

export function uploadImport(session: ApiSession, file: File, sourceKind = "auto", creditCardStatementId?: string) {
  const data = new FormData();
  data.append("file", file);
  data.append("source_kind", sourceKind);
  if (creditCardStatementId) data.append("credit_card_statement_id", creditCardStatementId);
  return apiRequest<{
    import_job_id: string;
    source_file_id: string;
    status: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    duplicate_rows: number;
  }>("/imports", session, { method: "POST", body: data });
}

export type TransactionListResponse = ListResponse<TransactionRead> & {
  // Aggregates over the full filtered set (decimals serialized as strings).
  total_income?: string;
  total_expense?: string;
  total_net?: string;
};

export function getTransactions(session: ApiSession, query: string) {
  return apiRequest<TransactionListResponse>(`/transactions${query}`, session);
}

export function getTransactionDuplicates(session: ApiSession, query = "?limit=20") {
  return apiRequest<DuplicateTransactionListResponse>(`/transactions/duplicates${query}`, session);
}

export function createManualTransaction(session: ApiSession, payload: ManualTransactionPayload) {
  return apiRequest<TransactionRead>("/transactions", session, {
    method: "POST",
    body: payload,
  });
}

export function updateTransactionCategory(
  session: ApiSession,
  transactionId: string,
  categoryId: string | null,
) {
  return apiRequest<TransactionRead>(`/transactions/${transactionId}/category`, session, {
    method: "PATCH",
    body: { category_id: categoryId },
  });
}

export function deleteTransaction(session: ApiSession, transactionId: string) {
  return apiRequest<void>(`/transactions/${transactionId}`, session, { method: "DELETE" });
}

export function updateTransactionDirection(session: ApiSession, transactionId: string, direction: string) {
  return apiRequest<TransactionRead>(`/transactions/${transactionId}/direction`, session, {
    method: "PATCH",
    body: { direction },
  });
}

export function normalizeTransactionDescriptions(session: ApiSession) {
  return apiRequest<DescriptionNormalizationResult>("/transactions/normalize-descriptions", session, {
    method: "POST",
  });
}

export function getCategories(session: ApiSession) {
  return apiRequest<ListResponse<CategoryRead>>("/categories", session);
}

export function createCategory(
  session: ApiSession,
  name: string,
  parentCategoryId: string | null,
  options: { color?: string | null; icon?: string | null } = {},
) {
  return apiRequest<CategoryRead>("/categories", session, {
    method: "POST",
    body: { name, parent_category_id: parentCategoryId, color: options.color, icon: options.icon },
  });
}

export function updateCategory(
  session: ApiSession,
  categoryId: string,
  payload: {
    name?: string;
    parent_category_id?: string | null;
    color?: string | null;
    icon?: string | null;
  },
) {
  return apiRequest<CategoryRead>(`/categories/${categoryId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteCategory(session: ApiSession, categoryId: string) {
  return apiRequest<void>(`/categories/${categoryId}`, session, { method: "DELETE" });
}

export function getRules(session: ApiSession) {
  return apiRequest<ListResponse<CategorizationRuleRead>>("/categorization-rules", session);
}

export type CategorizationRulePayload = {
  name: string;
  field: string;
  match_type: string;
  pattern: string;
  category_id: string | null;
  target_direction: string | null;
  priority: number;
  active: boolean;
  amount_ref?: string | null;
  amount_tolerance?: string | null;
  day_min?: number | null;
  day_max?: number | null;
  direction_filter?: string | null;
};

export function createRule(session: ApiSession, payload: CategorizationRulePayload) {
  return apiRequest<CategorizationRuleRead>("/categorization-rules", session, {
    method: "POST",
    body: payload,
  });
}

export function updateRule(
  session: ApiSession,
  ruleId: string,
  payload: Partial<CategorizationRulePayload>,
) {
  return apiRequest<CategorizationRuleRead>(`/categorization-rules/${ruleId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function getRuleSuggestion(session: ApiSession, transactionId: string) {
  return apiRequest<{ suggestion: RuleSuggestion | null }>(
    `/transactions/${transactionId}/rule-suggestion`,
    session,
  );
}

export function deleteRule(session: ApiSession, ruleId: string) {
  return apiRequest<void>(`/categorization-rules/${ruleId}`, session, { method: "DELETE" });
}

export function applyRules(session: ApiSession) {
  return apiRequest<{
    workspace_id: string;
    applied_count: number;
    category_applied_count: number;
    direction_applied_count: number;
    skipped_manual_count: number;
  }>("/categorization-rules/apply", session, { method: "POST" });
}

export function categorizePending(session: ApiSession) {
  return apiRequest<{
    workspace_id: string;
    trgm_applied: number;
    llm_applied: number;
    total_applied: number;
  }>("/categorize-pending", session, { method: "POST" });
}

export function getRulePreview(session: ApiSession, ruleId: string) {
  return apiRequest<RulePreview>(`/categorization-rules/${ruleId}/preview`, session);
}

// Auth endpoints
export async function signup(payload: { email: string; password: string; display_name?: string }) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Signup failed");
  }

  return response.json() as Promise<{
    user_id: string;
    email: string;
    display_name: string | null;
    created_at: string;
  }>;
}

export async function login(payload: { email: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Login failed");
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string | null;
    user_id: string;
    email: string;
    display_name: string | null;
  }>;
}

export async function refreshToken(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed");
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string | null;
    user_id: string;
    email: string;
    display_name: string | null;
  }>;
}

export async function resetPassword(email: string) {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error("Password reset failed");
  }

  return response.json() as Promise<{ message: string }>;
}

export function getActiveAccounts(session: ApiSession) {
  return apiRequest<{ items: ActiveAccountItem[]; total: number }>("/accounts/active", session);
}

// --------------------------------------------------------------------------- //
// Insights (explainable, rule-based)
// --------------------------------------------------------------------------- //
export type InsightItem = {
  type: "pos" | "neg" | "warn" | "info";
  title: string;
  impact: string;
  impact_label?: string;
  saving: string;
  confidence: "Alta" | "Média" | "Baixa";
  reason: string;
  data: string;
  action: string;
  action_target: string;
  action_param: string | null;
};

export type InsightsResponse = {
  workspace_id: string;
  date_from: string | null;
  date_to: string | null;
  kpis: {
    insights_count: number;
    potential_savings: string;
    risk_alerts: number;
    data_quality_pct: number | null;
  };
  items: InsightItem[];
};

export function getInsights(session: ApiSession, query = "") {
  return apiRequest<InsightsResponse>(`/insights${query}`, session);
}

// --------------------------------------------------------------------------- //
// Investments (position view)
// --------------------------------------------------------------------------- //
export type InvestmentClassRef = { id: string; label: string; color: string };

export type InvestmentCustodyRead = {
  id: string;
  workspace_id: string;
  name: string;
  kind: string | null;
  account_type: string;
  brand: string | null;
  color: string | null;
  sync_mode: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvestmentCustodyPayload = {
  name?: string;
  kind?: string | null;
  account_type?: string;
  brand?: string | null;
  color?: string | null;
  sync_mode?: string | null;
  active?: boolean;
};

export type InvestmentAssetRead = {
  id: string;
  workspace_id: string;
  custody_id: string;
  name: string;
  asset_class: string;
  risk: string | null;
  detail: string | null;
  current_value: string;
  contributed: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvestmentAssetPayload = {
  custody_id?: string;
  name?: string;
  asset_class?: string;
  risk?: string | null;
  detail?: string | null;
  current_value?: number | string;
  contributed?: number | string;
  active?: boolean;
};

export type InvestmentSnapshotRead = {
  id: string;
  asset_id: string;
  as_of: string;
  value: string;
  contributed: string | null;
  created_at: string;
};

export type InvestmentSnapshotPayload = {
  value: number | string;
  contributed?: number | string | null;
  as_of?: string | null;
};

// Money fields are serialized as strings (Decimal); returns/pct are numbers (float).
export type InvestmentPositionClass = {
  id: string;
  label: string;
  color: string;
  value: string;
  pct: number;
  contributed: string;
  month_return: number;
  year_return: number;
};

export type InvestmentPositionAccount = {
  id: string;
  name: string;
  kind: string | null;
  account_type: string;
  brand: string | null;
  color: string | null;
  value: string;
  prev: string;
  contrib: string;
  classes: { id: string; value: string }[];
  sync_mode: string | null;
  updated_at: string;
};

export type InvestmentPositionAsset = {
  id: string;
  name: string;
  asset_class: string;
  custody_id: string;
  account: string;
  value: string;
  contributed: string;
  risk: string | null;
  detail: string | null;
  month_return: number;
  ytd_return: number;
  updated_at: string | null;
};

export type InvestmentPosition = {
  workspace_id: string;
  total: string;
  total_contributed: string;
  total_gain: string;
  month_return: number;
  year_return: number;
  ytd_return: number;
  custody_count: number;
  asset_count: number;
  has_snapshots: boolean;
  classes: InvestmentPositionClass[];
  accounts: InvestmentPositionAccount[];
  assets: InvestmentPositionAsset[];
  history: { label: string; value: string }[];
};

export function getInvestmentClasses(session: ApiSession) {
  return apiRequest<{ items: InvestmentClassRef[] }>("/investment-classes", session);
}

export function getInvestmentPosition(session: ApiSession, asOf?: string) {
  const qs = asOf ? `?as_of=${asOf}` : "";
  return apiRequest<InvestmentPosition>(`/investments/position${qs}`, session);
}

export function getInvestmentCustodies(session: ApiSession) {
  return apiRequest<ListResponse<InvestmentCustodyRead>>("/investment-custodies", session);
}

export function createInvestmentCustody(session: ApiSession, payload: InvestmentCustodyPayload) {
  return apiRequest<InvestmentCustodyRead>("/investment-custodies", session, {
    method: "POST",
    body: payload,
  });
}

export function updateInvestmentCustody(
  session: ApiSession,
  custodyId: string,
  payload: InvestmentCustodyPayload,
) {
  return apiRequest<InvestmentCustodyRead>(`/investment-custodies/${custodyId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteInvestmentCustody(session: ApiSession, custodyId: string) {
  return apiRequest<void>(`/investment-custodies/${custodyId}`, session, { method: "DELETE" });
}

export function getInvestmentAssets(session: ApiSession, custodyId?: string) {
  const qs = custodyId ? `?custody_id=${custodyId}` : "";
  return apiRequest<ListResponse<InvestmentAssetRead>>(`/investment-assets${qs}`, session);
}

export function createInvestmentAsset(session: ApiSession, payload: InvestmentAssetPayload) {
  return apiRequest<InvestmentAssetRead>("/investment-assets", session, {
    method: "POST",
    body: payload,
  });
}

export function updateInvestmentAsset(
  session: ApiSession,
  assetId: string,
  payload: InvestmentAssetPayload,
) {
  return apiRequest<InvestmentAssetRead>(`/investment-assets/${assetId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteInvestmentAsset(session: ApiSession, assetId: string) {
  return apiRequest<void>(`/investment-assets/${assetId}`, session, { method: "DELETE" });
}

export function getInvestmentSnapshots(session: ApiSession, assetId: string) {
  return apiRequest<{ asset_id: string; items: InvestmentSnapshotRead[]; total: number }>(
    `/investment-assets/${assetId}/snapshots`,
    session,
  );
}

export function createInvestmentSnapshot(
  session: ApiSession,
  assetId: string,
  payload: InvestmentSnapshotPayload,
) {
  return apiRequest<InvestmentSnapshotRead>(`/investment-assets/${assetId}/snapshots`, session, {
    method: "POST",
    body: payload,
  });
}

export function deleteInvestmentSnapshot(session: ApiSession, snapshotId: string) {
  return apiRequest<void>(`/investment-snapshots/${snapshotId}`, session, { method: "DELETE" });
}

// --------------------------------------------------------------------------- //
// Wealth (net worth)
// --------------------------------------------------------------------------- //
export type WealthItemRead = {
  id: string;
  workspace_id: string;
  kind: "asset" | "liability";
  label: string;
  category: string | null;
  value: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type WealthItemPayload = {
  kind?: string;
  label?: string;
  value?: number | string;
  category?: string | null;
  note?: string | null;
  as_of?: string | null;
};

export type WealthRow = {
  id: string | null;
  label: string;
  value: string;
  category: string | null;
  note: string | null;
  source: "auto" | "manual";
  updated_at: string | null;
};

export type WealthSummary = {
  workspace_id: string;
  net_worth: string;
  total_assets: string;
  total_liabilities: string;
  delta: string;
  delta_pct: number;
  assets: WealthRow[];
  liabilities: WealthRow[];
  history: { label: string; value: string }[];
};

export function getWealth(session: ApiSession) {
  return apiRequest<WealthSummary>("/wealth", session);
}

export function createWealthItem(session: ApiSession, payload: WealthItemPayload) {
  return apiRequest<WealthItemRead>("/wealth-items", session, { method: "POST", body: payload });
}

export function updateWealthItem(session: ApiSession, itemId: string, payload: WealthItemPayload) {
  return apiRequest<WealthItemRead>(`/wealth-items/${itemId}`, session, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWealthItem(session: ApiSession, itemId: string) {
  return apiRequest<void>(`/wealth-items/${itemId}`, session, { method: "DELETE" });
}

export type WealthSnapshotRead = {
  id: string;
  item_id: string;
  as_of: string;
  value: string;
  created_at: string;
};

export function getWealthSnapshots(session: ApiSession, itemId: string) {
  return apiRequest<{ item_id: string; items: WealthSnapshotRead[]; total: number }>(
    `/wealth-items/${itemId}/snapshots`,
    session,
  );
}

export function createWealthSnapshot(
  session: ApiSession,
  itemId: string,
  payload: { value: number | string; as_of?: string | null },
) {
  return apiRequest<WealthSnapshotRead>(`/wealth-items/${itemId}/snapshots`, session, {
    method: "POST",
    body: payload,
  });
}

export function deleteWealthSnapshot(session: ApiSession, snapshotId: string) {
  return apiRequest<void>(`/wealth-snapshots/${snapshotId}`, session, { method: "DELETE" });
}

// --------------------------------------------------------------------------- //
// Family / members
// --------------------------------------------------------------------------- //
export type MemberRead = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_self: boolean;
  created_at: string;
};

export type InviteRead = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export type ProfileRead = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  workspace_name: string;
};

export function getProfile(session: ApiSession) {
  return apiRequest<ProfileRead>("/workspaces/profile", session);
}

export function updateProfile(session: ApiSession, payload: { display_name?: string; email?: string }) {
  return apiRequest<ProfileRead>("/workspaces/profile", session, { method: "PATCH", body: payload });
}

export function updateWorkspaceName(session: ApiSession, name: string) {
  return apiRequest<WorkspaceCurrent>("/workspaces/current", session, { method: "PATCH", body: { name } });
}

export function getMembers(session: ApiSession) {
  return apiRequest<{ workspace_id: string; items: MemberRead[]; total: number }>("/workspaces/members", session);
}

export function getInvites(session: ApiSession) {
  return apiRequest<{ workspace_id: string; items: InviteRead[]; total: number }>("/workspaces/invites", session);
}

export function inviteMember(session: ApiSession, payload: { email: string; role: string }) {
  return apiRequest<InviteRead>("/workspaces/members/invite", session, { method: "POST", body: payload });
}

export function acceptInvite(session: ApiSession, inviteId: string) {
  return apiRequest<MemberRead>(`/workspaces/invites/${inviteId}/accept`, session, { method: "POST" });
}

export function cancelInvite(session: ApiSession, inviteId: string) {
  return apiRequest<void>(`/workspaces/invites/${inviteId}`, session, { method: "DELETE" });
}

export function updateMemberRole(session: ApiSession, memberId: string, role: string) {
  return apiRequest<MemberRead>(`/workspaces/members/${memberId}`, session, { method: "PATCH", body: { role } });
}

export function removeMember(session: ApiSession, memberId: string) {
  return apiRequest<void>(`/workspaces/members/${memberId}`, session, { method: "DELETE" });
}
