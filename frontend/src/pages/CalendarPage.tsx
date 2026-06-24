import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCalendarEvent,
  getCalendarEvents,
  getCreditCards,
  getCreditCardInstallments,
  getDataQuality,
  getRecurringExpenses,
  getTransactions,
  getWeekdaySpending,
} from "../lib/api";
import {
  apiErrorMessage,
  buildCalendarEvents,
  compactMoneyAbs,
  isoDate,
  money,
  moneyAbs,
  withQueryParams,
} from "../lib/utils";
import { CalendarDays } from "lucide-react";
import { NoDataOnboarding } from "../components/ui";
import { useCategories, useHasTransactions, usePeriod } from "../hooks";
import type { ApiSession } from "../lib/api";
import type { CalendarEvent, PeriodState, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// Local SVG icon system
// ---------------------------------------------------------------------------

const CAL_ICONS: Record<string, string> = {
  calendar: "M3 5h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M16 3v4 M8 3v4 M3 10h18",
  plus:     "M12 5v14 M5 12h14",
  check:    "M5 12l5 5 9-10",
  x:        "M18 6L6 18 M6 6l12 12",
  edit:     "M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:    "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  chevR:    "M9 18l6-6-6-6",
  chevL:    "M15 18l-6-6 6-6",
  clock:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2",
  alert:    "M12 9v4 M12 17h.01 M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z",
  wallet:   "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  info:     "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  repeat:   "M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3",
  card:     "M2 6h20v12H2z M2 10h20",
  shield:   "M12 2l7 4v5c0 4.42-2.99 8.57-7 9.93C7.99 19.57 5 15.42 5 11V6z",
  gauge:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12l4-3",
  arrowDown:"M12 5v14 M5 12l7 7 7-7",
  spin:     "M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83",
};

function CalIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = CAL_ICONS[name];
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

function nextDayOfMonth(day: number): Date {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), day);
  if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}


function nextOccurrenceLabel(lastDate: string): string {
  const d = new Date(lastDate + "T00:00:00");
  return `Todo dia ${d.getDate()}`;
}

// Stable color per event kind/category, so calendar chips look category-colored.
const KIND_PALETTE = [
  "#3567b8", "#1f8a5b", "#6a52c9", "#c98a2b", "#cf4d43",
  "#d98234", "#2a9d8f", "#9a6b14", "#7c8696", "#a35a7d", "#3d7d63", "#5a7dc9",
];
function kindColor(kind: string): string {
  const h = kind.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return KIND_PALETTE[h % KIND_PALETTE.length];
}
function signedCompact(amount: string | number): string {
  const n = Number(amount);
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return sign + compactMoneyAbs(amount);
}

type CalendarFilter = "all" | "saidas" | "entradas" | "parcelas" | "recorrencias";

function filterEvents(events: CalendarEvent[], filter: CalendarFilter): CalendarEvent[] {
  if (filter === "all") return events;
  if (filter === "saidas") return events.filter((e) => Number(e.amount) < 0);
  if (filter === "entradas") return events.filter((e) => Number(e.amount) > 0);
  if (filter === "parcelas") return events.filter((e) => e.kind.toLowerCase().includes("parcela"));
  if (filter === "recorrencias") return events.filter((e) => e.kind.toLowerCase().includes("recorr"));
  return events;
}

// ---------------------------------------------------------------------------
// Tone → badge class mapping
// ---------------------------------------------------------------------------
function toneToEvtClass(tone: string): string {
  if (tone === "positive") return "b-real";
  if (tone === "negative") return "b-neg";
  if (tone === "warning") return "b-warn";
  return "b-info";
}

// ---------------------------------------------------------------------------
// Spinning loader (inline, no Lucide)
// ---------------------------------------------------------------------------
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      style={{ flex: "none", animation: "spin 1s linear infinite" }}
    >
      <path d="M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CalendarMonthGrid
// ---------------------------------------------------------------------------

