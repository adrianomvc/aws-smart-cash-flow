import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
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
  getDashboardSummary,
  getTransactionDuplicates,
  getTransactions,
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
  directionLabel,
  duplicatePrimaryId,
  exportTransactionsCSV,
  installmentLabel,
  installmentSummaryLabel,
  money,
  moneyAbs,
  orderedCategoryOptions,
  periodRange,
  sourceTypeLabel,
  transactionFilterSummary,
  withQueryParams,
} from "../lib/utils";
import { useCategories } from "../hooks";
import {
  DedupeStatusBadge,
  Drawer,
  EmptyInline,
  InlineError,
  InlineSuccess,
  MetricCard,
  PageState,
  Panel,
  PeriodFilter,
  QualityRow,
  ResponsiveTable,
  SortHeader,
} from "../components/ui";
import type {
  ApiSession,
  CategoryRead,
  DuplicateTransactionGroup,
  TransactionRead,
} from "../lib/api";
import type { TransactionDrilldown, TransactionPeriodPreset } from "../types";

// ---------------------------------------------------------------------------
// Private sub-components
// ---------------------------------------------------------------------------

function DirectionBadge({ direction }: { direction: string }) {
  return <span className={`direction-badge ${direction}`}>{directionLabel(direction)}</span>;
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
    <select className="table-select" disabled={mutation.isPending} value={transaction.category?.category_id ?? ""} onChange={(e) => mutation.mutate(e.target.value || null)}>
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
    <select className={`table-select direction-select ${transaction.direction}`} disabled={mutation.isPending} value={transaction.direction} onChange={(e) => mutation.mutate(e.target.value)}>
      <option value="debit">Despesa</option>
      <option value="credit">Receita/Crédito</option>
      <option value="payment">Pagamento de fatura</option>
    </select>
  );
}

