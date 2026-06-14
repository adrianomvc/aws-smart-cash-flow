import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  CalendarDays,
  CheckCircle,
  CreditCard,
  Gauge,
  Loader2,
  Plus,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  createCalendarEvent,
  getCalendarEvents,
  getCreditCardInstallments,
  getDashboardSummary,
  getRecurringExpenses,
  getTransactions,
} from "../lib/api";
import {
  apiErrorMessage,
  buildCalendarEvents,
  compactMoneyAbs,
  isoDate,
  money,
  moneyAbs,
  periodRange,
  withQueryParams,
} from "../lib/utils";
import { usePeriod } from "../hooks";
import {
  InlineError,
  MetricCard,
  PageState,
  PeriodFilter,
} from "../components/ui";
import type { ApiSession } from "../lib/api";
import type { CalendarEvent, PeriodState, TransactionDrilldown } from "../types";

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

function fmtShortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextOccurrenceLabel(lastDate: string): string {
  const d = new Date(lastDate + "T00:00:00");
  return `Todo dia ${d.getDate()}`;
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

type RiskInfo = { level: "low" | "medium" | "high"; label: string; tone: string; reason: string; recommendation: string };

function getRiskInfo(balance: number): RiskInfo {
  if (balance > 500) return {
    level: "low", label: "Baixo risco", tone: "positive",
    reason: "Saldo projetado positivo com margem confortável.",
    recommendation: "Boa saúde financeira para o período.",
  };
  if (balance >= 0) return {
    level: "medium", label: "Atenção",  tone: "warning",
    reason: "Saldo projetado próximo de zero.",
    recommendation: "Evite gastos extras este mês.",
  };
  return {
    level: "high", label: "Alto risco", tone: "negative",
    reason: "Saldo projetado negativo.",
    recommendation: "Revise despesas e priorize receitas urgentes.",
  };
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
}: {
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
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

  if (loading) return <PageState icon={Loader2} title="Carregando calendário" description="Organizando compromissos." spin compact />;

  return (
    <div className="calendar-month-grid-wrap">
      <div className="calendar-month-header">
        {weekdays.map((d) => <div className="calendar-month-weekday" key={d}>{d}</div>)}
      </div>
      <div className="calendar-month-grid">
        {cells.map((day, idx) => {
          if (!day) return <div className="calendar-month-cell empty" key={`empty-${idx}`} />;
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const dateKey = `${year}-${mm}-${dd}`;
          const allDayEvents = allByDate.get(dateKey) ?? [];
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const visible = dayEvents.slice(0, 2);
          const hidden = dayEvents.length - visible.length;
          const isToday = dateKey === today;

          const totalNet = allDayEvents.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
          let heatmapClass = "";
          if (allDayEvents.length > 0) {
            if (totalNet > 0) heatmapClass = " heatmap-income";
            else if (totalNet < -500) heatmapClass = " heatmap-high";
            else if (totalNet < -100) heatmapClass = " heatmap-medium";
          }

          return (
            <div className={`calendar-month-cell${isToday ? " today" : ""}${heatmapClass}`} key={dateKey}>
              <span className="calendar-day-number">{day}</span>
              {allDayEvents.length > 0 && (
                <span className={`calendar-day-total ${totalNet >= 0 ? "positive" : "negative"}`}>
                  {compactMoneyAbs(totalNet)}
                </span>
              )}
              {visible.map((ev, i) => (
                <button
                  className={`calendar-event-chip ${ev.tone}`}
                  key={i}
                  onClick={() => onEventClick(ev)}
                  title={`${ev.label} — ${moneyAbs(ev.amount)}`}
                  type="button"
                >
                  {ev.label}
                </button>
              ))}
              {hidden > 0 ? <span className="calendar-event-more">+{hidden}</span> : null}
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
  onOpenTransactions,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [calendarPeriod, setCalendarPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [showEventDrawer, setShowEventDrawer] = useState(false);
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
      setShowEventDrawer(false);
      void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });

  const summary = useQuery({
    queryKey: ["calendar-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedEvents = useQuery({
    queryKey: ["calendar-events", session.token, period.query],
    queryFn: () => getCalendarEvents(session, period.query),
  });
  const recurring = useQuery({
    queryKey: ["calendar-recurring", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "8", min_months: "2" })),
  });
  const installments = useQuery({
    queryKey: ["calendar-installments", session.token, period.dateTo],
    queryFn: () =>
      getCreditCardInstallments(
        session,
        period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" }),
      ),
  });
  const recentTransactions = useQuery({
    queryKey: ["calendar-recent-transactions", session.token, period.query],
    queryFn: () => getTransactions(session, withQueryParams(period.query, { limit: "6", sort_by: "transaction_date", sort_dir: "desc" })),
  });

  const calendarEvents = useMemo(() => buildCalendarEvents({
    apiEvents: persistedEvents.data?.items,
    installments: installments.data?.items ?? [],
    recurring: recurring.data?.items ?? [],
    transactions: recentTransactions.data?.items ?? [],
  }), [installments.data?.items, persistedEvents.data?.items, recurring.data?.items, recentTransactions.data?.items]);

  const filteredEvents = useMemo(() => filterEvents(calendarEvents, calFilter), [calendarEvents, calFilter]);

  const totalPlannedOutflow = useMemo(() =>
    calendarEvents.reduce((t, e) => t + Number(e.amount ?? 0), 0), [calendarEvents]);
  const riskEvents = useMemo(() =>
    calendarEvents.filter((e) => e.tone === "warning" || e.tone === "negative").length, [calendarEvents]);

  const upcomingEvents = useMemo(() => {
    const today = isoDate(new Date());
    const limit = isoDate(new Date(Date.now() + 30 * 86400000));
    return calendarEvents
      .filter((e) => e.date >= today && e.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 15);
  }, [calendarEvents]);

  const projectedInflow = useMemo(() =>
    calendarEvents.filter((e) => Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0),
    [calendarEvents]);
  const projectedOutflow = useMemo(() =>
    calendarEvents.filter((e) => Number(e.amount) < 0).reduce((s, e) => s + Math.abs(Number(e.amount)), 0),
    [calendarEvents]);
  const projectedBalance = projectedInflow - projectedOutflow;

  const calendarTotal = useMemo(() =>
    filteredEvents.reduce((s, e) => s + Number(e.amount ?? 0), 0), [filteredEvents]);

  const totalFlow = projectedInflow + projectedOutflow;
  const inflowPct = totalFlow > 0 ? (projectedInflow / totalFlow) * 100 : 0;
  const outflowPct = totalFlow > 0 ? (projectedOutflow / totalFlow) * 100 : 0;

  const risk = getRiskInfo(projectedBalance);

  const instData = installments.data;
  const closingDate = instData?.closing_day ? nextDayOfMonth(instData.closing_day) : null;
  const dueDate = instData?.due_day ? nextDayOfMonth(instData.due_day) : null;

  const sortedRecurring = useMemo(() =>
    (recurring.data?.items ?? [])
      .slice()
      .sort((a, b) => Math.abs(Number(b.last_amount)) - Math.abs(Number(a.last_amount)))
      .slice(0, 8),
    [recurring.data?.items]);

  const isLoading = persistedEvents.isLoading || recurring.isLoading || installments.isLoading;

  const calFilterTabs: { key: CalendarFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "saidas", label: "Saídas" },
    { key: "entradas", label: "Entradas" },
    { key: "parcelas", label: "Parcelas" },
    { key: "recorrencias", label: "Recorrências" },
  ];

  const drilldown = (event: CalendarEvent) =>
    onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction: event.direction, label: event.label, periodPreset: period.periodPreset, search: event.search });

  return (
    <section className="page-stack">

      {/* ── Header ── */}
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <button className="cal-new-event-btn" onClick={() => setShowEventDrawer(true)} type="button">
          <Plus size={13} /> Novo compromisso
        </button>
        <PeriodFilter
          dateFrom={period.dateFrom}
          dateTo={period.dateTo}
          periodPreset={period.periodPreset}
          onPreset={period.setPeriodPreset}
          onDateFrom={period.setDateFrom}
          onDateTo={period.setDateTo}
        />
      </div>

      {/* ── Cards resumo ── */}
      <div className="metric-grid executive">
        <MetricCard icon={CalendarDays} label="Eventos mapeados" value={String(calendarEvents.length)} helper="Recorrências, parcelas e lançamentos" tone="info" />
        <MetricCard icon={ArrowDownCircle} label="Saídas previstas" value={moneyAbs(totalPlannedOutflow)} helper="Estimativa do período" tone="negative" />
        <MetricCard icon={CreditCard} label="Parcelas ativas" value={String(instData?.active_count ?? 0)} helper={moneyAbs(instData?.total_future_amount)} tone="warning" />
        <MetricCard icon={ShieldCheck} label="Pontos de atenção" value={String(riskEvents)} helper="Itens que merecem revisão" tone={riskEvents ? "warning" : "positive"} />
        <MetricCard icon={Gauge} label="Saldo do período" value={money(summary.data?.balance)} helper="Calculado pelo dashboard atual" tone={Number(summary.data?.balance ?? 0) >= 0 ? "positive" : "negative"} />
      </div>

      {/* ── Fluxo Projetado + Risco Financeiro ── */}
      <div className="cal-flow-risk-row">

        {/* Fluxo Projetado */}
        <div className="cal-panel">
          <div className="cal-panel-header">
            <h3 className="cal-panel-title">Fluxo Projetado</h3>
          </div>
          <div className="cal-flow-metrics">
            <div className="cal-flow-metric positive">
              <small>Entradas previstas</small>
              <strong>{money(projectedInflow)}</strong>
            </div>
            <div className="cal-flow-metric negative">
              <small>Saídas previstas</small>
              <strong>{moneyAbs(projectedOutflow)}</strong>
            </div>
            <div className="cal-flow-metric warning">
              <small>Parcelas futuras</small>
              <strong>{moneyAbs(instData?.total_future_amount)}</strong>
            </div>
            <div className={`cal-flow-metric ${projectedBalance >= 0 ? "positive" : "negative"}`}>
              <small>Saldo projetado</small>
              <strong>{money(projectedBalance)}</strong>
            </div>
          </div>
          {totalFlow > 0 && (
            <div className="cal-flow-bar-section">
              <div className="cal-flow-bar-track">
                <div
                  className="cal-flow-bar-fill positive"
                  style={{ width: `${inflowPct}%` }}
                  title={`Entradas ${Math.round(inflowPct)}%`}
                />
                <div
                  className="cal-flow-bar-fill negative"
                  style={{ width: `${outflowPct}%` }}
                  title={`Saídas ${Math.round(outflowPct)}%`}
                />
              </div>
              <div className="cal-flow-bar-legend">
                <span className="cal-legend-dot positive" />
                <span>Entradas {Math.round(inflowPct)}%</span>
                <span className="cal-legend-dot negative" />
                <span>Saídas {Math.round(outflowPct)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Risco Financeiro */}
        <div className={`cal-panel cal-risk-panel ${risk.tone}`}>
          <div className="cal-panel-header">
            <h3 className="cal-panel-title">Risco Financeiro</h3>
          </div>
          <div className="cal-risk-indicator">
            {risk.level === "low"
              ? <CheckCircle size={36} className="cal-risk-icon positive" />
              : risk.level === "medium"
                ? <TriangleAlert size={36} className="cal-risk-icon warning" />
                : <TriangleAlert size={36} className="cal-risk-icon negative" />}
            <strong className="cal-risk-label">{risk.label}</strong>
          </div>
          <div className="cal-risk-rows">
            <div className="cal-risk-row">
              <span className="cal-risk-key">Motivo</span>
              <span className="cal-risk-value">{risk.reason}</span>
            </div>
            <div className="cal-risk-row">
              <span className="cal-risk-key">Recomendação</span>
              <span className="cal-risk-value">{risk.recommendation}</span>
            </div>
            <div className="cal-risk-row">
              <span className="cal-risk-key">Saldo projetado</span>
              <span className={`cal-risk-value font-bold ${projectedBalance >= 0 ? "text-green" : "text-red"}`}>
                {money(projectedBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Próximos compromissos + Calendário ── */}
      <div className="cal-main-row">

        {/* Próximos compromissos */}
        <div className="cal-panel cal-upcoming-panel">
          <div className="cal-panel-header">
            <h3 className="cal-panel-title">Próximos compromissos</h3>
            <span className="cal-upcoming-hint">próximos 30 dias</span>
          </div>

          {isLoading ? (
            <div className="cal-empty-state">
              <Loader2 size={24} className="spin" style={{ color: "#9ca3af" }} />
              <p>Carregando compromissos...</p>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="cal-empty-state">
              <CalendarDays size={36} style={{ color: "#d1d5db" }} />
              <p>Nenhum compromisso encontrado</p>
              <button
                className="primary-button"
                onClick={() => setShowEventDrawer(true)}
                type="button"
                style={{ marginTop: 4 }}
              >
                <Plus size={14} /> Criar compromisso
              </button>
            </div>
          ) : (
            <>
              <div className="cal-timeline">
                {upcomingEvents.map((event) => {
                  const d = new Date(event.date + "T00:00:00");
                  const dayNum = d.getDate();
                  const monthStr = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
                  return (
                    <button
                      className={`cal-upcoming-item ${event.tone}`}
                      key={`${event.kind}-${event.label}-${event.date}`}
                      onClick={() => drilldown(event)}
                      type="button"
                    >
                      <div className="cal-upcoming-date">
                        <span className="cal-upcoming-day">{dayNum}</span>
                        <span className="cal-upcoming-month">{monthStr}</span>
                      </div>
                      <div className="cal-upcoming-body">
                        <strong className="cal-upcoming-name">{event.label}</strong>
                        <small className="cal-upcoming-kind">{event.kind}{event.detail ? ` · ${event.detail}` : ""}</small>
                      </div>
                      <span className="cal-upcoming-amount">{moneyAbs(event.amount)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                className="cal-see-all-btn"
                onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset })}
                type="button"
              >
                Ver todos os compromissos
              </button>
            </>
          )}
        </div>

        {/* Calendário */}
        <div className="cal-panel cal-calendar-panel">
          <CalendarMonthGrid
            events={filteredEvents}
            allEvents={calendarEvents}
            dateFrom={period.dateFrom}
            dateTo={period.dateTo}
            loading={isLoading}
            onEventClick={drilldown}
          />
          <div className="cal-filter-tabs">
            {calFilterTabs.map((tab) => (
              <button
                className={`cal-filter-tab${calFilter === tab.key ? " active" : ""}`}
                key={tab.key}
                onClick={() => setCalFilter(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="cal-calendar-footer">
            <span className="cal-footer-label">Total do período {calFilter !== "all" ? `· ${calFilterTabs.find(t => t.key === calFilter)?.label}` : ""}</span>
            <span className={`cal-footer-value ${calendarTotal >= 0 ? "positive" : "negative"}`}>
              {money(calendarTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Vencimentos de Cartão ── */}
      {(instData?.active_count ?? 0) > 0 && closingDate && dueDate && (
        <div className="cal-section">
          <h2 className="cal-section-title">Vencimentos de Cartão</h2>
          <div className="cal-cards-grid">
            <div className="cal-closing-card">
              <div className="cal-closing-card-header">
                <CreditCard size={18} />
                <span>Cartão de Crédito</span>
                <span className="cal-closing-status-badge">{daysUntil(closingDate)}d para fechar</span>
              </div>
              <div className="cal-closing-card-body">
                <div className="cal-closing-card-row">
                  <span>Fecha em</span>
                  <strong>{daysUntil(closingDate)} dias <small>({fmtShortDate(closingDate)})</small></strong>
                </div>
                <div className="cal-closing-card-row">
                  <span>Vence em</span>
                  <strong>{daysUntil(dueDate)} dias <small>({fmtShortDate(dueDate)})</small></strong>
                </div>
                <div className="cal-closing-card-divider" />
                <div className="cal-closing-card-row highlight">
                  <span>Fatura atual</span>
                  <strong className="negative">{moneyAbs(instData?.total_future_amount)}</strong>
                </div>
                <div className="cal-closing-card-row">
                  <span>Parcelas ativas</span>
                  <strong>{instData?.active_count}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recorrências ── */}
      {sortedRecurring.length > 0 && (
        <div className="cal-section">
          <h2 className="cal-section-title">Recorrências do mês</h2>
          <div className="cal-rec-grid">
            {sortedRecurring.map((r) => (
              <div className="cal-rec-card" key={r.description}>
                <div className="cal-rec-card-top">
                  <span className="cal-rec-card-name">{r.description}</span>
                  <span className="cal-rec-card-amount">{moneyAbs(r.last_amount)}</span>
                </div>
                <div className="cal-rec-card-bottom">
                  {r.category_name && <small className="cal-rec-category">{r.category_name}</small>}
                  {r.last_transaction_date && (
                    <small className="cal-rec-next">{nextOccurrenceLabel(r.last_transaction_date)}</small>
                  )}
                  <span className={`cal-rec-badge ${r.status}`}>
                    {r.status === "stable" ? "Estável" : r.status === "rising" ? "↑ Alta" : "↓ Queda"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Drawer: Novo compromisso ── */}
      {showEventDrawer && (
        <div className="cal-drawer-overlay" onClick={() => setShowEventDrawer(false)}>
          <div className="cal-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cal-drawer-header">
              <h3 className="cal-drawer-title">Novo compromisso</h3>
              <button className="cal-drawer-close" onClick={() => setShowEventDrawer(false)} type="button">
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Cadastre compromissos que ainda não aparecem nos extratos importados.
            </p>
            <form className="inline-form form-grid two-columns" onSubmit={(e) => { e.preventDefault(); createEvent.mutate(); }}>
              <label>Título<input required value={eventForm.title} onChange={(e) => setEventForm((c) => ({ ...c, title: e.target.value }))} /></label>
              <label>Data<input required type="date" value={eventForm.dueDate} onChange={(e) => setEventForm((c) => ({ ...c, dueDate: e.target.value }))} /></label>
              <label>
                Tipo
                <select value={eventForm.eventType} onChange={(e) => setEventForm((c) => ({ ...c, eventType: e.target.value }))}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                  <option value="card_payment">Fatura</option>
                  <option value="subscription">Assinatura</option>
                  <option value="goal">Meta</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <label>Valor<input min="0" step="0.01" type="number" value={eventForm.amount} onChange={(e) => setEventForm((c) => ({ ...c, amount: e.target.value }))} /></label>
              <label>
                Recorrência
                <select value={eventForm.recurrence} onChange={(e) => setEventForm((c) => ({ ...c, recurrence: e.target.value }))}>
                  <option value="none">Sem recorrência</option>
                  <option value="monthly">Mensal</option>
                </select>
              </label>
              <button className="primary-button" disabled={createEvent.isPending} type="submit">
                {createEvent.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                Adicionar
              </button>
            </form>
            {createEvent.isError ? <InlineError message={apiErrorMessage(createEvent.error, "Falha ao criar evento.")} /> : null}
          </div>
        </div>
      )}
    </section>
  );
}
