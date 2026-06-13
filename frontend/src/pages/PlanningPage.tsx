import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Gauge, Loader2, Presentation } from "lucide-react";

import { getPlanningProjection } from "../lib/api";
import { dateLabel, isoDate, money, moneyAbs } from "../lib/utils";
import { DashboardSectionHeader, MetricCard, Panel, PageState, QualityRow, StatusBadge } from "../components/ui";
import type { ApiSession, PlanningProjection } from "../lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectionRiskTone(
  riskLevel?: PlanningProjection["horizons"][number]["risk_level"],
): "positive" | "negative" | "warning" | "info" {
  if (riskLevel === "risk") return "negative";
  if (riskLevel === "attention") return "warning";
  if (riskLevel === "healthy") return "positive";
  return "info";
}

function projectionRiskStatus(riskLevel?: string) {
  if (riskLevel === "risk") return "failed";
  if (riskLevel === "attention") return "completed_with_errors";
  return "completed";
}

function projectionRiskLabel(riskLevel?: string) {
  const labels: Record<string, string> = {
    attention: "Atenção",
    healthy: "Saudável",
    risk: "Risco",
  };
  return riskLevel ? labels[riskLevel] ?? riskLevel : "Sem leitura";
}

function planningEventLabel(eventType: string) {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PlanningPage({ session }: { session: ApiSession }) {
  const today = isoDate(new Date());
  const projection = useQuery({
    queryKey: ["planning-projection", session.token, today],
    queryFn: () => getPlanningProjection(session, `?date_from=${today}&horizons=30,60,90`),
  });
  const horizons = projection.data?.horizons ?? [];
  const firstHorizon = horizons[0];
  const finalHorizon = horizons[horizons.length - 1];
  const riskCount = horizons.filter((item) => item.risk_level === "risk").length;
  const eventCount = horizons.reduce((total, item) => Math.max(total, item.event_count), 0);

  if (projection.isLoading) {
    return <PageState icon={Loader2} title="Calculando projeção" description="Lendo eventos, metas e premissas." spin />;
  }

  if (projection.isError) {
    return (
      <PageState
        icon={AlertCircle}
        title="Não foi possível calcular a projeção"
        description="Confira a API local e tente novamente."
      />
    );
  }

  const data = projection.data;
  if (!data) {
    return <PageState icon={AlertCircle} title="Projeção indisponível" description="A API não retornou dados." />;
  }

  return (
    <div className="canvas stg">
      <div className="metric-grid executive">
        <MetricCard
          icon={Presentation}
          label="Horizonte principal"
          value={finalHorizon ? `${finalHorizon.days} dias` : "90 dias"}
          helper={finalHorizon ? `Até ${dateLabel(finalHorizon.date_to)}` : "Projeção inicial"}
          tone="info"
        />
        <MetricCard
          icon={ArrowUpCircle}
          label="Entradas previstas"
          value={moneyAbs(finalHorizon?.projected_income)}
          helper="Eventos de receita planejados"
          tone="positive"
        />
        <MetricCard
          icon={ArrowDownCircle}
          label="Saídas previstas"
          value={moneyAbs(finalHorizon?.projected_expenses)}
          helper="Eventos de despesa planejados"
          tone={Number(finalHorizon?.projected_expenses ?? 0) > 0 ? "warning" : "info"}
        />
        <MetricCard
          icon={Gauge}
          label="Saldo projetado"
          value={money(finalHorizon?.projected_balance)}
          helper={finalHorizon?.risk_reason ?? "Sem eventos suficientes"}
          tone={projectionRiskTone(finalHorizon?.risk_level)}
        />
        <MetricCard
          icon={AlertCircle}
          label="Riscos"
          value={String(riskCount)}
          helper={`${eventCount} evento${eventCount === 1 ? "" : "s"} no cálculo`}
          tone={riskCount > 0 ? "negative" : "positive"}
        />
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Planejamento"
          title="Projeção dos próximos horizontes"
          description="Leitura operacional baseada nos eventos planejados, sem IA ou simulador avançado neste recorte."
        />
        <div className="projection-grid">
          {horizons.map((horizon) => (
            <Panel
              key={horizon.days}
              title={`${horizon.days} dias`}
              description={`Até ${dateLabel(horizon.date_to)}`}
            >
              <div className="projection-card-body">
                <strong className={projectionRiskTone(horizon.risk_level)}>
                  {money(horizon.projected_balance)}
                </strong>
                <span>
                  {moneyAbs(horizon.projected_income)} entrando · {moneyAbs(horizon.projected_expenses)} saindo
                </span>
                <StatusBadge label={projectionRiskLabel(horizon.risk_level)} status={projectionRiskStatus(horizon.risk_level)} />
                <small>{horizon.risk_reason}</small>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="dashboard-section two-columns">
        <Panel title="Eventos usados na projeção" description="Compromissos futuros vindos do Calendário Financeiro.">
          <div className="timeline-list compact">
            {data.upcoming_events.length ? data.upcoming_events.map((event) => (
              <div className={`timeline-item ${event.event_type === "income" ? "positive" : "warning"}`} key={`${event.title}-${event.due_date}`}>
                <span>{dateLabel(event.due_date)}</span>
                <div>
                  <b>{event.title}</b>
                  <small>{planningEventLabel(event.event_type)} · {event.recurrence === "monthly" ? "mensal" : "pontual"}</small>
                </div>
                <strong>{moneyAbs(event.amount)}</strong>
              </div>
            )) : (
              <p className="muted">Nenhum evento planejado encontrado para os próximos horizontes.</p>
            )}
          </div>
        </Panel>

        <Panel title="Metas no horizonte" description="Metas ativas com prazo dentro da janela projetada.">
          <div className="settings-list">
            {data.goals_due.length ? data.goals_due.map((goal) => (
              <QualityRow
                key={`${goal.name}-${goal.target_date ?? "sem-prazo"}`}
                label={goal.name}
                value={`${moneyAbs(goal.remaining_amount)} restantes`}
              />
            )) : (
              <QualityRow label="Metas com prazo" value="Nenhuma nos próximos 90 dias" />
            )}
            <QualityRow label="Primeiro horizonte" value={firstHorizon ? dateLabel(firstHorizon.date_to) : "30 dias"} />
          </div>
        </Panel>
      </section>

      <Panel title="Premissas da projeção" description="O que esta leitura considera neste primeiro recorte.">
        <div className="assumption-list">
          {data.assumptions.map((assumption) => (
            <span key={assumption}>
              <CheckCircle2 size={16} />
              {assumption}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
