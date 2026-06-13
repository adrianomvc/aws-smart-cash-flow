import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";

import { getReports } from "../lib/api";
import { money, periodRange, periodSummary } from "../lib/utils";
import { usePeriod } from "../hooks";
import { PageState, PeriodFilter } from "../components/ui";
import type { ApiSession, ReportCardRead } from "../lib/api";
import type { Page, PeriodState } from "../types";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const R_ICONS: Record<string, string> = {
  report:   "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5 M9 12h6 M9 16h4",
  download: "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2 M7 11l5 5 5-5 M12 4v12",
  share:    "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  bars:     "M5 20V10 M12 20V4 M19 20v-7 M3 20h18",
  pie:      "M12 3v9h9 M21 12a9 9 0 1 1-9-9 M21 12a9 9 0 0 0-9-9",
  arrowDR:  "M7 7l10 10 M17 8v9H8",
  arrowUR:  "M7 17L17 7 M8 7h9v9",
  flow:     "M4 6h10 M4 6l3-3 M4 6l3 3 M20 18H10 M20 18l-3-3 M20 18l-3 3 M4 12h16",
  calendar: "M3 5h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M16 3v4 M8 3v4 M3 10h18",
  info:     "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  chevR:    "M9 18l6-6-6-6",
  spark:    "M9 3H5a2 2 0 0 0-2 2v4 M9 3l2.5 2.5L14 3l2.5 2.5L19 3h1a1 1 0 0 1 1 1v4 M2 9v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9 M7 15h4 M15 15h2",
  check:    "M20 6L9 17l-5-5",
  alert:    "M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  loader:   "M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83",
};

function RIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = R_ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none" }}
    >
      {segs.map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  );
}

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

function reportStatusBadgeClass(status: string) {
  if (status === "ready") return "badge b-pos";
  if (status === "partial") return "badge b-warn";
  return "badge b-neutral";
}

function reportMetricLabel(report: ReportCardRead) {
  if (["budgets", "goals", "planning-events"].includes(report.id)) return report.primary_metric;
  if (report.id === "data-quality") return report.primary_metric;
  return money(report.primary_metric);
}

// Map report IDs to icons
const REPORT_ICONS: Record<string, string> = {
  "cashflow":        "flow",
  "categories":      "pie",
  "income":          "arrowDR",
  "budgets":         "bars",
  "goals":           "check",
  "data-quality":    "info",
  "planning-events": "calendar",
  "transactions":    "report",
};

function reportIcon(id: string): string {
  return REPORT_ICONS[id] ?? "report";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  icon: string;
  eyebrow: string;
  title: string;
  sub: string;
}

function SectionHeader({ icon, eyebrow, title, sub }: SectionHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
      <div
        className="kpi-ic"
        style={{ width: 40, height: 40, borderRadius: 12, background: "var(--acc-soft)", color: "var(--acc)", display: "grid", placeItems: "center", flex: "none" }}
      >
        <RIcon name={icon} size={18} />
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 3 }}>{eyebrow}</div>
        <div className="section-title" style={{ fontSize: 18, letterSpacing: "-.4px" }}>{title}</div>
        <div className="section-sub">{sub}</div>
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  sub?: string;
  tone?: "pos" | "neg" | "warn" | "info" | "default";
}

