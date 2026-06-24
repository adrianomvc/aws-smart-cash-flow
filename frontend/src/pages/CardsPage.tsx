import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import {
  createCreditCard,
  getCreditCardInstallments,
  getCreditCardPaymentMatches,
  getCreditCards,
  getTransactions,
  updateCreditCard,
} from "../lib/api";
import {
  amountClass,
  apiErrorMessage,
  compactMoneyAbs,
  compactMoneyAxis,
  compactValueAbs,
  dateLabel,
  directionLabel,
  installmentSummaryLabel,
  money,
  moneyAbs,
  withQueryParams,
} from "../lib/utils";
import { CreditCard } from "lucide-react";
import { useCategories, useHasTransactions, usePeriod } from "../hooks";
import { InlineError, NoDataOnboarding } from "../components/ui";
import type {
  ApiSession,
  CategoryRead,
  CreditCardPaymentMatchItem,
  CreditCardPayload,
  CreditCardRead,
  TransactionRead,
} from "../lib/api";
import type { PeriodState, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const K_ICONS: Record<string, string> = {
  card:    "M3 7h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M3 11h18",
  plus:    "M12 5v14 M5 12h14",
  edit:    "M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check:   "M5 12l5 5 9-10",
  chevR:   "M9 18l6-6-6-6",
  chevL:   "M15 18l-6-6 6-6",
  alert:   "M12 9v4 M12 17h.01 M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z",
  wallet:  "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  list:    "M9 6h10 M9 12h10 M9 18h10 M5 6h.01 M5 12h.01 M5 18h.01",
  receipt: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5 M9 12h6 M9 16h4",
  repeat:  "M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3",
  star:    "M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.7l-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2z",
};

function KIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = K_ICONS[name];
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
// Helpers
// ---------------------------------------------------------------------------

const CARD_PALETTE = ["#2a4d8f", "#1f8a5b", "#6a4ba8", "#c98a2b", "#a35a7d", "#2a9d8f"];
function cardColor(index: number): string {
  return CARD_PALETTE[index % CARD_PALETTE.length];
}
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 36);
  const g = Math.max(0, ((n >> 8) & 255) - 26);
  const b = Math.max(0, (n & 255) - 14);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function sumTransactions(items: Array<Pick<TransactionRead, "amount">>) {
  return items.reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
}
// Best purchase day = day after closing (longest time until the bill is due).
function bestPurchaseDay(closingDay: number): number {
  return (closingDay % 31) + 1;
}

const CAT_PALETTE = [
  "#3567b8", "#1f8a5b", "#6a52c9", "#c98a2b", "#cf4d43",
  "#d98234", "#2a9d8f", "#9a6b14", "#7c8696", "#a35a7d",
];

// ---------------------------------------------------------------------------
// Donut chart
// ---------------------------------------------------------------------------

function Donut({ data, size = 150, thickness = 22, center }: {
  data: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {data.map((d, i) => {
            const dash = (d.value / total) * circ;
            const seg = (
              <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += dash;
            return seg;
          })}
        </g>
      </svg>
      {center && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          {center}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageCard({ icon, tone, title, desc, amount }: { icon: string; tone: string; title: string; desc: string; amount: string }) {
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="goal-ic" style={{ background: tone + "1e", color: tone }}>
          <KIcon name={icon} size={15} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px", lineHeight: 1.45, minHeight: 48 }}>{desc}</p>
      <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: tone }}>{amount}</div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 0" }}>
      {[1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 40, borderRadius: 9 }} />)}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="state">
      <div className="state-ic"><KIcon name="list" size={20} /></div>
      <p>{message}</p>
    </div>
  );
}

