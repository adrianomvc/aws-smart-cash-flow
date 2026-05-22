const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";

export type SessionMode = "local" | "supabase";

export type ApiSession = {
  token: string;
  mode: SessionMode;
};

export type WorkspaceCurrent = {
  user_id: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
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
  description: string;
  raw_description: string;
  amount: string;
  currency: string;
  direction: string;
  installment_current: number | null;
  installment_total: number | null;
  source_line: number | null;
  category: CategoryAssignmentRead | null;
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
  created_at: string;
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
  transaction_count: number;
};

export type MonthlyCashflowItem = {
  month: string;
  income: string;
  expenses: string;
  payments: string;
  balance: string;
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
  amount: string;
  count: number;
  share_ratio: string | null;
  average_amount: string;
};

export type MerchantRankingItem = {
  description: string;
  amount: string;
  count: number;
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

async function apiRequest<T>(path: string, session: ApiSession, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.token}`);

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export function getWeekdaySpending(session: ApiSession, query: string) {
  return apiRequest<ListResponse<WeekdaySpendingItem>>(`/dashboard/weekday-spending${query}`, session);
}

export function getCategoryRanking(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CategoryRankingItem>>(`/dashboard/category-ranking${query}`, session);
}

export function getMerchantRanking(session: ApiSession, query: string) {
  return apiRequest<ListResponse<MerchantRankingItem>>(`/dashboard/merchant-ranking${query}`, session);
}

export function getCategoryGrowthAlerts(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CategoryGrowthAlertItem>>(`/dashboard/category-growth-alerts${query}`, session);
}

export function getCreditCardPaymentMatches(session: ApiSession, query: string) {
  return apiRequest<ListResponse<CreditCardPaymentMatchItem>>(`/dashboard/credit-card-payment-matches${query}`, session);
}

export function getDataQuality(session: ApiSession, query: string) {
  return apiRequest<DataQuality>(`/dashboard/data-quality${query}`, session);
}

export function getImports(session: ApiSession, query = "?limit=20") {
  return apiRequest<ListResponse<ImportJobRead>>(`/imports${query}`, session);
}

export function getImportErrors(session: ApiSession, importId: string) {
  return apiRequest<ListResponse<ImportErrorRead>>(`/imports/${importId}/errors`, session);
}

export function previewImport(session: ApiSession, file: File, sourceKind = "auto") {
  const data = new FormData();
  data.append("file", file);
  data.append("source_kind", sourceKind);
  return apiRequest<ImportPreviewResult>("/imports/preview", session, { method: "POST", body: data });
}

export function uploadImport(session: ApiSession, file: File, sourceKind = "auto") {
  const data = new FormData();
  data.append("file", file);
  data.append("source_kind", sourceKind);
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

export function getTransactions(session: ApiSession, query: string) {
  return apiRequest<ListResponse<TransactionRead>>(`/transactions${query}`, session);
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

export function createCategory(session: ApiSession, name: string, parentCategoryId: string | null) {
  return apiRequest<CategoryRead>("/categories", session, {
    method: "POST",
    body: { name, parent_category_id: parentCategoryId },
  });
}

export function updateCategory(
  session: ApiSession,
  categoryId: string,
  payload: { name: string; parent_category_id: string | null },
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

export function createRule(
  session: ApiSession,
  payload: {
    name: string;
    field: string;
    match_type: string;
    pattern: string;
    category_id: string | null;
    target_direction: string | null;
    priority: number;
    active: boolean;
  },
) {
  return apiRequest<CategorizationRuleRead>("/categorization-rules", session, {
    method: "POST",
    body: payload,
  });
}

export function updateRule(
  session: ApiSession,
  ruleId: string,
  payload: Partial<{
    name: string;
    field: string;
    match_type: string;
    pattern: string;
    category_id: string | null;
    target_direction: string | null;
    priority: number;
    active: boolean;
  }>,
) {
  return apiRequest<CategorizationRuleRead>(`/categorization-rules/${ruleId}`, session, {
    method: "PATCH",
    body: payload,
  });
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

export function getRulePreview(session: ApiSession, ruleId: string) {
  return apiRequest<RulePreview>(`/categorization-rules/${ruleId}/preview`, session);
}
