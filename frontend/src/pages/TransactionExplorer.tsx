import type { FormEvent } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyRules,
  createCategory,
  createManualTransaction,
  createRule,
  deleteTransaction,
  getActiveAccounts,
  getCreditCards,
  getCreditCardStatements,
  getRuleSuggestion,
  getTransactionDuplicates,
  getTransactions,
  getUncategorizedGroups,
  normalizeTransactionDescriptions,
  updateTransactionCategory,
  updateTransactionDirection,
} from "../lib/api";
import {
  amountClass,
  apiErrorMessage,
  categoryPath,
  compactValueAbs,
  dateLabel,
  duplicatePrimaryId,
  exportTransactionsCSV,
  installmentLabel,
  installmentSummaryLabel,
  money,
  moneyAbs,
  orderedCategoryOptions,
  sourceTypeLabel,
  transactionFilterSummary,
} from "../lib/utils";
import { useCategories } from "../hooks";
import { CatModal } from "../components/CatModal";
import { RuleFormModal, emptyRuleForm, ruleFormToPayload } from "../components/RuleFormModal";
import type {
  ActiveAccountItem,
  ApiSession,
  CategoryRead,
  DuplicateTransactionGroup,
  TransactionRead,
} from "../lib/api";
import type { RuleFormState, TransactionPeriodPreset } from "../types";

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
  calendar: "M7 3v3 M17 3v3 M4 8h16 M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  info:     "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  x:        "M18 6L6 18 M6 6l12 12",
};

