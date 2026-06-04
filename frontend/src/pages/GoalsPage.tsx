import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Gauge, Loader2, PiggyBank, Plus, Sparkles, Target } from "lucide-react";

import { createGoal, getDashboardSummary, getGoals } from "../lib/api";
import {
  apiErrorMessage,
  dateInputLabel,
  formatPercentNumber,
  moneyAbs,
  periodRange,
} from "../lib/utils";
import { usePeriod } from "../hooks";
import {
  DashboardSectionHeader,
  InlineError,
  MetricCard,
  Panel,
  PeriodFilter,
  StatusBadge,
} from "../components/ui";
import type { ApiSession, DashboardSummary, GoalRead } from "../lib/api";
import type { PeriodState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function goalStatusLabel(goalStatus: string) {
  const labels: Record<string, string> = {
    active: "Ativa",
    completed: "Concluída",
    paused: "Pausada",
  };
  return labels[goalStatus] ?? goalStatus;
}

function buildGoalRows(summary?: DashboardSummary, persistedGoals?: GoalRead[]) {
  if (persistedGoals?.length) {
    return persistedGoals.map((goal) => ({
      current: Number(goal.current_amount),
      deadline: goal.target_date ? `Meta para ${dateInputLabel(goal.target_date)}` : "Sem prazo definido",
      description: goal.description ?? "Meta cadastrada no planejamento.",
      name: goal.name,
      ratio: Number(goal.current_amount) / Math.max(Number(goal.target_amount), 1),
      status: goalStatusLabel(goal.status),
      target: Number(goal.target_amount),
    }));
  }
  const balance = Math.max(Number(summary?.balance ?? 0), 0);
  const monthlyBoost = Math.min(balance, 1200);
  const goals = [
    { current: 16500 + monthlyBoost, deadline: "Meta para 90 dias", description: "Cobrir despesas essenciais com mais previsibilidade.", name: "Reserva de emergência", status: "Em avanço", target: 24000 },
    { current: 4200 + monthlyBoost * 0.3, deadline: "Meta para 6 meses", description: "Separar recursos para uma viagem familiar planejada.", name: "Viagem em família", status: "No ritmo", target: 12000 },
    { current: 2800 + monthlyBoost * 0.2, deadline: "Meta para 12 meses", description: "Construir uma base de investimento recorrente.", name: "Carteira de longo prazo", status: "Inicial", target: 18000 },
  ];
  return goals.map((goal) => ({ ...goal, ratio: goal.current / Math.max(goal.target, 1) }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function GoalsPage({ session }: { session: ApiSession }) {
  const [goalPeriod, setGoalPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [goalForm, setGoalForm] = useState(() => ({
    currentAmount: "0",
    description: "",
    name: "",
    targetAmount: "",
    targetDate: "",
  }));
  const queryClient = useQueryClient();
  const period = usePeriod(goalPeriod, setGoalPeriod);
  const summary = useQuery({
    queryKey: ["goals-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedGoals = useQuery({
    queryKey: ["goals", session.token],
    queryFn: () => getGoals(session),
  });
  const createGoalMutation = useMutation({
    mutationFn: () =>
      createGoal(session, {
        current_amount: goalForm.currentAmount || "0",
        description: goalForm.description || null,
        name: goalForm.name,
        target_amount: goalForm.targetAmount,
        target_date: goalForm.targetDate || null,
      }),
    onSuccess: () => {
      setGoalForm((current) => ({ ...current, currentAmount: "0", description: "", name: "", targetAmount: "", targetDate: "" }));
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
  const goals = buildGoalRows(summary.data, persistedGoals.data?.items);
  const monthlyCapacity = Math.max(Number(summary.data?.balance ?? 0), 0);
  const averageProgress = goals.reduce((total, goal) => total + goal.ratio, 0) / Math.max(goals.length, 1);

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
        <MetricCard icon={Target} label="Metas ativas" value={String(goals.length)} helper="Planejamento inicial" tone="info" />
        <MetricCard icon={PiggyBank} label="Capacidade mensal" value={moneyAbs(monthlyCapacity)} helper="Fluxo líquido positivo do período" tone={monthlyCapacity > 0 ? "positive" : "warning"} />
        <MetricCard icon={Gauge} label="Progresso médio" value={`${formatPercentNumber(averageProgress * 100)}%`} helper="Sobre metas simuladas" tone="positive" />
        <MetricCard icon={CalendarDays} label="Próximo marco" value="90 dias" helper="Reserva de emergência" tone="warning" />
        <MetricCard icon={Sparkles} label="Sugestão" value={monthlyCapacity > 0 ? "Aportar" : "Revisar"} helper="Derivada do saldo do mês" tone={monthlyCapacity > 0 ? "positive" : "warning"} />
      </div>
      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Metas"
          title="Objetivos financeiros da família"
          description={persistedGoals.data?.items.length ? "Metas persistidas pelo backend de Planning." : "Primeira tela visual com metas simuladas enquanto nenhuma meta foi cadastrada."}
        />
        <div className="goal-grid">
          {goals.map((goal) => (
            <Panel key={goal.name} title={goal.name} description={goal.description}>
              <div className="goal-card-body">
                <div>
                  <strong>{moneyAbs(goal.current)} de {moneyAbs(goal.target)}</strong>
                  <small>{goal.deadline}</small>
                </div>
                <span className="progress-track large" aria-label={`${goal.name}: ${formatPercentNumber(goal.ratio * 100)}%`}>
                  <i className={goal.ratio >= 0.7 ? "positive" : "info"} style={{ width: `${Math.min(goal.ratio * 100, 100)}%` }} />
                </span>
                <div className="goal-footer">
                  <StatusBadge status={goal.ratio >= 0.7 ? "completed" : "pending"} label={goal.status} />
                  <b>{formatPercentNumber(goal.ratio * 100)}%</b>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>
      <Panel title="Nova meta" description="Cadastre objetivos financeiros para acompanhar progresso real.">
        <form
          className="inline-form form-grid two-columns"
          onSubmit={(event) => { event.preventDefault(); createGoalMutation.mutate(); }}
        >
          <label>Nome<input required value={goalForm.name} onChange={(e) => setGoalForm((c) => ({ ...c, name: e.target.value }))} /></label>
          <label>Valor alvo<input min="0.01" required step="0.01" type="number" value={goalForm.targetAmount} onChange={(e) => setGoalForm((c) => ({ ...c, targetAmount: e.target.value }))} /></label>
          <label>Valor atual<input min="0" required step="0.01" type="number" value={goalForm.currentAmount} onChange={(e) => setGoalForm((c) => ({ ...c, currentAmount: e.target.value }))} /></label>
          <label>Prazo<input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm((c) => ({ ...c, targetDate: e.target.value }))} /></label>
          <label className="wide-field">Descrição<input value={goalForm.description} onChange={(e) => setGoalForm((c) => ({ ...c, description: e.target.value }))} /></label>
          <button className="primary-button" disabled={createGoalMutation.isPending} type="submit">
            {createGoalMutation.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Criar meta
          </button>
        </form>
        {createGoalMutation.isError ? <InlineError message={apiErrorMessage(createGoalMutation.error, "Falha ao criar meta.")} /> : null}
      </Panel>
    </section>
  );
}