// Invoice reference month/year, e.g. "ago/2021" (based on the due/payment month).
function faturaMonthLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m}/${d.getFullYear()}`;
}

function CardTransactionList({ emptyMessage, items, loading, onOpenTransaction }: {
  emptyMessage: string;
  items: TransactionRead[];
  loading: boolean;
  onOpenTransaction: (t: TransactionRead) => void;
}) {
  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyState message={emptyMessage} />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tbl">
        <thead>
          <tr><th>Data / Fatura</th><th>Descrição</th><th>Tipo</th><th className="num">Valor</th></tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr
              key={t.id}
              style={{ cursor: "pointer", ...(t.installment_total ? { background: "var(--warn-soft)" } : {}) }}
              onClick={() => onOpenTransaction(t)}
            >
              <td className="mono t-sub" style={{ whiteSpace: "nowrap" }}>
                <div>{dateLabel(t.transaction_date)}</div>
                {t.invoice_due_date && (
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>fatura {faturaMonthLabel(t.invoice_due_date)}</div>
                )}
              </td>
              <td>
                <span className="t-desc">{t.description}</span>
                {installmentSummaryLabel(t) && (
                  <span className="badge b-future tag-mono" style={{ marginLeft: 8 }}>{installmentSummaryLabel(t)}</span>
                )}
              </td>
              <td>
                <span className={`badge ${t.direction === "credit" ? "b-pos" : t.direction === "payment" ? "b-info" : "b-neutral"}`}>
                  {directionLabel(t.direction)}
                </span>
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                <span className={amountClass(t)}>{moneyAbs(t.amount)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentMatchListPanel({ items, loading, onOpenMatch }: {
  items: CreditCardPaymentMatchItem[];
  loading: boolean;
  onOpenMatch: (item: CreditCardPaymentMatchItem, side: "bank" | "card") => void;
}) {
  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyState message="Nenhum pagamento conciliável no período." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item) => (
        <div key={`${item.bank_transaction_id}-${item.card_transaction_id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: "1px solid var(--line)" }}>
          <div className="goal-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
            <KIcon name="check" size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{moneyAbs(item.amount)}</div>
            <div className="t-sub">{dateLabel(item.bank_date)} no extrato · {dateLabel(item.card_date)} na fatura</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-quiet btn-sm" onClick={() => onOpenMatch(item, "bank")} type="button">Extrato</button>
            <button className="btn btn-quiet btn-sm" onClick={() => onOpenMatch(item, "card")} type="button">Fatura</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CardsPage({
  onOpenImports,
  onOpenTransactions,
  period: cardPeriod,
  session,
  setPeriod: setCardPeriod,
}: {
  onOpenImports?: () => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  period: PeriodState;
  session: ApiSession;
  setPeriod: Dispatch<SetStateAction<PeriodState>>;
}) {
  const hasTransactions = useHasTransactions(session);
  const period = usePeriod(cardPeriod, setCardPeriod);
  // active = -1 → all cards (aggregate); 0..n → a specific card.
  const [active, setActive] = useState(-1);
  const [showNewCard, setShowNewCard] = useState(false);
  const [editCard, setEditCard] = useState<CreditCardRead | null>(null);

  const persistedCards = useQuery({ queryKey: ["credit-cards", session.token], queryFn: () => getCreditCards(session) });
  const categories = useCategories(session);
  const cardList = persistedCards.data?.items ?? [];
  const selectedCard: CreditCardRead | undefined = active >= 0 ? cardList[active] : undefined;

  // Transactions of the selected card (linked via its imported statements/files).
  // The card month means "the invoice PAID that month": filter by the invoice's due
  // (payment) month, not by each purchase's date. This query (limit 100) feeds the
  // KPIs aggregate and the category breakdown.
  const cardQueryParams: Record<string, string> = { limit: "100", sort_by: "transaction_date", sort_dir: "desc", source_type: "credit_card_statement" };
  if (selectedCard) cardQueryParams.credit_card_id = selectedCard.id;
  if (period.dateFrom) cardQueryParams.due_from = period.dateFrom;
  if (period.dateTo) cardQueryParams.due_to = period.dateTo;
  const cardQuery = withQueryParams("", cardQueryParams);
  // The chart, category breakdown and per-day aggregate must cover the WHOLE invoice.
  // A single page is capped at 100 and sorted by purchase date, which dropped
  // old-purchase-date installments (e.g. a 24/02 charge billed in April) — so page
  // past the 100 limit and merge. Server-side aggregates (total_expense/income) come
  // from the first page (computed over all matching rows).
  const cards = useQuery({
    queryKey: ["card-transactions", session.token, cardQuery],
    queryFn: async () => {
      const first = await getTransactions(session, withQueryParams("", { ...cardQueryParams, offset: "0" }));
      const items = [...first.items];
      let offset = 100;
      while (items.length < (first.total ?? items.length) && offset < 2000) {
        const page = await getTransactions(session, withQueryParams("", { ...cardQueryParams, offset: String(offset) }));
        if (page.items.length === 0) break;
        items.push(...page.items);
        offset += 100;
      }
      return { ...first, items };
    },
  });

  // Day-by-day purchases of the selected invoice/period (by purchase date) + a
  // running cumulative — a visual tracking of how the invoice builds up.
  const dailySpend = useMemo(() => {
    const byDay = new Map<string, { value: number; inst: number }>();
    for (const t of cards.data?.items ?? []) {
      if (t.direction !== "debit") continue;
      const amt = Math.abs(Number(t.amount ?? 0));
      const cur = byDay.get(t.transaction_date) ?? { value: 0, inst: 0 };
      cur.value += amt;
      if (t.installment_total) cur.inst += amt; // parceladas (compradas neste dia)
      byDay.set(t.transaction_date, cur);
    }
    let acc = 0;
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => { acc += d.value; return { date, value: d.value, regular: d.value - d.inst, inst: d.inst, acc }; });
  }, [cards.data?.items]);
  const hasInstallmentsInChart = dailySpend.some((d) => d.inst > 0);

  // Separate, paginated query for the "Lançamentos da fatura" list so the user can
  // page through every transaction in place (without jumping to Transações).
  const CARD_LEDGER_PAGE_SIZE = 12;
  const [ledgerPage, setLedgerPage] = useState(0);
  // Sort the invoice list by purchase date or by amount — sorting by value brings
  // the big (often parceled) charges to the top instead of burying them.
  const [ledgerSort, setLedgerSort] = useState<"transaction_date" | "amount">("transaction_date");
  useEffect(() => { setLedgerPage(0); }, [selectedCard?.id, period.dateFrom, period.dateTo, ledgerSort]);
  const ledgerParams: Record<string, string> = {
    limit: String(CARD_LEDGER_PAGE_SIZE),
    offset: String(ledgerPage * CARD_LEDGER_PAGE_SIZE),
    sort_by: ledgerSort,
    sort_dir: "desc",
    source_type: "credit_card_statement",
  };
  if (selectedCard) ledgerParams.credit_card_id = selectedCard.id;
  if (period.dateFrom) ledgerParams.due_from = period.dateFrom;
  if (period.dateTo) ledgerParams.due_to = period.dateTo;
  const ledgerQuery = withQueryParams("", ledgerParams);
  const cardLedger = useQuery({ queryKey: ["card-ledger", session.token, ledgerQuery], queryFn: () => getTransactions(session, ledgerQuery) });
  const ledgerItems = cardLedger.data?.items ?? [];
  const ledgerTotal = cardLedger.data?.total ?? 0;
  const ledgerPageCount = Math.max(1, Math.ceil(ledgerTotal / CARD_LEDGER_PAGE_SIZE));
  const installments = useQuery({
    queryKey: ["card-future-installments", session.token, period.dateTo],
    queryFn: () => getCreditCardInstallments(session, period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" })),
  });
  const paymentMatches = useQuery({ queryKey: ["cards-credit-card-payment-matches", session.token, period.query], queryFn: () => getCreditCardPaymentMatches(session, withQueryParams(period.query, { limit: "5", window_days: "7" })) });

  // Todas as compras parceladas (para a timeline "mês a mês"). O `remaining` do
  // endpoint é ancorado na compra; calculamos a posição real relativa a HOJE.
  const instAllParams: Record<string, string> = { limit: "100" };
  if (selectedCard) instAllParams.credit_card_id = selectedCard.id;
  const installmentsAll = useQuery({
    queryKey: ["card-installments-all", session.token, selectedCard?.id ?? "all"],
    queryFn: () => getCreditCardInstallments(session, withQueryParams("", instAllParams)),
  });
  const instForecast = useMemo(() => {
    const items = installmentsAll.data?.items ?? [];
    // Anchor the timeline to the selected period (its end month), else to today.
    const anchor = period.dateTo ? new Date(period.dateTo + "T00:00:00") : new Date();
    const curIdx = anchor.getFullYear() * 12 + anchor.getMonth();
    const MONTHS_AHEAD = 6;
    const mIdx = (iso: string) => { const d = new Date(iso + "T00:00:00"); return d.getFullYear() * 12 + d.getMonth(); };
    const idxLabel = (idx: number) => new Date(Math.floor(idx / 12), idx % 12, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    const buckets = Array.from({ length: MONTHS_AHEAD }, (_, k) => ({ idx: curIdx + k, label: idxLabel(curIdx + k), total: 0, count: 0, parts: [] as string[] }));
    const active: { description: string; total: number; current: number; remainingCount: number; remainingValue: number }[] = [];
    for (const it of items) {
      if (!it.first_invoice_month || !it.installment_total) continue;
      const fi = mIdx(it.first_invoice_month);
      const total = Number(it.installment_total);
      const amount = Number(it.amount ?? 0);
      const lastIdx = fi + total - 1;
      for (const b of buckets) if (b.idx >= fi && b.idx <= lastIdx) { b.total += amount; b.count += 1; b.parts.push(`${it.description} ${b.idx - fi + 1}/${total}`); }
      if (lastIdx >= curIdx) {
        const current = Math.min(Math.max(curIdx - fi + 1, 1), total);
        const remainingCount = total - (current - 1);
        active.push({ description: it.description, total, current, remainingCount, remainingValue: amount * remainingCount });
      }
    }
    active.sort((a, b) => b.remainingValue - a.remainingValue);
    const maxBucket = Math.max(1, ...buckets.map((b) => b.total));
    const committed = active.reduce((s, a) => s + a.remainingValue, 0);
    return { buckets, active, maxBucket, committed };
  }, [installmentsAll.data?.items, period.dateTo]);

  const cardItems = cards.data?.items ?? [];
  const cardDebits = cardItems.filter((t) => t.direction === "debit");

  // Invoice total = debits − credits (refunds), summed server-side over the FULL
  // filtered set. Summing page items would undercount when an invoice has more
  // transactions than the page limit (the API caps a page at 100 rows).
  const cardExpenses = cards.data
    ? Number(cards.data.total_expense ?? 0) - Number(cards.data.total_income ?? 0)
    : sumTransactions(cardDebits);
  const futureInstallments = Number(installments.data?.total_future_amount ?? 0);
  const activeInstallmentCount = installments.data?.active_count ?? 0;
  const sumLimits = cardList.reduce((s, c) => s + Number(c.limit_amount ?? 0), 0);
  const limitForUsage = selectedCard ? Number(selectedCard.limit_amount ?? 0) : sumLimits;
  const util = limitForUsage > 0 ? Math.round((cardExpenses / limitForUsage) * 100) : 0;
  const available = limitForUsage - cardExpenses;

  // Gastos por categoria-pai (subcategorias são somadas na categoria-pai).
  const catById = useMemo(() => {
    const m = new Map<string, CategoryRead>();
    (categories.data?.items ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [categories.data?.items]);
  // índice de paleta estável por categoria-pai (para fallback de cor)
  const parentPaletteIndex = useMemo(() => {
    const m = new Map<string, number>();
    (categories.data?.items ?? []).filter((c) => !c.parent_category_id).forEach((c, i) => m.set(c.id, i));
    return m;
  }, [categories.data?.items]);
  const gastosPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of cardDebits) {
      const assigned = t.category?.category_id;
      const cat = assigned ? catById.get(assigned) : undefined;
      // sobe para a categoria-pai (se for subcategoria); top-level usa a si mesmo
      const rootId = cat ? (cat.parent_category_id ?? cat.id) : "__none__";
      map.set(rootId, (map.get(rootId) ?? 0) + Math.abs(Number(t.amount)));
    }
    return [...map.entries()]
      .map(([id, value]) => {
        const cat = catById.get(id);
        const color = cat?.color ?? CAT_PALETTE[(parentPaletteIndex.get(id) ?? 0) % CAT_PALETTE.length];
        return { id, name: cat?.name ?? "Sem categoria", color, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [cardDebits, catById, parentPaletteIndex]);

  function openCardTransactions(direction: string | undefined, label: string) {
    onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction, label, periodPreset: period.periodPreset, sourceType: "credit_card_statement" });
  }
  // "Ver todas" → Transações filtered to this exact invoice (via its source file).
  // Falls back to the period when there isn't a single invoice in view.
  function openInvoiceTransactions() {
    const sourceFileIds = Array.from(new Set((cardItems as TransactionRead[]).map((t) => t.source_file_id).filter(Boolean)));
    if (selectedCard && sourceFileIds.length === 1) {
      onOpenTransactions({ sourceFileId: sourceFileIds[0], label: `Fatura · ${selectedCard.name}`, sourceType: "credit_card_statement" });
    } else {
      onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, label: "Lançamentos do cartão", periodPreset: period.periodPreset, sourceType: "credit_card_statement" });
    }
  }
  function openTransaction(t: TransactionRead) {
    onOpenTransactions({ dateFrom: t.transaction_date, dateTo: t.transaction_date, direction: t.direction, label: t.description, periodPreset: "custom", search: t.description, sourceType: "credit_card_statement" });
  }

  if (hasTransactions === false && cardList.length === 0 && !showNewCard) {
    return (
      <NoDataOnboarding
        icon={CreditCard}
        eyebrow="Cartões"
        title="Cadastre seu primeiro cartão"
        description="Acompanhe faturas, limites, vencimentos e parcelados. Cadastre um cartão manualmente ou importe a fatura (OFX/CSV) para o SmartCashFlow montar tudo automaticamente."
        onImport={onOpenImports}
        secondaryLabel="Cadastrar cartão"
        onSecondary={() => setShowNewCard(true)}
      />
    );
  }

  return (
    <div className="canvas stg">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h2 className="section-title"><KIcon name="card" size={18} /> Cartões de Crédito</h2>
          <p className="section-sub">
            Faturas, limites, vencimentos e parcelados. Compra, fatura e pagamento são tratados separadamente para evitar dupla contagem.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          {selectedCard && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditCard(selectedCard)}>
              <KIcon name="edit" size={14} /> Editar cartão
            </button>
          )}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowNewCard(true)}>
            <KIcon name="plus" size={14} /> Adicionar cartão
          </button>
        </div>
      </div>

      {/* ── Seletor de cartões ── */}
      {cardList.length === 0 ? (
        <div className="card card-pad" style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <EmptyState message="Nenhum cartão cadastrado. Adicione um cartão ou importe uma fatura para começar." />
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowNewCard(true)}>
            <KIcon name="plus" size={14} /> Adicionar cartão
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          {/* Todos os cartões (agregado) */}
          <button
            type="button"
            onClick={() => setActive(-1)}
            className={"cc" + (active === -1 ? " on" : "")}
            style={{ background: "linear-gradient(135deg, var(--ink-3), var(--ink-faint))", minWidth: 150 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Todos os cartões</span>
              <KIcon name="card" size={16} />
            </div>
            <div style={{ fontSize: 11, opacity: .85, marginTop: 18 }}>{cardList.length} cartões</div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9.5, opacity: .75, textTransform: "uppercase", letterSpacing: .5 }}>Limite total</div>
              <div style={{ fontWeight: 700, fontSize: 17, fontVariantNumeric: "tabular-nums" }}>{money(sumLimits)}</div>
            </div>
          </button>
          {cardList.map((c, i) => {
            const col = c.color || cardColor(i);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(i)}
                onDoubleClick={() => setEditCard(c)}
                className={"cc" + (active === i ? " on" : "")}
                style={{ background: `linear-gradient(135deg, ${col}, ${shade(col)})` }}
                title="Clique duplo para editar"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                  <span style={{ fontSize: 11, opacity: .8, fontFamily: "var(--font-mono)" }}>{c.brand ?? ""}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, letterSpacing: 2, marginTop: 18 }}>
                  •••• {c.last_four ?? "----"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 9.5, opacity: .75, textTransform: "uppercase", letterSpacing: .5 }}>Limite</div>
                    <div style={{ fontWeight: 700, fontSize: 17, fontVariantNumeric: "tabular-nums" }}>{money(c.limit_amount)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9.5, opacity: .75, textTransform: "uppercase", letterSpacing: .5 }}>Vence</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>dia {c.due_day}</div>
                  </div>
                </div>
              </button>
            );
          })}
          {/* Tile: adicionar cartão */}
          <button
            type="button"
            onClick={() => setShowNewCard(true)}
            className="cc cc-add"
            title="Adicionar cartão"
          >
            <KIcon name="plus" size={22} />
            <span style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>Adicionar cartão</span>
          </button>
        </div>
      )}

      {/* ── KPIs do cartão / período ── */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <button className="kpi" style={{ textAlign: "left" }} type="button" onClick={() => openCardTransactions("debit", "Compras no cartão")}>
          <div className="kpi-top"><div className="kpi-ic"><KIcon name="receipt" size={15} /></div><span className="kpi-label">Fatura / compras</span></div>
          <div className="kpi-val"><span className="cur">R$</span>{compactValueAbs(cardExpenses)}</div>
          <div className="kpi-sub">{selectedCard ? `fecha dia ${selectedCard.closing_day}` : "no período"}</div>
        </button>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}><KIcon name="wallet" size={15} /></div><span className="kpi-label">Limite disponível</span></div>
          <div className="kpi-val"><span className="cur">R$</span>{compactValueAbs(Math.max(0, available))}</div>
          <div className="kpi-sub">de {moneyAbs(limitForUsage)}</div>
        </div>
        <button className="kpi" style={{ textAlign: "left" }} type="button" onClick={() => openCardTransactions("debit", "Parcelas identificadas")}>
          <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><KIcon name="repeat" size={15} /></div><span className="kpi-label">Parcelado futuro</span></div>
          <div className="kpi-val"><span className="cur">R$</span>{compactValueAbs(futureInstallments)}</div>
          <div className="kpi-sub">{activeInstallmentCount} parcela{activeInstallmentCount === 1 ? "" : "s"} no próximo mês</div>
        </button>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}><KIcon name="star" size={15} /></div><span className="kpi-label">Melhor dia de compra</span></div>
          <div className="kpi-val">{selectedCard ? `Dia ${bestPurchaseDay(selectedCard.closing_day)}` : "—"}</div>
          <div className="kpi-sub">maior prazo até o pagamento</div>
        </div>
      </div>

      {/* ── Uso do limite ── */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span className="eyebrow">Uso do limite · {selectedCard ? selectedCard.name : "todos os cartões"}</span>
          <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            {moneyAbs(cardExpenses)} de {moneyAbs(limitForUsage)} · {util}%
          </span>
        </div>
        <div className="track" style={{ height: 12 }}>
          <div className="fill" style={{ width: `${Math.min(100, util)}%`, background: util > 70 ? "var(--neg)" : util > 55 ? "var(--warn)" : "var(--acc)" }} />
        </div>
        {util > 55 && (
          <div className="alert warn" style={{ marginTop: 12 }}>
            <div className="alert-ic"><KIcon name="alert" size={15} /></div>
            <div>
              <div className="a-ttl">Comprometimento do limite em {util}%</div>
              <div className="a-txt">Acima de 70% o score de crédito pode ser afetado. Considere antecipar parte da fatura ou reduzir novas compras parceladas.</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Compras dia a dia + acumulado ── */}
      {dailySpend.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span className="eyebrow">Compras dia a dia · {selectedCard ? selectedCard.name : "todos os cartões"}</span>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
              {dailySpend.length} dia{dailySpend.length === 1 ? "" : "s"} · acumulado {moneyAbs(dailySpend[dailySpend.length - 1]?.acc)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={dailySpend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cardAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--acc)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`} tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compactMoneyAxis} tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} width={52} />
              <YAxis yAxisId="acc" orientation="right" tickFormatter={compactMoneyAxis} tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--ink)" }}
                labelFormatter={(d) => dateLabel(String(d))}
                formatter={(v: number, n: string) => {
                  if (!v) return ["", ""] as [string, string];
                  return [moneyAbs(v), n === "acc" ? "Acumulado" : n === "inst" ? "Parcelas (comprado neste dia)" : "Compras à vista"];
                }}
              />
              <Area yAxisId="acc" type="monotone" dataKey="acc" stroke="none" fill="url(#cardAcc)" isAnimationActive={false} legendType="none" tooltipType="none" />
              <Bar dataKey="regular" name="regular" stackId="d" fill="var(--acc)" maxBarSize={22} isAnimationActive={false} />
              <Bar dataKey="inst" name="inst" stackId="d" fill="var(--warn)" maxBarSize={22} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="acc" type="monotone" dataKey="acc" name="acc" stroke="var(--acc-strong)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="legend" style={{ marginTop: 10 }}>
            <span className="legend-item"><span className="lz" style={{ background: "var(--acc)" }} />Compras à vista</span>
            {hasInstallmentsInChart && <span className="legend-item"><span className="lz" style={{ background: "var(--warn)" }} />Parcelas (no dia da compra)</span>}
            <span className="legend-item"><span className="lz" style={{ background: "var(--acc-strong)" }} />Acumulado no ciclo</span>
          </div>
        </div>
      )}

      {/* ── 4 estágios ── */}
      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <StageCard icon="card"    tone="var(--info)"      title="Compra"         desc="Lançamento no cartão. Ainda não é despesa de caixa." amount={`${compactMoneyAbs(cardExpenses)} no ciclo`} />
        <StageCard icon="receipt" tone="var(--warn)"      title="Fatura"         desc="Soma das compras do ciclo. Vence conforme o cartão." amount={moneyAbs(cardExpenses)} />
        <StageCard icon="check"   tone="var(--acc)"       title="Pagamento"      desc="Saída de caixa real. Concilia a fatura — sem dupla contagem." amount="a conciliar" />
        <StageCard icon="repeat"  tone="var(--st-future)" title="Parcela futura" desc="Compromete as próximas faturas." amount={moneyAbs(futureInstallments)} />
      </div>

      {/* ── Lançamentos + Gastos por categoria + Conciliação ── */}
      <div className="dash-main" style={{ marginBottom: 20, alignItems: "stretch" }}>
        <div className="card">
          <div className="card-head">
            <div className="goal-ic" style={{ background: "var(--info-soft)", color: "var(--info)" }}><KIcon name="list" size={15} /></div>
            <div>
              <div className="ttl">Lançamentos da fatura</div>
              <div className="sub">
                {selectedCard ? selectedCard.name : "todos os cartões"}
                {ledgerTotal > 0 ? ` · ${ledgerTotal} lançamento${ledgerTotal === 1 ? "" : "s"}` : " · ciclo atual"}
              </div>
            </div>
            <div className="spacer" />
            <div className="seg" style={{ marginRight: 8 }}>
              <button className={ledgerSort === "transaction_date" ? "on" : ""} onClick={() => setLedgerSort("transaction_date")} type="button" title="Ordenar por data da compra">Data</button>
              <button className={ledgerSort === "amount" ? "on" : ""} onClick={() => setLedgerSort("amount")} type="button" title="Ordenar por valor — traz as parcelas grandes ao topo">Valor</button>
            </div>
            <button className="btn btn-quiet btn-sm" type="button" onClick={openInvoiceTransactions}>
              Ver todas <KIcon name="chevR" size={13} />
            </button>
          </div>
          <div className="card-body">
            <CardTransactionList
              emptyMessage="Nenhuma compra de cartão encontrada no período."
              items={ledgerItems}
              loading={cardLedger.isLoading}
              onOpenTransaction={openTransaction}
            />
            {ledgerTotal > CARD_LEDGER_PAGE_SIZE && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
                <span className="t-sub" style={{ fontSize: 11.5 }}>
                  {ledgerPage * CARD_LEDGER_PAGE_SIZE + 1}–{Math.min((ledgerPage + 1) * CARD_LEDGER_PAGE_SIZE, ledgerTotal)} de {ledgerTotal}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-quiet btn-sm" type="button" disabled={ledgerPage === 0 || cardLedger.isFetching} onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}>
                    <KIcon name="chevL" size={13} /> Anterior
                  </button>
                  <span className="t-sub" style={{ fontSize: 11.5, alignSelf: "center" }}>{ledgerPage + 1}/{ledgerPageCount}</span>
                  <button className="btn btn-quiet btn-sm" type="button" disabled={ledgerPage + 1 >= ledgerPageCount || cardLedger.isFetching} onClick={() => setLedgerPage((p) => p + 1)}>
                    Próxima <KIcon name="chevR" size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="vstack" style={{ gap: 16, height: "100%" }}>
          {/* Gastos por categoria */}
          <div className="card card-pad" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="eyebrow" style={{ alignSelf: "flex-start", marginBottom: 12 }}>Gastos por categoria</div>
            {gastosPorCategoria.length === 0 ? (
              <EmptyState message="Sem gastos de cartão no período." />
            ) : (
              <>
                <Donut
                  data={gastosPorCategoria.map((c) => ({ value: c.value, color: c.color }))}
                  size={150}
                  thickness={22}
                  center={
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>{compactMoneyAbs(cardExpenses)}</div>
                      <div className="t-sub">gasto</div>
                    </div>
                  }
                />
                <div style={{ marginTop: 14, width: "100%", display: "grid", gap: 8 }}>
                  {gastosPorCategoria.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                      <span className="catdot" style={{ background: c.color }} />
                      <span style={{ flex: 1, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      <span className="mono" style={{ fontWeight: 600 }}>{moneyAbs(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Conciliação */}
          <div className="card card-pad" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="goal-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><KIcon name="check" size={15} /></span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Conciliação de pagamento</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
              Pagamentos parecidos entre extrato e fatura no período — registrados como saída de caixa uma única vez.
            </p>
            <PaymentMatchListPanel
              items={paymentMatches.data?.items ?? []}
              loading={paymentMatches.isLoading}
              onOpenMatch={(item, side) => onOpenTransactions({
                dateFrom: side === "bank" ? item.bank_date : item.card_date,
                dateTo: side === "bank" ? item.bank_date : item.card_date,
                direction: "payment",
                label: side === "bank" ? "Pagamento no extrato" : "Pagamento na fatura",
                periodPreset: "custom",
                search: side === "bank" ? item.bank_description : item.card_description,
                sourceType: side === "card" ? "credit_card_statement" : "bank_statement",
              })}
            />
          </div>
        </div>
      </div>

      {/* ── Compras parceladas: como vão caindo mês a mês ── */}
      {(instForecast.active.length > 0 || instForecast.buckets.some((b) => b.total > 0)) && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="eyebrow">Compras parceladas · como vão caindo</span>
            <span className="t-sub">comprometido: <b style={{ color: "var(--ink)" }}>{money(instForecast.committed)}</b></span>
          </div>
          <div className="dash-main">
            <div>
              <div className="t-sub" style={{ marginBottom: 8 }}>Próximos 6 meses (parcelas que caem na fatura)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {instForecast.buckets.map((b) => (
                  <div key={b.idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono t-sub" style={{ width: 56, flexShrink: 0, whiteSpace: "nowrap", textTransform: "capitalize" }}>{b.label}</span>
                    <div
                      style={{ flex: 1, minWidth: 0, height: 18, background: "var(--bg-sunken)", borderRadius: 6, overflow: "hidden", cursor: b.count > 0 ? "help" : "default" }}
                      title={b.count > 0 ? `${b.label} · ${b.count} parcela${b.count === 1 ? "" : "s"} · ${money(b.total)}\n${b.parts.join("\n")}` : `${b.label} · sem parcelas`}
                    >
                      <div style={{ width: `${Math.round((b.total / instForecast.maxBucket) * 100)}%`, height: "100%", background: "var(--st-future)", minWidth: b.total > 0 ? 3 : 0 }} />
                    </div>
                    <span className="mono" style={{ flexShrink: 0, whiteSpace: "nowrap", textAlign: "right", fontWeight: 600, fontSize: 12 }}>{money(b.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="vstack" style={{ gap: 10 }}>
              <div className="t-sub">Compras parceladas ativas</div>
              {instForecast.active.length === 0 ? (
                <EmptyState message="Nenhuma compra parcelada em aberto." />
              ) : (
                instForecast.active.slice(0, 8).map((a, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</span>
                      <span className="mono t-sub" style={{ flexShrink: 0 }}>{a.current}/{a.total} · faltam {a.remainingCount} · {moneyAbs(a.remainingValue)}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-sunken)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(((a.current - 1) / a.total) * 100)}%`, height: "100%", background: "var(--acc)" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showNewCard && <CardModal session={session} onClose={() => setShowNewCard(false)} />}
      {editCard && <CardModal session={session} card={editCard} onClose={() => setEditCard(null)} />}
    </div>
  );
}

const CARD_COLOR_CHOICES = ["#2a4d8f", "#1f8a5b", "#6a4ba8", "#c98a2b", "#a35a7d", "#2a9d8f", "#c0392b", "#2c3e50", "#16a085", "#34495e"];

function CardModal({ session, card, onClose }: { session: ApiSession; card?: CreditCardRead | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = Boolean(card);
  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState(card?.brand ?? "");
  const [lastFour, setLastFour] = useState(card?.last_four ?? "");
  const [color, setColor] = useState(card?.color ?? "");
  const [limit, setLimit] = useState((card?.limit_amount ?? "").replace(".", ","));
  const [closingDay, setClosingDay] = useState(card ? String(card.closing_day) : "23");
  const [dueDay, setDueDay] = useState(card ? String(card.due_day) : "30");
  const [formError, setFormError] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const payload: CreditCardPayload = {
        name: name.trim(),
        brand: brand.trim() || null,
        last_four: lastFour.trim() || null,
        color: color || null,
        limit_amount: limit.trim() ? limit.replace(/\./g, "").replace(",", ".") : null,
        closing_day: Number(closingDay),
        due_day: Number(dueDay),
      };
      return card ? updateCreditCard(session, card.id, payload) : createCreditCard(session, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
  });

  const deactivate = useMutation({
    mutationFn: () => updateCreditCard(session, card!.id, { active: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
  });

  function handleDelete() {
    if (!window.confirm(`Excluir o cartão "${card?.name}"? Esta ação não pode ser desfeita.`)) return;
    deactivate.mutate();
  }

  function submit() {
    if (!name.trim()) { setFormError("Informe o nome do cartão."); return; }
    const cd = Number(closingDay), dd = Number(dueDay);
    if (!cd || cd < 1 || cd > 31) { setFormError("Dia de fechamento inválido (1–31)."); return; }
    if (!dd || dd < 1 || dd > 31) { setFormError("Dia de vencimento inválido (1–31)."); return; }
    if (lastFour && !/^\d{1,4}$/.test(lastFour.trim())) { setFormError("Final do cartão deve ter até 4 dígitos."); return; }
    setFormError("");
    save.mutate();
  }

  const previewColor = color || CARD_COLOR_CHOICES[0];

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="mdl-head">
          <div className="mh-ic" style={{ background: `linear-gradient(135deg, ${previewColor}, ${shade(previewColor)})`, color: "#fff" }}><KIcon name="card" size={17} /></div>
          <div>
            <div className="mh-ttl">{editing ? "Editar cartão" : "Novo cartão de crédito"}</div>
            <div className="mh-sub">{editing ? "Altere dados, limite, datas e cor" : "Cadastre limites, datas e cor do cartão"}</div>
          </div>
          <button className="btn btn-quiet btn-sm mh-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="mdl-body">
          <label className="fld">
            <span className="fld-label">Nome / Apelido</span>
            <input className="fld-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Visa Infinite, Nubank Roxinho" autoFocus />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Bandeira</span>
              <select className="fld-select" value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="">—</option>
                <option>Visa</option>
                <option>Mastercard</option>
                <option>Elo</option>
                <option>American Express</option>
                <option>Hipercard</option>
              </select>
            </label>
            <label className="fld">
              <span className="fld-label">Final (4 dígitos)</span>
              <input className="fld-input" value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" inputMode="numeric" />
            </label>
          </div>
          <div className="fld">
            <span className="fld-label">Cor do cartão</span>
            <div className="swatch-row">
              {CARD_COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"swatch" + (color === c ? " on" : "")}
                  style={{ background: `linear-gradient(135deg, ${c}, ${shade(c)})` }}
                  onClick={() => setColor(c)}
                  title={c}
                >
                  {color === c ? <KIcon name="check" size={14} /> : null}
                </button>
              ))}
              <button
                type="button"
                className={"swatch" + (color === "" ? " on" : "")}
                style={{ background: "var(--bg-sunken)", color: "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700 }}
                onClick={() => setColor("")}
                title="Automática"
              >
                Auto
              </button>
            </div>
          </div>
          <label className="fld">
            <span className="fld-label">Limite (R$)</span>
            <input className="fld-input" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Dia de fechamento</span>
              <input className="fld-input" value={closingDay} onChange={(e) => setClosingDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
            </label>
            <label className="fld">
              <span className="fld-label">Dia de vencimento</span>
              <input className="fld-input" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
            </label>
          </div>
          {formError && <div className="fld-error">{formError}</div>}
          {save.isError && <div style={{ marginTop: 4 }}><InlineError message={apiErrorMessage(save.error, "Falha ao salvar cartão.")} /></div>}
        </div>
        <div className="mdl-foot">
          {editing && (
            <button className="btn btn-danger btn-sm" type="button" onClick={handleDelete} disabled={save.isPending || deactivate.isPending}>
              {deactivate.isPending ? "Excluindo…" : "Excluir cartão"}
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} disabled={save.isPending || deactivate.isPending}>Cancelar</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={submit} disabled={save.isPending || deactivate.isPending}>
            {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar cartão"}
          </button>
        </div>
      </div>
    </div>
  );
}
