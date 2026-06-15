/**
 * Shared presentational UI components extracted from App.tsx.
 * These components are pure/display components — no useQuery calls or page-level state.
 * PeriodFilter is the exception: it owns its own open/close dropdown state.
 */

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";

import type { TransactionRead } from "../lib/api";
import type { TransactionPeriodPreset, PeriodState } from "../types";
import { periodRange } from "../lib/utils";

// ---------------------------------------------------------------------------
// Internal helpers (used only within this file)
// ---------------------------------------------------------------------------

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: "Completo",
    completed_with_errors: "Com erros",
    duplicate_file: "Duplicado",
    failed: "Falhou",
    pending: "Pendente",
    processing: "Processando",
    active: "Ativa",
    inactive: "Inativa",
    manual: "Manual",
  };
  return labels[status] ?? status;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: "Manual",
    rule: "Regra",
    embedding: "Embedding",
    llm: "LLM",
    pending: "Pendente",
  };
  return labels[source] ?? source;
}

export function dedupeStatus(
  transaction: Pick<TransactionRead, "id" | "natural_dedupe_key">,
  expectedKey = "",
  primaryId = "",
) {
  if (expectedKey && transaction.natural_dedupe_key === expectedKey) return "principal";
  if (primaryId && transaction.id === primaryId) return "suggested";
  return "review";
}

function periodSummary({
  dateFrom,
  dateTo,
  periodPreset,
}: {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
}): string {
  function dateInputLabel(value: string) {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  }
  function monthYearLabel(value: string) {
    const [year, month] = value.split("-");
    if (!year || !month) return value;
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  function yearLabel(value: string) {
    return value.split("-")[0] ?? value;
  }
  if (periodPreset === "current_month") return monthYearLabel(dateFrom || dateTo);
  if (periodPreset === "previous_month") return monthYearLabel(dateFrom || dateTo);
  if (periodPreset === "current_year") return yearLabel(dateFrom || dateTo);
  if (periodPreset === "previous_year") return yearLabel(dateFrom || dateTo);
  if (dateFrom && dateTo) return `${dateInputLabel(dateFrom)} a ${dateInputLabel(dateTo)}`;
  if (dateFrom) return `desde ${dateInputLabel(dateFrom)}`;
  if (dateTo) return `até ${dateInputLabel(dateTo)}`;
  return "";
}

const CATEGORY_PALETTE = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#ffedd5", text: "#c2410c" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#cffafe", text: "#0e7490" },
  { bg: "#fef9c3", text: "#a16207" },
  { bg: "#f0fdf4", text: "#166534" },
  { bg: "#fef2f2", text: "#b91c1c" },
  { bg: "#f5f3ff", text: "#7c3aed" },
];

