import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  ChevronRight,
  CreditCard,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";

import {
  createManualTransaction,
  deleteTransaction,
  getActiveAccounts,
  getDashboardSummary,
  getTransactionDuplicates,
  getTransactions,
  normalizeTransactionDescriptions,
  updateTransactionCategory,
  updateTransactionDirection,
} from "../lib/api";
import {
  amountClass,
  apiErrorMessage,
  categoryPath,
  compactMoneyAbs,
  dateLabel,
  dedupeStatus,
  duplicatePrimaryId,
  exportTransactionsCSV,
  installmentLabel,
  installmentSummaryLabel,
  money,
  moneyAbs,
  orderedCategoryOptions,
  orderedCategoryTree,
  periodRange,
  sourceTypeLabel,
  transactionFilterSummary,
} from "../lib/utils";
import { useCategories } from "../hooks";
import {
  DedupeStatusBadge,
  Drawer,
  InlineError,
  InlineSuccess,
  MetricCard,
  Panel,
  PeriodFilter,
  QualityRow,
  ResponsiveTable,
  SortHeader,
} from "../components/ui";
import type {
  ActiveAccountItem,
  ApiSession,
  CategoryRead,
  DuplicateTransactionGroup,
  TransactionRead,
} from "../lib/api";
import type { TransactionPeriodPreset } from "../types";

// ---------------------------------------------------------------------------
// Private sub-components
// ---------------------------------------------------------------------------


