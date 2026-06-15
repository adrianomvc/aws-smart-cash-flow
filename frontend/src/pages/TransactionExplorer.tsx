import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyRules,
  createManualTransaction,
  createRule,
  deleteTransaction,
  getActiveAccounts,
  getCreditCards,
  getRuleSuggestion,
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
} from "../lib/utils";
import { useCategories } from "../hooks";
import type {
  ActiveAccountItem,
  ApiSession,
  CategoryRead,
  DuplicateTransactionGroup,
  TransactionRead,
} from "../lib/api";
import type { TransactionPeriodPreset } from "../types";

// ---------------------------------------------------------------------------
// SVG icon system
// ---------------------------------------------------------------------------

const T_ICONS: Record<string, string> = {
  search:   "M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M16 16l4 4",
  upload:   "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2 M7 9l5-5 5 5 M12 4v12",
  download: "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2 M7 11l5 5 5-5 M12 4v12",
  list:     "M9 6h10 M9 12h10 M9 18h10 M5 6h.01 M5 12h.01 M5 18h.01",
  tag:      "M12 2H7a1 1 0 0 0-1 1v5l9.29 9.29a1 1 0 0 0 1.41 0l4.3-4.3a1 1 0 0 0 0-1.41L12 2z M7 7h.01",
  check:    "M5 12l5 5 9-10",
  alert:    "M12 9v4 M12 17h.01 M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z",
  clock:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2",
  arrowDR:  "M7 7l10 10 M17 8v9H8",
  arrowUR:  "M7 17L17 7 M8 7h9v9",
  flow:     "M4 6h10 M4 6l3-3 M4 6l3 3 M20 18H10 M20 18l-3-3 M20 18l-3 3 M4 12h16",
  filter:   "M4 4h16v2l-6 6v7l-4-2V12L4 6V4z",
  trash:    "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  plus:     "M12 5v14 M5 12h14",
  refresh:  "M4 12a8 8 0 0 1 14.93-4 M20 12a8 8 0 0 1-14.93 4 M3 3v5h5 M21 21v-5h-5",
  file:     "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5",
  chevR:    "M9 18l6-6-6-6",
  chevL:    "M15 18l-6-6 6-6",
  info:     "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  x:        "M18 6L6 18 M6 6l12 12",
};

function TIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = T_ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }}>
      {segs.map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Inline micro-components (replacing imported UI primitives)
// ---------------------------------------------------------------------------

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="alert neg" style={{ margin: "8px 0" }}>
      <div className="alert-ic"><TIcon name="alert" size={17} /></div>
      <div><div className="a-ttl">Erro</div><div className="a-txt">{message}</div></div>
    </div>
  );
}

function InlineSuccess({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="alert pos" style={{ margin: "8px 0" }}>
      <div className="alert-ic"><TIcon name="check" size={17} /></div>
      <div><div className="a-ttl">Pronto</div><div className="a-txt">{message}</div></div>
    </div>
  );
}

function SimpleDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={onClose}>
      {/* backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.38)", backdropFilter: "blur(2px)" }} />
      {/* panel */}
      <div
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--card)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", boxShadow: "var(--sh-pop)", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, flex: 1 }}>{title}</span>
          <button className="btn btn-quiet btn-sm" onClick={onClose} type="button"><TIcon name="x" size={14} /></button>
        </div>
        <div style={{ padding: "18px 20px", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function QRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", fontFamily: "var(--font-mono)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{value ?? "—"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Private sub-components
// ---------------------------------------------------------------------------

function ActiveAccountsPanel({ accounts, loading }: { accounts: ActiveAccountItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="state">
        <div className="state-ic"><TIcon name="refresh" size={18} /></div>
        <h4>Carregando contas...</h4>
      </div>
    );
  }
  if (!accounts.length) {
    return <div style={{ padding: "14px 0", color: "var(--ink-3)", fontSize: 13 }}>Nenhuma conta ativa encontrada.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {accounts.map((account, idx) => (
        <div key={idx} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", marginBottom: 4 }}>{account.name}</div>
          {account.kind === "bank" ? (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{money(account.current_balance)}</div>
              {account.balance_date ? <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Extrato: {account.balance_date}</div> : null}
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{money(account.used_amount)} <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 12 }}>/ {money(account.limit_amount)}</span></div>
              <div className="track" style={{ marginTop: 6 }}>
                <div className="fill" style={{ width: `${account.limit_amount ? Math.min(100, (Number(account.used_amount ?? 0) / Number(account.limit_amount)) * 100) : 0}%`, background: "var(--acc)" }} />
              </div>
              {account.available_amount != null ? <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Disponível: {money(account.available_amount)}</div> : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

type CategoryGroup = { id: string; name: string; subs: { id: string; name: string }[] };

function CategoryPicker({ categoryGroups, transaction, session, onCategorized }: {
  categoryGroups: CategoryGroup[];
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
    <select className="cat-select" disabled={mutation.isPending} value={transaction.category?.category_id ?? ""} onChange={(e) => mutation.mutate(e.target.value || null)} onClick={(e) => e.stopPropagation()}>
      <option value="">Sem categoria</option>
      {categoryGroups.map((g) => (
        <optgroup key={g.id} label={g.name}>
          <option value={g.id}>{g.name} (geral)</option>
          {g.subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

// Two cascading cells for the table: "Categoria" (parent) and "Subcategoria"
// (child). Keeps the parent in its own column so the Categoria column never
// shows the leaf sub-category. Both are editable and share one mutation.
function CategoryCells({ categoryGroups, transaction, session, onCategorized }: {
  categoryGroups: CategoryGroup[];
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
  const currentId = transaction.category?.category_id ?? "";
  let parentId = "";
  let subId = "";
  for (const g of categoryGroups) {
    if (g.id === currentId) { parentId = g.id; break; }
    const s = g.subs.find((x) => x.id === currentId);
    if (s) { parentId = g.id; subId = s.id; break; }
  }
  const subsOfParent = categoryGroups.find((g) => g.id === parentId)?.subs ?? [];
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <>
      <td>
        <select className="cat-select" disabled={mutation.isPending} value={parentId}
          onChange={(e) => mutation.mutate(e.target.value || null)} onClick={stop}>
          <option value="">Sem categoria</option>
          {categoryGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </td>
      <td>
        <select className="cat-select" disabled={mutation.isPending || !parentId} value={subId}
          onChange={(e) => mutation.mutate(e.target.value || parentId || null)} onClick={stop}>
          <option value="">{parentId ? "— (geral)" : "—"}</option>
          {subsOfParent.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
    </>
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
    <select className={`cat-select direction-select ${transaction.direction}`} disabled={mutation.isPending} value={transaction.direction} onChange={(e) => mutation.mutate(e.target.value)} onClick={(e) => e.stopPropagation()}>
      <option value="debit">Despesa</option>
      <option value="credit">Receita/Crédito</option>
      <option value="payment">Pagamento de fatura</option>
    </select>
  );
}

function TransactionRow({ transaction, categoryGroups, session, onDelete, onSelect, onCategorized, showInstallments = false, selected = false, onToggleSelect }: {
  transaction: TransactionRead;
  categoryGroups: CategoryGroup[];
  session: ApiSession;
  onDelete: () => void;
  onSelect: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
  showInstallments?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const acctText = transaction.account_or_card ?? transaction.source_name ?? (
    transaction.source_type === "bank_statement" ? "Conta Bancária" :
    transaction.source_type === "credit_card_statement" ? "Cartão de Crédito" :
    transaction.source_type === "unknown" ? "Manual" : "Origem não identificada"
  );
  const srcLabel = transaction.source_type === "bank_statement" ? "Conta" : transaction.source_type === "credit_card_statement" ? "Cartão" : transaction.source_type === "unknown" ? "Manual" : "?";
  const isCredit = transaction.direction === "credit";
  const hasCategory = !!transaction.category;

  return (
    <tr
      className={selected ? "row-selected" : ""}
      onClick={() => onSelect()}
      style={{ cursor: "pointer" }}
    >
      <td style={{ width: 32, padding: "11px 8px" }}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect?.(transaction.id)} onClick={(e) => e.stopPropagation()} />
      </td>
      <td
        className="mono"
        style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}
        title={transaction.payment_date && transaction.payment_date !== transaction.transaction_date ? `Compra: ${dateLabel(transaction.transaction_date)} · Pagamento: ${dateLabel(transaction.payment_date)}` : undefined}
      >
        {dateLabel(transaction.payment_date ?? transaction.transaction_date)}
      </td>
      <td>
        <span className="t-desc">{transaction.description}</span>
        {transaction.description !== transaction.raw_description ? <div className="t-sub">{transaction.raw_description}</div> : null}
      </td>
      <CategoryCells categoryGroups={categoryGroups} onCategorized={onCategorized} session={session} transaction={transaction} />
      <td style={{ whiteSpace: "nowrap" }}><span className="t-sub">{acctText}</span></td>
      <td>
        <span className="pill" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5 }}>{srcLabel}</span>
      </td>
      {showInstallments ? <td>{installmentLabel(transaction)}</td> : null}
      <td className="num" style={{ fontWeight: 700, color: isCredit ? "var(--acc)" : "var(--ink)" }}>
        {isCredit ? "+" : ""}{moneyAbs(transaction.amount)}
      </td>
      <td>
        {hasCategory
          ? <span className="badge b-real"><TIcon name="check" size={11} />Revisada</span>
          : transaction.direction === "debit"
            ? <span className="badge b-warn"><TIcon name="alert" size={11} />Sem categoria</span>
            : <span className="badge b-info"><TIcon name="clock" size={11} />Pendente</span>
        }
      </td>
      <td>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            style={{ padding: "4px 6px", borderRadius: 7, background: "var(--neg-soft)", color: "var(--neg)", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Excluir transação"
            type="button"
          ><TIcon name="trash" size={13} /></button>
          <button
            style={{ padding: "4px 6px", borderRadius: 7, background: "var(--bg-sunken)", color: "var(--ink-3)", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            title="Ver detalhe"
            type="button"
          ><TIcon name="chevR" size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

function TransactionDetail({ transaction, categories, categoryGroups, deleting = false, onDelete, onCategorized, session }: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  categoryGroups: CategoryGroup[];
  deleting?: boolean;
  onDelete?: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
  session: ApiSession;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const normalizedChanged = transaction.description !== transaction.raw_description;
  const isCredit = transaction.direction === "credit";
  const [showRule, setShowRule] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <QRow label="Descrição normalizada" value={<span style={normalizedChanged ? { color: "var(--acc)", fontWeight: 600 } : {}}>{transaction.description}</span>} />
      <QRow label="Descrição original" value={transaction.raw_description} />
      <div style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", fontFamily: "var(--font-mono)", marginBottom: 4 }}>Tipo financeiro</div>
        <DirectionPicker session={session} transaction={transaction} />
      </div>
      <QRow label="Valor" value={<span style={{ fontWeight: 700, color: isCredit ? "var(--acc)" : "var(--ink)" }} className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</span>} />
      <QRow label="Parcela" value={installmentSummaryLabel(transaction)} />
      <QRow label="Data de compra" value={dateLabel(transaction.transaction_date)} />
      {transaction.payment_date && transaction.payment_date !== transaction.transaction_date && (
        <QRow label="Data de pagamento" value={dateLabel(transaction.payment_date)} />
      )}
      <QRow label="Origem" value={sourceTypeLabel(transaction.source_type)} />
      <QRow label="Arquivo" value={transaction.source_file_id} />
      <QRow label="Importação" value={transaction.import_job_id} />
      <QRow label="Linha" value={transaction.source_line ?? "—"} />
      <QRow label="Duplicidade" value={transaction.natural_dedupe_key ? "Registro principal ou já regularizado" : "Precisa revisão por possível duplicidade"} />
      <QRow label="Categoria atual" value={category ? categoryPath(category, categories) : "Sem categoria"} />
      <QRow label="Fonte" value={transaction.category?.source ?? "Pendente"} />
      <div style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", fontFamily: "var(--font-mono)", marginBottom: 4 }}>Alterar categoria</div>
        <CategoryPicker categoryGroups={categoryGroups} onCategorized={onCategorized} session={session} transaction={transaction} />
      </div>
      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Criar regra desta transação</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Aplique a mesma categoria automaticamente a lançamentos parecidos.</div>
        </div>
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => setShowRule(true)}>
          <TIcon name="tag" size={13} /> Criar regra
        </button>
      </div>
      {showRule && (
        <RuleFromTxModal
          transaction={transaction}
          categories={categories}
          session={session}
          onClose={() => setShowRule(false)}
        />
      )}
      {onDelete ? (
        <div style={{ marginTop: 24, padding: "16px", background: "var(--neg-soft)", borderRadius: 10, border: "1px solid color-mix(in oklab, var(--neg) 28%, transparent)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Excluir transação</div>
            <div style={{ fontSize: 12, color: "var(--neg)", marginTop: 2 }}>Remove este lançamento permanentemente.</div>
          </div>
          <button className="btn btn-sm btn-danger" disabled={deleting} onClick={onDelete} type="button">
            <TIcon name="trash" size={13} />{deleting ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RuleFromTxModal({ transaction, categories, session, onClose }: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  session: ApiSession;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const categoryOptions = useMemo(() => orderedCategoryOptions(categories), [categories]);

  // Friendly "contains" default derived from the normalized description.
  const containsDefault = useMemo(
    () => (transaction.description || "").split(/\s+/).filter((t) => t.length > 1).slice(0, 3).join(" "),
    [transaction.description],
  );

  const suggestionQ = useQuery({
    queryKey: ["rule-suggestion", session.token, transaction.id],
    queryFn: () => getRuleSuggestion(session, transaction.id),
  });
  const suggestion = suggestionQ.data?.suggestion ?? null;

  const [name, setName] = useState("");
  const [touchedName, setTouchedName] = useState(false);
  const [matchType, setMatchType] = useState("contains");
  const [pattern, setPattern] = useState(containsDefault);
  const [touchedPattern, setTouchedPattern] = useState(false);
  const [categoryId, setCategoryId] = useState(transaction.category?.category_id ?? "");
  const [applyNow, setApplyNow] = useState(true);
  const [error, setError] = useState("");

  // Prefill the name from the backend suggestion once it loads (unless edited).
  useEffect(() => {
    if (!touchedName && suggestion?.suggested_name) setName(suggestion.suggested_name);
  }, [suggestion, touchedName]);

  function changeMatchType(next: string) {
    setMatchType(next);
    if (!touchedPattern) setPattern(next === "regex" ? (suggestion?.pattern ?? containsDefault) : containsDefault);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const create = useMutation({
    mutationFn: async () => {
      const rule = await createRule(session, {
        name: name.trim() || `Auto: ${containsDefault}`,
        field: "description",
        match_type: matchType,
        pattern: pattern.trim(),
        category_id: categoryId || null,
        target_direction: null,
        priority: 100,
        active: true,
      });
      if (applyNow) await applyRules(session);
      return rule;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e, "Falha ao criar a regra.")),
  });

  function submit() {
    if (!categoryId) { setError("Escolha a categoria que a regra vai aplicar."); return; }
    if (!pattern.trim()) { setError("Informe o padrão de texto."); return; }
    setError("");
    create.mutate();
  }

  return (
    <div className="mdl-backdrop" style={{ zIndex: 300 }} onClick={onClose}>
      <div className="mdl" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><TIcon name="zap" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">Criar regra desta transação</div>
            <div className="mh-sub">Lançamentos parecidos receberão a categoria automaticamente.</div>
          </div>
          <button className="mh-close" onClick={onClose} type="button"><TIcon name="x" size={18} /></button>
        </div>

        <div className="mdl-body">
          <label className="fld">
            <span className="fld-label">Nome</span>
            <input className="fld-input" value={name} placeholder={`Auto: ${containsDefault}`}
              onChange={(e) => { setName(e.target.value); setTouchedName(true); }} />
          </label>

          <label className="fld">
            <span className="fld-label">Quando a descrição</span>
            <select className="fld-select" value={matchType} onChange={(e) => changeMatchType(e.target.value)}>
              <option value="contains">Contém</option>
              <option value="starts_with">Começa com</option>
              <option value="equals">É igual a</option>
              <option value="regex">Casa a regex</option>
            </select>
          </label>

          <label className="fld">
            <span className="fld-label">Padrão</span>
            <input className="fld-input" value={pattern} placeholder="Ex: IFOOD"
              onChange={(e) => { setPattern(e.target.value); setTouchedPattern(true); }} />
          </label>

          <label className="fld">
            <span className="fld-label">Aplicar a categoria</span>
            <select className="fld-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Selecione…</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          {suggestion != null && suggestion.affected_count > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
              <TIcon name="info" size={14} />
              <span>Aproximadamente <strong style={{ color: "var(--ink-1)" }}>{suggestion.affected_count}</strong> lançamento(s) parecido(s) no histórico.</span>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 10 }}>
            <input type="checkbox" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Aplicar agora às transações existentes</span>
          </label>

          <InlineError message={error} />
        </div>

        <div className="mdl-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={onClose} type="button">Cancelar</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={submit} type="button">
            <TIcon name="check" size={14} />
            {create.isPending ? "Criando…" : "Criar regra"}
          </button>
        </div>
      </div>
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
    <form style={{ display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Data
          <input disabled={loading} type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Tipo financeiro
          <select disabled={loading} value={direction} onChange={(e) => setDirection(e.target.value)} className="cat-select" style={{ padding: "8px 10px" }}>
            <option value="debit">Despesa</option>
            <option value="credit">Receita/Crédito</option>
            <option value="payment">Pagamento de fatura</option>
          </select>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
        Descrição
        <input disabled={loading} placeholder="Ex: Mercado, salário, ajuste de fatura" value={description} onChange={(e) => setDescription(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" }} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Valor
          <input disabled={loading} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Categoria
          <select disabled={loading} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="cat-select" style={{ padding: "8px 10px" }}>
            <option value="">Sem categoria</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>
      {validationError ? <InlineError message={validationError} /> : null}
      {error ? <InlineError message={error} /> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button className="btn btn-ghost btn-sm" disabled={loading} onClick={onCancel} type="button">Cancelar</button>
        <button className="btn btn-primary btn-sm" disabled={loading} type="submit">
          <TIcon name="plus" size={14} />{loading ? "Cadastrando…" : "Cadastrar transação"}
        </button>
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
  if (loading) {
    return (
      <div className="state">
        <div className="state-ic"><TIcon name="refresh" size={22} /></div>
        <h4>Carregando possíveis duplicados...</h4>
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="alert pos" style={{ margin: "0 0 12px" }}>
        <div className="alert-ic"><TIcon name="check" size={17} /></div>
        <div><div className="a-ttl">Sem duplicatas</div><div className="a-txt">Nenhum grupo de possível duplicidade encontrado.</div></div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 8px" }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{totalGroups} grupos · {totalTransactions} lançamentos · página {page + 1}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" disabled={loading || resolving || !groups.length} onClick={onAutoResolveAll} type="button">
            <TIcon name="zap" size={13} />Resolver todos
          </button>
          <button className="btn btn-ghost btn-sm" disabled={loading} onClick={onRefresh} type="button"><TIcon name="refresh" size={13} /></button>
          <button className="btn btn-ghost btn-sm" disabled={loading || page === 0} onClick={onPreviousPage} type="button"><TIcon name="chevL" size={13} /></button>
          <button className="btn btn-ghost btn-sm" disabled={nextDisabled} onClick={onNextPage} type="button"><TIcon name="chevR" size={13} /></button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {groups.map((group) => {
          const first = group.items[0];
          return (
            <div key={group.current_natural_dedupe_key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--warn-soft)", border: "1px solid color-mix(in oklab, var(--warn) 30%, transparent)", borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{first?.description ?? "—"}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{dateLabel(first?.transaction_date ?? "")} · {moneyAbs(first?.amount)} · {group.count} cópias</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => onReviewGroup(group)} type="button">Revisar</button>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>Escolha qual lançamento manter. Os demais serão excluídos permanentemente.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className={`btn btn-ghost btn-sm${keepId === oldestId ? " active" : ""}`} onClick={() => onKeepChange(oldestId)} type="button">Manter mais antigo</button>
        <button className={`btn btn-ghost btn-sm${keepId === newestId ? " active" : ""}`} onClick={() => onKeepChange(newestId)} type="button">Manter mais recente</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((item) => {
          const isKeep = item.id === keepId;
          return (
            <label key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, border: `1px solid ${isKeep ? "var(--acc)" : "var(--line)"}`, background: isKeep ? "var(--acc-soft)" : "var(--card-2)", cursor: "pointer" }}>
              <input checked={isKeep} name="dedupe-keep" onChange={() => onKeepChange(item.id)} type="radio" value={item.id} style={{ marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>{dateLabel(item.transaction_date)}</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{moneyAbs(item.amount)}</span>
                  <span className={`badge ${isKeep ? "b-real" : "b-neg"}`} style={{ marginLeft: "auto" }}>{isKeep ? "Manter" : "Excluir"}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 3 }}>{item.description}</div>
                <div className="t-sub" style={{ marginTop: 2 }}>{item.source_filename ?? "arquivo sem nome"} · linha {item.source_line ?? "—"} · {item.source_type === "credit_card_statement" ? "Cartão" : "Conta"}</div>
              </div>
            </label>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" disabled={resolving} onClick={onSkip} type="button">Pular grupo</button>
        <button className="btn btn-sm btn-danger" disabled={resolving || !keepId || deleteCount < 1} onClick={onResolve} type="button">
          <TIcon name="trash" size={13} />{resolving ? "Excluindo…" : `Excluir ${deleteCount} duplicado(s)`}
        </button>
      </div>
    </div>
  );
}

// Flat multi-select dropdown: a list of {id, name} options with checkboxes.
function FlatMultiSelect({ placeholder, options, selected, onChange, emptyLabel }: {
  placeholder: string;
  options: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const label = selected.size === 0
    ? placeholder
    : selected.size === 1
      ? (options.find((o) => o.id === [...selected][0])?.name ?? "1 selecionada")
      : `${selected.size} selecionadas`;

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
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className={`cat-select${selected.size > 0 ? " active" : ""}`}
        type="button"
        style={{ cursor: "pointer", padding: "7px 10px" }}
        onClick={() => setOpen((o) => !o)}
      >
        {label} ▾
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--sh-lg)", minWidth: 220, maxHeight: 300, overflowY: "auto", padding: "6px 0" }}>
          {options.length === 0 ? (
            <div style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>
              {emptyLabel ?? "Nenhuma opção"}
            </div>
          ) : options.map((o) => (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
              {o.name}
            </label>
          ))}
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
  initialSourceFileId = "",
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
  initialSourceFileId?: string;
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
  const [cardBrand, setCardBrand] = useState("");
  const [direction, setDirection] = useState(initialDirection);
  const [statusFilter, setStatusFilter] = useState(
    initialCategoryId === "__pending__" || initialCategoryId === "__confirmed__" ? initialCategoryId : "",
  );
  // Categorization-source filter ("" | manual | rule | embedding | llm | __none__)
  const [catSource, setCatSource] = useState("");
  // Review-status filter ("" | queue | pending | accepted). "__review__" drilldown → review queue.
  const [reviewStatus, setReviewStatus] = useState(initialCategoryId === "__review__" ? "queue" : "");
  const [categoryIds, setCategoryIds] = useState<Set<string>>(() => new Set(initialCategoryId && !initialCategoryId.startsWith("__") ? [initialCategoryId] : []));
  const [subcategoryIds, setSubcategoryIds] = useState<Set<string>>(new Set());
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [importJobId] = useState(initialImportJobId);
  const [sourceFileId] = useState(initialSourceFileId);
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
  const [showFilters, setShowFilters] = useState(false);
  const [duplicatePage, setDuplicatePage] = useState(0);
  const [activeReviewGroup, setActiveReviewGroup] = useState<DuplicateTransactionGroup | null>(null);
  const [keepId, setKeepId] = useState("");
  const [pageSize, setPageSize] = useState(50);
  // Tab state: all | in | out | pending
  const [tab, setTab] = useState<"all" | "in" | "out" | "pending">(initialCategoryId === "__pending__" ? "pending" : "all");
  const [accountFilter, setAccountFilter] = useState("all");
  const duplicatePageSize = 10;
  const categories = useCategories(session);
  const categoryOptions = useMemo(() => orderedCategoryOptions(categories.data?.items ?? []), [categories.data?.items]);

  // Card brands for the "Bandeira" filter.
  const creditCards = useQuery({ queryKey: ["credit-cards", session.token], queryFn: () => getCreditCards(session), staleTime: 5 * 60 * 1000 });
  const cardBrands = useMemo(
    () => [...new Set((creditCards.data?.items ?? []).map((c) => c.brand).filter((b): b is string => !!b))],
    [creditCards.data?.items],
  );

  // Two-level category filter: roots and (cascading) subcategories.
  const allCategories = categories.data?.items ?? [];
  const subParent = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of allCategories) if (c.parent_category_id) m.set(c.id, c.parent_category_id);
    return m;
  }, [allCategories]);

  // When arriving from a drilldown whose category is a subcategory, route it to
  // the subcategory filter (and its parent to the category filter) once the
  // category tree has loaded.
  const classifiedInitialRef = useRef(false);
  useEffect(() => {
    if (classifiedInitialRef.current || allCategories.length === 0) return;
    classifiedInitialRef.current = true;
    if (!initialCategoryId || initialCategoryId.startsWith("__")) return;
    const parentId = subParent.get(initialCategoryId);
    if (parentId) {
      setCategoryIds(new Set([parentId]));
      setSubcategoryIds(new Set([initialCategoryId]));
    }
  }, [allCategories.length, initialCategoryId, subParent]);
  const rootCategoryOptions = useMemo(
    () => allCategories.filter((c) => !c.parent_category_id).map((c) => ({ id: c.id, name: c.name })),
    [allCategories],
  );
  // Grouped options for the row category selector (category + its subcategories).
  const categoryGroups = useMemo(
    () => allCategories
      .filter((c) => !c.parent_category_id)
      .map((root) => ({
        id: root.id,
        name: root.name,
        subs: allCategories.filter((c) => c.parent_category_id === root.id).map((c) => ({ id: c.id, name: c.name })),
      })),
    [allCategories],
  );
  // Subcategories of the selected categories (all subcategories when none selected).
  const subcategoryOptions = useMemo(() => {
    const parentName = new Map(allCategories.map((c) => [c.id, c.name]));
    return allCategories
      .filter((c) => c.parent_category_id && (categoryIds.size === 0 || categoryIds.has(c.parent_category_id)))
      .map((c) => ({ id: c.id, name: `${parentName.get(c.parent_category_id!) ?? ""} › ${c.name}` }));
  }, [allCategories, categoryIds]);
  // Effective ids sent to the API: selected subcategories, plus categories that
  // have no specific subcategory selected (backend expands a parent to its children).
  const effectiveCategoryIds = useMemo(() => {
    const result = new Set<string>(subcategoryIds);
    for (const catId of categoryIds) {
      const hasSelectedSub = [...subcategoryIds].some((sid) => subParent.get(sid) === catId);
      if (!hasSelectedSub) result.add(catId);
    }
    return result;
  }, [categoryIds, subcategoryIds, subParent]);

  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync tab → direction filter
  useEffect(() => {
    if (tab === "pending") {
      setDirection("");
      setStatusFilter("__pending__");
    } else {
      setStatusFilter("");
      if (tab === "all") setDirection("");
      else if (tab === "in") setDirection("credit");
      else if (tab === "out") setDirection("debit");
    }
  }, [tab]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sourceType) params.set("source_type", sourceType);
    if (cardBrand) params.set("card_brand", cardBrand);
    if (direction) params.set("direction", direction);
    if (importJobId) params.set("import_job_id", importJobId);
    if (sourceFileId) params.set("source_file_id", sourceFileId);
    if (effectiveCategoryIds.size > 0 && fixedQuery !== "category_id=__uncategorized__") {
      for (const id of effectiveCategoryIds) params.append("category_ids", id);
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
    if (catSource) params.set("category_source", catSource);
    if (reviewStatus) params.set("category_review_status", reviewStatus);
    return `?${params.toString()}`;
  }, [amountMax, amountMin, cardBrand, catSource, effectiveCategoryIds, dateFrom, dateTo, direction, fixedQuery, importJobId, reviewStatus, sourceFileId, page, pageSize, search, sortBy, sortDir, sourceType, statusFilter, weekday]);
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

  const bulkChangeDirection = useMutation({
    mutationFn: async ({ ids, direction: dir }: { ids: string[]; direction: string }) => {
      for (const id of ids) await updateTransactionDirection(session, id, dir);
      return ids.length;
    },
    onSuccess: (count) => {
      setSelectedIds(new Set());
      setActionMessage(`Tipo alterado em ${count} transação(ões).`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["weekday-spending"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-card-payment-matches"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await deleteTransaction(session, id); return ids.length; },
    onSuccess: (count, ids) => {
      if (selected && ids.includes(selected.id)) onSelect(null);
      setSelectedIds(new Set());
      setActionMessage(`${count} transação(ões) excluída(s).`);
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

  const normalizeDescriptions = useMutation({
    mutationFn: () => normalizeTransactionDescriptions(session),
    onSuccess: (result) => {
      setActionMessage(`${result.changed_count} descrição(ões) normalizada(s) de ${result.scanned_count} verificada(s).`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
  void normalizeDescriptions;

  const visibleTransactions = (() => {
    let items = transactions.data?.items ?? [];
    if (fixedQuery === "category_id=__uncategorized__") items = items.filter((t) => !t.category);
    if (accountFilter !== "all") items = items.filter((t) => (t.account_or_card ?? t.source_name ?? "") === accountFilter);
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
  const somePageSelected = selectedIds.size > 0;
  const selCount = selectedIds.size;
  const nextPageDisabled = transactions.isLoading || fixedQuery === "category_id=__uncategorized__" ? visibleTransactions.length < pageSize : (page + 1) * pageSize >= totalTransactions;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const emptyMessage = (statusFilter === "__pending__" || reviewStatus === "queue") ? "Tudo certo! Nada na fila de revisão." : reviewStatus === "pending" ? "Nenhuma sugestão pendente de revisão." : searchInput ? `Nenhum lançamento encontrado para "${searchInput}".` : (dateFrom || dateTo) ? "Nenhum lançamento no período selecionado." : "Nenhuma transação encontrada.";

  const activeFilterCount = [searchInput, sourceType, cardBrand, importJobId, sourceFileId, !reviewMode ? statusFilter : "", !reviewMode ? catSource : "", !reviewMode ? reviewStatus : "", !reviewMode && (categoryIds.size > 0 || subcategoryIds.size > 0) ? "cat" : "", dateFrom || dateTo, weekday !== undefined ? String(weekday) : "", amountMin, amountMax].filter(Boolean).length;
  const filterSummary = transactionFilterSummary({ categoryIds: effectiveCategoryIds, categories: categories.data?.items ?? [], dateFrom, dateTo, direction, duplicateGroupCount: 0, importJobId, periodPreset, reviewMode, search, sourceType, weekday });
  void filterSummary;

  // Account options for select
  const accountOptions = useMemo(() => {
    const all = (transactions.data?.items ?? []).map((t) => t.account_or_card ?? t.source_name ?? "").filter(Boolean);
    return Array.from(new Set(all));
  }, [transactions.data?.items]);

  function toggleSort(nextSortBy: string) {
    setPage(0);
    if (sortBy === nextSortBy) { setSortDir((c) => (c === "asc" ? "desc" : "asc")); return; }
    setSortBy(nextSortBy);
    setSortDir(nextSortBy === "transaction_date" ? "desc" : "asc");
  }
  const sortTh = (label: string, col: string, className?: string) => {
    const active = sortBy === col;
    return (
      <th
        className={className}
        onClick={() => toggleSort(col)}
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
        title={`Ordenar por ${label}`}
      >
        {label}
        <span style={{ marginLeft: 4, fontSize: 10, color: active ? "var(--acc)" : "var(--ink-faint)" }}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </th>
    );
  };

  function applyPeriodPreset(nextPreset: TransactionPeriodPreset) {
    setPeriodPreset(nextPreset); setPage(0);
    const range = periodRange(nextPreset);
    setDateFrom(range.dateFrom); setDateTo(range.dateTo);
  }
  void applyPeriodPreset;

  function updateDateFrom(value: string) { setPeriodPreset("custom"); setDateFrom(value); setPage(0); }
  function updateDateTo(value: string) { setPeriodPreset("custom"); setDateTo(value); setPage(0); }
  void updateDateFrom; void updateDateTo;

  function clearFilters() { setSearchInput(""); setSearch(""); setSourceType(""); setCardBrand(""); setDirection(""); setStatusFilter(""); setCatSource(""); setReviewStatus(""); setCategoryIds(new Set()); setSubcategoryIds(new Set()); setAmountMin(""); setAmountMax(""); setPeriodPreset("all"); setDateFrom(""); setDateTo(""); setPage(0); setTab("all"); setAccountFilter("all"); }
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

  // KPI values — reflect the FULL filtered set (backend aggregates), not just
  // the current page nor only the period.
  const kpiIncome = transactions.data?.total_income != null ? Math.abs(Number(transactions.data.total_income)) : pageIncome;
  const kpiExpenses = transactions.data?.total_expense != null ? Math.abs(Number(transactions.data.total_expense)) : pageExpenses;
  const kpiResult = transactions.data?.total_net != null ? Number(transactions.data.total_net) : kpiIncome - kpiExpenses;
  const kpiCount = totalTransactions;

  const sub = reviewMode
    ? `${pagePending} transações precisam de revisão.`
    : `Consulte, filtre, revise e categorize.${pagePending > 0 ? ` ${pagePending} transações precisam de revisão.` : " Tudo revisado."}`;

  const fGroup: React.CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 };
  const fLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)", minWidth: 78, flex: "none", whiteSpace: "nowrap" };
  const fInput: React.CSSProperties = { padding: "6px 8px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--card-2)", fontSize: 12.5, color: "var(--ink)" };

  return (
    <div className="canvas stg">
      {/* ── Page header ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div className="kpi-ic"><TIcon name="list" size={15} /></div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>Transações</h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {!reviewMode && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)} type="button"><TIcon name="plus" size={14} /> Nova</button>
                <button className="btn btn-ghost btn-sm" type="button"><TIcon name="upload" size={14} /> Importar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => exportTransactionsCSV(visibleTransactions, "transacoes")} type="button"><TIcon name="download" size={14} /> Exportar</button>
              </>
            )}
          </div>
        </div>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>{sub}</p>
      </div>

      {/* ── KPI deck (4 tiles, reflect the active filters) ── */}
      {!reviewMode && (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          {/* Quantidade */}
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-ic"><TIcon name="list" size={15} /></div>
              <span className="kpi-label">Transações</span>
            </div>
            <div className="kpi-val">
              {transactions.isLoading ? "…" : kpiCount.toLocaleString("pt-BR")}
            </div>
            <div className="kpi-sub">{activeFilterCount > 0 ? "no filtro atual" : "no total"}</div>
          </div>
          {/* Entradas */}
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><TIcon name="arrowDR" size={15} /></div>
              <span className="kpi-label">Entradas</span>
            </div>
            <div className="kpi-val" style={{ color: "var(--acc)" }}>
              <span className="cur">R$</span>{compactMoneyAbs(kpiIncome)}
            </div>
            <div className="kpi-sub">Total de entradas</div>
          </div>
          {/* Saídas */}
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-ic" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}><TIcon name="arrowUR" size={15} /></div>
              <span className="kpi-label">Saídas</span>
            </div>
            <div className="kpi-val" style={{ color: "var(--ink)" }}>
              <span className="cur">R$</span>{compactMoneyAbs(kpiExpenses)}
            </div>
            <div className="kpi-sub">Total de saídas</div>
          </div>
          {/* Resultado */}
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-ic" style={{ background: kpiResult >= 0 ? "var(--acc-soft)" : "var(--neg-soft)", color: kpiResult >= 0 ? "var(--acc)" : "var(--neg)" }}><TIcon name="flow" size={15} /></div>
              <span className="kpi-label">Resultado</span>
            </div>
            <div className="kpi-val" style={{ color: kpiResult >= 0 ? "var(--acc)" : "var(--neg)" }}>
              <span className="cur">R$</span>{compactMoneyAbs(kpiResult)}
            </div>
            <div className="kpi-sub">Entradas − saídas</div>
          </div>
        </div>
      )}

      {/* ── Main card ── */}
      <div className="card">
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", pointerEvents: "none" }}>
              <TIcon name="search" size={15} />
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por descrição…"
              style={{ width: "100%", padding: "8px 12px 8px 34px", borderRadius: 9, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" }}
            />
            {searchInput ? (
              <button
                onClick={() => { setSearchInput(""); setSearch(""); setPage(0); }}
                type="button"
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 16, lineHeight: 1 }}
              >×</button>
            ) : null}
          </div>
          {/* Segment tabs */}
          <div className="seg">
            {([
              { id: "all", label: "Todas" },
              { id: "in", label: "Entradas" },
              { id: "out", label: "Saídas" },
              { id: "pending", label: "A revisar", count: pagePending },
            ] as { id: "all" | "in" | "out" | "pending"; label: string; count?: number }[]).map(({ id, label, count }) => (
              <button
                key={id}
                className={tab === id ? "on" : ""}
                onClick={() => { setTab(id); setPage(0); }}
                type="button"
              >
                {label}
                {count != null && count > 0 ? (
                  <span style={{ marginLeft: 5, background: "var(--warn)", color: "#fff", borderRadius: 20, padding: "0px 5px", fontSize: 10, fontWeight: 700 }}>{count}</span>
                ) : null}
              </button>
            ))}
          </div>
          {/* Filters + advanced toggles */}
          {!reviewMode && (
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button className={`btn btn-sm ${showFilters || activeFilterCount > 0 ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowFilters((c) => !c)} type="button">
                <TIcon name="filter" size={13} /> Filtros
                {activeFilterCount > 0 ? <span className="badge" style={{ marginLeft: 5, padding: "1px 6px", fontSize: 10, background: "rgba(255,255,255,.25)" }}>{activeFilterCount}</span> : null}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDuplicates((c) => !c)} type="button">
                <TIcon name="filter" size={13} /> Duplicados
                {duplicates.data?.total_groups ? <span className="badge b-warn" style={{ marginLeft: 4, padding: "1px 6px", fontSize: 10 }}>{duplicates.data.total_groups}</span> : null}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAccounts((c) => !c)} type="button">
                <TIcon name="info" size={13} /> Contas
              </button>
            </div>
          )}
        </div>

        {/* Advanced filter panels (collapsible) */}
        {showDuplicates && !reviewMode && (
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <DuplicateTransactionsPanel
              groups={duplicates.data?.groups ?? []}
              loading={duplicates.isLoading}
              onReviewGroup={openGroupReview}
              onAutoResolveAll={autoResolveAllGroups}
              onNextPage={() => setDuplicatePage((c) => c + 1)}
              onPreviousPage={() => setDuplicatePage((c) => Math.max(c - 1, 0))}
              onRefresh={() => void duplicates.refetch()}
              page={duplicatePage}
              pageSize={duplicatePageSize}
              resolving={removeDuplicateReviewItems.isPending}
              totalGroups={duplicates.data?.total_groups ?? 0}
              totalTransactions={duplicates.data?.total_transactions ?? 0}
            />
          </div>
        )}
        {showAccounts && !reviewMode && (
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <TIcon name="info" size={14} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Contas e cartões</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: 4 }}>Detectados nos arquivos importados</span>
            </div>
            <ActiveAccountsPanel accounts={activeAccounts.data?.items ?? []} loading={activeAccounts.isLoading} />
          </div>
        )}

        {/* Filters panel (grouped, collapsible) */}
        {!reviewMode && (showFilters || activeFilterCount > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            {/* Categoria */}
            <div style={fGroup}>
              <span style={fLabel}>Categoria</span>
              <FlatMultiSelect
                placeholder="Todas as categorias"
                options={rootCategoryOptions}
                selected={categoryIds}
                onChange={(next) => {
                  setSubcategoryIds((prev) => {
                    if (next.size === 0) return prev;
                    return new Set([...prev].filter((sid) => next.has(subParent.get(sid) ?? "")));
                  });
                  setCategoryIds(next);
                  setPage(0);
                }}
              />
              <FlatMultiSelect
                placeholder="Todas as subcategorias"
                options={subcategoryOptions}
                selected={subcategoryIds}
                onChange={(next) => { setSubcategoryIds(next); setPage(0); }}
                emptyLabel={categoryIds.size > 0 ? "Sem subcategorias nesta categoria" : "Selecione categorias ou veja todas"}
              />
              <select className={`cat-select${catSource ? " active" : ""}`} value={catSource} onChange={(e) => { setCatSource(e.target.value); setPage(0); }} style={{ padding: "7px 10px" }} title="Como a transação foi categorizada">
                <option value="">Categorizado por (todos)</option>
                <option value="rule">Por regra</option>
                <option value="embedding">Por memória (similaridade)</option>
                <option value="llm">Por IA</option>
                <option value="manual">Manual</option>
                <option value="__none__">Sem categoria</option>
              </select>
              <select className={`cat-select${reviewStatus ? " active" : ""}`} value={reviewStatus} onChange={(e) => { setReviewStatus(e.target.value); setPage(0); }} style={{ padding: "7px 10px" }} title="Status de revisão da categorização">
                <option value="">Revisão: todas</option>
                <option value="queue">A revisar (fila)</option>
                <option value="pending">Sugestões pendentes</option>
                <option value="accepted">Confirmadas</option>
              </select>
            </div>
            {/* Origem */}
            <div style={fGroup}>
              <span style={fLabel}>Origem</span>
              <select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(0); }} className={`cat-select${accountFilter !== "all" ? " active" : ""}`} style={{ padding: "7px 10px" }}>
                <option value="all">Todas as contas</option>
                {accountOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className={`cat-select${sourceType ? " active" : ""}`} value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(0); }} style={{ padding: "7px 10px" }}>
                <option value="">Todas as origens</option>
                <option value="bank_statement">Conta corrente</option>
                <option value="credit_card_statement">Cartão de crédito</option>
                <option value="unknown">Manual / Outras</option>
              </select>
              {cardBrands.length > 0 && (
                <select className={`cat-select${cardBrand ? " active" : ""}`} value={cardBrand} onChange={(e) => { setCardBrand(e.target.value); setPage(0); }} style={{ padding: "7px 10px" }}>
                  <option value="">Todas as bandeiras</option>
                  {cardBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
            </div>
            {/* Período + Valor */}
            <div style={fGroup}>
              <span style={fLabel}>Período</span>
              <input type="date" value={dateFrom} onChange={(e) => { setPeriodPreset("custom"); setDateFrom(e.target.value); setPage(0); }} style={fInput} placeholder="De" />
              <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>até</span>
              <input type="date" value={dateTo} onChange={(e) => { setPeriodPreset("custom"); setDateTo(e.target.value); setPage(0); }} style={fInput} placeholder="Até" />
              <span style={{ ...fLabel, minWidth: "auto", marginLeft: 12 }}>Valor</span>
              <input type="number" placeholder="De R$" value={amountMin} min="0" onChange={(e) => { setAmountMin(e.target.value); setPage(0); }} style={{ ...fInput, width: 90 }} />
              <input type="number" placeholder="Até R$" value={amountMax} min="0" onChange={(e) => { setAmountMax(e.target.value); setPage(0); }} style={{ ...fInput, width: 90 }} />
              {activeFilterCount > 0 && (
                <button className="btn btn-quiet btn-sm" onClick={clearFilters} type="button" style={{ marginLeft: "auto" }}>Limpar filtros ({activeFilterCount})</button>
              )}
            </div>
          </div>
        )}

        {/* Action message */}
        {actionMessage ? (
          <div style={{ padding: "0 14px" }}><InlineSuccess message={actionMessage} /></div>
        ) : null}

        {/* Selection bar */}
        {somePageSelected ? (
          <div className="selbar">
            <span className="selbar-count">{selCount} selecionada{selCount > 1 ? "s" : ""}</span>
            <select
              className="cat-select"
              disabled={bulkCategorize.isPending}
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__placeholder__") return;
                bulkCategorize.mutate({ ids: [...selectedIds], categoryId: val === "__remove__" ? null : val });
              }}
              style={{ padding: "5px 8px" }}
            >
              <option value="__placeholder__">{bulkCategorize.isPending ? "Aplicando…" : "Categorizar em lote"}</option>
              <option value="__remove__">— Remover categoria</option>
              {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select
              className="cat-select"
              disabled={bulkChangeDirection.isPending}
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                bulkChangeDirection.mutate({ ids: [...selectedIds], direction: val });
              }}
              style={{ padding: "5px 8px" }}
            >
              <option value="">{bulkChangeDirection.isPending ? "Alterando…" : "Mudar tipo…"}</option>
              <option value="debit">Despesa</option>
              <option value="credit">Receita</option>
              <option value="payment">Fatura</option>
            </select>
            <button className="btn btn-sm btn-ghost" onClick={() => exportTransactionsCSV(visibleTransactions.filter((t) => selectedIds.has(t.id)), "transacoes-selecionadas")} type="button">
              <TIcon name="download" size={13} /> Exportar
            </button>
            <button className="btn btn-sm btn-danger" disabled={bulkDelete.isPending} onClick={() => { if (window.confirm(`Excluir ${selectedIds.size} transação(ões)? Esta ação não pode ser desfeita.`)) bulkDelete.mutate([...selectedIds]); }} type="button">
              <TIcon name="trash" size={13} />{bulkDelete.isPending ? "Excluindo…" : "Excluir"}
            </button>
            <button className="btn btn-quiet btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelectedIds(new Set())} type="button">Limpar</button>
          </div>
        ) : null}

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          {transactions.isLoading ? (
            <div className="state">
              <div className="state-ic"><TIcon name="refresh" size={22} /></div>
              <h4>Carregando transações...</h4>
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="state">
              <div className="state-ic"><TIcon name="search" size={22} /></div>
              <h4>Nenhuma transação encontrada</h4>
              <p>{emptyMessage}</p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                      onChange={(e) => { if (e.target.checked) setSelectedIds(new Set(visibleTransactions.map((t) => t.id))); else setSelectedIds(new Set()); }}
                    />
                  </th>
                  {sortTh("Data", "transaction_date")}
                  {sortTh("Descrição", "description")}
                  <th>Categoria</th>
                  <th>Subcategoria</th>
                  <th>Conta</th>
                  {sortTh("Origem", "source_type")}
                  {hasInstallments ? <th>Parcela</th> : null}
                  {sortTh("Valor", "amount", "num")}
                  <th>Status</th>
                  <th style={{ width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((transaction) => (
                  <TransactionRow
                    categoryGroups={categoryGroups}
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
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", padding: "11px 14px", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--ink-3)", flexWrap: "wrap", gap: 8 }}>
          Mostrando <b style={{ margin: "0 4px", color: "var(--ink-2)" }}>{visibleTransactions.length}</b> de {totalTransactions} transações
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 0 || transactions.isLoading} onClick={() => setPage((c) => Math.max(c - 1, 0))} type="button">
              <TIcon name="chevL" size={13} />
            </button>
            <span>Página {page + 1} de {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={nextPageDisabled} onClick={() => setPage((c) => c + 1)} type="button">
              <TIcon name="chevR" size={13} />
            </button>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="cat-select" style={{ padding: "4px 8px" }}>
              <option value={25}>25 / pág</option>
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error banners */}
      {remove.isError ? <InlineError message={apiErrorMessage(remove.error, "Falha ao excluir transação.")} /> : null}
      {removeDuplicateReviewItems.isError ? <InlineError message={apiErrorMessage(removeDuplicateReviewItems.error, "Falha ao excluir lançamentos revisados.")} /> : null}
      {bulkDelete.isError ? <InlineError message={apiErrorMessage(bulkDelete.error, "Falha ao excluir transações selecionadas.")} /> : null}

      {/* ── Drawers ── */}
      {selected ? (
        <SimpleDrawer title="Detalhe da transação" onClose={() => onSelect(null)}>
          <TransactionDetail
            categories={categories.data?.items ?? []}
            categoryGroups={categoryGroups}
            deleting={remove.isPending}
            onDelete={() => { if (window.confirm(`Excluir a transação "${selected.description}"? Esta ação não pode ser desfeita no MVP.`)) remove.mutate(selected.id); }}
            onCategorized={handleCategoryChanged}
            session={session}
            transaction={selected}
          />
        </SimpleDrawer>
      ) : null}

      {showCreate ? (
        <SimpleDrawer title="Nova transação manual" onClose={() => setShowCreate(false)}>
          <ManualTransactionForm
            categories={categories.data?.items ?? []}
            error={createManual.isError ? apiErrorMessage(createManual.error, "Falha ao cadastrar transação.") : ""}
            loading={createManual.isPending}
            onCancel={() => setShowCreate(false)}
            onSubmit={(payload) => createManual.mutate(payload)}
          />
        </SimpleDrawer>
      ) : null}

      {activeReviewGroup ? (
        <SimpleDrawer title={`Revisar grupo · ${activeReviewGroup.count} lançamentos parecidos`} onClose={() => { setActiveReviewGroup(null); setKeepId(""); }}>
          <DuplicateReviewDrawerContent
            group={activeReviewGroup}
            keepId={keepId}
            onKeepChange={setKeepId}
            onResolve={resolveGroup}
            onSkip={() => { setActiveReviewGroup(null); setKeepId(""); }}
            resolving={removeDuplicateReviewItems.isPending}
          />
        </SimpleDrawer>
      ) : null}
    </div>
  );
}