function CalendarMonthGrid({
  events,
  allEvents,
  dateFrom,
  loading,
  onEventClick,
  onDayClick,
}: {
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: string) => void;
}) {
  const parts = dateFrom.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month) return null;

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay();
  const cells: Array<number | null> = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const allByDate = new Map<string, CalendarEvent[]>();
  for (const event of allEvents) {
    const arr = allByDate.get(event.date) ?? [];
    arr.push(event);
    allByDate.set(event.date, arr);
  }

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const arr = eventsByDate.get(event.date) ?? [];
    arr.push(event);
    eventsByDate.set(event.date, arr);
  }

  const today = isoDate(new Date());
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

  if (loading) {
    return (
      <div className="state" style={{ minHeight: 240 }}>
        <div className="state-ic"><Spinner size={22} /></div>
        <h4>Carregando calendário</h4>
        <p>Organizando compromissos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Weekday headers */}
      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {weekdays.map((d) => (
          <div className="cal-dow" key={d}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="cal-grid">
        {cells.map((day, idx) => {
          if (!day) return <div className="cal-cell empty" key={`empty-${idx}`} />;
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const dateKey = `${year}-${mm}-${dd}`;
          const allDayEvents = allByDate.get(dateKey) ?? [];
          // Real (imported) transactions first, then forecast — so the 2 visible
          // chips favour the actual movements over the projections.
          const dayEvents = [...(eventsByDate.get(dateKey) ?? [])]
            .sort((a, b) => Number(a.forecast ?? false) - Number(b.forecast ?? false));
          const visible = dayEvents.slice(0, 2);
          const hidden = dayEvents.length - visible.length;
          const isToday = dateKey === today;

          const totalNet = allDayEvents.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
          const hasCrit = allDayEvents.some((e) => e.tone === "warning" || e.tone === "negative");

          return (
            <div
              className={`cal-cell${isToday ? " today" : ""}${hasCrit && !isToday ? " crit" : ""}`}
              key={dateKey}
              onClick={() => onDayClick(dateKey)}
              title="Ver lançamentos do dia"
            >
              <div className="cal-cell-head">
                <span className="cal-day">{day}</span>
                {allDayEvents.length > 0 && (
                  <span className={`cal-count${hasCrit ? " crit" : ""}`}>
                    {allDayEvents.length}
                  </span>
                )}
              </div>
              <div className="cal-evts">
                {visible.map((ev, i) => {
                  const catLabel = ev.category ?? ev.kind;
                  // Colour by tone, matching the legend (Entrada/Saída/Atenção/Previsto).
                  const bg = ev.tone === "positive" ? "var(--pos-soft)" : ev.tone === "negative" ? "var(--neg-soft)" : ev.tone === "warning" ? "var(--warn-soft)" : "var(--info-soft)";
                  const fg = ev.tone === "positive" ? "var(--pos)" : ev.tone === "negative" ? "var(--neg)" : ev.tone === "warning" ? "var(--warn)" : "var(--info)";
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`cal-evt`}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      title={`${ev.label} — ${catLabel} — ${moneyAbs(ev.amount)}`}
                      style={{ background: bg, color: fg, borderLeft: `2px solid ${fg}` }}
                    >
                      <span className="cal-evt-cat">{catLabel}</span>
                      <span className="cal-evt-val">{signedCompact(ev.amount)}</span>
                    </button>
                  );
                })}
              </div>
              {hidden > 0 && (
                <button
                  type="button"
                  className="cal-more"
                  style={{ cursor: "pointer", textAlign: "left", background: "none", border: "none" }}
                  onClick={(e) => { e.stopPropagation(); onDayClick(dateKey); }}
                >
                  +{hidden} mais
                </button>
              )}
              {allDayEvents.length > 0 && (
                <div className="cal-total">
                  <span style={{ color: "var(--ink-faint)", fontSize: 9 }}>total</span>
                  <span style={{ color: totalNet >= 0 ? "var(--pos)" : "var(--neg)" }}>
                    {compactMoneyAbs(totalNet)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CalendarPage({
  onOpenImports,
  onOpenTransactions,
  period: calendarPeriod,
  session,
  setPeriod: setCalendarPeriod,
}: {
  onOpenImports?: () => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  period: PeriodState;
  session: ApiSession;
  setPeriod: Dispatch<SetStateAction<PeriodState>>;
}) {
  const hasTransactions = useHasTransactions(session);
  const [showEventModal, setShowEventModal] = useState(false);
  const [calFilter, setCalFilter] = useState<CalendarFilter>("all");
  const [eventForm, setEventForm] = useState(() => ({
    amount: "",
    dueDate: isoDate(new Date()),
    eventType: "expense",
    recurrence: "none",
    title: "",
  }));
  const queryClient = useQueryClient();
  const period = usePeriod(calendarPeriod, setCalendarPeriod);

  const createEvent = useMutation({
    mutationFn: () =>
      createCalendarEvent(session, {
        amount: eventForm.amount || null,
        due_date: eventForm.dueDate,
        event_type: eventForm.eventType,
        recurrence: eventForm.recurrence,
        title: eventForm.title,
      }),
    onSuccess: () => {
      setEventForm((current) => ({ ...current, amount: "", title: "" }));
      setShowEventModal(false);
      void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });

  const persistedEvents = useQuery({
    queryKey: ["calendar-events", session.token, period.query],
    queryFn: () => getCalendarEvents(session, period.query),
  });
  const recurring = useQuery({
    queryKey: ["calendar-recurring", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "50", min_months: "2" })),
  });
  const installments = useQuery({
    queryKey: ["calendar-installments", session.token, period.dateTo],
    queryFn: () =>
      getCreditCardInstallments(
        session,
        period.dateTo
          ? withQueryParams("", { date_to: period.dateTo, limit: "8" })
          : withQueryParams("", { limit: "8" }),
      ),
  });
  const recentTransactions = useQuery({
    queryKey: ["calendar-recent-transactions", session.token, period.query],
    // The list endpoint caps limit at 100, so limit=500 used to 422 and the calendar
    // showed no real transactions (only forecasts). Page through at 100/request and
    // merge so every day's movements appear.
    queryFn: async () => {
      const base = { sort_by: "transaction_date", sort_dir: "desc", limit: "100" };
      const first = await getTransactions(session, withQueryParams(period.query, { ...base, offset: "0" }));
      const items = [...first.items];
      let offset = 100;
      while (items.length < (first.total ?? items.length) && offset < 1000) {
        const page = await getTransactions(session, withQueryParams(period.query, { ...base, offset: String(offset) }));
        if (page.items.length === 0) break;
        items.push(...page.items);
        offset += 100;
      }
      return { ...first, items };
    },
  });
  const categories = useCategories(session);
  const weekday = useQuery({
    queryKey: ["calendar-weekday", session.token, period.query],
    queryFn: () => getWeekdaySpending(session, period.query),
  });
  const creditCards = useQuery({
    queryKey: ["credit-cards", session.token],
    queryFn: () => getCreditCards(session),
    staleTime: 5 * 60 * 1000,
  });
  const dataQuality = useQuery({
    queryKey: ["calendar-data-quality", session.token, period.query],
    queryFn: () => getDataQuality(session, period.query),
  });

  const calendarEvents = useMemo(() => buildCalendarEvents({
    apiEvents: persistedEvents.data?.items,
    categories: categories.data?.items ?? [],
    installments: installments.data?.items ?? [],
    recurring: recurring.data?.items ?? [],
    transactions: recentTransactions.data?.items ?? [],
  }), [categories.data?.items, installments.data?.items, persistedEvents.data?.items, recurring.data?.items, recentTransactions.data?.items]);

  // "Previsto" (forecast) only applies to the future: once a day has passed it
  // shows only the real (imported) transactions, not the projections.
  const visibleEvents = useMemo(() => {
    const today = isoDate(new Date());
    return calendarEvents.filter((e) => !e.forecast || e.date >= today);
  }, [calendarEvents]);

  const filteredEvents = useMemo(() => filterEvents(visibleEvents, calFilter), [visibleEvents, calFilter]);

  const upcomingEvents = useMemo(() => {
    const today = isoDate(new Date());
    const limit = isoDate(new Date(Date.now() + 30 * 86400000));
    return visibleEvents
      .filter((e) => !e.recurring && e.date >= today && e.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [visibleEvents]);

  const projectedInflow = useMemo(() =>
    filteredEvents.filter((e) => Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0),
    [filteredEvents]);
  const projectedOutflow = useMemo(() =>
    filteredEvents.filter((e) => Number(e.amount) < 0).reduce((s, e) => s + Math.abs(Number(e.amount)), 0),
    [filteredEvents]);
  const calendarTotal = useMemo(() =>
    filteredEvents.reduce((s, e) => s + Number(e.amount ?? 0), 0), [filteredEvents]);

  // ── Aggregates for the KPI strip + side panels (respect the active filter) ──
  const outCount = useMemo(() => filteredEvents.filter((e) => Number(e.amount) < 0).length, [filteredEvents]);
  const inCount = useMemo(() => filteredEvents.filter((e) => Number(e.amount) > 0).length, [filteredEvents]);
  // The grid needs a single month. When the period has no specific month (e.g.
  // "Todos"/personalizado leaves dateFrom empty) fall back to the current month so
  // the calendar still renders instead of going blank.
  const gridMonthFrom = useMemo(() => {
    const p = period.dateFrom.split("-").map(Number);
    if (p[0] && p[1]) return period.dateFrom;
    const now = new Date();
    return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [period.dateFrom]);
  const monthParts = gridMonthFrom.split("-").map(Number);
  const daysInMonth = monthParts[0] && monthParts[1] ? new Date(monthParts[0], monthParts[1], 0).getDate() : 30;
  const daysWith = useMemo(() => new Set(filteredEvents.map((e) => e.date)).size, [filteredEvents]);
  const heaviest = useMemo(() => {
    const net = new Map<string, number>();
    for (const e of filteredEvents) net.set(e.date, (net.get(e.date) ?? 0) + Number(e.amount ?? 0));
    let best = { date: "", net: 0 };
    for (const [date, value] of net) if (value < best.net) best = { date, net: value };
    return best;
  }, [filteredEvents]);
  // Outflows grouped by real category for the distribution panel.
  const catDist = useMemo(() => {
    const map = new Map<string, { value: number; color: string | null }>();
    for (const e of filteredEvents) {
      if (Number(e.amount) >= 0) continue;
      const name = e.category ?? "Sem categoria";
      const cur = map.get(name) ?? { value: 0, color: e.categoryColor ?? null };
      cur.value += Math.abs(Number(e.amount));
      if (!cur.color && e.categoryColor) cur.color = e.categoryColor;
      map.set(name, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEvents]);
  const catDistTotal = catDist.reduce((s, d) => s + d.value, 0) || 1;
  // Days with the most negative net — risk of a tight balance.
  const criticalDays = useMemo(() => {
    const byDate = new Map<string, { net: number; count: number; label: string; worst: number }>();
    for (const e of filteredEvents) {
      const amt = Number(e.amount ?? 0);
      const cur = byDate.get(e.date) ?? { net: 0, count: 0, label: e.label, worst: 0 };
      cur.net += amt;
      cur.count += 1;
      if (amt < cur.worst) { cur.worst = amt; cur.label = e.label; }
      byDate.set(e.date, cur);
    }
    return [...byDate.entries()]
      .filter(([, v]) => v.net < 0)
      .sort((a, b) => a[1].net - b[1].net)
      .map(([date, v]) => ({ date, ...v }));
  }, [filteredEvents]);

  // Inflows grouped by category, for the "Entradas" card.
  const incomeDist = useMemo(() => {
    const map = new Map<string, { value: number; color: string | null }>();
    for (const e of filteredEvents) {
      if (Number(e.amount) <= 0) continue;
      const name = e.category ?? e.kind;
      const cur = map.get(name) ?? { value: 0, color: e.categoryColor ?? null };
      cur.value += Number(e.amount);
      if (!cur.color && e.categoryColor) cur.color = e.categoryColor;
      map.set(name, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEvents]);
  const incomeDistTotal = incomeDist.reduce((s, d) => s + d.value, 0) || 1;
  const heaviestLabel = heaviest.date
    ? (() => { const d = new Date(heaviest.date + "T00:00:00"); return `${d.getDate()}/${d.toLocaleString("pt-BR", { month: "short" }).replace(".", "")}`; })()
    : "—";

  // Weekday spending averages (for the "Média por dia da semana" card).
  const weekdayData = useMemo(() => {
    const items = (weekday.data?.items ?? [])
      .slice()
      .sort((a, b) => a.weekday - b.weekday)
      .map((w) => ({ weekday: w.weekday, label: w.weekday_name.slice(0, 3), avg: Number(w.average_amount ?? 0) }));
    const max = Math.max(1, ...items.map((w) => w.avg));
    const withData = items.filter((w) => w.avg > 0);
    const best = withData.length ? withData.reduce((a, b) => (b.avg < a.avg ? b : a)) : undefined;
    const worst = items.length ? items.reduce((a, b) => (b.avg > a.avg ? b : a)) : undefined;
    const avgAll = items.length ? items.reduce((s, w) => s + w.avg, 0) / items.length : 0;
    return { items, max, best, worst, avgAll };
  }, [weekday.data]);

  const instData = installments.data;
  const closingDate = instData?.closing_day ? nextDayOfMonth(instData.closing_day) : null;
  const dueDate = instData?.due_day ? nextDayOfMonth(instData.due_day) : null;

  const sortedRecurring = useMemo(() => {
    // Detection runs over 12 months, but only "active" recurrences matter: those
    // with an occurrence close to the period end. This drops installments that
    // finished a while ago (their last charge is old) and other stale patterns.
    const ref = period.dateTo ? new Date(period.dateTo + "T00:00:00") : new Date();
    const cutoff = new Date(ref);
    cutoff.setDate(cutoff.getDate() - 45);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return (recurring.data?.items ?? [])
      .filter((r) => (r.last_transaction_date ?? "") >= cutoffIso)
      .slice()
      .sort((a, b) => Math.abs(Number(b.last_amount)) - Math.abs(Number(a.last_amount)))
      .slice(0, 50);
  }, [recurring.data?.items, period.dateTo]);

  const isLoading = persistedEvents.isLoading || recurring.isLoading || installments.isLoading;

  const calFilterTabs: { key: CalendarFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "saidas", label: "Saídas" },
    { key: "entradas", label: "Entradas" },
    { key: "parcelas", label: "Parcelas" },
    { key: "recorrencias", label: "Recorrências" },
  ];

  const drilldown = (event: CalendarEvent) =>
    onOpenTransactions({
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      direction: event.direction,
      label: event.label,
      periodPreset: period.periodPreset,
      search: event.search,
    });

  if (hasTransactions === false) {
    return (
      <NoDataOnboarding
        icon={CalendarDays}
        eyebrow="Calendário"
        title="Seu calendário financeiro aparece aqui"
        description="Compromissos, parcelas de cartão e recorrências são montados a partir dos seus extratos e lançamentos. Importe o primeiro arquivo para preencher o calendário."
        onImport={onOpenImports}
      />
    );
  }

  return (
    <div className="canvas stg">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-.4px", lineHeight: 1.1 }}>
            Calendário Financeiro
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            Compromissos, parcelas e recorrências do período
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowEventModal(true)}
          type="button"
        >
          <CalIcon name="plus" size={14} /> Novo compromisso
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="cal-strip" style={{ marginBottom: 16 }}>
        <div className="cal-strip-cell">
          <span className="cs-lab">A pagar</span>
          <span className="cs-val neg">− {moneyAbs(projectedOutflow)}</span>
          <span className="cs-sub">{outCount} lançamento{outCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="cal-strip-cell">
          <span className="cs-lab">A receber</span>
          <span className="cs-val pos">+ {moneyAbs(projectedInflow)}</span>
          <span className="cs-sub">{inCount} entrada{inCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="cal-strip-cell">
          <span className="cs-lab">Dias com lançamento</span>
          <span className="cs-val">{daysWith} / {daysInMonth}</span>
          <span className="cs-sub">no mês</span>
        </div>
        <div className="cal-strip-cell warn">
          <span className="cs-lab">Dia mais pesado</span>
          <span className="cs-val">{heaviestLabel}</span>
          <span className="cs-sub">− {moneyAbs(Math.abs(heaviest.net))}</span>
        </div>
      </div>

      {/* ── Filtros + legenda (acima do calendário) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {calFilterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`chip${calFilter === tab.key ? " on" : ""}`}
            onClick={() => setCalFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span className="legend-item"><span className="sdot paid" /> Entrada</span>
          <span className="legend-item"><span className="sdot late" /> Saída</span>
          <span className="legend-item"><span className="sdot est" /> Atenção</span>
          <span className="legend-item"><span className="sdot pred" /> Previsto</span>
        </div>
      </div>

      {/* ── Calendário (largura total) ── */}
      <div style={{ marginBottom: 16 }}>

        {/* Calendário */}
        <div className="card card-pad">
          <CalendarMonthGrid
            events={filteredEvents}
            allEvents={filteredEvents}
            dateFrom={gridMonthFrom}
            dateTo={period.dateTo}
            loading={isLoading}
            onEventClick={drilldown}
            onDayClick={(date) => onOpenTransactions({ dateFrom: date, dateTo: date, periodPreset: "custom", label: `Dia ${date.slice(8, 10)}/${date.slice(5, 7)}` })}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 14, fontSize: 12.5, color: "var(--ink-3)" }}>
            Total {calFilter !== "all" ? `· ${calFilterTabs.find((t) => t.key === calFilter)?.label}` : ""}
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: calendarTotal >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
              {money(calendarTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Cards abaixo do calendário — ordem visual via flex (order): Temporal → Trio → Próximos ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>

      {/* Próximos · Dias críticos · Pendências */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, order: 3, alignItems: "stretch" }}>

        {/* Próximos compromissos */}
        <div className="card" style={{ minHeight: 0 }}>
          <div className="card-head">
            <div className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
              <CalIcon name="clock" size={15} />
            </div>
            <div>
              <div className="ttl">Próximos</div>
              <div className="sub">30 dias</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: "10px 14px" }}>
            {isLoading ? (
              <div className="state" style={{ padding: "28px 16px" }}>
                <div className="state-ic"><Spinner size={20} /></div>
                <p>Carregando...</p>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="state" style={{ padding: "28px 16px" }}>
                <div className="state-ic"><CalIcon name="calendar" size={22} /></div>
                <h4>Sem compromissos</h4>
                <p>Nenhum compromisso nos próximos 30 dias.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowEventModal(true)} type="button">
                  <CalIcon name="plus" size={13} /> Criar
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {upcomingEvents.slice(0, 5).map((event) => {
                  const d = new Date(event.date + "T00:00:00");
                  const dayNum = d.getDate();
                  const monthStr = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
                  return (
                    <button
                      className="row-item"
                      key={`${event.kind}-${event.label}-${event.date}`}
                      onClick={() => drilldown(event)}
                      type="button"
                      style={{ padding: "7px 8px", borderRadius: 9, width: "100%", textAlign: "left" }}
                    >
                      <div className="date-chip">
                        <div className="d">{dayNum}</div>
                        <div className="m">{monthStr}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {event.label}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          {event.category ?? event.kind}{event.detail ? ` · ${event.detail}` : ""}
                        </div>
                      </div>
                      <span className={`badge ${toneToEvtClass(event.tone)}`}>
                        {moneyAbs(event.amount)}
                      </span>
                    </button>
                  );
                })}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset })}
                  type="button"
                  style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                >
                  {upcomingEvents.length > 5 ? `Ver todos (+${upcomingEvents.length - 5})` : "Ver todos"} <CalIcon name="chevR" size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

          {/* Dias críticos */}
          <div className="card" style={{ minHeight: 0 }}>
            <div className="card-head">
              <div className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                <CalIcon name="alert" size={15} />
              </div>
              <div>
                <div className="ttl">Dias críticos</div>
                <div className="sub">Risco de saldo apertado</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: "6px 8px" }}>
              {criticalDays.length === 0 ? (
                <div style={{ padding: "20px 16px", fontSize: 12.5, color: "var(--ink-3)", textAlign: "center" }}>
                  Nenhum dia crítico no período.
                </div>
              ) : (
                <>
                  {criticalDays.slice(0, 5).map((cd) => {
                    const d = new Date(cd.date + "T00:00:00");
                    return (
                      <div className="row-item" key={cd.date} style={{ padding: "7px 8px" }}>
                        <div className="date-chip" style={{ background: "var(--warn-soft)" }}>
                          <span className="d">{d.getDate()}</span>
                          <span className="m">{d.toLocaleString("pt-BR", { month: "short" }).replace(".", "")}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {cd.label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                            {cd.count} lançamento{cd.count !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--neg)", fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                          {moneyAbs(cd.net)}
                        </span>
                      </div>
                    );
                  })}
                  {criticalDays.length > 5 && (
                    <div style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--ink-3)" }}>+{criticalDays.length - 5} dia{criticalDays.length - 5 !== 1 ? "s" : ""}</div>
                  )}
                  <div style={{ padding: "10px 12px 4px", borderTop: "1px solid var(--line)", marginTop: 4, display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="eyebrow">Maior saída no período</span>
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--warn)" }}>
                      {moneyAbs(Math.abs(heaviest.net))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Pendências */}
          <div className="card" style={{ minHeight: 0 }}>
            <div className="card-head">
              <div className="kpi-ic" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
                <CalIcon name="alert" size={15} />
              </div>
              <div>
                <div className="ttl">Pendências</div>
                <div className="sub">A resolver no período</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: "10px 14px" }}>
              {dataQuality.isLoading ? (
                <div className="state" style={{ padding: "24px 16px" }}><div className="state-ic"><Spinner size={20} /></div><p>Carregando...</p></div>
              ) : (dataQuality.data?.uncategorized_count ?? 0) + (dataQuality.data?.duplicate_imports ?? 0) + (dataQuality.data?.imports_with_errors ?? 0) === 0 ? (
                <div className="state" style={{ padding: "24px 16px" }}>
                  <div className="state-ic"><CalIcon name="check" size={22} /></div>
                  <h4>Tudo em dia</h4>
                  <p>Sem pendências no período.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button className="row-item" type="button" disabled={(dataQuality.data?.uncategorized_count ?? 0) === 0}
                    onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset, label: "Não categorizadas" })}
                    style={{ padding: "9px 8px", borderRadius: 9, width: "100%", textAlign: "left", opacity: (dataQuality.data?.uncategorized_count ?? 0) === 0 ? 0.5 : 1 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Não categorizadas</div>
                    <span className="badge b-warn">{dataQuality.data?.uncategorized_count ?? 0}</span>
                  </button>
                  <button className="row-item" type="button" disabled={!onOpenImports || (dataQuality.data?.duplicate_imports ?? 0) === 0}
                    onClick={() => onOpenImports?.()}
                    style={{ padding: "9px 8px", borderRadius: 9, width: "100%", textAlign: "left", opacity: (dataQuality.data?.duplicate_imports ?? 0) === 0 ? 0.5 : 1 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Possíveis duplicados</div>
                    <span className="badge b-info">{dataQuality.data?.duplicate_imports ?? 0}</span>
                  </button>
                  <button className="row-item" type="button" disabled={!onOpenImports || (dataQuality.data?.imports_with_errors ?? 0) === 0}
                    onClick={() => onOpenImports?.()}
                    style={{ padding: "9px 8px", borderRadius: 9, width: "100%", textAlign: "left", opacity: (dataQuality.data?.imports_with_errors ?? 0) === 0 ? 0.5 : 1 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Importações com erro</div>
                    <span className="badge b-neg">{dataQuality.data?.imports_with_errors ?? 0}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* ── Trio: Média semanal · Recorrências · Faturas ── */}
      <div className="cal-trio" style={{ order: 2 }}>

        {/* Saídas por categoria */}
        <div className="card card-pad cal-trio-card">
          <div className="cal-trio-head">
            <div>
              <div className="eyebrow">Saídas</div>
              <div className="cal-trio-title">Saídas por categoria</div>
            </div>
            <span className="badge b-neg">{outCount}</span>
          </div>
          <div className="cal-trio-hero">
            <span className="cth-lab">Total de saídas</span>
            <span className="cth-val" style={{ color: "var(--neg)" }}>{moneyAbs(projectedOutflow)}</span>
            <span className="cth-sub">{outCount} lançamento{outCount !== 1 ? "s" : ""}</span>
          </div>
          {catDist.length === 0 ? (
            <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--ink-3)" }}>Sem saídas no período.</div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {catDist.slice(0, 5).map((d) => {
                const c = d.color ?? kindColor(d.name);
                const pct = (d.value / catDistTotal) * 100;
                return (
                  <div key={d.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flex: "none" }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                      </span>
                      <strong style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{moneyAbs(d.value)}</strong>
                    </div>
                    <div className="track thin"><div className="fill" style={{ width: `${pct}%`, background: c }} /></div>
                    <div className="t-sub mono" style={{ marginTop: 3, fontSize: 11, color: "var(--ink-3)" }}>
                      {pct.toFixed(1).replace(".", ",")}% de saída
                    </div>
                  </div>
                );
              })}
              {catDist.length > 5 && (
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>+{catDist.length - 5} categoria{catDist.length - 5 !== 1 ? "s" : ""}</div>
              )}
            </div>
          )}
        </div>

        {/* Recorrências */}
        <div className="card card-pad cal-trio-card">
          <div className="cal-trio-head">
            <div>
              <div className="eyebrow">Recorrentes</div>
              <div className="cal-trio-title">Recorrências</div>
            </div>
            <span className="badge b-info">{sortedRecurring.length} ativas</span>
          </div>
          <div className="cal-trio-hero">
            <span className="cth-lab">Total mensal</span>
            <span className="cth-val">{moneyAbs(sortedRecurring.reduce((s, r) => s + Math.abs(Number(r.last_amount ?? 0)), 0))}</span>
            <span className="cth-sub">
              soma de {sortedRecurring.length} recorrência{sortedRecurring.length !== 1 ? "s" : ""}
              {sortedRecurring.length > 5 ? " · 5 maiores abaixo" : ""}
            </span>
          </div>
          <div className="sub-list">
            {sortedRecurring.slice(0, 5).map((r) => {
              const c = kindColor(r.description);
              return (
                <div
                  className="sub-row"
                  key={r.description}
                  style={{ cursor: "pointer" }}
                  title={`Ver lançamentos de "${r.description}"`}
                  onClick={() => onOpenTransactions({ search: r.description, dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset, label: r.description })}
                >
                  <span className="sub-logo" style={{ background: c + "22", color: c, border: `1px solid ${c}55` }}>{r.description.charAt(0).toUpperCase()}</span>
                  <div className="sub-meta">
                    <span className="sub-name">{r.description}</span>
                    <span className="sub-due">{r.category_name ?? (r.last_transaction_date ? nextOccurrenceLabel(r.last_transaction_date) : "recorrente")}</span>
                  </div>
                  <span className="sub-val mono">{moneyAbs(r.last_amount)}</span>
                </div>
              );
            })}
            {sortedRecurring.length > 5 && (
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", padding: "4px 2px" }}>+{sortedRecurring.length - 5} recorrência{sortedRecurring.length - 5 !== 1 ? "s" : ""}</div>
            )}
          </div>
        </div>

        {/* Faturas */}
        <div className="card card-pad cal-trio-card">
          <div className="cal-trio-head">
            <div>
              <div className="eyebrow">Cartões</div>
              <div className="cal-trio-title">Faturas</div>
            </div>
            <span className="badge b-warn">{(creditCards.data?.items ?? []).length || (instData?.active_count ? 1 : 0)} cartões</span>
          </div>
          <div className="cal-trio-hero">
            <span className="cth-lab">Total em faturas</span>
            <span className="cth-val">{moneyAbs(instData?.total_future_amount)}</span>
            <span className="cth-sub">{instData?.active_count ?? 0} parcela{(instData?.active_count ?? 0) !== 1 ? "s" : ""} ativa{(instData?.active_count ?? 0) !== 1 ? "s" : ""}</span>
          </div>
          <div className="sub-list">
            {(creditCards.data?.items ?? []).length > 0 ? (
              <>
                {(creditCards.data?.items ?? []).slice(0, 4).map((card) => {
                  const dleft = daysUntil(nextDayOfMonth(card.due_day));
                  const c = kindColor(card.name);
                  const dueClass = dleft <= 7 ? "b-neg" : dleft <= 15 ? "b-warn" : "b-info";
                  return (
                    <div className="sub-row" key={card.id}>
                      <span className="sub-logo" style={{ background: c + "22", color: c, border: `1px solid ${c}55` }}>{card.name.charAt(0).toUpperCase()}</span>
                      <div className="sub-meta">
                        <span className="sub-name">{card.name}</span>
                        <span className="sub-due">vence dia {card.due_day} · <span className={`badge ${dueClass}`} style={{ fontSize: 9.5, padding: "1px 6px" }}>{dleft} dias</span></span>
                      </div>
                      <span className="sub-val mono">{card.brand ?? card.last_four ?? ""}</span>
                    </div>
                  );
                })}
                {(creditCards.data?.items ?? []).length > 4 && (
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", padding: "4px 2px" }}>+{(creditCards.data?.items ?? []).length - 4} cartão(ões)</div>
                )}
              </>
            ) : closingDate && dueDate ? (
              <div className="sub-row">
                <span className="sub-logo" style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--warn)" }}>C</span>
                <div className="sub-meta">
                  <span className="sub-name">Cartão de Crédito</span>
                  <span className="sub-due">vence em {daysUntil(dueDate)} dias · fecha em {daysUntil(closingDate)} dias</span>
                </div>
                <span className="sub-val mono">{moneyAbs(instData?.total_future_amount)}</span>
              </div>
            ) : (
              <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--ink-3)" }}>Sem cartões cadastrados.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Média por dia da semana + Entradas (Visão temporal, no topo via order) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, order: 1 }}>

        {/* Média por dia da semana */}
        <div className="card card-pad cal-trio-card">
          <div className="cal-trio-head">
            <div>
              <div className="eyebrow">Visão temporal</div>
              <div className="cal-trio-title">Média por dia da semana</div>
            </div>
          </div>
          {weekdayData.items.length === 0 ? (
            <div style={{ padding: "24px 0", fontSize: 12.5, color: "var(--ink-3)" }}>Sem dados no período.</div>
          ) : (
            <>
              <div className="wdbars" style={{ marginTop: 14, marginBottom: 14 }}>
                {weekdayData.items.map((w) => (
                  <div
                    key={w.weekday}
                    className={"wdbar" + (w.weekday === weekdayData.worst?.weekday ? " top" : "") + (w.weekday === weekdayData.best?.weekday ? " low" : "")}
                  >
                    <div className="wdbar-val mono">{moneyAbs(w.avg)}</div>
                    <div className="wdbar-track"><div className="wdbar-fill" style={{ height: `${(w.avg / weekdayData.max) * 100}%` }} /></div>
                    <div className="wdbar-lab">{w.label}</div>
                  </div>
                ))}
              </div>
              <div className="cal-trio-stats">
                <div className="cts-cell">
                  <span className="cts-lab">Melhor dia</span>
                  <span className="cts-val pos">{weekdayData.best?.label ?? "—"}</span>
                  <span className="cts-sub">{moneyAbs(weekdayData.best?.avg ?? 0)}/dia</span>
                </div>
                <div className="cts-cell">
                  <span className="cts-lab">Pior dia</span>
                  <span className="cts-val neg">{weekdayData.worst?.label ?? "—"}</span>
                  <span className="cts-sub">{moneyAbs(weekdayData.worst?.avg ?? 0)}/dia</span>
                </div>
                <div className="cts-cell">
                  <span className="cts-lab">Média diária</span>
                  <span className="cts-val">{moneyAbs(weekdayData.avgAll)}</span>
                  <span className="cts-sub">no período</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Entradas por categoria */}
        <div className="card card-pad cal-trio-card">
          <div className="cal-trio-head">
            <div>
              <div className="eyebrow">Entradas</div>
              <div className="cal-trio-title">Entradas por categoria</div>
            </div>
            <span className="badge b-real">{inCount}</span>
          </div>
          <div className="cal-trio-hero">
            <span className="cth-lab">Total de entradas</span>
            <span className="cth-val" style={{ color: "var(--pos)" }}>{moneyAbs(projectedInflow)}</span>
            <span className="cth-sub">{inCount} entrada{inCount !== 1 ? "s" : ""} no período</span>
          </div>
          {incomeDist.length === 0 ? (
            <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--ink-3)" }}>Sem entradas no período.</div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {incomeDist.slice(0, 3).map((d) => {
                const c = d.color ?? "var(--pos)";
                const pct = (d.value / incomeDistTotal) * 100;
                return (
                  <div key={d.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flex: "none" }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                      </span>
                      <strong style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--pos)" }}>{moneyAbs(d.value)}</strong>
                    </div>
                    <div className="track thin"><div className="fill" style={{ width: `${pct}%`, background: c }} /></div>
                    <div className="t-sub mono" style={{ marginTop: 3, fontSize: 11, color: "var(--ink-3)" }}>
                      {pct.toFixed(1).replace(".", ",")}% do total
                    </div>
                  </div>
                );
              })}
              {incomeDist.length > 3 && (
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>+{incomeDist.length - 3} entrada{incomeDist.length - 3 !== 1 ? "s" : ""}</div>
              )}
            </div>
          )}
          <button
            className="cal-trio-cta"
            type="button"
            onClick={() => onOpenTransactions({ direction: "credit", dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset, label: "Entradas" })}
          >
            Ver entradas <CalIcon name="chevR" size={13} />
          </button>
        </div>
      </div>
      </div>

      {/* ── Modal: Novo compromisso ── */}
      {showEventModal && (
        <div className="mdl-backdrop" onClick={() => setShowEventModal(false)}>
          <div className="mdl" onClick={(e) => e.stopPropagation()}>
            <div className="mdl-head">
              <div className="mh-ic">
                <CalIcon name="calendar" size={17} />
              </div>
              <div>
                <div className="mh-ttl">Novo compromisso</div>
                <div className="mh-sub">Cadastre compromissos que ainda não aparecem nos extratos importados.</div>
              </div>
              <button
                className="btn btn-ghost btn-sm mh-close"
                onClick={() => setShowEventModal(false)}
                type="button"
                style={{ padding: "6px 8px" }}
              >
                <CalIcon name="x" size={15} />
              </button>
            </div>

            <div className="mdl-body">
              <form
                id="new-event-form"
                onSubmit={(e) => { e.preventDefault(); createEvent.mutate(); }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  <label className="fld" style={{ gridColumn: "1 / -1" }}>
                    <span className="fld-label">Título</span>
                    <input
                      className="fld-input"
                      required
                      placeholder="Ex: Aluguel, Netflix..."
                      value={eventForm.title}
                      onChange={(e) => setEventForm((c) => ({ ...c, title: e.target.value }))}
                    />
                  </label>
                  <label className="fld" style={{ marginRight: 7 }}>
                    <span className="fld-label">Data</span>
                    <input
                      className="fld-input"
                      required
                      type="date"
                      value={eventForm.dueDate}
                      onChange={(e) => setEventForm((c) => ({ ...c, dueDate: e.target.value }))}
                    />
                  </label>
                  <label className="fld" style={{ marginLeft: 7 }}>
                    <span className="fld-label">Valor</span>
                    <input
                      className="fld-input"
                      min="0"
                      step="0.01"
                      type="number"
                      placeholder="0,00"
                      value={eventForm.amount}
                      onChange={(e) => setEventForm((c) => ({ ...c, amount: e.target.value }))}
                    />
                  </label>
                  <label className="fld" style={{ marginRight: 7 }}>
                    <span className="fld-label">Tipo</span>
                    <select
                      className="fld-select"
                      value={eventForm.eventType}
                      onChange={(e) => setEventForm((c) => ({ ...c, eventType: e.target.value }))}
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                      <option value="card_payment">Fatura</option>
                      <option value="subscription">Assinatura</option>
                      <option value="goal">Meta</option>
                      <option value="other">Outro</option>
                    </select>
                  </label>
                  <label className="fld" style={{ marginLeft: 7 }}>
                    <span className="fld-label">Recorrência</span>
                    <select
                      className="fld-select"
                      value={eventForm.recurrence}
                      onChange={(e) => setEventForm((c) => ({ ...c, recurrence: e.target.value }))}
                    >
                      <option value="none">Sem recorrência</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </label>
                </div>

                {createEvent.isError && (
                  <div className="alert neg" style={{ marginTop: 8, marginBottom: 4 }}>
                    <div className="alert-ic"><CalIcon name="alert" size={17} /></div>
                    <div>
                      <div className="a-ttl">Erro ao criar evento</div>
                      <div className="a-txt">{apiErrorMessage(createEvent.error, "Falha ao criar evento.")}</div>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="mdl-foot">
              <span className="spacer" />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEventModal(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={createEvent.isPending}
                form="new-event-form"
                type="submit"
              >
                {createEvent.isPending ? <Spinner size={14} /> : <CalIcon name="plus" size={14} />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