function ActiveAccountsPanel({ accounts, loading }: { accounts: ActiveAccountItem[]; loading: boolean }) {
  if (loading) {
    return <div className="loading-state"><Loader2 className="spin" size={16} />Carregando contas...</div>;
  }
  if (!accounts.length) {
    return <div className="account-item"><span className="account-item-meta">Nenhuma conta ativa encontrada.</span></div>;
  }
  return (
    <div className="accounts-panel">
      {accounts.map((account, idx) => (
        <div className="account-item" key={idx}>
          <div className="account-item-header">
            <span className="account-item-name">{account.account_name}</span>
          </div>
          {account.kind === "bank" ? (
            <>
              <div className="account-item-balance">{money(account.current_balance)}</div>
              {account.balance_date ? <div className="account-item-meta">Extrato: {account.balance_date}</div> : null}
            </>
          ) : (
            <>
              <div className="account-item-balance">{money(account.used_amount)} <span className="account-item-meta">/ {money(account.limit_amount)}</span></div>
              <div className="account-item-track">
                <div
                  className="account-item-track-fill"
                  style={{ width: `${account.limit_amount ? Math.min(100, ((account.used_amount ?? 0) / account.limit_amount) * 100) : 0}%` }}
                />
              </div>
              {account.available_amount != null ? (
                <div className="account-item-available">Disponível: {money(account.available_amount)}</div>
              ) : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryPicker({ categoryOptions, transaction, session, onCategorized }: {
  categoryOptions: ReturnType<typeof orderedCategoryOptions>;
  transaction: TransactionRead;
  session: ApiSession;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (categoryId: string | null) => updateTransactionCategory(session, transaction.id, categoryId),
    onSuccess: (updatedTransaction, categoryId) => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      onCategorized?.(updatedTransaction, categoryId);
    },
  });
  return (
    <select className="table-select" disabled={mutation.isPending} value={transaction.category?.category_id ?? ""} onChange={(e) => mutation.mutate(e.target.value || null)} onClick={(e) => e.stopPropagation()}>
      <option value="">Sem categoria</option>
      {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select>
  );
}

function DirectionPicker({ transaction, session }: { transaction: TransactionRead; session: ApiSession }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (direction: string) => updateTransactionDirection(session, transaction.id, direction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["weekday-spending"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-card-payment-matches"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  return (
    <select className={`table-select direction-select ${transaction.direction}`} disabled={mutation.isPending} value={transaction.direction} onChange={(e) => mutation.mutate(e.target.value)} onClick={(e) => e.stopPropagation()}>
      <option value="debit">Despesa</option>
      <option value="credit">Receita/Crédito</option>
      <option value="payment">Pagamento de fatura</option>
    </select>
  );
}

function TransactionRow({ transaction, categories, categoryOptions, session, onDelete, onSelect, onCategorized, expectedDedupeKey = "", primaryDedupeId = "", showDedupeStatus = false, showInstallments = false, selected = false, onToggleSelect }: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  categoryOptions: ReturnType<typeof orderedCategoryOptions>;
  session: ApiSession;
  onDelete: () => void;
  onSelect: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
  expectedDedupeKey?: string;
  primaryDedupeId?: string;
  showDedupeStatus?: boolean;
  showInstallments?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const categoryLabel = category ? categoryPath(category, categories) : undefined;
  const acctText = transaction.account_or_card ?? transaction.source_name ?? (
    transaction.source_type === "bank_statement" ? "Conta Bancária" :
    transaction.source_type === "credit_card_statement" ? "Cartão de Crédito" :
    transaction.source_type === "unknown" ? "Manual" : "Origem não identificada"
  );
  const acctIcon = transaction.source_type === "bank_statement" ? "🏦" : transaction.source_type === "credit_card_statement" ? "💳" : transaction.source_type === "unknown" ? "✏️" : "❓";
  return (
    <tr
      className={[selected ? "row-selected" : "", `direction-${transaction.direction}`, !transaction.category ? "status-pending" : ""].filter(Boolean).join(" ")}
      onClick={() => onSelect()}
      style={{ cursor: "pointer" }}
    >
      <td className="col-checkbox"><input type="checkbox" checked={selected} onChange={() => onToggleSelect?.(transaction.id)} onClick={(e) => e.stopPropagation()} /></td>
      <td>{dateLabel(transaction.transaction_date)}</td>
      <td>
        <span className="description-cell">{transaction.description}</span>
        {transaction.description !== transaction.raw_description ? <small>{transaction.raw_description}</small> : null}
      </td>
      <td><span className="account-cell account-cell-inner" title={acctText}><span className="account-type-icon">{acctIcon}</span>{acctText}</span></td>
      <td><DirectionPicker session={session} transaction={transaction} /></td>
      <td className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</td>
      {showInstallments ? <td>{installmentLabel(transaction)}</td> : null}
      <td><CategoryPicker categoryOptions={categoryOptions} onCategorized={onCategorized} session={session} transaction={transaction} /></td>
      <td>{transaction.category ? <span className="status-badge confirmed" title={categoryLabel}>Confirmado</span> : <span className="status-badge pending">Pendente</span>}</td>
      {showDedupeStatus ? <td><DedupeStatusBadge status={dedupeStatus(transaction, expectedDedupeKey, primaryDedupeId)} /></td> : null}
      <td>
        <div className="row-actions">
          <button className="icon-button danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Excluir transação" type="button"><Trash2 size={16} /></button>
          <button className="icon-button" onClick={(e) => { e.stopPropagation(); onSelect(); }} title="Ver detalhe" type="button"><ChevronRight size={16} /></button>
        </div>
      </td>
    </tr>
  );
}

function TransactionDetail({ transaction, categories, categoryOptions, deleting = false, onDelete, onCategorized, session }: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  categoryOptions: ReturnType<typeof orderedCategoryOptions>;
  deleting?: boolean;
  onDelete?: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
  session: ApiSession;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const normalizedChanged = transaction.description !== transaction.raw_description;
  return (
    <div className="detail-stack">
      <QualityRow label="Descrição normalizada" value={<span className={normalizedChanged ? "normalized-value" : ""}>{transaction.description}</span>} />
      <QualityRow label="Descrição original" value={transaction.raw_description} />
      <div><p className="field-label">Tipo financeiro</p><DirectionPicker session={session} transaction={transaction} /></div>
      <QualityRow label="Valor" value={<span className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</span>} />
      <QualityRow label="Parcela" value={installmentSummaryLabel(transaction)} />
      <QualityRow label="Data" value={dateLabel(transaction.transaction_date)} />
      <QualityRow label="Origem" value={sourceTypeLabel(transaction.source_type)} />
      <QualityRow label="Arquivo" value={transaction.source_file_id} />
      <QualityRow label="Importação" value={transaction.import_job_id} />
      <QualityRow label="Linha" value={transaction.source_line ?? "-"} />
      <QualityRow label="Duplicidade" value={transaction.natural_dedupe_key ? "Registro principal ou já regularizado" : "Precisa revisão por possível duplicidade"} />
      <QualityRow label="Categoria atual" value={category ? categoryPath(category, categories) : "Sem categoria"} />
      <QualityRow label="Fonte" value={transaction.category?.source ?? "Pendente"} />
      <div><p className="field-label">Alterar categoria</p><CategoryPicker categoryOptions={categoryOptions} onCategorized={onCategorized} session={session} transaction={transaction} /></div>
      {onDelete ? (
        <div className="danger-zone">
          <div><strong>Excluir transação</strong><p>Remove este lançamento e sua classificação dos indicadores do MVP.</p></div>
          <button className="danger-button" disabled={deleting} onClick={onDelete} type="button">
            {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}Excluir
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ManualTransactionForm({ categories, error, loading, onCancel, onSubmit }: {
  categories: CategoryRead[];
  error: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (payload: { amount: string; category_id: string | null; description: string; direction: string; transaction_date: string }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [transactionDate, setTransactionDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("debit");
  const [categoryId, setCategoryId] = useState("");
  const [validationError, setValidationError] = useState("");
  const categoryOptions = orderedCategoryOptions(categories);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedAmount = amount.replace(",", ".").trim();
    const numericAmount = Number(normalizedAmount);
    const missingFields = [!transactionDate ? "data" : "", !description.trim() ? "descrição" : "", !normalizedAmount || Number.isNaN(numericAmount) || numericAmount <= 0 ? "valor maior que zero" : ""].filter(Boolean);
    if (missingFields.length) { setValidationError(`Informe ${missingFields.join(", ")}.`); return; }
    setValidationError("");
    onSubmit({ transaction_date: transactionDate, description: description.trim(), amount: normalizedAmount, direction, category_id: categoryId || null });
  }

  return (
    <form className="manual-transaction-form" onSubmit={submit}>
      <div className="form-grid two-columns">
        <label>Data<input disabled={loading} type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} /></label>
        <label>Tipo financeiro<select disabled={loading} value={direction} onChange={(e) => setDirection(e.target.value)}><option value="debit">Despesa</option><option value="credit">Receita/Crédito</option><option value="payment">Pagamento de fatura</option></select></label>
      </div>
      <label>Descrição<input disabled={loading} placeholder="Ex: Mercado, salário, ajuste de fatura" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-grid two-columns">
        <label>Valor<input disabled={loading} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Categoria<select disabled={loading} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Sem categoria</option>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      </div>
      {validationError ? <InlineError message={validationError} /> : null}
      {error ? <InlineError message={error} /> : null}
      <div className="form-actions">
        <button className="ghost-button" disabled={loading} onClick={onCancel} type="button">Cancelar</button>
        <button className="primary-button" disabled={loading} type="submit">{loading ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}Cadastrar transação</button>
      </div>
    </form>
  );
}

function DuplicateTransactionsPanel({ groups, loading, onNextPage, onReviewGroup, onAutoResolveAll, onPreviousPage, onRefresh, page, pageSize, resolving = false, totalGroups, totalTransactions }: {
  groups: DuplicateTransactionGroup[];
  loading: boolean;
  onNextPage: () => void;
  onReviewGroup: (group: DuplicateTransactionGroup) => void;
  onAutoResolveAll: () => void;
  onPreviousPage: () => void;
  onRefresh: () => void;
  page: number;
  pageSize: number;
  resolving?: boolean;
  totalGroups: number;
  totalTransactions: number;
}) {
  const to = Math.min((page + 1) * pageSize, totalGroups);
  const nextDisabled = loading || to >= totalGroups;
  if (loading) return <div className="loading-state"><Loader2 className="spin" size={18} />Carregando possíveis duplicados...</div>;
  if (!groups.length) return <div className="filter-summary compact"><span>Nenhum grupo de possível duplicidade encontrado. ✓</span></div>;
  return (
    <div className="duplicate-stack">
      <div className="duplicate-toolbar">
        <span className="filter-summary-text">{totalGroups} grupos · {totalTransactions} lançamentos envolvidos · página {page + 1}</span>
        <div className="duplicate-toolbar-actions">
          <button className="ghost-button compact-button" disabled={loading || resolving || !groups.length} onClick={onAutoResolveAll} title="Manter o mais antigo de cada grupo e excluir os demais" type="button">
            {resolving ? <Loader2 className="spin" size={13} /> : <Zap size={13} />}Resolver todos
          </button>
          <button className="ghost-button compact-button" disabled={loading} onClick={onRefresh} type="button"><RefreshCw size={13} /> Atualizar</button>
          <button className="ghost-button compact-button" disabled={loading || page === 0} onClick={onPreviousPage} type="button">‹ Anterior</button>
          <button className="ghost-button compact-button" disabled={nextDisabled} onClick={onNextPage} type="button">Próxima ›</button>
        </div>
      </div>
      <div className="duplicate-group-list">
        {groups.map((group) => {
          const first = group.items[0];
          return (
            <div className="duplicate-group-row" key={group.current_natural_dedupe_key}>
              <div className="duplicate-group-row-info">
                <strong>{first?.description ?? "—"}</strong>
                <span>{dateLabel(first?.transaction_date ?? "")} · {moneyAbs(first?.amount)} · {group.count} cópias</span>
              </div>
              <button className="primary-button compact-button" onClick={() => onReviewGroup(group)} type="button">Revisar →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DuplicateReviewDrawerContent({ group, keepId, onKeepChange, onResolve, onSkip, resolving }: {
  group: DuplicateTransactionGroup;
  keepId: string;
  onKeepChange: (id: string) => void;
  onResolve: () => void;
  onSkip: () => void;
  resolving: boolean;
}) {
  const sorted = [...group.items].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  const oldestId = sorted[0]?.id ?? "";
  const newestId = sorted[sorted.length - 1]?.id ?? "";
  const deleteCount = group.items.length - 1;
  return (
    <div className="dedupe-review-stack">
      <p className="dedupe-review-description">Escolha qual lançamento manter. Os demais serão excluídos permanentemente.</p>
      <div className="dedupe-quick-actions">
        <button className={`ghost-button compact-button ${keepId === oldestId ? "active" : ""}`} onClick={() => onKeepChange(oldestId)} type="button">Manter mais antigo</button>
        <button className={`ghost-button compact-button ${keepId === newestId ? "active" : ""}`} onClick={() => onKeepChange(newestId)} type="button">Manter mais recente</button>
      </div>
      <div className="dedupe-items">
        {sorted.map((item) => {
          const isKeep = item.id === keepId;
          return (
            <label key={item.id} className={`dedupe-item-card ${isKeep ? "keep" : "discard"}`}>
              <input checked={isKeep} name="dedupe-keep" onChange={() => onKeepChange(item.id)} type="radio" value={item.id} />
              <div className="dedupe-item-body">
                <div className="dedupe-item-main">
                  <span className="dedupe-item-date">{dateLabel(item.transaction_date)}</span>
                  <span className="dedupe-item-amount">{moneyAbs(item.amount)}</span>
                  <span className={`dedupe-item-badge ${isKeep ? "keep" : "discard"}`}>{isKeep ? "✓ Manter" : "× Excluir"}</span>
                </div>
                <span className="dedupe-item-desc">{item.description}</span>
                <small className="dedupe-item-source">{item.source_filename ?? "arquivo sem nome"} · linha {item.source_line ?? "-"} · {item.source_type === "credit_card_statement" ? "Cartão" : "Conta"}</small>
              </div>
            </label>
          );
        })}
      </div>
      <div className="dedupe-actions">
        <button className="ghost-button" disabled={resolving} onClick={onSkip} type="button">Pular grupo</button>
        <button className="danger-button" disabled={resolving || !keepId || deleteCount < 1} onClick={onResolve} type="button">
          {resolving ? <><Loader2 className="spin" size={14} /> Excluindo...</> : <><Trash2 size={14} /> Excluir {deleteCount} duplicado(s)</>}
        </button>
      </div>
    </div>
  );
}

function CategoryMultiSelect({ categories, selected, onChange }: {
  categories: CategoryRead[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tree = orderedCategoryTree(categories);
  const roots = tree.filter((c) => !c.parent_category_id);
  const childrenOf = (id: string) => tree.filter((c) => c.parent_category_id === id);

  const label = selected.size === 0
    ? "Todas as categorias"
    : selected.size === 1
      ? (categories.find((c) => c.id === [...selected][0])?.name ?? "1 categoria")
      : `${selected.size} categorias`;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="category-multiselect" ref={ref}>
      <button
        className={`filter-select category-multiselect-trigger${selected.size > 0 ? " active" : ""}`}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        {label} ▾
      </button>
      {open && (
        <div className="category-multiselect-dropdown">
          {roots.map((root) => {
            const children = childrenOf(root.id);
            return (
              <div key={root.id} className="category-multiselect-group">
                <label className="category-multiselect-item parent">
                  <input type="checkbox" checked={selected.has(root.id)} onChange={() => toggle(root.id)} />
                  {root.name}
                </label>
                {children.map((child) => (
                  <label key={child.id} className="category-multiselect-item child">
                    <input type="checkbox" checked={selected.has(child.id)} onChange={() => toggle(child.id)} />
                    {child.name}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TransactionExplorer({
  initialCategoryId = "",
  initialDateFrom = "",
  initialDateTo = "",
  initialDirection = "",
  initialImportJobId = "",
  initialMessage = "",
  initialPeriodPreset = "all",
  initialSearch = "",
  initialSourceType = "",
  initialWeekday,
  session,
  onSelect,
  selected,
  fixedQuery,
  reviewMode = false,
}: {
  initialCategoryId?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialDirection?: string;
  initialImportJobId?: string;
  initialMessage?: string;
  initialPeriodPreset?: TransactionPeriodPreset;
  initialSearch?: string;
  initialSourceType?: string;
  initialWeekday?: number;
  session: ApiSession;
  onSelect: (transaction: TransactionRead | null) => void;
  selected: TransactionRead | null;
  fixedQuery?: string;
  reviewMode?: boolean;
}) {
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [sourceType, setSourceType] = useState(initialSourceType);
  const [direction, setDirection] = useState(initialDirection);
  const [statusFilter, setStatusFilter] = useState(initialCategoryId.startsWith("__") ? initialCategoryId : "");
  const [categoryIds, setCategoryIds] = useState<Set<string>>(() => new Set(initialCategoryId && !initialCategoryId.startsWith("__") ? [initialCategoryId] : []));
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [importJobId] = useState(initialImportJobId);
  const [periodPreset, setPeriodPreset] = useState<TransactionPeriodPreset>(initialPeriodPreset);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [weekday] = useState<number | undefined>(initialWeekday);
  const [sortBy, setSortBy] = useState("transaction_date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [actionMessage, setActionMessage] = useState(initialMessage);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [duplicatePage, setDuplicatePage] = useState(0);
  const [activeReviewGroup, setActiveReviewGroup] = useState<DuplicateTransactionGroup | null>(null);
  const [keepId, setKeepId] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const duplicatePageSize = 10;
  const categories = useCategories(session);
  const categoryOptions = useMemo(() => orderedCategoryOptions(categories.data?.items ?? []), [categories.data?.items]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const periodSummaryQuery = useMemo(() => { const params = new URLSearchParams(); if (dateFrom) params.set("date_from", dateFrom); if (dateTo) params.set("date_to", dateTo); return `?${params.toString()}`; }, [dateFrom, dateTo]);
  const periodSummary = useQuery({ queryKey: ["transactions-period-summary", session.token, periodSummaryQuery], queryFn: () => getDashboardSummary(session, periodSummaryQuery), staleTime: 2 * 60 * 1000 });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sourceType) params.set("source_type", sourceType);
    if (direction) params.set("direction", direction);
    if (importJobId) params.set("import_job_id", importJobId);
    if (categoryIds.size > 0 && fixedQuery !== "category_id=__uncategorized__") {
      for (const id of categoryIds) params.append("category_ids", id);
    }
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (weekday !== undefined) params.set("weekday", String(weekday));
    params.set("sort_by", sortBy);
    params.set("sort_dir", sortDir);
    if (fixedQuery && fixedQuery !== "category_id=__uncategorized__") { const [key, value] = fixedQuery.split("="); params.set(key, value); }
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    if (amountMin) params.set("amount_min", amountMin);
    if (amountMax) params.set("amount_max", amountMax);
    if (statusFilter === "__pending__") params.set("status", "pending");
    else if (statusFilter === "__confirmed__") params.set("status", "confirmed");
    return `?${params.toString()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountMax, amountMin, categoryIds, dateFrom, dateTo, direction, fixedQuery, importJobId, page, pageSize, search, sortBy, sortDir, sourceType, statusFilter, weekday]);
  const transactions = useQuery({ queryKey: ["transactions", session.token, query], queryFn: () => getTransactions(session, query) });
  const duplicatesQuery = `?limit=${duplicatePageSize}&offset=${duplicatePage * duplicatePageSize}`;
  const duplicates = useQuery({ queryKey: ["transaction-duplicates", session.token, duplicatesQuery], queryFn: () => getTransactionDuplicates(session, duplicatesQuery), enabled: showDuplicates });
  const activeAccounts = useQuery({ queryKey: ["active-accounts", session.token], queryFn: () => getActiveAccounts(session), staleTime: 2 * 60 * 1000 });
  const remove = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(session, transactionId),
    onSuccess: () => {
      onSelect(null);
      setActionMessage("Transação excluída. Indicadores e listas foram atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-duplicates"] });
      void queryClient.invalidateQueries({ queryKey: ["duplicate-count-badge"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-card-statements"] });
    },
  });
  const removeDuplicateReviewItems = useMutation({
    mutationFn: async (transactionIds: string[]) => { for (const id of transactionIds) await deleteTransaction(session, id); return transactionIds; },
    onSuccess: (_result, transactionIds) => {
      setActiveReviewGroup(null); setKeepId("");
      setActionMessage(`${transactionIds.length} duplicado(s) excluído(s). A base foi atualizada.`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-duplicates"] });
      void queryClient.invalidateQueries({ queryKey: ["duplicate-count-badge"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions-period-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  const createManual = useMutation({
    mutationFn: (payload: { amount: string; category_id: string | null; description: string; direction: string; transaction_date: string }) => createManualTransaction(session, payload),
    onSuccess: (transaction) => {
      setShowCreate(false); onSelect(transaction);
      setActionMessage("Transação manual cadastrada. Indicadores e listas foram atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  const bulkCategorize = useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId: string | null }) => {
      for (const id of ids) await updateTransactionCategory(session, id, categoryId);
      return ids.length;
    },
    onSuccess: (count) => {
      setSelectedIds(new Set());
      setActionMessage(`Categoria aplicada em ${count} transação(ões). Indicadores atualizados.`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const normalizeDescriptions = useMutation({
    mutationFn: () => normalizeTransactionDescriptions(session),
    onSuccess: (result) => {
      setActionMessage(`${result.changed_count} descrição(ões) normalizada(s) de ${result.scanned_count} verificada(s).`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const visibleTransactions = (() => {
    const items = transactions.data?.items ?? [];
    if (fixedQuery === "category_id=__uncategorized__") return items.filter((t) => !t.category);
    return items;
  })();
  const totalTransactions = fixedQuery === "category_id=__uncategorized__" ? visibleTransactions.length : transactions.data?.total ?? 0;
  const pageIncome = visibleTransactions.filter((t) => t.direction === "credit").reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
  const pageExpenses = visibleTransactions.filter((t) => t.direction === "debit").reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
  const pagePayments = visibleTransactions.filter((t) => t.direction === "payment").reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
  const pagePending = visibleTransactions.filter((t) => !t.category).length;
  const pageBalance = pageIncome - pageExpenses;
  const hasInstallments = visibleTransactions.some((t) => t.installment_current != null && t.installment_total != null);
  void pagePayments; void pageBalance;
  const allPageSelected = visibleTransactions.length > 0 && visibleTransactions.every((t) => selectedIds.has(t.id));
  const somePageSelected = visibleTransactions.some((t) => selectedIds.has(t.id));
  const nextPageDisabled = transactions.isLoading || fixedQuery === "category_id=__uncategorized__" ? visibleTransactions.length < pageSize : (page + 1) * pageSize >= totalTransactions;
  const paginationFrom = page * pageSize + 1;
  const paginationTo = Math.min((page + 1) * pageSize, totalTransactions);
  const activeFilterCount = [searchInput, sourceType, direction, importJobId, !reviewMode ? statusFilter : "", !reviewMode && categoryIds.size > 0 ? "cat" : "", dateFrom || dateTo, weekday !== undefined ? String(weekday) : "", amountMin, amountMax].filter(Boolean).length;
  const emptyMessage = statusFilter === "__pending__" ? "Ótimo! Nenhum lançamento pendente de categoria." : searchInput ? `Nenhum lançamento encontrado para "${searchInput}".` : (dateFrom || dateTo) ? "Nenhum lançamento no período selecionado." : activeFilterCount ? "Nenhuma transação encontrada para os filtros selecionados." : reviewMode ? "Nenhuma transação pendente de categoria." : "Nenhuma transação encontrada.";
  const filterSummary = transactionFilterSummary({ categoryIds, categories: categories.data?.items ?? [], dateFrom, dateTo, direction, duplicateGroupCount: 0, importJobId, periodPreset, reviewMode, search, sourceType, weekday });

  function toggleSort(nextSortBy: string) {
    setPage(0);
    if (sortBy === nextSortBy) { setSortDir((c) => (c === "asc" ? "desc" : "asc")); return; }
    setSortBy(nextSortBy);
    setSortDir(nextSortBy === "transaction_date" ? "desc" : "asc");
  }
  function applyPeriodPreset(nextPreset: TransactionPeriodPreset) {
    setPeriodPreset(nextPreset); setPage(0);
    const range = periodRange(nextPreset);
    setDateFrom(range.dateFrom); setDateTo(range.dateTo);
  }
  function updateDateFrom(value: string) { setPeriodPreset("custom"); setDateFrom(value); setPage(0); }
  function updateDateTo(value: string) { setPeriodPreset("custom"); setDateTo(value); setPage(0); }
  function clearFilters() { setSearchInput(""); setSearch(""); setSourceType(""); setDirection(""); setStatusFilter(""); setCategoryIds(new Set()); setAmountMin(""); setAmountMax(""); setPeriodPreset("all"); setDateFrom(""); setDateTo(""); setPage(0); }
  function openGroupReview(group: DuplicateTransactionGroup) { setActiveReviewGroup(group); setKeepId(duplicatePrimaryId(group)); }
  function resolveGroup() { if (!activeReviewGroup || !keepId) return; const deleteIds = activeReviewGroup.items.map((i) => i.id).filter((id) => id !== keepId); if (!deleteIds.length) return; removeDuplicateReviewItems.mutate(deleteIds); }
  function autoResolveAllGroups() {
    const groups = duplicates.data?.groups ?? [];
    if (!groups.length) return;
    const allDeleteIds: string[] = [];
    for (const group of groups) { const sorted = [...group.items].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)); const keepItemId = sorted[0]?.id ?? ""; group.items.forEach((i) => { if (i.id !== keepItemId) allDeleteIds.push(i.id); }); }
    if (!allDeleteIds.length) return;
    const confirmed = window.confirm(`Resolver automaticamente ${groups.length} grupo(s) desta página?\n\nSerão excluídos ${allDeleteIds.length} lançamento(s), mantendo sempre o mais antigo de cada grupo.\n\nEsta ação não pode ser desfeita.`);
    if (confirmed) removeDuplicateReviewItems.mutate(allDeleteIds);
  }
  function handleCategoryChanged(transaction: TransactionRead, categoryId: string | null) {
    if (selected?.id === transaction.id) onSelect(transaction);
    if (reviewMode && categoryId) { setActionMessage("Categoria aplicada. A transação saiu da revisão porque não está mais pendente."); return; }
    if (!categoryId) { setActionMessage("Categoria removida. A transação voltou para Sem categoria e entrou na revisão pendente."); return; }
    setActionMessage("Categoria atualizada. Indicadores e listas foram recalculados.");
  }

  const advancedFilterCount = [sourceType, categoryIds.size > 0 ? "cat" : "", amountMin, amountMax, dateFrom || dateTo ? "period" : ""].filter(Boolean).length;
  const activeFilterChips: Array<{ id: string; label: string; clear: () => void }> = [
    searchInput ? { id: "search", label: `"${searchInput}"`, clear: () => { setSearchInput(""); setSearch(""); setPage(0); } } : null,
    direction ? { id: "direction", label: direction === "debit" ? "Despesas" : direction === "credit" ? "Receitas" : "Faturas", clear: () => { setDirection(""); setPage(0); } } : null,
    statusFilter ? { id: "status", label: statusFilter === "__confirmed__" ? "Confirmados" : "Pendentes", clear: () => { setStatusFilter(""); setPage(0); } } : null,
    (dateFrom || dateTo) ? { id: "period", label: `${dateFrom || "início"} → ${dateTo || "hoje"}`, clear: () => { setDateFrom(""); setDateTo(""); setPeriodPreset("all"); setPage(0); } } : null,
    sourceType ? { id: "source", label: sourceType === "bank_statement" ? "Conta corrente" : sourceType === "credit_card_statement" ? "Cartão de crédito" : "Manual", clear: () => { setSourceType(""); setPage(0); } } : null,
    categoryIds.size > 0 ? { id: "categories", label: categoryIds.size === 1 ? (categories.data?.items.find((c) => c.id === [...categoryIds][0])?.name ?? "1 categoria") : `${categoryIds.size} categorias`, clear: () => { setCategoryIds(new Set()); setPage(0); } } : null,
    amountMin ? { id: "amountMin", label: `≥ R$ ${amountMin}`, clear: () => { setAmountMin(""); setPage(0); } } : null,
    amountMax ? { id: "amountMax", label: `≤ R$ ${amountMax}`, clear: () => { setAmountMax(""); setPage(0); } } : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <section className="page-stack">
      {reviewMode ? (
        <div className="transaction-summary-grid compact-four" aria-label="Resumo da revisão">
          <div className="transaction-summary-card warning"><span>Pendentes</span><strong>{pagePending}</strong><small>Sem categoria nesta página</small></div>
          <div className="transaction-summary-card negative"><span>Despesas</span><strong>{String(pageExpenses.toFixed(0))}</strong><small>{moneyAbs(pageExpenses)}</small></div>
          <div className="transaction-summary-card positive"><span>Receitas</span><strong>{String(pageIncome.toFixed(0))}</strong><small>{moneyAbs(pageIncome)}</small></div>
          <div className="transaction-summary-card"><span>Total</span><strong>{visibleTransactions.length}</strong><small>Lançamentos na fila</small></div>
        </div>
      ) : null}

      {!reviewMode ? (
        <div className="transactions-kpi-section">
          <span className="transactions-kpi-label">Resumo do período</span>
          <div className="metric-grid executive transactions-kpi-grid" aria-label="Resumo do período">
            <MetricCard icon={ArrowUpCircle} label="Receitas" value={compactMoneyAbs(periodSummary.data?.income)} title={moneyAbs(periodSummary.data?.income)} helper="Total de entradas" tone="positive" />
            <MetricCard icon={ArrowDownCircle} label="Despesas" value={compactMoneyAbs(periodSummary.data?.expenses)} title={moneyAbs(periodSummary.data?.expenses)} helper="Total de saídas" tone="negative" />
            <MetricCard icon={CreditCard} label="Faturas" value={compactMoneyAbs(periodSummary.data?.payments)} title={moneyAbs(periodSummary.data?.payments)} helper="Pagamentos de cartão" tone="info" />
            <MetricCard icon={BarChart3} label="Saldo" value={compactMoneyAbs(periodSummary.data?.balance)} title={money(periodSummary.data?.balance)} helper="Receitas − despesas" tone={Number(periodSummary.data?.balance ?? 0) >= 0 ? "positive" : "negative"} />
          </div>
        </div>
      ) : null}

      <div className="page-stack">
        {/* Filter card */}
        <div className="tx-filter-card">
          {/* Search */}
          <div className="tx-search-bar">
            <Search size={16} />
            <input placeholder="Buscar por descrição, estabelecimento ou valor..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            {searchInput ? <button className="tx-search-clear" onClick={() => { setSearchInput(""); setSearch(""); setPage(0); }} type="button">×</button> : null}
          </div>
          {/* Quick filters: Tipo + Status */}
          <div className="tx-quick-filters">
            <div className="tx-filter-group">
              <span className="tx-filter-group-label">Tipo</span>
              <div className="transactions-quick-tabs">
                {[{ value: "", label: "Todos" }, { value: "debit", label: "Despesas" }, { value: "credit", label: "Receitas" }, { value: "payment", label: "Faturas" }].map(({ value, label }) => (
                  <button key={value} className={`quick-tab${direction === value ? " active" : ""}`} onClick={() => { setDirection(value); setPage(0); }} type="button">{label}</button>
                ))}
              </div>
            </div>
            <div className="tx-filter-group">
              <span className="tx-filter-group-label">Status</span>
              <div className="transactions-quick-tabs">
                {[{ value: "", label: "Todos" }, { value: "__confirmed__", label: "Confirmados" }, { value: "__pending__", label: "Pendentes" }].map(({ value, label }) => (
                  <button key={value} className={`quick-tab${statusFilter === value ? " active" : ""}`} onClick={() => { setStatusFilter(value); setPage(0); }} type="button">{label}</button>
                ))}
              </div>
            </div>
            <button className="tx-advanced-toggle" onClick={() => setShowAdvancedFilters((c) => !c)} type="button">
              {showAdvancedFilters ? "Menos filtros ▲" : "Mais filtros ▼"}
              {advancedFilterCount > 0 ? <span className="tx-advanced-badge">{advancedFilterCount}</span> : null}
            </button>
          </div>
          {/* Advanced filters (collapsible) */}
          {showAdvancedFilters ? (
            <div className="tx-advanced-filters">
              <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} periodPreset={periodPreset} onPreset={applyPeriodPreset} onDateFrom={updateDateFrom} onDateTo={updateDateTo} />
              <select className={sourceType ? "filter-select active" : "filter-select"} value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(0); }} title="Filtrar por origem">
                <option value="">Todas as origens</option><option value="bank_statement">Conta corrente</option><option value="credit_card_statement">Cartão de crédito</option><option value="unknown">Manual / Outras</option>
              </select>
              <CategoryMultiSelect categories={categories.data?.items ?? []} selected={categoryIds} onChange={(next) => { setCategoryIds(next); setPage(0); }} />
              <div className="filter-amount-range">
                <input type="number" placeholder="De R$" value={amountMin} min="0" onChange={(e) => { setAmountMin(e.target.value); setPage(0); }} title="Valor mínimo" />
                <input type="number" placeholder="Até R$" value={amountMax} min="0" onChange={(e) => { setAmountMax(e.target.value); setPage(0); }} title="Valor máximo" />
              </div>
            </div>
          ) : null}
          {/* Footer: count + chips + limpar */}
          <div className="tx-filter-footer">
            <span className="tx-filter-count">{totalTransactions.toLocaleString("pt-BR")} lançamentos encontrados</span>
            {activeFilterChips.length > 0 ? (
              <div className="tx-filter-chips">
                {activeFilterChips.map((chip) => (
                  <span className="tx-filter-chip" key={chip.id}>
                    {chip.label}
                    <button className="tx-filter-chip-remove" onClick={chip.clear} type="button">×</button>
                  </span>
                ))}
              </div>
            ) : null}
            {activeFilterCount > 0 ? <button className="ghost-button filter-clear" onClick={clearFilters} type="button">Limpar filtros</button> : null}
            {!reviewMode ? <button className="primary-button" onClick={() => setShowCreate(true)} type="button" style={{ marginLeft: "auto" }}><Plus size={14} />Nova transação</button> : null}
          </div>
        </div>
        {somePageSelected ? (
          <div className="bulk-action-bar">
            <span>{selectedIds.size} selecionado(s)</span>
            <select
              className="filter-select"
              disabled={bulkCategorize.isPending}
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__placeholder__") return;
                bulkCategorize.mutate({ ids: [...selectedIds], categoryId: val === "__remove__" ? null : val });
              }}
            >
              <option value="__placeholder__">{bulkCategorize.isPending ? "Aplicando…" : "Categorizar seleção…"}</option>
              <option value="__remove__">— Remover categoria</option>
              {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button className="ghost-button compact-button" onClick={() => exportTransactionsCSV(visibleTransactions.filter((t) => selectedIds.has(t.id)), "transacoes-selecionadas")} type="button"><Download size={14} /> Exportar seleção</button>
            <button className="ghost-button compact-button" onClick={() => setSelectedIds(new Set())} type="button">Limpar seleção</button>
          </div>
        ) : null}
        {!somePageSelected ? (
          <div className="bulk-hint-bar">
            <span>Selecione lançamentos para categorizar, exportar ou excluir em massa</span>
          </div>
        ) : null}
        {actionMessage ? <InlineSuccess message={actionMessage} /> : null}

        {!reviewMode ? (
          <div className="tx-info-cards">
            <button className={`tx-info-card${showDuplicates ? " active" : ""}`} onClick={() => { setShowDuplicates((c) => !c); setDuplicatePage(0); }} type="button">
              <div className="tx-info-card-header">
                <span className="tx-info-card-icon">⚠️</span>
                <span className="tx-info-card-title">Possíveis duplicados</span>
                {duplicates.data?.total_groups ? <span className="tx-info-card-badge warn">{duplicates.data.total_groups} grupos</span> : null}
              </div>
              <span className="tx-info-card-action">{showDuplicates ? "Ocultar ▲" : "Verificar →"}</span>
            </button>
            <button className={`tx-info-card${showAccounts ? " active" : ""}`} onClick={() => setShowAccounts((c) => !c)} type="button">
              <div className="tx-info-card-header">
                <span className="tx-info-card-icon">🏦</span>
                <span className="tx-info-card-title">Contas e cartões</span>
                {activeAccounts.data?.items.length ? <span className="tx-info-card-badge">{activeAccounts.data.items.length} contas</span> : null}
              </div>
              <span className="tx-info-card-action">{showAccounts ? "Ocultar ▲" : "Ver contas →"}</span>
            </button>
          </div>
        ) : null}

        {!reviewMode && showDuplicates ? (
          <DuplicateTransactionsPanel groups={duplicates.data?.groups ?? []} loading={duplicates.isLoading} onReviewGroup={openGroupReview} onAutoResolveAll={autoResolveAllGroups} onNextPage={() => setDuplicatePage((c) => c + 1)} onPreviousPage={() => setDuplicatePage((c) => Math.max(c - 1, 0))} onRefresh={() => void duplicates.refetch()} page={duplicatePage} pageSize={duplicatePageSize} resolving={removeDuplicateReviewItems.isPending} totalGroups={duplicates.data?.total_groups ?? 0} totalTransactions={duplicates.data?.total_transactions ?? 0} />
        ) : null}
        {!reviewMode && showAccounts ? (
          <Panel title="Contas e cartões" description="Contas e cartões detectados nos arquivos importados.">
            <ActiveAccountsPanel accounts={activeAccounts.data?.items ?? []} loading={activeAccounts.isLoading} />
          </Panel>
        ) : null}

        <Panel title={reviewMode ? "Pendências" : "Lançamentos"}>
          <ResponsiveTable loading={transactions.isLoading} empty={!visibleTransactions.length} emptyMessage={emptyMessage}>
            <thead>
              <tr>
                <th className="col-checkbox">
                  <input type="checkbox" checked={allPageSelected} ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }} onChange={(e) => { if (e.target.checked) setSelectedIds(new Set(visibleTransactions.map((t) => t.id))); else setSelectedIds(new Set()); }} />
                </th>
                <th><SortHeader active={sortBy === "transaction_date"} direction={sortDir} label="Data" onClick={() => toggleSort("transaction_date")} /></th>
                <th><SortHeader active={sortBy === "description"} direction={sortDir} label="Estabelecimento" onClick={() => toggleSort("description")} /></th>
                <th>Conta/Cartão</th>
                <th><SortHeader active={sortBy === "direction"} direction={sortDir} label="Tipo" onClick={() => toggleSort("direction")} /></th>
                <th><SortHeader active={sortBy === "amount"} direction={sortDir} label="Valor" onClick={() => toggleSort("amount")} /></th>
                {hasInstallments ? <th>Parcela</th> : null}
                <th>Categoria</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => (
                <TransactionRow
                  categories={categories.data?.items ?? []}
                  categoryOptions={categoryOptions}
                  key={transaction.id}
                  onDelete={() => { if (window.confirm(`Excluir a transação "${transaction.description}"? Esta ação não pode ser desfeita no MVP.`)) remove.mutate(transaction.id); }}
                  onSelect={() => onSelect(selected?.id === transaction.id ? null : transaction)}
                  onCategorized={handleCategoryChanged}
                  session={session}
                  transaction={transaction}
                  showInstallments={hasInstallments}
                  selected={selectedIds.has(transaction.id)}
                  onToggleSelect={(id) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }}
                />
              ))}
            </tbody>
          </ResponsiveTable>
          <div className="pagination-bar">
            <button className="ghost-button" disabled={page === 0 || transactions.isLoading} onClick={() => setPage((c) => Math.max(c - 1, 0))}>Anterior</button>
            <span>Exibindo {paginationFrom}–{paginationTo} de {totalTransactions} lançamentos</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} title="Itens por página">
              <option value={25}>25 / página</option>
              <option value={50}>50 / página</option>
              <option value={100}>100 / página</option>
            </select>
            <button className="ghost-button" disabled={nextPageDisabled} onClick={() => setPage((c) => c + 1)}>Próxima</button>
          </div>
        </Panel>
      </div>

      {selected ? (
        <Drawer title="Detalhe da transação" onClose={() => onSelect(null)}>
          <TransactionDetail categories={categories.data?.items ?? []} categoryOptions={categoryOptions} deleting={remove.isPending} onDelete={() => { if (window.confirm(`Excluir a transação "${selected.description}"? Esta ação não pode ser desfeita no MVP.`)) remove.mutate(selected.id); }} onCategorized={handleCategoryChanged} session={session} transaction={selected} />
        </Drawer>
      ) : null}

      {showCreate ? (
        <Drawer title="Nova transação manual" onClose={() => setShowCreate(false)}>
          <ManualTransactionForm categories={categories.data?.items ?? []} error={createManual.isError ? apiErrorMessage(createManual.error, "Falha ao cadastrar transação.") : ""} loading={createManual.isPending} onCancel={() => setShowCreate(false)} onSubmit={(payload) => createManual.mutate(payload)} />
        </Drawer>
      ) : null}

      {remove.isError ? <InlineError message={apiErrorMessage(remove.error, "Falha ao excluir transação.")} /> : null}
      {removeDuplicateReviewItems.isError ? <InlineError message={apiErrorMessage(removeDuplicateReviewItems.error, "Falha ao excluir lançamentos revisados.")} /> : null}

      {activeReviewGroup ? (
        <Drawer title={`Revisar grupo · ${activeReviewGroup.count} lançamentos parecidos`} onClose={() => { setActiveReviewGroup(null); setKeepId(""); }}>
          <DuplicateReviewDrawerContent group={activeReviewGroup} keepId={keepId} onKeepChange={setKeepId} onResolve={resolveGroup} onSkip={() => { setActiveReviewGroup(null); setKeepId(""); }} resolving={removeDuplicateReviewItems.isPending} />
        </Drawer>
      ) : null}
    </section>
  );
}