function TransactionRow({ transaction, categories, categoryOptions, session, onDelete, onSelect, onCategorized, expectedDedupeKey = "", primaryDedupeId = "", showDedupeStatus = false, selected = false, onToggleSelect }: {
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
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const categoryLabel = category ? categoryPath(category, categories) : undefined;
  void categoryLabel;
  return (
    <tr className={selected ? "row-selected" : ""}>
      <td className="col-checkbox"><input type="checkbox" checked={selected} onChange={() => onToggleSelect?.(transaction.id)} onClick={(e) => e.stopPropagation()} /></td>
      <td>{dateLabel(transaction.transaction_date)}</td>
      <td>
        <span className="description-cell">{transaction.description}</span>
        {transaction.description !== transaction.raw_description ? <small>{transaction.raw_description}</small> : null}
      </td>
      <td><span className="account-cell" title={transaction.account_or_card ?? transaction.source_name ?? ""}>{transaction.account_or_card ?? transaction.source_name ?? "-"}</span></td>
      <td><DirectionPicker session={session} transaction={transaction} /></td>
      <td className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</td>
      <td>{installmentLabel(transaction)}</td>
      <td><CategoryPicker categoryOptions={categoryOptions} onCategorized={onCategorized} session={session} transaction={transaction} /></td>
      <td>{transaction.category ? <span className="status-badge confirmed">Confirmado</span> : <span className="status-badge pending">Pendente</span>}</td>
      {showDedupeStatus ? <td><DedupeStatusBadge status={dedupeStatus(transaction, expectedDedupeKey, primaryDedupeId)} /></td> : null}
      <td>
        <div className="row-actions">
          <button className="icon-button danger" onClick={onDelete} title="Excluir transação" type="button"><Trash2 size={16} /></button>
          <button className="icon-button" onClick={onSelect} title="Ver detalhe" type="button"><ChevronRight size={16} /></button>
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
  const [search, setSearch] = useState(initialSearch);
  const [sourceType, setSourceType] = useState(initialSourceType);
  const [direction, setDirection] = useState(initialDirection);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
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
  const [duplicatePage, setDuplicatePage] = useState(0);
  const [activeReviewGroup, setActiveReviewGroup] = useState<DuplicateTransactionGroup | null>(null);
  const [keepId, setKeepId] = useState("");
  const pageSize = 50;
  const duplicatePageSize = 10;
  const categories = useCategories(session);
  const categoryOptions = useMemo(() => orderedCategoryOptions(categories.data?.items ?? []), [categories.data?.items]);
  const queryClient = useQueryClient();
  const periodSummaryQuery = useMemo(() => { const params = new URLSearchParams(); if (dateFrom) params.set("date_from", dateFrom); if (dateTo) params.set("date_to", dateTo); return `?${params.toString()}`; }, [dateFrom, dateTo]);
  const periodSummary = useQuery({ queryKey: ["transactions-period-summary", session.token, periodSummaryQuery], queryFn: () => getDashboardSummary(session, periodSummaryQuery), staleTime: 2 * 60 * 1000 });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sourceType) params.set("source_type", sourceType);
    if (direction) params.set("direction", direction);
    if (importJobId) params.set("import_job_id", importJobId);
    if (categoryId && fixedQuery !== "category_id=__uncategorized__" && !categoryId.startsWith("__")) params.set("category_id", categoryId);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (weekday !== undefined) params.set("weekday", String(weekday));
    params.set("sort_by", sortBy);
    params.set("sort_dir", sortDir);
    if (fixedQuery && fixedQuery !== "category_id=__uncategorized__") { const [key, value] = fixedQuery.split("="); params.set(key, value); }
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `?${params.toString()}`;
  }, [categoryId, dateFrom, dateTo, direction, fixedQuery, importJobId, page, search, sortBy, sortDir, sourceType, weekday]);
  const transactions = useQuery({ queryKey: ["transactions", session.token, query], queryFn: () => getTransactions(session, query) });
  const duplicatesQuery = `?limit=${duplicatePageSize}&offset=${duplicatePage * duplicatePageSize}`;
  const duplicates = useQuery({ queryKey: ["transaction-duplicates", session.token, duplicatesQuery], queryFn: () => getTransactionDuplicates(session, duplicatesQuery), enabled: showDuplicates });
  const remove = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(session, transactionId),
    onSuccess: () => {
      onSelect(null);
      setActionMessage("Transação excluída. Indicadores e listas foram atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
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

  const visibleTransactions = (() => {
    const items = transactions.data?.items ?? [];
    if (fixedQuery === "category_id=__uncategorized__") return items.filter((t) => !t.category);
    if (categoryId === "__pending__") return items.filter((t) => !t.category);
    if (categoryId === "__confirmed__") return items.filter((t) => Boolean(t.category));
    return items;
  })();
  const totalTransactions = fixedQuery === "category_id=__uncategorized__" ? visibleTransactions.length : transactions.data?.total ?? 0;
  const pageIncome = visibleTransactions.filter((t) => t.direction === "credit").reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
  const pageExpenses = visibleTransactions.filter((t) => t.direction === "debit").reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
  const pagePayments = visibleTransactions.filter((t) => t.direction === "payment").reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
  const pagePending = visibleTransactions.filter((t) => !t.category).length;
  const pageBalance = pageIncome - pageExpenses;
  void pagePayments; void pageBalance;
  const allPageSelected = visibleTransactions.length > 0 && visibleTransactions.every((t) => selectedIds.has(t.id));
  const somePageSelected = visibleTransactions.some((t) => selectedIds.has(t.id));
  const nextPageDisabled = transactions.isLoading || fixedQuery === "category_id=__uncategorized__" ? visibleTransactions.length < pageSize : (page + 1) * pageSize >= totalTransactions;
  const activeFilterCount = [search, sourceType, direction, importJobId, !reviewMode ? categoryId : "", dateFrom || dateTo, weekday !== undefined ? String(weekday) : ""].filter(Boolean).length;
  const emptyMessage = activeFilterCount ? "Nenhuma transação encontrada para os filtros selecionados." : reviewMode ? "Nenhuma transação pendente de categoria." : "Nenhuma transação encontrada.";
  const filterSummary = transactionFilterSummary({ categoryId, categories: categories.data?.items ?? [], dateFrom, dateTo, direction, duplicateGroupCount: 0, importJobId, periodPreset, reviewMode, search, sourceType, weekday });

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
  function clearFilters() { setSearch(""); setSourceType(""); setDirection(""); setCategoryId(""); setPeriodPreset("all"); setDateFrom(""); setDateTo(""); setPage(0); }
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
        {somePageSelected ? (
          <div className="bulk-action-bar">
            <span>{selectedIds.size} selecionado(s)</span>
            <button className="ghost-button compact-button" onClick={() => exportTransactionsCSV(visibleTransactions.filter((t) => selectedIds.has(t.id)), "transacoes-selecionadas")} type="button"><Download size={14} /> Exportar seleção</button>
            <button className="ghost-button compact-button" onClick={() => setSelectedIds(new Set())} type="button">Limpar seleção</button>
          </div>
        ) : null}

        <div className="transactions-filter-bar">
          <label className="filter-search-label"><Search size={14} /><input placeholder="Buscar descrição..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
          <select className={direction ? "filter-select active" : "filter-select"} value={direction} onChange={(e) => { setDirection(e.target.value); setPage(0); }} title="Filtrar por tipo">
            <option value="">Todos os tipos</option><option value="debit">Despesas</option><option value="credit">Receitas</option><option value="payment">Faturas</option>
          </select>
          <select className={categoryId.startsWith("__") ? "filter-select active" : "filter-select"} value={categoryId.startsWith("__") ? categoryId : "all"} onChange={(e) => { setCategoryId(e.target.value === "all" ? "" : e.target.value); setPage(0); }} title="Filtrar por status">
            <option value="all">Todos os status</option><option value="__confirmed__">Confirmados</option><option value="__pending__">Pendentes</option>
          </select>
          <select className={sourceType ? "filter-select active" : "filter-select"} value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(0); }} title="Filtrar por origem">
            <option value="">Todas as origens</option><option value="bank_statement">Conta corrente</option><option value="credit_card_statement">Cartão de crédito</option><option value="unknown">Manual / Outras</option>
          </select>
          <select className={categoryId && !categoryId.startsWith("__") ? "filter-select active" : "filter-select"} value={categoryId.startsWith("__") ? "" : categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(0); }} title="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            {categoryOptions.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
          </select>
          <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} periodPreset={periodPreset} onPreset={applyPeriodPreset} onDateFrom={updateDateFrom} onDateTo={updateDateTo} />
          {activeFilterCount > 0 ? <button className="ghost-button filter-clear" onClick={clearFilters} type="button">Limpar ({activeFilterCount})</button> : null}
          <span className="filter-bar-spacer" />
          {!reviewMode ? (
            <>
              <button className="ghost-button" disabled={!visibleTransactions.length} onClick={() => exportTransactionsCSV(visibleTransactions, "transacoes")} title="Exportar página atual como CSV" type="button"><Download size={16} />Exportar</button>
              <button className="primary-button" onClick={() => setShowCreate(true)} type="button"><Plus size={16} />Nova</button>
            </>
          ) : null}
        </div>

        <div className="filter-summary"><span>{filterSummary}</span><strong>{totalTransactions} lançamentos</strong></div>
        {actionMessage ? <InlineSuccess message={actionMessage} /> : null}

        {!reviewMode ? (
          <div className="duplicate-alert-bar">
            <span className="duplicate-alert-text">{showDuplicates && duplicates.data ? `${duplicates.data.total_groups} grupo(s) · ${duplicates.data.total_transactions} lançamentos envolvidos` : "Verificar possíveis duplicados"}</span>
            <button className="ghost-button compact-button" onClick={() => { setShowDuplicates((c) => !c); setDuplicatePage(0); }} type="button">{showDuplicates ? "Ocultar lista" : "Ver grupos →"}</button>
          </div>
        ) : null}

        {!reviewMode && showDuplicates ? (
          <DuplicateTransactionsPanel groups={duplicates.data?.groups ?? []} loading={duplicates.isLoading} onReviewGroup={openGroupReview} onAutoResolveAll={autoResolveAllGroups} onNextPage={() => setDuplicatePage((c) => c + 1)} onPreviousPage={() => setDuplicatePage((c) => Math.max(c - 1, 0))} onRefresh={() => void duplicates.refetch()} page={duplicatePage} pageSize={duplicatePageSize} resolving={removeDuplicateReviewItems.isPending} totalGroups={duplicates.data?.total_groups ?? 0} totalTransactions={duplicates.data?.total_transactions ?? 0} />
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
                <th>Parcela</th>
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
                  onSelect={() => onSelect(transaction)}
                  onCategorized={handleCategoryChanged}
                  session={session}
                  transaction={transaction}
                  selected={selectedIds.has(transaction.id)}
                  onToggleSelect={(id) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }}
                />
              ))}
            </tbody>
          </ResponsiveTable>
          <div className="pagination-bar">
            <button className="ghost-button" disabled={page === 0 || transactions.isLoading} onClick={() => setPage((c) => Math.max(c - 1, 0))}>Anterior</button>
            <span>Página {page + 1} · {visibleTransactions.length} de {totalTransactions} lançamentos</span>
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