function KpiCard({ label, value, icon, sub, tone = "default" }: KpiCardProps) {
  const icBg =
    tone === "pos" ? "var(--pos-soft)" :
    tone === "neg" ? "var(--neg-soft)" :
    tone === "warn" ? "var(--warn-soft)" :
    tone === "info" ? "var(--info-soft)" :
    "var(--acc-soft)";
  const icColor =
    tone === "pos" ? "var(--acc)" :
    tone === "neg" ? "var(--neg)" :
    tone === "warn" ? "var(--warn)" :
    tone === "info" ? "var(--info)" :
    "var(--acc)";
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div className="kpi-ic" style={{ background: icBg, color: icColor }}>
          <RIcon name={icon} size={16} />
        </div>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-val">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report card (list item in sidebar + main card)
// ---------------------------------------------------------------------------

interface ReportCardItemProps {
  report: ReportCardRead;
  active: boolean;
  onClick: () => void;
}

function ReportCardSidebarItem({ report, active, onClick }: ReportCardItemProps) {
  return (
    <button
      className={active ? "on" : ""}
      onClick={onClick}
      type="button"
    >
      <RIcon name={reportIcon(report.id)} size={16} />
      <span style={{ flex: 1 }}>{report.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Report detail panel
// ---------------------------------------------------------------------------

interface ReportDetailProps {
  report: ReportCardRead;
  onNavigate: (page: Page) => void;
}

function ReportDetail({ report, onNavigate }: ReportDetailProps) {
  const statusBadgeClass = reportStatusBadgeClass(report.status);
  const statusLabel = reportStatusLabel(report.status);
  const metricValue = reportMetricLabel(report);

  return (
    <div className="vstack" style={{ gap: 16 }}>
      {/* Header card */}
      <div className="card">
        <div className="card-head">
          <div
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: "var(--acc-soft)", color: "var(--acc)",
              display: "grid", placeItems: "center", flex: "none",
            }}
          >
            <RIcon name={reportIcon(report.id)} size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card-head ttl" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>
              {report.title}
            </div>
            <div className="t-sub" style={{ marginTop: 2 }}>{report.description}</div>
          </div>
          <span className={statusBadgeClass}>{statusLabel}</span>
        </div>

        <div className="card-body">
          <div className="grid cols-2" style={{ gap: 12, marginBottom: 14 }}>
            {/* Primary metric */}
            <div
              style={{
                background: "var(--bg-sunken)", border: "1px solid var(--line)",
                borderRadius: "var(--r-sm)", padding: "14px 16px",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 6 }}>Métrica principal</div>
              <div
                className="kpi-val"
                style={{ fontSize: 22, letterSpacing: "-.5px", color: "var(--acc)" }}
              >
                {metricValue}
              </div>
            </div>
            {/* Secondary metric */}
            <div
              style={{
                background: "var(--bg-sunken)", border: "1px solid var(--line)",
                borderRadius: "var(--r-sm)", padding: "14px 16px",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 6 }}>Complemento</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.4 }}>
                {report.secondary_metric || "—"}
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => onNavigate(report.target_page as Page)}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Abrir relatório
            <RIcon name="chevR" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export panel
// ---------------------------------------------------------------------------

function ExportPanel() {
  const formats = [
    { label: "PDF", sub: "Relatório formatado para impressão" },
    { label: "CSV", sub: "Dados brutos para análise" },
    { label: "XLSX", sub: "Planilha editável" },
  ];
  return (
    <div className="card">
      <div className="card-head">
        <RIcon name="download" size={16} />
        <div style={{ flex: 1 }}>
          <div className="ttl" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5 }}>Exportação</div>
          <div className="t-sub" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Formatos planejados para o próximo recorte</div>
        </div>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 10 }}>
        {formats.map((f) => (
          <div
            key={f.label}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)", background: "var(--card-2)",
            }}
          >
            <div
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "var(--bg-sunken)", color: "var(--ink-3)",
                display: "grid", placeItems: "center", flex: "none",
              }}
            >
              <RIcon name="report" size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{f.label}</div>
              <div className="t-sub">{f.sub}</div>
            </div>
            <span className="badge b-neutral">Em breve</span>
          </div>
        ))}
      </div>
    </div>
  );
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // Derive active report — default to first item once loaded
  const activeId = selectedId ?? (items.length > 0 ? items[0].id : null);
  const activeReport = items.find((r) => r.id === activeId) ?? null;

  if (reports.isLoading) {
    return (
      <PageState
        icon={Loader2}
        title="Carregando relatórios"
        description="Consolidando leituras do período."
        spin
      />
    );
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
    <div className="canvas stg">
      {/* ── Top bar ── */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 24,
        }}
      >
        <SectionHeader
          icon="report"
          eyebrow="Crescimento"
          title="Relatórios"
          sub="Visões consolidadas e executivas dos seus dados financeiros."
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PeriodFilter
            dateFrom={period.dateFrom}
            dateTo={period.dateTo}
            periodPreset={period.periodPreset}
            onPreset={period.setPeriodPreset}
            onDateFrom={period.setDateFrom}
            onDateTo={period.setDateTo}
          />
          <button className="btn btn-ghost btn-sm" type="button">
            <RIcon name="download" size={14} />
            CSV
          </button>
          <button className="btn btn-primary btn-sm" type="button">
            <RIcon name="report" size={14} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── KPI deck ── */}
      <div className="grid cols-4" style={{ marginBottom: 24 }}>
        <KpiCard
          icon="report"
          label="Relatórios"
          value={String(items.length)}
          sub="Disponíveis no MVP"
          tone="info"
        />
        <KpiCard
          icon="check"
          label="Com dados"
          value={String(readyCount)}
          sub="Prontos para leitura"
          tone="pos"
        />
        <KpiCard
          icon="alert"
          label="Parciais"
          value={String(partialCount)}
          sub="Consolidação em evolução"
          tone={partialCount > 0 ? "warn" : "pos"}
        />
        <KpiCard
          icon="calendar"
          label="Período"
          value={periodSummary(period) || "Todos"}
          sub="Filtro aplicado"
          tone="info"
        />
      </div>

      {/* ── Period chip strip ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          flexWrap: "wrap", marginBottom: 20,
        }}
      >
        <span className="chip on">
          <RIcon name="calendar" size={13} />
          {periodSummary(period) || "Todos os períodos"}
        </span>
        <span className="chip">Todos os relatórios</span>
        <span
          style={{
            marginLeft: "auto", fontSize: 12,
            color: "var(--ink-3)", fontFamily: "var(--font-mono)",
          }}
        >
          {items.length} relatório{items.length !== 1 ? "s" : ""} disponíve{items.length !== 1 ? "is" : "l"}
        </span>
      </div>

      {/* ── Two-column layout: sidebar + main ── */}
      <div className="grid" style={{ gridTemplateColumns: "232px 1fr", alignItems: "start", gap: 16 }}>
        {/* Left: report type list */}
        <div className="card card-pad" style={{ position: "sticky", top: 80 }}>
          <div className="eyebrow" style={{ marginBottom: 8, paddingLeft: 4 }}>Tipo de relatório</div>
          {items.length === 0 ? (
            <div className="t-sub" style={{ padding: "8px 4px" }}>Nenhum relatório disponível</div>
          ) : (
            <div className="list-select">
              {items.map((r) => (
                <ReportCardSidebarItem
                  key={r.id}
                  report={r}
                  active={r.id === activeId}
                  onClick={() => setSelectedId(r.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail + export */}
        <div className="vstack" style={{ gap: 16 }}>
          {activeReport ? (
            <ReportDetail report={activeReport} onNavigate={onNavigate} />
          ) : (
            <div className="card card-pad">
              <div className="state">
                <div className="state-ic">
                  <RIcon name="report" size={22} />
                </div>
                <h4>Selecione um relatório</h4>
                <p>Escolha um item na lista à esquerda para ver os detalhes.</p>
              </div>
            </div>
          )}

          {/* All reports overview table */}
          {items.length > 0 && (
            <div className="card">
              <div className="card-head">
                <RIcon name="bars" size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5 }}>
                    Todos os relatórios
                  </div>
                  <div className="t-sub">Leituras consolidadas do período</div>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Relatório</th>
                      <th>Status</th>
                      <th className="num">Métrica principal</th>
                      <th>Complemento</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((report) => (
                      <tr
                        key={report.id}
                        onClick={() => setSelectedId(report.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                            <span
                              style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: "var(--acc-soft)", color: "var(--acc)",
                                display: "grid", placeItems: "center", flex: "none",
                              }}
                            >
                              <RIcon name={reportIcon(report.id)} size={14} />
                            </span>
                            <span>
                              <span className="t-desc">{report.title}</span>
                              <span
                                className="t-sub"
                                style={{ display: "block", marginTop: 1 }}
                              >
                                {report.description}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className={reportStatusBadgeClass(report.status)}>
                            {reportStatusLabel(report.status)}
                          </span>
                        </td>
                        <td className="num" style={{ fontWeight: 700, color: "var(--acc)" }}>
                          {reportMetricLabel(report)}
                        </td>
                        <td className="t-sub">{report.secondary_metric || "—"}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(report.target_page as Page);
                            }}
                          >
                            Abrir
                            <RIcon name="chevR" size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ExportPanel />

          {/* Export status info */}
          {reports.data?.export_status === "coming_soon" && (
            <div className="alert info">
              <div className="alert-ic">
                <RIcon name="info" size={17} />
              </div>
              <div>
                <div className="a-ttl">Exportação planejada</div>
                <div className="a-txt">
                  PDF, CSV e XLSX estão planejados para o próximo recorte do produto.
                  Atualmente, todas as leituras estão disponíveis diretamente no app.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