// Invoice reference month/year, e.g. "ago/2021" (based on the due/payment date).
function faturaMonthLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m}/${d.getFullYear()}`;
}

// Range calendar (estilo Decolar): clica início → fim, com o intervalo destacado.
function DateRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const d = from ? new Date(from + "T00:00:00") : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const label = from && to ? `${dateLabel(from)} – ${dateLabel(to)}` : from ? `${dateLabel(from)} – escolha o fim` : "Selecionar datas";
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  function pick(day: number) {
    const d = iso(new Date(year, month, day));
    if (!from || (from && to)) onChange(d, "");
    else if (d < from) onChange(d, "");
    else { onChange(from, d); setOpen(false); }
  }
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className={`cat-select${from ? " active" : ""}`} style={{ padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setOpen((o) => !o)}>
        <TIcon name="calendar" size={13} /> {label}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--sh-pop)", padding: 12, width: 264 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setView(new Date(year, month - 1, 1))}><TIcon name="chevL" size={13} /></button>
            <span style={{ fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>{view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setView(new Date(year, month + 1, 1))}><TIcon name="chevR" size={13} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, fontSize: 10.5, textAlign: "center", color: "var(--ink-faint)", marginBottom: 4 }}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => <div key={i}>{w}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const d = iso(new Date(year, month, day));
              const edge = d === from || d === to;
              const inRange = !!(from && to && d > from && d < to);
              return (
                <button key={i} type="button" onClick={() => pick(day)} style={{ padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, background: edge ? "var(--acc)" : inRange ? "var(--acc-soft)" : "transparent", color: edge ? "#fff" : "var(--ink)" }}>{day}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange("", "")}>Limpar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

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

// Sentinel value used by the category <select>s to mean "create a new one".
const NEW_CATEGORY_VALUE = "__new__";

// The AI categorizer stores a suggested rule regex in the assignment reason
// ("IA Gemini | regex sugerido: ^spotify"). Pull it out so we can offer a rule.
function aiSuggestedRegex(reason: string | null | undefined): string | null {
  const match = /regex sugerido:\s*(.+)$/i.exec(reason ?? "");
  const value = match?.[1]?.trim();
  return value && value.toLowerCase() !== "null" ? value : null;
}

// Lets any CategoryPicker (deeply nested in rows/cards/detail/review) open the
// shared "create category" modal without threading callbacks through every layer.
// The handler receives an `apply` callback that assigns the freshly created
// category id to whatever target triggered it (a transaction, a group, a batch).
const NewCategoryContext = createContext<((apply: (categoryId: string) => void) => void) | null>(null);

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
  const requestNewCategory = useContext(NewCategoryContext);
  return (
    <select
      className="cat-select"
      disabled={mutation.isPending}
      value={transaction.category?.category_id ?? ""}
      onChange={(e) => {
        const value = e.target.value;
        if (value === NEW_CATEGORY_VALUE) { requestNewCategory?.((id) => mutation.mutate(id)); return; }
        mutation.mutate(value || null);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">Sem categoria</option>
      {categoryGroups.map((g) => (
        <optgroup key={g.id} label={g.name}>
          <option value={g.id}>{g.name} (geral)</option>
          {g.subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup>
      ))}
      {requestNewCategory ? <option value={NEW_CATEGORY_VALUE}>＋ Nova categoria…</option> : null}
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
        title={transaction.invoice_due_date ? `Compra: ${dateLabel(transaction.transaction_date)} · Fatura vence: ${dateLabel(transaction.invoice_due_date)}` : undefined}
      >
        <div>{dateLabel(transaction.transaction_date)}</div>
        {transaction.invoice_due_date && (
          <div className="t-sub" style={{ fontSize: 10.5 }}>fatura {faturaMonthLabel(transaction.invoice_due_date)}</div>
        )}
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span className="t-desc">{transaction.description}</span>
          {!hasCategory && transaction.direction === "debit" && <span className="badge b-warn" style={{ fontSize: 10 }}><TIcon name="alert" size={10} />Sem categoria</span>}
          {showInstallments && installmentLabel(transaction) !== "-" && <span className="pill" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{installmentLabel(transaction)}</span>}
        </div>
        {transaction.description !== transaction.raw_description ? <div className="t-sub">{transaction.raw_description}</div> : null}
      </td>
      <td><CategoryPicker categoryGroups={categoryGroups} onCategorized={onCategorized} session={session} transaction={transaction} /></td>
      <td style={{ whiteSpace: "nowrap" }}>
        <div className="t-sub">{acctText}</div>
        <span className="pill" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{srcLabel}</span>
      </td>
      <td className="num" style={{ fontWeight: 700, color: isCredit ? "var(--acc)" : "var(--ink)" }}>
        {isCredit ? "+" : ""}{moneyAbs(transaction.amount)}
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

function TransactionDetail({ transaction, categories, categoryGroups, deleting = false, onDelete, onCategorized, onCreateRuleFromAI, session }: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  categoryGroups: CategoryGroup[];
  deleting?: boolean;
  onDelete?: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
  onCreateRuleFromAI?: (transaction: TransactionRead) => void;
  session: ApiSession;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const normalizedChanged = transaction.description !== transaction.raw_description;
  const isCredit = transaction.direction === "credit";
  const [showRule, setShowRule] = useState(false);
  const aiRegex = transaction.category?.source === "llm" ? aiSuggestedRegex(transaction.category?.reason) : null;
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
      {transaction.account_or_card && <QRow label="Conta/Cartão" value={transaction.account_or_card} />}
      {transaction.invoice_due_date && (
        <QRow label="Fatura" value={`${transaction.invoice_closing_date ? `fecha ${dateLabel(transaction.invoice_closing_date)} · ` : ""}vence ${dateLabel(transaction.invoice_due_date)}`} />
      )}
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
      {aiRegex && onCreateRuleFromAI && (
        <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
              <TIcon name="zap" size={13} /> Sugestão de regra da IA
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
              A IA sugeriu o padrão <code style={{ background: "var(--bg-sunken)", padding: "1px 5px", borderRadius: 5 }}>{aiRegex}</code>. Revise antes de salvar.
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" type="button" style={{ flexShrink: 0 }} onClick={() => onCreateRuleFromAI(transaction)}>
            <TIcon name="zap" size={13} /> Revisar e criar
          </button>
        </div>
      )}
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
  const [targetDirection, setTargetDirection] = useState("");
  const [applyNow, setApplyNow] = useState(true);
  const [error, setError] = useState("");
  const requestNewCategory = useContext(NewCategoryContext);

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
        target_direction: targetDirection || null,
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
    if (!categoryId && !targetDirection) { setError("Escolha a categoria e/ou o tipo financeiro que a regra vai aplicar."); return; }
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
            <select
              className="fld-select"
              value={categoryId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === NEW_CATEGORY_VALUE) { requestNewCategory?.((id) => setCategoryId(id)); return; }
                setCategoryId(v);
              }}
            >
              <option value="">Selecione…</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
              {requestNewCategory ? <option value={NEW_CATEGORY_VALUE}>＋ Nova categoria…</option> : null}
            </select>
          </label>

          <label className="fld">
            <span className="fld-label">Tipo financeiro (opcional)</span>
            <select className="fld-select" value={targetDirection} onChange={(e) => setTargetDirection(e.target.value)}>
              <option value="">Não alterar</option>
              <option value="debit">Despesa</option>
              <option value="credit">Receita</option>
              <option value="payment">Pagamento de fatura</option>
            </select>
            <span className="fld-help">A regra também marca os lançamentos parecidos com este tipo.</span>
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

// Date range for a period preset (local-time safe, avoids UTC off-by-one).
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const PERIOD_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "Todo o período" },
  { id: "current_month", label: "Mês atual" },
  { id: "previous_month", label: "Mês passado" },
  { id: "last_30", label: "Últimos 30 dias" },
  { id: "last_90", label: "Últimos 90 dias" },
  { id: "current_year", label: "Este ano" },
  { id: "custom", label: "Personalizado" },
];
function rangeForPreset(p: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = 86400000;
  switch (p) {
    case "current_month": return { from: isoLocal(new Date(y, m, 1)), to: isoLocal(now) };
    case "previous_month": return { from: isoLocal(new Date(y, m - 1, 1)), to: isoLocal(new Date(y, m, 0)) };
    case "last_30": return { from: isoLocal(new Date(now.getTime() - 29 * day)), to: isoLocal(now) };
    case "last_90": return { from: isoLocal(new Date(now.getTime() - 89 * day)), to: isoLocal(now) };
    case "current_year": return { from: isoLocal(new Date(y, 0, 1)), to: isoLocal(now) };
    default: return { from: "", to: "" };
  }
}

// True on narrow viewports — drives the card layout (vs the wide table).
function useIsMobile(maxWidth = 720) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width:${maxWidth}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxWidth}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [maxWidth]);
  return isMobile;
}

// Mobile-friendly card for one transaction: tap opens the detail drawer; the
// checkbox selects (for bulk actions); category is editable inline.
function TransactionCard({ transaction, categoryGroups, session, selected, onToggleSelect, onSelect, onCategorized }: {
  transaction: TransactionRead;
  categoryGroups: CategoryGroup[];
  session: ApiSession;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onSelect: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
}) {
  const isCredit = transaction.direction === "credit";
  const hasCategory = !!transaction.category;
  const inst = installmentSummaryLabel(transaction);
  return (
    <div className="tx-card" onClick={onSelect} style={{ borderColor: selected ? "var(--acc)" : undefined }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input type="checkbox" checked={selected} onClick={(e) => e.stopPropagation()} onChange={() => onToggleSelect(transaction.id)} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-desc" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{transaction.description}</div>
          <div className="t-sub mono" style={{ fontSize: 11.5 }}>
            {dateLabel(transaction.transaction_date)}
            {transaction.invoice_due_date ? ` · fatura ${faturaMonthLabel(transaction.invoice_due_date)}` : ""}
            {inst && inst !== "-" ? ` · ${inst}` : ""}
          </div>
        </div>
        <div className="mono" style={{ fontWeight: 700, whiteSpace: "nowrap", color: isCredit ? "var(--acc)" : "var(--ink)" }}>
          {isCredit ? "+" : ""}{moneyAbs(transaction.amount)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
        <CategoryPicker categoryGroups={categoryGroups} transaction={transaction} session={session} onCategorized={onCategorized} />
        {!hasCategory && transaction.direction === "debit" && (
          <span className="badge b-warn" style={{ flexShrink: 0 }}><TIcon name="alert" size={11} />Sem categoria</span>
        )}
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
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [sourceFileId, setSourceFileId] = useState(initialSourceFileId);
  const [periodPreset, setPeriodPreset] = useState<TransactionPeriodPreset>(initialPeriodPreset);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  // Whether the date range filters by purchase date ("compra") or invoice date ("fatura").
  // Period preset selected in the filter bar (drives dateFrom/dateTo).
  const [periodSel, setPeriodSel] = useState<string>(initialDateFrom || initialDateTo ? "custom" : "all");
  // Optional filters explicitly added via "+ Filtro" (shown even before having a value).
  const [addedFilters, setAddedFilters] = useState<Set<string>>(new Set());
  // Saved filter views (D), persisted in localStorage.
  const [savedViews, setSavedViews] = useState<{ name: string; snap: Record<string, unknown> }[]>(() => {
    try { return JSON.parse(localStorage.getItem("scf-tx-views") || "[]"); } catch { return []; }
  });
  const [weekday] = useState<number | undefined>(initialWeekday);
  const [sortBy, setSortBy] = useState("transaction_date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [actionMessage, setActionMessage] = useState(initialMessage);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  // "Categorizar em grupo" mode (agrupa pendentes por comerciante).
  const [groupMode, setGroupMode] = useState(false);
  const [groupSortBy, setGroupSortBy] = useState<"name" | "count" | "total">("count");
  const [groupSortDir, setGroupSortDir] = useState<"asc" | "desc">("desc");
  const [groupCreateRule, setGroupCreateRule] = useState(true);
  const [groupPage, setGroupPage] = useState(0);
  const [groupPageSize, setGroupPageSize] = useState(50);
  // "Revisar 1 a 1" focused mode + current index in the review queue.
  const [reviewOne, setReviewOne] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [ruleTx, setRuleTx] = useState<TransactionRead | null>(null);
  const [duplicatePage, setDuplicatePage] = useState(0);
  const [activeReviewGroup, setActiveReviewGroup] = useState<DuplicateTransactionGroup | null>(null);
  const [keepId, setKeepId] = useState("");
  const [pageSize, setPageSize] = useState(50);
  // Tab state: all | in | out | pending
  const [tab, setTab] = useState<"all" | "in" | "out" | "pay" | "pending">(initialCategoryId === "__pending__" ? "pending" : "all");
  const [accountFilter, setAccountFilter] = useState("all");
  const duplicatePageSize = 10;
  const categories = useCategories(session);
  const categoryOptions = useMemo(() => orderedCategoryOptions(categories.data?.items ?? []), [categories.data?.items]);
  // Inline category creation: a select asks to create one, we remember which
  // target to apply the new category to, then open the shared CatModal.
  const [newCat, setNewCat] = useState<{ apply: (categoryId: string) => void } | null>(null);
  const openNewCategory = useMemo(() => (apply: (categoryId: string) => void) => setNewCat({ apply }), []);
  // Mirrors the Categories page creation: a category (with color/icon and any
  // initial subs) or a single subcategory — then applies the new id to the target.
  const createCategoryInline = useMutation({
    mutationFn: async (
      input:
        | { kind: "cat"; payload: { name: string; color: string; icon: string; subs: string[] } }
        | { kind: "sub"; name: string; parentId: string },
    ): Promise<string> => {
      if (input.kind === "sub") {
        const sub = await createCategory(session, input.name, input.parentId);
        return sub.id;
      }
      const { name, color, icon, subs } = input.payload;
      const parent = await createCategory(session, name, null, { color, icon });
      for (const subName of subs) await createCategory(session, subName, parent.id, { color });
      return parent.id;
    },
    onSuccess: (applyId, _input, ctx) => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      (ctx as { apply?: (id: string) => void } | undefined)?.apply?.(applyId);
      setNewCat(null);
    },
    onMutate: () => ({ apply: newCat?.apply }),
  });

  // Inline "Criar regra" from a group — opens the shared rule form prefilled, so a
  // recurring classification (e.g. mark as invoice payment) can be set up without
  // leaving Transactions for Settings.
  const [ruleForm, setRuleForm] = useState<RuleFormState>(emptyRuleForm);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleFormError, setRuleFormError] = useState("");
  const createRuleInline = useMutation({
    mutationFn: () => createRule(session, ruleFormToPayload(ruleForm)),
    onSuccess: () => {
      setShowRuleModal(false);
      setRuleForm(emptyRuleForm);
      setRuleFormError("");
      setActionMessage("Regra criada.");
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
      void queryClient.invalidateQueries({ queryKey: ["uncategorized-groups"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
    },
    onError: (e) => setRuleFormError(apiErrorMessage(e, "Falha ao criar a regra.")),
  });
  function openRuleForGroup(sampleDescription: string) {
    setRuleForm({
      ...emptyRuleForm,
      name: sampleDescription.slice(0, 40),
      field: "description",
      match_type: "contains",
      pattern: ruleTokens(sampleDescription),
    });
    setRuleFormError("");
    setShowRuleModal(true);
  }
  // Open the rule form prefilled from the AI's suggested regex (user can edit before saving).
  function openRuleFromAi(t: TransactionRead) {
    const regex = aiSuggestedRegex(t.category?.reason);
    if (!regex) return;
    setRuleForm({
      ...emptyRuleForm,
      name: t.description.slice(0, 40),
      field: "description",
      match_type: "regex",
      pattern: regex,
      category_id: t.category?.category_id ?? "",
      origin: "ai",
    });
    setRuleFormError("");
    setShowRuleModal(true);
  }

  // Card brands for the "Bandeira" filter.
  const creditCards = useQuery({ queryKey: ["credit-cards", session.token], queryFn: () => getCreditCards(session), staleTime: 5 * 60 * 1000 });
  const cardBrands = useMemo(
    () => [...new Set((creditCards.data?.items ?? []).map((c) => c.brand).filter((b): b is string => !!b))],
    [creditCards.data?.items],
  );

  // Invoices (statements) for the "Fatura" filter — pick one to see exactly its
  // transactions (filtered by the imported file). Labelled "<card> · mmm/aa · R$".
  const statements = useQuery({ queryKey: ["credit-card-statements", session.token, "filter"], queryFn: () => getCreditCardStatements(session, ""), staleTime: 5 * 60 * 1000 });
  const invoiceOptions = useMemo(() => {
    const cardName = new Map((creditCards.data?.items ?? []).map((c) => [c.id, c.name]));
    return (statements.data?.items ?? [])
      .filter((s) => s.source_file_id)
      .map((s) => {
        const ref = s.due_date || s.statement_month;
        const d = new Date(ref + "T00:00:00");
        const my = Number.isNaN(d.getTime()) ? ref : `${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${d.getFullYear()}`;
        const total = s.total_amount ? ` · ${money(s.total_amount)}` : "";
        return { id: s.source_file_id as string, label: `${cardName.get(s.credit_card_id) ?? "Cartão"} · ${my}${total}` };
      });
  }, [statements.data?.items, creditCards.data?.items]);

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
  const isMobile = useIsMobile();

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
      else if (tab === "pay") setDirection("payment");
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
  // Review queue (modo Revisar 1 a 1): uncategorized OR pending suggestion.
  const modeAmount = `${amountMin ? `&amount_min=${amountMin}` : ""}${amountMax ? `&amount_max=${amountMax}` : ""}`;
  const uncategorizedGroups = useQuery({
    queryKey: ["uncategorized-groups", session.token, groupPage, groupPageSize, groupSortBy, groupSortDir, search, amountMin, amountMax],
    queryFn: () => getUncategorizedGroups(session, `?limit=${groupPageSize}&offset=${groupPage * groupPageSize}&sort_by=${groupSortBy}&sort_dir=${groupSortDir}${search ? `&q=${encodeURIComponent(search)}` : ""}${modeAmount}`),
    enabled: groupMode,
  });
  const groupTotal = uncategorizedGroups.data?.total_groups ?? 0;
  const groupPageCount = Math.max(1, Math.ceil(groupTotal / groupPageSize));
  // Buscar tambem filtra os modos grupo/revisar; reinicia a paginacao ao mudar.
  useEffect(() => { setGroupPage(0); setReviewOffset(0); setReviewIdx(0); }, [search, amountMin, amountMax]);
  const categorizeGroup = useMutation({
    mutationFn: async ({ ids, categoryId, rulePattern }: { ids: string[]; categoryId: string; rulePattern?: string }) => {
      for (const id of ids) await updateTransactionCategory(session, id, categoryId);
      if (rulePattern) {
        await createRule(session, {
          name: `Auto: ${rulePattern}`,
          field: "description",
          match_type: "contains",
          pattern: rulePattern,
          category_id: categoryId,
          target_direction: null,
          priority: 100,
          active: true,
        });
      }
      return { count: ids.length, rule: Boolean(rulePattern) };
    },
    onSuccess: ({ count, rule }) => {
      setActionMessage(`Categoria aplicada em ${count} lançamento${count === 1 ? "" : "s"}${rule ? " · regra criada para futuras" : ""}.`);
      void queryClient.invalidateQueries({ queryKey: ["uncategorized-groups"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
  // First significant words of a merchant description → a safe "contains" pattern.
  const ruleTokens = (desc: string) => desc.split(/\s+/).filter((t) => t.length > 1).slice(0, 3).join(" ");
  const REVIEW_BATCH = 100;
  const reviewQueue = useQuery({
    queryKey: ["transactions", "review-queue", session.token, reviewOffset, search, amountMin, amountMax],
    queryFn: () => getTransactions(session, `?category_review_status=queue&sort_by=transaction_date&sort_dir=asc&limit=${REVIEW_BATCH}&offset=${reviewOffset}${search ? `&q=${encodeURIComponent(search)}` : ""}${modeAmount}`),
    enabled: reviewOne,
  });
  const reviewItems = reviewQueue.data?.items ?? [];
  const reviewTotal = reviewQueue.data?.total ?? reviewItems.length;
  const reviewCurrent = reviewItems[Math.min(reviewIdx, Math.max(reviewItems.length - 1, 0))];
  // Overall 1-based position across all batches.
  const reviewPos = reviewOffset + Math.min(reviewIdx, Math.max(reviewItems.length - 1, 0)) + 1;
  function reviewNext() {
    if (reviewIdx < reviewItems.length - 1) { setReviewIdx((i) => i + 1); return; }
    if (reviewOffset + reviewItems.length < reviewTotal) { setReviewOffset((o) => o + REVIEW_BATCH); setReviewIdx(0); }
  }
  function reviewPrev() {
    if (reviewIdx > 0) { setReviewIdx((i) => i - 1); return; }
    if (reviewOffset > 0) { setReviewOffset((o) => Math.max(o - REVIEW_BATCH, 0)); setReviewIdx(REVIEW_BATCH - 1); }
  }
  // After categorizing, the item leaves the queue: reload from the front.
  function reviewAfterCategorize() {
    setReviewOffset(0); setReviewIdx(0);
    void reviewQueue.refetch();
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }
  useEffect(() => {
    if (!reviewOne) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") reviewNext();
      if (e.key === "ArrowLeft") reviewPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [reviewOne, reviewItems.length, reviewOffset, reviewIdx, reviewTotal]);
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
      void queryClient.invalidateQueries({ queryKey: ["uncategorized-groups"] });
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
  const hasInstallments = visibleTransactions.some((t) => t.installment_current != null);
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

  function clearFilters() { setSearchInput(""); setSearch(""); setSourceType(""); setCardBrand(""); setSourceFileId(""); setDirection(""); setStatusFilter(""); setCatSource(""); setReviewStatus(""); setCategoryIds(new Set()); setSubcategoryIds(new Set()); setAmountMin(""); setAmountMax(""); setPeriodPreset("all"); setDateFrom(""); setDateTo(""); setPeriodSel("all"); setAddedFilters(new Set()); setPage(0); setTab("all"); setAccountFilter("all"); }
  function applyPeriodPreset(id: string) {
    setPeriodSel(id);
    if (id === "custom") return;
    const r = rangeForPreset(id);
    setDateFrom(r.from); setDateTo(r.to); setPage(0);
  }
  function addFilter(id: string) { setAddedFilters((prev) => new Set([...prev, id])); }
  function removeFilter(id: string, clear: () => void) { clear(); setAddedFilters((prev) => { const n = new Set(prev); n.delete(id); return n; }); setPage(0); }
  // Saved views (D) — persisted in localStorage.
  function applyView(snap: Record<string, unknown>) {
    const s = snap as Record<string, string | string[] | undefined>;
    setSearchInput((s.search as string) || ""); setSearch((s.search as string) || "");
    setSourceType((s.sourceType as string) || ""); setCardBrand((s.cardBrand as string) || ""); setSourceFileId((s.sourceFileId as string) || "");
    setAccountFilter((s.accountFilter as string) || "all"); setCatSource((s.catSource as string) || ""); setReviewStatus((s.reviewStatus as string) || "");
    setCategoryIds(new Set((s.categoryIds as string[]) || [])); setSubcategoryIds(new Set((s.subcategoryIds as string[]) || []));
    setAmountMin((s.amountMin as string) || ""); setAmountMax((s.amountMax as string) || "");
    setDateFrom((s.dateFrom as string) || ""); setDateTo((s.dateTo as string) || ""); setPeriodSel((s.periodSel as string) || "all");
    setPage(0);
  }
  function saveCurrentView() {
    const name = window.prompt("Nome desta visão:");
    if (!name?.trim()) return;
    const snap = { search: searchInput, sourceType, cardBrand, sourceFileId, accountFilter, catSource, reviewStatus, categoryIds: [...categoryIds], subcategoryIds: [...subcategoryIds], amountMin, amountMax, dateFrom, dateTo, periodSel };
    const next = [...savedViews.filter((v) => v.name !== name.trim()), { name: name.trim(), snap }];
    setSavedViews(next);
    try { localStorage.setItem("scf-tx-views", JSON.stringify(next)); } catch { /* ignore */ }
  }
  function deleteView(name: string) {
    const next = savedViews.filter((v) => v.name !== name);
    setSavedViews(next);
    try { localStorage.setItem("scf-tx-views", JSON.stringify(next)); } catch { /* ignore */ }
  }
  // Filter fields shown as chips with inline controls. A field appears when it has
  // a value OR was explicitly added via "+ Filtro"; "+ Filtro" lists the rest.
  const fInput: React.CSSProperties = { padding: "6px 8px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--card-2)", fontSize: 12.5, color: "var(--ink)" };
  const cardOk = sourceType === "" || sourceType === "credit_card_statement";
  const chipSelect: React.CSSProperties = { padding: "5px 8px", maxWidth: 190 };
  const fieldDefs: { id: string; label: string; has: boolean; show: boolean; control: React.ReactNode; clear: () => void }[] = [
    { id: "categoria", label: "Categoria", has: categoryIds.size + subcategoryIds.size > 0, show: true,
      control: (<FlatMultiSelect placeholder="Todas" options={rootCategoryOptions} selected={categoryIds} onChange={(next) => { setSubcategoryIds((prev) => { if (next.size === 0) return prev; return new Set([...prev].filter((sid) => next.has(subParent.get(sid) ?? ""))); }); setCategoryIds(next); setPage(0); }} />),
      clear: () => { setCategoryIds(new Set()); setSubcategoryIds(new Set()); } },
    { id: "conta", label: "Conta", has: accountFilter !== "all", show: true,
      control: (<select className="cat-select" style={chipSelect} value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(0); }}><option value="all">Todas</option>{accountOptions.map((a) => <option key={a} value={a}>{a}</option>)}</select>),
      clear: () => setAccountFilter("all") },
    { id: "tipo", label: "Tipo", has: sourceType !== "", show: true,
      control: (<select className="cat-select" style={chipSelect} value={sourceType} onChange={(e) => { const v = e.target.value; setSourceType(v); if (v && v !== "credit_card_statement") { setCardBrand(""); setSourceFileId(""); } setPage(0); }}><option value="">Todas</option><option value="bank_statement">Conta corrente</option><option value="credit_card_statement">Cartão</option><option value="unknown">Manual/Outras</option></select>),
      clear: () => { setSourceType(""); setCardBrand(""); setSourceFileId(""); } },
    { id: "bandeira", label: "Bandeira", has: cardBrand !== "", show: cardOk && cardBrands.length > 0,
      control: (<select className="cat-select" style={chipSelect} value={cardBrand} onChange={(e) => { setCardBrand(e.target.value); setPage(0); }}><option value="">Todas</option>{cardBrands.map((b) => <option key={b} value={b}>{b}</option>)}</select>),
      clear: () => setCardBrand("") },
    { id: "fatura", label: "Fatura", has: sourceFileId !== "", show: cardOk && invoiceOptions.length > 0,
      control: (<select className="cat-select" style={chipSelect} value={sourceFileId} onChange={(e) => { setSourceFileId(e.target.value); setPage(0); }}><option value="">Todas</option>{invoiceOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>),
      clear: () => setSourceFileId("") },
    { id: "valor", label: "Valor", has: !!(amountMin || amountMax), show: true,
      control: (<span style={{ display: "inline-flex", gap: 4 }}><input type="number" placeholder="0" value={amountMin} min="0" onChange={(e) => { setAmountMin(e.target.value); setPage(0); }} style={{ ...fInput, width: 70 }} /><input type="number" placeholder="∞" value={amountMax} min="0" onChange={(e) => { setAmountMax(e.target.value); setPage(0); }} style={{ ...fInput, width: 70 }} /></span>),
      clear: () => { setAmountMin(""); setAmountMax(""); } },
    { id: "categorizacao", label: "Categorização", has: catSource !== "", show: true,
      control: (<select className="cat-select" style={chipSelect} value={catSource} onChange={(e) => { setCatSource(e.target.value); setPage(0); }}><option value="">Todas</option><option value="rule">Por regra</option><option value="embedding">Por memória</option><option value="llm">Por IA</option><option value="manual">Manual</option><option value="__none__">Sem categoria</option></select>),
      clear: () => setCatSource("") },
    { id: "revisao", label: "Revisão", has: reviewStatus !== "", show: true,
      control: (<select className="cat-select" style={chipSelect} value={reviewStatus} onChange={(e) => { setReviewStatus(e.target.value); setPage(0); }}><option value="">Todas</option><option value="queue">A revisar</option><option value="pending">Pendentes</option><option value="accepted">Confirmadas</option></select>),
      clear: () => setReviewStatus("") },
  ];
  const visibleFields = fieldDefs.filter((f) => f.show && (f.has || addedFilters.has(f.id)));
  const availableFields = fieldDefs.filter((f) => f.show && !(f.has || addedFilters.has(f.id)));

  // Smart-search suggestions: text search stays live; this dropdown offers
  // structured filters (valor, categoria, atalhos) the user clicks to apply.
  const sq = searchInput.trim();
  const sqNum = Number(sq.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  const sqHasNumber = sq !== "" && !Number.isNaN(sqNum) && sqNum > 0;
  const searchSuggestions: { key: string; label: string; apply: () => void }[] = [];
  if (sq) {
    if (sqHasNumber) {
      searchSuggestions.push({ key: "amin", label: `Valor a partir de R$ ${sqNum.toLocaleString("pt-BR")}`, apply: () => { setAmountMin(String(sqNum)); setSearchInput(""); setSearch(""); setPage(0); setSearchOpen(false); } });
      searchSuggestions.push({ key: "amax", label: `Valor até R$ ${sqNum.toLocaleString("pt-BR")}`, apply: () => { setAmountMax(String(sqNum)); setSearchInput(""); setSearch(""); setPage(0); setSearchOpen(false); } });
    }
    const low = sq.toLowerCase();
    rootCategoryOptions
      .filter((o) => o.name.toLowerCase().includes(low))
      .slice(0, 4)
      .forEach((o) => searchSuggestions.push({ key: `cat-${o.id}`, label: `Categoria: ${o.name}`, apply: () => { setCategoryIds(new Set([o.id])); setSubcategoryIds(new Set()); setSearchInput(""); setSearch(""); setPage(0); setSearchOpen(false); } }));
    if ("sem categoria".includes(low)) searchSuggestions.push({ key: "nocat", label: "Sem categoria", apply: () => { setCatSource("__none__"); setSearchInput(""); setSearch(""); setPage(0); setSearchOpen(false); } });
    if ("cartao".includes(low) || "cartão".includes(low)) searchSuggestions.push({ key: "card", label: "Só cartão de crédito", apply: () => { setSourceType("credit_card_statement"); setSearchInput(""); setSearch(""); setPage(0); setSearchOpen(false); } });
  }

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


  return (
    <NewCategoryContext.Provider value={openNewCategory}>
    {showRuleModal ? (
      <RuleFormModal
        form={ruleForm}
        setForm={setRuleForm}
        categoryOptions={categoryOptions}
        saving={createRuleInline.isPending}
        error={ruleFormError}
        onClose={() => { setShowRuleModal(false); setRuleFormError(""); }}
        onSubmit={() => createRuleInline.mutate()}
        onRequestNewCategory={() => setNewCat({ apply: (id) => setRuleForm((prev) => ({ ...prev, category_id: id })) })}
      />
    ) : null}
    {newCat ? (
      <CatModal
        state={{ kind: "cat" }}
        categories={allCategories}
        zIndex={400}
        onClose={() => setNewCat(null)}
        onSaveCat={(payload) => createCategoryInline.mutate({ kind: "cat", payload: { name: payload.name, color: payload.color, icon: payload.icon, subs: payload.subs } })}
        onSaveSub={(name, parentId) => createCategoryInline.mutate({ kind: "sub", name, parentId })}
      />
    ) : null}
    <div className="canvas stg">
      {/* ── Page header ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
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
      {!reviewMode && !showDuplicates && !reviewOne && !groupMode && (
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
              <span className="cur">R$</span>{compactValueAbs(kpiIncome)}
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
              <span className="cur">R$</span>{compactValueAbs(kpiExpenses)}
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
              <span className="cur">R$</span>{compactValueAbs(kpiResult)}
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
              onChange={(e) => { setSearchInput(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Buscar: descrição, valor, categoria…"
              style={{ width: "100%", padding: "8px 12px 8px 34px", borderRadius: 9, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" }}
            />
            {searchInput ? (
              <button
                onClick={() => { setSearchInput(""); setSearch(""); setPage(0); }}
                type="button"
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 16, lineHeight: 1 }}
              >×</button>
            ) : null}
            {searchOpen && searchSuggestions.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--sh-pop)", overflow: "hidden" }}>
                <div style={{ padding: "6px 12px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-faint)" }}>Filtrar por</div>
                {searchSuggestions.map((s) => (
                  <button key={s.key} type="button" onMouseDown={(e) => { e.preventDefault(); s.apply(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", borderTop: "1px solid var(--line)", cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Segment tabs */}
          <div className="seg">
            {([
              { id: "all", label: "Todas" },
              { id: "in", label: "Receitas" },
              { id: "out", label: "Despesas" },
              { id: "pay", label: "Pagamentos" },
              { id: "pending", label: "A revisar", count: pagePending },
            ] as { id: "all" | "in" | "out" | "pay" | "pending"; label: string; count?: number }[]).map(({ id, label, count }) => (
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
            <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
              <button className={`btn btn-sm ${groupMode ? "btn-primary" : "btn-ghost"}`} onClick={() => { setGroupMode((c) => !c); setReviewOne(false); setShowDuplicates(false); }} type="button">
                <TIcon name="list" size={13} /> Categorizar em grupo
              </button>
              <button className={`btn btn-sm ${reviewOne ? "btn-primary" : "btn-ghost"}`} onClick={() => { setReviewOne((c) => !c); setGroupMode(false); setShowDuplicates(false); setReviewIdx(0); }} type="button">
                <TIcon name="check" size={13} /> Revisar 1 a 1
              </button>
              <button className={`btn btn-sm ${showDuplicates ? "btn-primary" : "btn-ghost"}`} onClick={() => { setShowDuplicates((c) => !c); setGroupMode(false); setReviewOne(false); setShowAccounts(false); }} type="button">
                <TIcon name="filter" size={13} /> Duplicados
                {duplicates.data?.total_groups ? <span className="badge b-warn" style={{ marginLeft: 4, padding: "1px 6px", fontSize: 10 }}>{duplicates.data.total_groups}</span> : null}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAccounts(true)} type="button">
                <TIcon name="info" size={13} /> Contas
              </button>
            </div>
          )}
        </div>

        {/* Filter bar: período + visões salvas + filtros (chips com controle) + "+ Filtro" */}
        {!reviewMode && !showDuplicates && !reviewOne && !groupMode && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
            {/* Período */}
            <div className="fbox">
              <span className="fbox-lbl">Período</span>
              <select className="cat-select" style={{ padding: "5px 8px" }} value={periodSel} onChange={(e) => applyPeriodPreset(e.target.value)}>
                {PERIOD_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              {periodSel === "custom" && (
                <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(0); }} />
              )}
            </div>

            {/* Visões salvas */}
            {savedViews.map((v) => (
              <span key={v.name} className="chip" onClick={() => applyView(v.snap)} title="Aplicar visão" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <TIcon name="star" size={12} />{v.name}
                <span aria-hidden onClick={(e) => { e.stopPropagation(); deleteView(v.name); }} style={{ opacity: 0.6 }}>✕</span>
              </span>
            ))}

            {/* Filtros ativos/adicionados, cada um com seu controle */}
            {visibleFields.map((f) => (
              <div key={f.id} className="fbox">
                <span className="fbox-lbl">{f.label}</span>
                {f.control}
                <button type="button" className="fbox-x" title="Remover filtro" onClick={() => removeFilter(f.id, f.clear)}>✕</button>
              </div>
            ))}

            {/* + Filtro */}
            {availableFields.length > 0 && (
              <select className="chip" style={{ cursor: "pointer" }} value="" onChange={(e) => { if (e.target.value) addFilter(e.target.value); }}>
                <option value="">+ Filtro</option>
                {availableFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-quiet btn-sm" onClick={saveCurrentView}>Salvar visão</button>
              {activeFilterCount > 0 && <button type="button" className="btn btn-quiet btn-sm" onClick={clearFilters}>Limpar</button>}
            </div>
          </div>
        )}

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

        {/* Modo Revisar 1 a 1 */}
        {reviewOne && !reviewMode && (
          <div style={{ padding: "20px 14px" }}>
            {reviewQueue.isLoading ? (
              <div className="state"><div className="state-ic"><TIcon name="refresh" size={22} /></div><h4>Carregando fila…</h4></div>
            ) : reviewItems.length === 0 ? (
              <div className="state"><div className="state-ic"><TIcon name="check" size={22} /></div><h4>Tudo revisado! 🎉</h4><p>Nenhuma transação pendente de categoria.</p>
                <button className="btn btn-primary btn-sm" type="button" style={{ marginTop: 10 }} onClick={() => setReviewOne(false)}>Sair do modo revisar</button>
              </div>
            ) : reviewCurrent ? (
              <div className="card card-pad" style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="t-sub">Revisando {reviewPos} de {reviewTotal} a revisar</span>
                  <button className="btn btn-quiet btn-sm" type="button" onClick={() => setReviewOne(false)}>Sair</button>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{reviewCurrent.description}</div>
                  {reviewCurrent.raw_description !== reviewCurrent.description && <div className="t-sub">{reviewCurrent.raw_description}</div>}
                </div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
                  <div><div className="t-sub">Valor</div><div className="mono" style={{ fontWeight: 700, color: reviewCurrent.direction === "credit" ? "var(--acc)" : "var(--ink)" }}>{reviewCurrent.direction === "credit" ? "+" : "-"}{moneyAbs(reviewCurrent.amount)}</div></div>
                  <div><div className="t-sub">Data</div><div className="mono">{dateLabel(reviewCurrent.transaction_date)}</div></div>
                  {reviewCurrent.account_or_card && <div><div className="t-sub">Conta/Cartão</div><div>{reviewCurrent.account_or_card}</div></div>}
                </div>
                <div>
                  <div className="t-sub" style={{ marginBottom: 4 }}>Categoria</div>
                  <CategoryPicker categoryGroups={categoryGroups} session={session} transaction={reviewCurrent} onCategorized={reviewAfterCategorize} />
                  {reviewCurrent.category && (
                    <button className="btn btn-quiet btn-sm" type="button" style={{ marginTop: 8 }} onClick={() => setRuleTx(reviewCurrent)}>
                      <TIcon name="tag" size={13} /> Criar regra (aplicar a parecidas)
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" type="button" disabled={reviewOffset === 0 && reviewIdx === 0} onClick={reviewPrev}><TIcon name="chevL" size={13} /> Anterior</button>
                  <button className="btn btn-ghost btn-sm" type="button" disabled={reviewPos >= reviewTotal} onClick={reviewNext}>Pular <TIcon name="chevR" size={13} /></button>
                  <span className="t-sub" style={{ marginLeft: "auto", fontSize: 11.5 }}>← → para navegar</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Modo Categorizar em grupo (por comerciante) */}
        {groupMode && !reviewMode && (
          <div style={{ padding: "16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Categorizar em grupo</div>
                <div className="t-sub" style={{ fontSize: 12 }}>Lançamentos sem categoria agrupados por comerciante — categorize vários de uma vez.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }} title="Cria uma regra que categoriza automaticamente futuras importações deste comerciante">
                  <input type="checkbox" checked={groupCreateRule} onChange={(e) => setGroupCreateRule(e.target.checked)} />
                  Criar regra para futuras
                </label>
                {uncategorizedGroups.data ? <span className="t-sub">{uncategorizedGroups.data.total_groups} grupos</span> : null}
              </div>
            </div>
            {uncategorizedGroups.isLoading ? (
              <div className="state"><div className="state-ic"><TIcon name="refresh" size={22} /></div><h4>Agrupando…</h4></div>
            ) : (uncategorizedGroups.data?.groups.length ?? 0) === 0 ? (
              <div className="state"><div className="state-ic"><TIcon name="check" size={22} /></div><h4>Nada sem categoria! 🎉</h4></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead><tr>
                    {([["name", "Comerciante", ""], ["count", "Lançamentos", "num"], ["total", "Total", "num"]] as const).map(([col, label, cls]) => (
                      <th
                        key={col}
                        className={cls}
                        onClick={() => { if (groupSortBy === col) setGroupSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setGroupSortBy(col); setGroupSortDir(col === "name" ? "asc" : "desc"); } setGroupPage(0); }}
                        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      >
                        {label} <span style={{ fontSize: 10, color: groupSortBy === col ? "var(--acc)" : "var(--ink-faint)" }}>{groupSortBy === col ? (groupSortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </th>
                    ))}
                    <th style={{ minWidth: 320 }}>Categoria / ação</th>
                  </tr></thead>
                  <tbody>
                    {(uncategorizedGroups.data?.groups ?? []).map((g) => (
                      <tr key={g.key}>
                        <td><span className="t-desc">{g.sample_description}</span></td>
                        <td className="num mono">{g.count}</td>
                        <td className="num mono" style={{ color: "var(--neg)" }}>{moneyAbs(g.total)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <select
                              className="cat-select"
                              style={{ flex: 1, minWidth: 0 }}
                              disabled={categorizeGroup.isPending}
                              value=""
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!value) return;
                                const rulePattern = groupCreateRule ? ruleTokens(g.sample_description) : undefined;
                                if (value === NEW_CATEGORY_VALUE) { setNewCat({ apply: (id) => categorizeGroup.mutate({ ids: g.ids, categoryId: id, rulePattern }) }); return; }
                                categorizeGroup.mutate({ ids: g.ids, categoryId: value, rulePattern });
                              }}
                            >
                              <option value="">{categorizeGroup.isPending ? "Aplicando…" : `Categorizar ${g.count} →`}</option>
                              {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                              <option value={NEW_CATEGORY_VALUE}>＋ Nova categoria…</option>
                            </select>
                            <select
                              className="cat-select"
                              style={{ flexShrink: 0 }}
                              title="Marcar o tipo deste grupo (ex.: Pagamento de fatura)"
                              disabled={bulkChangeDirection.isPending}
                              value=""
                              onChange={(e) => {
                                const dir = e.target.value;
                                if (!dir) return;
                                bulkChangeDirection.mutate({ ids: g.ids, direction: dir });
                              }}
                            >
                              <option value="">Tipo…</option>
                              <option value="payment">Fatura</option>
                              <option value="debit">Despesa</option>
                              <option value="credit">Receita</option>
                            </select>
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              style={{ flexShrink: 0 }}
                              title="Criar uma regra a partir deste grupo (sem ir em Configurações)"
                              onClick={() => openRuleForGroup(g.sample_description)}
                            >
                              <TIcon name="zap" size={13} /> Regra
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {groupTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <span className="t-sub" style={{ fontSize: 12 }}>{groupPage * groupPageSize + 1}–{Math.min((groupPage + 1) * groupPageSize, groupTotal)} de {groupTotal} grupos</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" type="button" disabled={groupPage === 0 || uncategorizedGroups.isFetching} onClick={() => setGroupPage((p) => Math.max(p - 1, 0))}><TIcon name="chevL" size={13} /></button>
                      <span className="t-sub" style={{ fontSize: 12 }}>{groupPage + 1}/{groupPageCount}</span>
                      <button className="btn btn-ghost btn-sm" type="button" disabled={groupPage + 1 >= groupPageCount || uncategorizedGroups.isFetching} onClick={() => setGroupPage((p) => p + 1)}><TIcon name="chevR" size={13} /></button>
                      <select value={groupPageSize} onChange={(e) => { setGroupPageSize(Number(e.target.value)); setGroupPage(0); }} className="cat-select" style={{ padding: "4px 8px" }}>
                        <option value={25}>25 / pág</option>
                        <option value={50}>50 / pág</option>
                        <option value={100}>100 / pág</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showAccounts && !reviewMode && (
          <SimpleDrawer title="Contas e cartões" onClose={() => setShowAccounts(false)}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 12 }}>Detectados nos arquivos importados.</div>
              <ActiveAccountsPanel accounts={activeAccounts.data?.items ?? []} loading={activeAccounts.isLoading} />
            </div>
          </SimpleDrawer>
        )}


        {/* Action message */}
        {actionMessage ? (
          <div style={{ padding: "0 14px" }}><InlineSuccess message={actionMessage} /></div>
        ) : null}

        {!showDuplicates && !reviewOne && !groupMode && (<>
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
                if (val === NEW_CATEGORY_VALUE) { const ids = [...selectedIds]; setNewCat({ apply: (id) => bulkCategorize.mutate({ ids, categoryId: id }) }); return; }
                bulkCategorize.mutate({ ids: [...selectedIds], categoryId: val === "__remove__" ? null : val });
              }}
              style={{ padding: "5px 8px" }}
            >
              <option value="__placeholder__">{bulkCategorize.isPending ? "Aplicando…" : "Categorizar em lote"}</option>
              <option value={NEW_CATEGORY_VALUE}>＋ Nova categoria…</option>
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
              {activeFilterCount > 0 && (
                <button className="btn btn-primary btn-sm" type="button" onClick={clearFilters} style={{ marginTop: 10 }}>Limpar filtros</button>
              )}
            </div>
          ) : isMobile ? (
            <div className="tx-card-list">
              {visibleTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  categoryGroups={categoryGroups}
                  session={session}
                  transaction={transaction}
                  selected={selectedIds.has(transaction.id)}
                  onSelect={() => onSelect(selected?.id === transaction.id ? null : transaction)}
                  onCategorized={handleCategoryChanged}
                  onToggleSelect={(id) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }}
                />
              ))}
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
                  {sortTh("Data / Fatura", "transaction_date")}
                  {sortTh("Descrição", "description")}
                  <th>Categoria</th>
                  <th>Conta</th>
                  {sortTh("Valor", "amount", "num")}
                  <th style={{ width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((transaction) => (
                  <TransactionRow
                    categoryGroups={categoryGroups}
                    key={transaction.id}
                    onDelete={() => { if (window.confirm(`Excluir a transação "${transaction.description}"? Esta ação não pode ser desfeita.`)) remove.mutate(transaction.id); }}
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
        </>)}
      </div>

      {/* Error banners */}
      {remove.isError ? <InlineError message={apiErrorMessage(remove.error, "Falha ao excluir transação.")} /> : null}
      {removeDuplicateReviewItems.isError ? <InlineError message={apiErrorMessage(removeDuplicateReviewItems.error, "Falha ao excluir lançamentos revisados.")} /> : null}
      {bulkDelete.isError ? <InlineError message={apiErrorMessage(bulkDelete.error, "Falha ao excluir transações selecionadas.")} /> : null}

      {/* ── Drawers ── */}
      {ruleTx ? (
        <RuleFromTxModal transaction={ruleTx} categories={categories.data?.items ?? []} session={session} onClose={() => setRuleTx(null)} />
      ) : null}
      {selected ? (
        <SimpleDrawer title="Detalhe da transação" onClose={() => onSelect(null)}>
          <TransactionDetail
            categories={categories.data?.items ?? []}
            categoryGroups={categoryGroups}
            deleting={remove.isPending}
            onDelete={() => { if (window.confirm(`Excluir a transação "${selected.description}"? Esta ação não pode ser desfeita.`)) remove.mutate(selected.id); }}
            onCategorized={handleCategoryChanged}
            onCreateRuleFromAI={openRuleFromAi}
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
    </NewCategoryContext.Provider>
  );
}
