const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";

export type ImportJob = {
  id: string;
  source_file_id: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  created_at: string;
  source_file?: {
    original_filename: string;
    source_kind: string;
    size_bytes: number;
  } | null;
};

export type Transaction = {
  id: string;
  transaction_date: string;
  description: string;
  raw_description: string;
  amount: string;
  currency: string;
  direction: string;
  source_type: string;
  category_id: string | null;
  category_source: string | null;
  category_review_status: string | null;
};

export type Category = {
  id: string;
  name: string;
  parent_category_id: string | null;
};

export type CategorizationRule = {
  id: string;
  name: string;
  field: string;
  match_type: string;
  pattern: string;
  category_id: string;
  priority: number;
  active: boolean;
};

export type ListResponse<T> = {
  workspace_id: string;
  items: T[];
};

export type PaginatedListResponse<T> = ListResponse<T> & {
  total: number;
  limit: number;
  offset: number;
};

export type ApplyRulesResponse = {
  workspace_id: string;
  applied_count: number;
};

async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
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

export function listImports(token: string) {
  return apiRequest<ListResponse<ImportJob>>("/imports?limit=20", token);
}

export function uploadImport(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<{
    import_job_id: string;
    source_file_id: string;
    status: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    duplicate_rows: number;
  }>("/imports", token, {
    method: "POST",
    body: form,
  });
}

export function listTransactions(
  token: string,
  options: { limit?: number; offset?: number } = {},
) {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  return apiRequest<PaginatedListResponse<Transaction>>(
    `/transactions?limit=${limit}&offset=${offset}`,
    token,
  );
}

export function assignTransactionCategory(
  token: string,
  transactionId: string,
  categoryId: string,
) {
  return apiRequest<Transaction>(`/transactions/${transactionId}/category`, token, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category_id: categoryId }),
  });
}

export function listCategories(token: string) {
  return apiRequest<ListResponse<Category>>("/categories", token);
}

export function createCategory(token: string, name: string) {
  return apiRequest<Category>("/categories", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
}

export function listRules(token: string) {
  return apiRequest<ListResponse<CategorizationRule>>("/categorization-rules", token);
}

export function createRule(
  token: string,
  payload: {
    name: string;
    field: string;
    match_type: string;
    pattern: string;
    category_id: string;
    priority: number;
    active: boolean;
  },
) {
  return apiRequest<CategorizationRule>("/categorization-rules", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function applyRules(token: string) {
  return apiRequest<ApplyRulesResponse>("/categorization-rules/apply", token, {
    method: "POST",
  });
}
