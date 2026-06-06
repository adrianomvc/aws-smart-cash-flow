import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, CalendarDays, CreditCard, Database, Loader2, Plus, ReceiptText } from "lucide-react";

import {
  createCreditCard,
  createCreditCardStatement,
  getCreditCardInstallments,
  getCreditCardPaymentMatches,
  getCreditCards,
  getCreditCardStatements,
  getRecurringExpenses,
  getTransactions,
  updateCreditCard,
} from "../lib/api";
import {
  amountClass,
  apiErrorMessage,
  cardLabel,
  compactMoneyAbs,
  dateLabel,
  directionLabel,
  installmentSummaryLabel,
  isoDate,
  moneyAbs,
  monthYearLabel,
  periodRange,
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
  CreditCardInstallmentItem,
  CreditCardPaymentMatchItem,
  CreditCardRead,
  CreditCardStatementRead,
  TransactionRead,
} from "../lib/api";
import type { PeriodState, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function statementStatusLabel(status: string) {
  const labels: Record<string, string> = {
    closed: "Fechada",
    open: "Aberta",
    paid: "Paga",
    partial: "Parcial",
  };
  return labels[status] ?? status;
}

function sumTransactions(items: Array<Pick<TransactionRead, "amount">>) {
  return items.reduce((total, t) => total + Math.abs(Number(t.amount)), 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CardTransactionList({
  emptyMessage,
  items,
  loading,
  onOpenTransaction,
  showInstallments = false,
}: {
  emptyMessage: string;
  items: TransactionRead[];
  loading: boolean;
  onOpenTransaction: (t: TransactionRead) => void;
  showInstallments?: boolean;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando cartão" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message={emptyMessage} />;
  return (
    <div className="merchant-list">
      {items.map((t) => (
        <button className="merchant-row clickable" key={t.id} onClick={() => onOpenTransaction(t)} type="button">
          <span>
            <strong>{t.description}</strong>
            <small>{dateLabel(t.transaction_date)} · {directionLabel(t.direction)}{showInstallments ? ` · ${installmentSummaryLabel(t)}` : ""}</small>
          </span>
          <strong className={amountClass(t)}>{moneyAbs(t.amount)}</strong>
        </button>
      ))}
    </div>
  );
}

function CardInstallmentList({
  emptyMessage,
  error,
  items,
  loading,
  onOpenInstallment,
}: {
  emptyMessage: string;
  error: boolean;
  items: CreditCardInstallmentItem[];
  loading: boolean;
  onOpenInstallment: (item: CreditCardInstallmentItem) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando parcelas" description="Aguarde um momento." spin compact />;
  if (error) return <EmptyInline message="Não foi possível carregar as parcelas do cartão. Confira se a API local foi reiniciada." />;
  if (!items.length) return <EmptyInline message={emptyMessage} />;
  return (
    <div className="installment-list">
      {items.map((item) => (
        <button className="installment-row" key={`${item.description}-${item.amount}-${item.installment_total}`} onClick={() => onOpenInstallment(item)} type="button">
          <span>
            <strong>{item.description}</strong>
            <small>Parcela {item.installment_current}/{item.installment_total} · Compra em {dateLabel(item.last_transaction_date)} · Fatura inicial: {monthYearLabel(item.first_invoice_month)}</small>
          </span>
          <strong className={item.remaining_installments ? "warning" : "muted-strong"}>{moneyAbs(item.future_amount)}</strong>
        </button>
      ))}
    </div>
  );
}

function CreditCardList({ items, loading, onEditCard }: { items: CreditCardRead[]; loading: boolean; onEditCard: (card: CreditCardRead) => void }) {
  if (loading) return <PageState icon={Loader2} title="Carregando cartões" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhum cartão detectado ainda. Importe uma fatura para começar." />;
  return (
    <div className="quality-list">
      {items.map((card) => (
        <div className="payment-match-row" key={card.id}>
          <div>
            <strong>{cardLabel(card)}</strong>
            <small>Fecha {card.closing_day} · vence {card.due_day}{card.issuer ? ` · ${card.issuer}` : ""}{card.brand ? ` · ${card.brand}` : ""}</small>
          </div>
          <button className="ghost-button compact" onClick={() => onEditCard(card)} type="button">Editar</button>
        </div>
      ))}
    </div>
  );
}

function CreditCardStatementList({ cards, items, loading }: { cards: CreditCardRead[]; items: CreditCardStatementRead[]; loading: boolean }) {
  if (loading) return <PageState icon={Loader2} title="Carregando faturas" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhuma fatura detectada ainda. Importe uma fatura ou ajuste manualmente se precisar." />;
  const cardById = new Map(cards.map((c) => [c.id, c]));
  return (
    <div className="quality-list">
      {items.map((statement) => (
        <QualityRow
          key={statement.id}
          label={`${cardById.get(statement.credit_card_id)?.name ?? "Cartão"} · ${monthYearLabel(statement.statement_month)}`}
          value={`${dateLabel(statement.due_date)} · ${moneyAbs(statement.total_amount ?? 0)} · ${statementStatusLabel(statement.status)}`}
        />
      ))}
    </div>
  );
}

function PaymentMatchList({ items, loading, onOpenMatch }: {
  items: CreditCardPaymentMatchItem[];
  loading: boolean;
  onOpenMatch: (item: CreditCardPaymentMatchItem, side: "bank" | "card") => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Buscando pares" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhum pagamento conciliável encontrado no período." />;
  return (
    <div className="payment-match-list">
      {items.map((item) => (
        <div className="payment-match-row" key={`${item.bank_transaction_id}-${item.card_transaction_id}`}>
          <div>
            <strong>{moneyAbs(item.amount)}</strong>
            <small>{dateLabel(item.bank_date)} no extrato · {dateLabel(item.card_date)} na fatura{item.date_delta_days ? ` · diferença de ${item.date_delta_days} dia${item.date_delta_days === 1 ? "" : "s"}` : ""}</small>
          </div>
          <div className="payment-match-actions">
            <button className="ghost-button compact" onClick={() => onOpenMatch(item, "bank")} type="button">Extrato</button>
            <button className="ghost-button compact" onClick={() => onOpenMatch(item, "card")} type="button">Fatura</button>
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
  onOpenTransactions,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [cardPeriod, setCardPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [cardForm, setCardForm] = useState({ brand: "", closingDay: "23", dueDay: "20", issuer: "", lastFour: "", limitAmount: "", name: "" });
  const [editingCardId, setEditingCardId] = useState("");
  const [statementForm, setStatementForm] = useState(() => {
    const today = new Date();
    return { cardId: "", closingDate: "", dueDate: isoDate(today), statementMonth: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), status: "open", totalAmount: "" };
  });
  const period = usePeriod(cardPeriod, setCardPeriod);
  const queryClient = useQueryClient();

  const cardQuery = withQueryParams(period.query, { limit: "100", sort_by: "transaction_date", sort_dir: "desc", source_type: "credit_card_statement" });
  const paymentQuery = withQueryParams(period.query, { direction: "payment", limit: "50", sort_by: "transaction_date", sort_dir: "desc", source_type: "credit_card_statement" });

  const cards = useQuery({ queryKey: ["card-transactions", session.token, cardQuery], queryFn: () => getTransactions(session, cardQuery) });
  const payments = useQuery({ queryKey: ["card-payments", session.token, paymentQuery], queryFn: () => getTransactions(session, paymentQuery) });
  const recurring = useQuery({ queryKey: ["card-recurring-expenses", session.token, period.recurringQuery], queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })) });
  const futureInstallmentsQuery = useQuery({
    queryKey: ["card-future-installments", session.token, period.dateTo],
    queryFn: () => getCreditCardInstallments(session, period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" })),
  });
  const currentInstallments = useQuery({ queryKey: ["card-current-installments", session.token, period.query], queryFn: () => getCreditCardInstallments(session, withQueryParams(period.query, { limit: "20" })) });
  const paymentMatches = useQuery({ queryKey: ["cards-credit-card-payment-matches", session.token, period.query], queryFn: () => getCreditCardPaymentMatches(session, withQueryParams(period.query, { limit: "5", window_days: "7" })) });
  const persistedCards = useQuery({ queryKey: ["credit-cards", session.token], queryFn: () => getCreditCards(session) });
  const persistedStatements = useQuery({ queryKey: ["credit-card-statements", session.token, period.query], queryFn: () => getCreditCardStatements(session, period.query) });

  const createCardMutation = useMutation({
    mutationFn: () => createCreditCard(session, { brand: cardForm.brand || null, closing_day: Number(cardForm.closingDay || 23), due_day: Number(cardForm.dueDay || 20), issuer: cardForm.issuer || null, last_four: cardForm.lastFour || null, limit_amount: cardForm.limitAmount || null, name: cardForm.name }),
    onSuccess: (card) => {
      setCardForm((c) => ({ ...c, lastFour: "", limitAmount: "", name: "" }));
      setStatementForm((c) => ({ ...c, cardId: card.id }));
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: () => updateCreditCard(session, editingCardId, { brand: cardForm.brand || null, closing_day: Number(cardForm.closingDay || 23), due_day: Number(cardForm.dueDay || 20), issuer: cardForm.issuer || null, last_four: cardForm.lastFour || null, limit_amount: cardForm.limitAmount || null, name: cardForm.name }),
    onSuccess: () => {
      setEditingCardId("");
      setCardForm((c) => ({ ...c, brand: "", issuer: "", lastFour: "", limitAmount: "", name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
    },
  });
  const createStatementMutation = useMutation({
    mutationFn: () => createCreditCardStatement(session, { closing_date: statementForm.closingDate || null, credit_card_id: statementForm.cardId, due_date: statementForm.dueDate, statement_month: statementForm.statementMonth, status: statementForm.status, total_amount: statementForm.totalAmount || null }),
    onSuccess: () => {
      setStatementForm((c) => ({ ...c, closingDate: "", totalAmount: "" }));
      void queryClient.invalidateQueries({ queryKey: ["credit-card-statements"] });
    },
  });

  const cardItems = cards.data?.items ?? [];
  const paymentItems = payments.data?.items ?? [];
  const cardExpenses = sumTransactions(cardItems.filter((t) => t.direction === "debit"));
  const cardCredits = sumTransactions(cardItems.filter((t) => t.direction === "credit"));
  const cardPayments = sumTransactions(paymentItems);
  const activeInstallmentCount = futureInstallmentsQuery.data?.active_count ?? 0;
  const futureInstallments = futureInstallmentsQuery.data?.total_future_amount ?? "0";

  function openCardTransactions(direction?: string, label = "Cartão de crédito") {
    onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, direction, label, periodPreset: period.periodPreset, sourceType: "credit_card_statement" });
  }
  function openTransaction(t: TransactionRead) {
    onOpenTransactions({ dateFrom: t.transaction_date, dateTo: t.transaction_date, direction: t.direction, label: t.description, periodPreset: "custom", search: t.description, sourceType: "credit_card_statement" });
  }
  function editCard(card: CreditCardRead) {
    setEditingCardId(card.id);
    setCardForm({ brand: card.brand ?? "", closingDay: String(card.closing_day), dueDay: String(card.due_day), issuer: card.issuer ?? "", lastFour: card.last_four ?? "", limitAmount: card.limit_amount ?? "", name: card.name });
  }

  return (
    <section className="page-stack">
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <PeriodFilter dateFrom={period.dateFrom} dateTo={period.dateTo} periodPreset={period.periodPreset} onPreset={period.setPeriodPreset} onDateFrom={period.setDateFrom} onDateTo={period.setDateTo} />
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Cartão de crédito" title="Fatura e compras" description="Separe compras, créditos, pagamentos e parcelas para não misturar fatura com gasto do mês." />
        <div className="metric-grid executive">
          <MetricCard icon={CreditCard} label="Compras" title={moneyAbs(cardExpenses)} value={compactMoneyAbs(cardExpenses)} helper="Despesas em faturas" tone="negative" onClick={() => openCardTransactions("debit", "Compras no cartão")} />
          <MetricCard icon={ArrowUpCircle} label="Créditos" title={moneyAbs(cardCredits)} value={compactMoneyAbs(cardCredits)} helper="Estornos e devoluções" tone="positive" onClick={() => openCardTransactions("credit", "Créditos no cartão")} />
          <MetricCard icon={ReceiptText} label="Fatura" title={moneyAbs(cardPayments)} value={compactMoneyAbs(cardPayments)} helper="Pagamentos na fatura" tone="info" onClick={() => openCardTransactions("payment", "Pagamentos da fatura")} />
          <MetricCard icon={CalendarDays} label="Parcelado futuro" title={moneyAbs(futureInstallments)} value={compactMoneyAbs(futureInstallments)} helper={`${activeInstallmentCount} parcela${activeInstallmentCount === 1 ? "" : "s"} no próximo mês`} tone="warning" onClick={() => openCardTransactions("debit", "Parcelas identificadas")} />
          <MetricCard icon={Database} label="Lançamentos" title={String(cards.data?.total ?? cardItems.length)} value={String(cards.data?.total ?? cardItems.length)} helper="No período filtrado" onClick={() => openCardTransactions(undefined, "Lançamentos do cartão")} />
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Importação primeiro" title="Cartões e faturas detectados" description="O sistema deve aproveitar os arquivos importados para descobrir cartão, vencimento, fechamento e status. Ajuste manual fica como exceção." />
        <div className="dashboard-grid operations-grid">
          <Panel title="Cartões detectados" description="Base identificada ou ajustada a partir das faturas importadas.">
            <CreditCardList items={persistedCards.data?.items ?? []} loading={persistedCards.isLoading} onEditCard={editCard} />
          </Panel>
          <Panel title="Faturas detectadas" description="Competências, vencimentos e status usados nos indicadores.">
            <CreditCardStatementList cards={persistedCards.data?.items ?? []} items={persistedStatements.data?.items ?? []} loading={persistedStatements.isLoading} />
          </Panel>
        </div>
        <div className="dashboard-grid operations-grid">
          <Panel title={editingCardId ? "Editar cartão detectado" : "Ajustar cartão manualmente"} description="Use apenas quando a importação não conseguiu identificar ou você precisa corrigir dados.">
            <form className="inline-form form-grid two-columns" onSubmit={(e) => { e.preventDefault(); editingCardId ? updateCardMutation.mutate() : createCardMutation.mutate(); }}>
              <label>Nome<input required value={cardForm.name} onChange={(e) => setCardForm((c) => ({ ...c, name: e.target.value }))} /></label>
              <label>Banco/emissor<input value={cardForm.issuer} onChange={(e) => setCardForm((c) => ({ ...c, issuer: e.target.value }))} /></label>
              <label>Bandeira<input value={cardForm.brand} onChange={(e) => setCardForm((c) => ({ ...c, brand: e.target.value }))} /></label>
              <label>Final<input inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={cardForm.lastFour} onChange={(e) => setCardForm((c) => ({ ...c, lastFour: e.target.value }))} /></label>
              <label>Fechamento<input max="31" min="1" required type="number" value={cardForm.closingDay} onChange={(e) => setCardForm((c) => ({ ...c, closingDay: e.target.value }))} /></label>
              <label>Vencimento<input max="31" min="1" required type="number" value={cardForm.dueDay} onChange={(e) => setCardForm((c) => ({ ...c, dueDay: e.target.value }))} /></label>
              <label>Limite<input min="0.01" step="0.01" type="number" value={cardForm.limitAmount} onChange={(e) => setCardForm((c) => ({ ...c, limitAmount: e.target.value }))} /></label>
              <button className="primary-button" disabled={createCardMutation.isPending || updateCardMutation.isPending} type="submit">
                <Plus size={16} />{editingCardId ? "Salvar edição" : "Salvar cartão"}
              </button>
              {editingCardId ? (
                <button className="ghost-button" disabled={updateCardMutation.isPending} onClick={() => { setEditingCardId(""); setCardForm((c) => ({ ...c, brand: "", issuer: "", lastFour: "", limitAmount: "", name: "" })); }} type="button">Cancelar edição</button>
              ) : null}
            </form>
            {createCardMutation.isError ? <InlineError message={apiErrorMessage(createCardMutation.error, "Falha ao salvar cartão.")} /> : null}
            {updateCardMutation.isError ? <InlineError message={apiErrorMessage(updateCardMutation.error, "Falha ao editar cartão.")} /> : null}
          </Panel>
          <Panel title="Ajustar fatura manualmente" description="Use como correção quando vencimento, total ou status não vieram do arquivo.">
            <form className="inline-form form-grid two-columns" onSubmit={(e) => { e.preventDefault(); createStatementMutation.mutate(); }}>
              <label>
                Cartão
                <select required value={statementForm.cardId} onChange={(e) => setStatementForm((c) => ({ ...c, cardId: e.target.value }))}>
                  <option value="">Selecione</option>
                  {(persistedCards.data?.items ?? []).map((card) => <option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
                </select>
              </label>
              <label>Mês<input required type="date" value={statementForm.statementMonth} onChange={(e) => setStatementForm((c) => ({ ...c, statementMonth: e.target.value }))} /></label>
              <label>Fechamento<input type="date" value={statementForm.closingDate} onChange={(e) => setStatementForm((c) => ({ ...c, closingDate: e.target.value }))} /></label>
              <label>Vencimento<input required type="date" value={statementForm.dueDate} onChange={(e) => setStatementForm((c) => ({ ...c, dueDate: e.target.value }))} /></label>
              <label>Valor total<input min="0" step="0.01" type="number" value={statementForm.totalAmount} onChange={(e) => setStatementForm((c) => ({ ...c, totalAmount: e.target.value }))} /></label>
              <label>
                Status
                <select value={statementForm.status} onChange={(e) => setStatementForm((c) => ({ ...c, status: e.target.value }))}>
                  <option value="open">Aberta</option><option value="closed">Fechada</option><option value="partial">Parcial</option><option value="paid">Paga</option>
                </select>
              </label>
              <button className="primary-button" disabled={createStatementMutation.isPending || !persistedCards.data?.items.length} type="submit">
                <Plus size={16} />Salvar fatura
              </button>
            </form>
            {createStatementMutation.isError ? <InlineError message={apiErrorMessage(createStatementMutation.error, "Falha ao salvar fatura.")} /> : null}
          </Panel>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader eyebrow="Controle" title="Detalhes do cartão" description="Revise compras recentes, parcelas e pagamentos conciliáveis antes de tomar decisão." />
        <div className="dashboard-grid operations-grid">
          <Panel title="Compras recentes" description="Últimos lançamentos importados de faturas.">
            <CardTransactionList emptyMessage="Nenhuma compra de cartão encontrada no período." items={cardItems.filter((t) => t.direction !== "payment").slice(0, 8)} loading={cards.isLoading} onOpenTransaction={openTransaction} />
          </Panel>
          <Panel title="Parcelas identificadas" description="Compras com parcela atual/total detectada na fatura.">
            <div className="panel-summary-line">
              <strong>{currentInstallments.data?.active_count ?? 0} parcela{currentInstallments.data?.active_count === 1 ? "" : "s"} no período</strong>
              <span>{moneyAbs(currentInstallments.data?.total_future_amount ?? 0)}</span>
            </div>
            {currentInstallments.data ? <p className="panel-note">Cálculo usando fechamento dia {currentInstallments.data.closing_day} e vencimento dia {currentInstallments.data.due_day} até o cadastro de cartões ficar disponível.</p> : null}
            <CardInstallmentList emptyMessage="Nenhuma parcela identificada no período." error={currentInstallments.isError} items={currentInstallments.data?.items ?? []} loading={currentInstallments.isLoading} onOpenInstallment={(item) => onOpenTransactions({ dateTo: period.dateTo, label: item.description, periodPreset: "custom", search: item.description, sourceType: "credit_card_statement" })} />
          </Panel>
          <Panel title="Conciliação de fatura" description="Pagamentos parecidos entre extrato e fatura.">
            <PaymentMatchList items={paymentMatches.data?.items ?? []} loading={paymentMatches.isLoading} onOpenMatch={(item, side) => onOpenTransactions({ dateFrom: side === "bank" ? item.bank_date : item.card_date, dateTo: side === "bank" ? item.bank_date : item.card_date, direction: "payment", label: side === "bank" ? "Pagamento no extrato" : "Pagamento na fatura", periodPreset: "custom", search: side === "bank" ? item.bank_description : item.card_description, sourceType: side === "card" ? "credit_card_statement" : "bank_statement" })} />
          </Panel>
          <Panel title="Recorrências" description="Assinaturas e cobranças repetidas detectadas no histórico.">
            <div className="quality-list">
              {recurring.isLoading ? <PageState icon={Loader2} title="Carregando recorrências" description="Aguarde um momento." spin compact /> : null}
              {!recurring.isLoading && !recurring.data?.items.length ? <EmptyInline message="Nenhuma recorrência detectada." /> : null}
              {recurring.data?.items.map((item) => <QualityRow key={item.description} label={item.description} onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, label: item.description, periodPreset: period.periodPreset, search: item.description })} value={compactMoneyAbs(item.average_amount)} />)}
            </div>
          </Panel>
        </div>
      </section>
    </section>
  );
}