function categoryColor(id: string) {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

const PERIOD_PRESETS: { label: string; value: TransactionPeriodPreset }[] = [
  { label: "Mês atual", value: "current_month" },
  { label: "Mês anterior", value: "previous_month" },
  { label: "Ano atual", value: "current_year" },
  { label: "Ano anterior", value: "previous_year" },
  { label: "Todos", value: "all" },
  { label: "Personalizado", value: "custom" },
];

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

export function EmptyInline({ message }: { message: string }) {
  return (
    <div className="empty-inline">
      <FileWarning size={18} /> {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported shared UI components
// ---------------------------------------------------------------------------

export function DashboardSectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="dashboard-section-header">
      <span>{eyebrow}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="panel-link" onClick={onClick} type="button">
      {label}
      <ChevronRight size={14} />
    </button>
  );
}

export function HelpIcon({
  icon: Icon,
  label,
  text,
}: {
  icon: LucideIcon;
  label: string;
  text?: string;
}) {
  if (!text) {
    return <Icon aria-hidden="true" size={20} />;
  }
  return (
    <span className="help-tooltip">
      <button aria-label={`Explicação: ${label}`} onClick={(event) => event.stopPropagation()} type="button">
        <Icon aria-hidden="true" size={20} />
      </button>
      <span role="tooltip">{text}</span>
    </span>
  );
}

export function MetricCard({
  className,
  icon: Icon,
  label,
  value,
  helper,
  helpText,
  onClick,
  title,
  tone,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  helpText?: string;
  onClick?: () => void;
  title?: string;
  tone?: "positive" | "negative" | "warning" | "info";
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  const tooltipText = helpText ?? helper;

  return (
    <div
      className={["metric-card", onClick ? "clickable" : "", tone ? `tone-${tone}` : "", className ?? ""].filter(Boolean).join(" ")}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="metric-top">
        <span>{label}</span>
        <HelpIcon icon={Icon} label={label} text={tooltipText} />
      </div>
      <strong className={tone} title={title}>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

export function ResponsiveTable({
  children,
  loading,
  empty,
  emptyMessage,
}: {
  children: ReactNode;
  loading: boolean;
  empty: boolean;
  emptyMessage: string;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando dados" description="Aguarde um momento." spin compact />;
  if (empty) return <EmptyInline message={emptyMessage} />;
  return <div className="table-wrap"><table>{children}</table></div>;
}

export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function ChartBox({
  children,
  loading,
  empty,
  size = "default",
}: {
  children: ReactNode;
  loading: boolean;
  empty: boolean;
  size?: "default" | "large";
}) {
  const className = size === "large" ? "chart-box large" : "chart-box";
  if (loading) return <div className={`${className} loading`}><Loader2 className="spin" /></div>;
  if (empty) return <div className={className}><EmptyInline message="Sem dados para o período." /></div>;
  return <div className={className}>{children}</div>;
}

export function PageState({
  icon: Icon,
  title,
  description,
  spin = false,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  spin?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "page-state compact" : "page-state"}>
      <Icon className={spin ? "spin" : ""} size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card card-pad" style={{ textAlign: "center", padding: "44px 24px" }}>
      <div className="state-ic" style={{ margin: "0 auto 14px", width: 52, height: 52 }}><Icon size={24} /></div>
      <h4 style={{ margin: "0 0 6px", fontSize: 16 }}>{title}</h4>
      <p className="t-sub" style={{ maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.55 }}>{description}</p>
      {actionLabel && onAction && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

/**
 * Standard "no data yet" screen shown across pages when the workspace has no
 * imported transactions. Renders a page header + a centered onboarding card so
 * every empty page looks consistent (like the Dashboard onboarding).
 * The primary CTA opens the import flow; an optional secondary action lets
 * manual-first pages (cards, goals, budgets) create directly.
 */
export function NoDataOnboarding({
  icon,
  eyebrow,
  title,
  description,
  onImport,
  secondaryLabel,
  onSecondary,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  onImport?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const Icon = icon;
  return (
    <div className="canvas stg">
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>
        <h2 className="section-title"><Icon size={18} /> {eyebrow}</h2>
      </div>
      <div className="card card-pad" style={{ textAlign: "center", padding: "44px 24px" }}>
        <div className="state-ic" style={{ margin: "0 auto 14px", width: 52, height: 52 }}><Icon size={24} /></div>
        <h4 style={{ margin: "0 0 6px", fontSize: 16 }}>{title}</h4>
        <p className="t-sub" style={{ maxWidth: 460, margin: "0 auto 18px", lineHeight: 1.55 }}>{description}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {onImport && (
            <button className="btn btn-primary btn-sm" onClick={onImport}>Importar extrato</button>
          )}
          {secondaryLabel && onSecondary && (
            <button className="btn btn-ghost btn-sm" onClick={onSecondary}>{secondaryLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return <div className="inline-error"><AlertCircle size={16} /> {message}</div>;
}

export function InlineSuccess({ message }: { message: string }) {
  return <div className="inline-success"><CheckCircle2 size={16} /> {message}</div>;
}

export function QualityRow({
  disabled = false,
  label,
  onClick,
  value,
  warn,
}: {
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  value: ReactNode;
  warn?: boolean;
}) {
  if (onClick && !disabled) {
    return (
      <button className="quality-row clickable" onClick={onClick} type="button">
        <span>{label}</span>
        <strong className={warn ? "warning" : ""}>{value}</strong>
      </button>
    );
  }

  return (
    <div className="quality-row">
      <span>{label}</span>
      <strong className={warn ? "warning" : ""}>{value}</strong>
    </div>
  );
}

export function StatusBadge({ label, status }: { label?: string; status: string }) {
  const normalized = status.toLowerCase();
  return <span className={`status-badge ${normalized}`}>{label ?? statusLabel(status)}</span>;
}

export function SourceBadge({ source, label }: { source?: string; label?: string }) {
  const value = source ?? "pending";
  return (
    <span className={`status-badge ${value}`}>
      {label ? `${label} · ${sourceLabel(value)}` : sourceLabel(value)}
    </span>
  );
}

export function SortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`sort-header ${active ? "active" : ""}`} onClick={onClick} type="button">
      {label}
      <span>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

export function PeriodFilter({
  dateFrom,
  dateTo,
  periodPreset,
  onPreset,
  onDateFrom,
  onDateTo,
}: {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
  onPreset: (preset: TransactionPeriodPreset) => void;
  onDateFrom: (date: string) => void;
  onDateTo: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const label = periodSummary({ dateFrom, dateTo, periodPreset }) || "Todos os períodos";
  const isCustom = periodPreset === "custom";

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  return (
    <div className="period-picker" ref={wrapperRef}>
      <button
        className={`period-picker-trigger ${periodPreset !== "all" ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <CalendarDays size={15} />
        <span>{label}</span>
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open ? (
        <div className="period-picker-popover">
          <p className="period-picker-heading">Período analisado</p>
          <div className="period-picker-presets">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.value}
                className={`period-preset-btn ${periodPreset === p.value ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPreset(p.value);
                  if (p.value !== "custom") setOpen(false);
                }}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
          {isCustom ? (
            <div className="period-picker-custom">
              <label>
                De
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFrom(e.target.value)}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateTo(e.target.value)}
                />
              </label>
              <button
                className="primary-button compact-button"
                onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
                type="button"
              >
                Aplicar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DedupeStatusBadge({ status }: { status: ReturnType<typeof dedupeStatus> }) {
  if (status === "principal") return <StatusBadge label="Principal" status="completed" />;
  if (status === "suggested") return <StatusBadge label="Principal sugerido" status="completed" />;
  return <StatusBadge label="Revisar" status="completed_with_errors" />;
}

export function CategoryBadge({ name, categoryId }: { name: string; categoryId: string }) {
  const color = categoryColor(categoryId);
  return (
    <span className="category-badge" style={{ background: color.bg, color: color.text }}>
      {name}
    </span>
  );
}

// PeriodState is re-exported for convenience so consumers can import from one place
export type { PeriodState, TransactionPeriodPreset };

// ---------------------------------------------------------------------------
// DashboardPeriodPicker — segmented control [M0][M-1][3M][1A][📅] + popover
// ---------------------------------------------------------------------------

export function DashboardPeriodPicker({ period, onChange }: { period: PeriodState; onChange: (p: PeriodState) => void }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(period.dateFrom);
  const [tempTo, setTempTo] = useState(period.dateTo);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    setTempFrom(period.dateFrom);
    setTempTo(period.dateTo);
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setPopoverOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popoverOpen, period.dateFrom, period.dateTo]);

  function applyPreset(preset: TransactionPeriodPreset) {
    const range = periodRange(preset);
    onChange({ ...range, periodPreset: preset });
    setPopoverOpen(false);
  }

  function applyCustom() {
    if (!tempFrom || !tempTo) return;
    onChange({ dateFrom: tempFrom, dateTo: tempTo, periodPreset: "custom" });
    setPopoverOpen(false);
  }

  function apply3Months() {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    onChange({ dateFrom: fmt(from), dateTo: fmt(to), periodPreset: "custom" });
    setPopoverOpen(false);
  }

  const isM0 = period.periodPreset === "current_month";
  const isM1 = period.periodPreset === "previous_month";
  const is3M = period.periodPreset === "custom" && (() => {
    const diff = Math.round((new Date(period.dateTo).getTime() - new Date(period.dateFrom).getTime()) / 86400000);
    return diff >= 88 && diff <= 93;
  })();
  const isCustom = period.periodPreset === "custom" && !is3M;

  return (
    <div className="dash-period-picker" ref={wrapperRef}>
      <div className="dash-period-segments">
        <button className={`dash-seg-btn${isM0 ? " active" : ""}`} onClick={() => applyPreset("current_month")} type="button" title="Mês atual">M0</button>
        <button className={`dash-seg-btn${isM1 ? " active" : ""}`} onClick={() => applyPreset("previous_month")} type="button" title="Mês anterior">M-1</button>
        <button className={`dash-seg-btn${is3M ? " active" : ""}`} onClick={apply3Months} type="button" title="Últimos 3 meses">3M</button>
        <button className={`dash-seg-btn${period.periodPreset === "current_year" ? " active" : ""}`} onClick={() => applyPreset("current_year")} type="button" title="Este ano">1A</button>
        <button className={`dash-seg-btn dash-seg-cal${isCustom ? " active" : ""}`} onClick={() => setPopoverOpen(v => !v)} type="button" title="Período personalizado">
          <CalendarDays size={14} />
          {isCustom ? <span>{period.dateFrom.slice(5).replace("-", "/")} → {period.dateTo.slice(5).replace("-", "/")}</span> : null}
        </button>
      </div>

      {popoverOpen && (
        <div className="dash-period-popover">
          <p className="dash-period-popover-title">Período personalizado</p>
          <div className="dash-period-presets">
            <button className="dash-period-preset-btn" onClick={() => applyPreset("current_month")} type="button">Mês atual</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("previous_month")} type="button">Mês anterior</button>
            <button className="dash-period-preset-btn" onClick={apply3Months} type="button">Últimos 3 meses</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("current_year")} type="button">Este ano</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("previous_year")} type="button">Ano anterior</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("all")} type="button">Tudo</button>
          </div>
          <div className="dash-period-divider" />
          <p className="dash-period-popover-label">Intervalo customizado</p>
          <div className="dash-period-inputs">
            <div className="dash-period-input-group">
              <label>De</label>
              <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)} />
            </div>
            <span className="dash-period-arrow">→</span>
            <div className="dash-period-input-group">
              <label>Até</label>
              <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)} />
            </div>
          </div>
          <div className="dash-period-popover-actions">
            <button className="dash-period-cancel" onClick={() => setPopoverOpen(false)} type="button">Cancelar</button>
            <button className="dash-period-apply" onClick={applyCustom} type="button" disabled={!tempFrom || !tempTo}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}
