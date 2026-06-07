import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, CheckCircle2, FileUp, Loader2, ReceiptText } from "lucide-react";

import { getReports } from "../lib/api";
import { money, periodRange, periodSummary } from "../lib/utils";
import { usePeriod } from "../hooks";
import { DashboardSectionHeader, MetricCard, Panel, PageState, PeriodFilter, QualityRow, StatusBadge } from "../components/ui";
import type { ApiSession, ReportCardRead } from "../lib/api";
import type { Page, PeriodState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    empty: "Sem dados",
    partial: "Parcial",
    ready: "Com dados",
  };
  return labels[status] ?? status;
}

function reportStatusBadge(status: string) {
  if (status === "ready") return "completed";
  if (status === "partial") return "completed_with_errors";
  return "pending";
}

function reportMetricLabel(report: ReportCardRead) {
  if (["budgets", "goals", "planning-events"].includes(report.id)) return report.primary_metric;
  if (report.id === "data-quality") return report.primary_metric;
  return money(report.primary_metric);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReportsPage({
  onNavigate,
  session,
}: {
  onNavigate: (page: Page) => void;
  session: ApiSession;
}) {
  const [reportPeriod, setReportPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const period = usePeriod(reportPeriod, setReportPeriod);
  const reports = useQuery({
    queryKey: ["reports", session.token, period.query],
    queryFn: () => getReports(session, period.query),
  });
  const items = reports.data?.items ?? [];
  const readyCount = items.filter((item) => item.status === "ready").length;
  const partialCount = items.filter((item) => item.status === "partial").length;

  if (reports.isLoading) {
    return <PageState icon={Loader2} title="Carregando relatórios" description="Consolidando leituras do período." spin />;
  }

  if (reports.isError) {
    return (
      <PageState
        icon={AlertCircle}
        title="Não foi possível carregar relatórios"
        description="Confira a API local e tente novamente."
      />
    );
  }

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
        <MetricCard icon={ReceiptText} label="Relatórios" value={String(items.length)} helper="Disponíveis no MVP" tone="info" />
        <MetricCard icon={CheckCircle2} label="Com dados" value={String(readyCount)} helper="Prontos para leitura" tone="positive" />
        <MetricCard icon={AlertCircle} label="Parciais" value={String(partialCount)} helper="Consolidação em evolução" tone={partialCount > 0 ? "warning" : "positive"} />
        <MetricCard icon={FileUp} label="Exportação" value="Em breve" helper={reports.data?.export_status === "coming_soon" ? "PDF, CSV e XLSX planejados" : "Disponível"} tone="info" />
        <MetricCard icon={CalendarDays} label="Período" value={periodSummary(period) || "Todos"} helper="Filtro aplicado aos relatórios" tone="info" />
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Relatórios"
          title="Leituras consolidadas"
          description="Primeira visão real de relatórios, usando dados e agregados já disponíveis no produto."
        />
        <div className="report-grid">
          {items.map((report) => (
            <button
              className="report-card"
              key={report.id}
              onClick={() => onNavigate(report.target_page as Page)}
              type="button"
            >
              <div>
                <StatusBadge label={reportStatusLabel(report.status)} status={reportStatusBadge(report.status)} />
                <h3>{report.title}</h3>
                <p>{report.description}</p>
              </div>
              <strong>{reportMetricLabel(report)}</strong>
              <small>{report.secondary_metric}</small>
            </button>
          ))}
        </div>
      </section>

      <Panel title="Exportação" description="Os formatos exportáveis ficam planejados para o próximo recorte.">
        <div className="settings-list">
          <QualityRow label="PDF" value="Em breve" />
          <QualityRow label="CSV" value="Em breve" />
          <QualityRow label="XLSX" value="Em breve" />
          <QualityRow label="Escopo atual" value="Leitura consolidada no app" />
        </div>
      </Panel>
    </section>
  );
}
