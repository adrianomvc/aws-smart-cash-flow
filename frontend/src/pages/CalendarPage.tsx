import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, CalendarDays, CreditCard, Gauge, Loader2, Plus, ShieldCheck } from "lucide-react";

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
  dateInputLabel,
  isoDate,
  money,
  moneyAbs,
  periodRange,
  sourceTypeLabel,
  withQueryParams,
} from "../lib/utils";
import { usePeriod } from "../hooks";
import {
  DashboardSectionHeader,
  EmptyInline,
  InlineError,
  MetricCard,
  PageState,
  Panel,
  PeriodFilter,
  QualityRow,
} from "../components/ui";
import type {
  ApiSession,
  CalendarEventRead,
  CreditCardInstallmentItem,
  RecurringExpenseItem,
  TransactionRead,
} from "../lib/api";
import type { CalendarEvent, PeriodState, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calendarEventTone(event: CalendarEventRead): "info" | "negative" | "positive" | "warning" {
  if (event.status === "paid") return "positive";
  if (event.event_type === "income") return "positive";
  if (event.event_type === "card_payment" || event.event_type === "subscription") return "warning";
  if (event.event_type === "expense") return "negative";
  return "info";
}

function calendarEventTypeLabel(eventType: string) {
  const labels: Record<string, string> = {
    card_payment: "Fatura",
    expense: "Despesa",
    goal: "Meta",
    income: "Receita",
    other: "Outro",
    subscription: "Assinatura",
  };
  return labels[eventType] ?? eventType;
}

function calendarEventStatusLabel(eventStatus: string) {
  const labels: Record<string, string> = {
    paid: "Pago",
    planned: "Planejado",
    skipped: "Ignorado",
  };
  return labels[eventStatus] ?? eventStatus;
}

function buildCalendarEvents({
  apiEvents,
  installments,
  recurring,
  transactions,
}: {
  apiEvents?: CalendarEventRead[];
  installments: CreditCardInstallmentItem[];
  recurring: RecurringExpenseItem[];
  transactions: TransactionRead[];
}): CalendarEvent[] {
  if (apiEvents?.length) {
    return apiEvents
      .map((event) => ({
        amount: event.amount ?? 0,
        date: event.due_date,
        detail: `${calendarEventTypeLabel(event.event_type)} · ${calendarEventStatusLabel(event.status)}`,
        direction: event.event_type === "income" ? "credit" : "debit",
        kind: event.recurrence === "monthly" ? "Recorrente" : "Planejado",
        label: event.title,
        search: event.title,
        tone: calendarEventTone(event),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }
  const recurringEvents: CalendarEvent[] = recurring.slice(0, 5).map((item) => ({
    amount: item.last_amount || item.average_amount,
    date: item.last_transaction_date,
    detail: `${item.transaction_count} ocorrências em ${item.month_count} mês${item.month_count === 1 ? "" : "es"}`,
    direction: "debit",
    kind: item.category_name ?? "Recorrência provável",
    label: item.description,
    search: item.description,
    tone: Number(item.change_ratio ?? 0) >= 0.3 ? "warning" : "info",
  }));
  const installmentEvents: CalendarEvent[] = installments.slice(0, 4).map((item) => ({
    amount: item.amount,
    date: item.last_transaction_date,
    detail: `${item.installment_current}/${item.installment_total} · faltam ${item.remaining_installments}`,
    direction: "debit",
    kind: "Parcela de cartão",
    label: item.description,
    search: item.description,
    tone: item.remaining_installments >= 3 ? "warning" : "info",
  }));
  const transactionEvents: CalendarEvent[] = transactions
    .filter((t) => t.direction !== "payment")
    .slice(0, 4)
    .map((t) => ({
      amount: t.amount,
      date: t.transaction_date,
      detail: sourceTypeLabel(t.source_type),
      direction: t.direction,
      kind: t.direction === "credit" ? "Entrada recente" : "Saída recente",
      label: t.description,
      search: t.description,
      tone: t.direction === "credit" ? "positive" : "negative",
    }));
  return [...recurringEvents, ...installmentEvents, ...transactionEvents]
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CalendarMonthGrid({
  events,
  dateFrom,
  loading,
  onEventClick,
}: {
  events: CalendarEvent[];
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
  const totalCells = 42;
  const cells: Array<number | null> = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < totalCells) cells.push(null);

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.date;
    const arr = eventsByDate.get(key) ?? [];
    arr.push(event);
    eventsByDate.set(key, arr);
  }

  const today = isoDate(new Date());
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
  const MAX_VISIBLE = 2;

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
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const hidden = dayEvents.length - visible.length;
          const isToday = dateKey === today;
          return (
            <div className={`calendar-month-cell${isToday ? " today" : ""}`} key={dateKey}>
              <span className="calendar-day-number">{day}</span>
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
  const [calendarView, setCalendarView] = useState<"grid" | "timeline">("grid");
  const [calendarPeriod, setCalendarPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
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

  const totalPlannedOutflow = useMemo(() => calendarEvents.reduce((total, item) => total + Number(item.amount ?? 0), 0), [calendarEvents]);
  const riskEvents = useMemo(() => calendarEvents.filter((item) => item.tone === "warning" || item.tone === "negative").length, [calendarEvents]);

  return (
    <section className="page-stack">
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <PeriodFilter
          dateFrom={period.dateFrom}
          dateTo={period.dateTo}
          periodPreset={period.periodPreset}
          onPreset={period.setPeriodPreset}
          onDateFrom={period.setDateFrom}
          onDateTo={period.setDateTo}
        />
      </div>
      <div className="metric-grid executive">
        <MetricCard icon={CalendarDays} label="Eventos mapeados" value={String(calendarEvents.length)} helper="Recorrências, parcelas e últimos lançamentos" tone="info" />
        <MetricCard icon={ArrowDownCircle} label="Saídas previstas" value={moneyAbs(totalPlannedOutflow)} helper="Estimativa derivada do histórico" tone="negative" />
        <MetricCard icon={CreditCard} label="Parcelas ativas" value={String(installments.data?.active_count ?? 0)} helper={moneyAbs(installments.data?.total_future_amount)} tone="warning" />
        <MetricCard icon={ShieldCheck} label="Pontos de atenção" value={String(riskEvents)} helper="Itens que merecem revisão" tone={riskEvents ? "warning" : "positive"} />
        <MetricCard icon={Gauge} label="Saldo do período" value={money(summary.data?.balance)} helper="Calculado pelo dashboard atual" tone={Number(summary.data?.balance ?? 0) >= 0 ? "positive" : "negative"} />
      </div>

      <div className="calendar-view-toggle">
        <button className={calendarView === "grid" ? "active" : ""} onClick={() => setCalendarView("grid")} type="button">Grade</button>
        <button className={calendarView === "timeline" ? "active" : ""} onClick={() => setCalendarView("timeline")} type="button">Linha do tempo</button>
      </div>

      {calendarView === "grid" ? (
        <CalendarMonthGrid
          events={calendarEvents}
          dateFrom={period.dateFrom}
          dateTo={period.dateTo}
          loading={persistedEvents.isLoading || recurring.isLoading || installments.isLoading}
          onEventClick={(event) => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction: event.direction, label: event.label, periodPreset: period.periodPreset, search: event.search })}
        />
      ) : (
        <section className="dashboard-section">
          <DashboardSectionHeader eyebrow="Calendário" title="Próximos compromissos financeiros" description="Primeira visão baseada nos dados já importados. A API dedicada de calendário entra na próxima etapa." />
          <div className="dashboard-grid analysis-grid">
            <Panel title="Linha do tempo" description="Eventos estimados a partir de recorrências, parcelas e lançamentos recentes.">
              <div className="timeline-list">
                {persistedEvents.isLoading || recurring.isLoading || installments.isLoading || recentTransactions.isLoading ? (
                  <PageState icon={Loader2} title="Carregando calendário" description="Organizando compromissos do período." spin compact />
                ) : null}
                {!persistedEvents.isLoading && !recurring.isLoading && !installments.isLoading && !recentTransactions.isLoading && !calendarEvents.length ? (
                  <EmptyInline message="Ainda não há eventos suficientes para montar o calendário." />
                ) : null}
                {calendarEvents.map((event) => (
                  <button
                    className={`timeline-item ${event.tone}`}
                    key={`${event.kind}-${event.label}-${event.date}`}
                    onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction: event.direction, label: event.label, periodPreset: period.periodPreset, search: event.search })}
                    type="button"
                  >
                    <span><strong>{dateInputLabel(event.date)}</strong><small>{event.kind}</small></span>
                    <div><strong>{event.label}</strong><small>{event.detail}</small></div>
                    <b>{moneyAbs(event.amount)}</b>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Resumo operacional" description="Leitura inicial enquanto o módulo Planning não tem backend próprio.">
              <div className="settings-list">
                <QualityRow label="Fonte dos dados" value={persistedEvents.data?.items.length ? "Planning API" : "Transações importadas"} />
                <QualityRow label="Recorrências prováveis" value={recurring.data?.items.length ?? 0} />
                <QualityRow label="Parcelado futuro" value={moneyAbs(installments.data?.total_future_amount)} />
                <QualityRow label="Qualidade da previsão" value={calendarEvents.length >= 5 ? "Boa" : "Inicial"} />
              </div>
            </Panel>
          </div>
        </section>
      )}

      <Panel title="Novo evento" description="Cadastre compromissos que ainda não aparecem nos extratos importados.">
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
            Adicionar evento
          </button>
        </form>
        {createEvent.isError ? <InlineError message={apiErrorMessage(createEvent.error, "Falha ao criar evento.")} /> : null}
      </Panel>
    </section>
  );
}
