/**
 * SmartCashFlow — DashboardPage.tsx
 * Visual idêntico ao wireframe aprovado + dados reais da API.
 * Copiar para: frontend/src/pages/DashboardPage.tsx
 *
 * Deps já no repo: react, @tanstack/react-query, recharts, lucide-react
 * CSS adicional: copiar design_handoff/inject/styles-additions.css → append em src/styles.css
 */

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line,
} from "recharts";
import {
  TrendingUp, TrendingDown,
  Clock, Check, ChevronRight, Sparkles, AlertTriangle,
  Target, CreditCard, Flag,
} from "lucide-react";

import type { ApiSession } from "../lib/api";
import { yearQueryFromDate } from "../lib/utils";
import type { ImportDrilldown, Page, PeriodState, TransactionDrilldown } from "../types";
import {
  getDashboardSummary, getMonthlyCashflow, getDailyCashflow,
  getCategoryRanking, getSubcategoryRanking, getDataQuality,
  getGoals, getBudgets, getCreditCards, getCalendarEvents,
  type DashboardSummary, type MonthlyCashflowItem, type DailyCashflowItem,
  type CategoryRankingItem, type SubcategoryRankingItem,
  type DataQuality, type GoalRead, type BudgetRead, type CreditCardRead,
  type CalendarEventRead,
} from "../lib/api";

// ─── Cores por categoria (mapeamento de nomes → hex) ──────────────────────────
const CAT_COLORS: Record<string, string> = {
  "Moradia": "#3567b8", "Habitação": "#3567b8", "Casa": "#3567b8",
  "Alimentação": "#1f8a5b", "Comida": "#1f8a5b", "Restaurante": "#1f8a5b",
  "Educação": "#6a52c9", "Ensino": "#6a52c9",
  "Transporte": "#c98a2b", "Mobilidade": "#c98a2b",
  "Saúde": "#cf4d43", "Médico": "#cf4d43",
  "Lazer": "#d98234", "Entretenimento": "#d98234",
  "Assinaturas": "#9a6b14", "Streaming": "#9a6b14",
  "Mercado": "#2a9d8f", "Supermercado": "#2a9d8f",
  "Serviços": "#7c8696",
  "Investimentos": "#135737", "Investimento": "#135737",
  "Renda": "#1f8a5b", "Receita": "#1f8a5b",
  "Outros": "#9aa3b0", "Sem categoria": "#9aa3b0",
};
function catColor(name: string): string {
  if (CAT_COLORS[name]) return CAT_COLORS[name];
  for (const [k, v] of Object.entries(CAT_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  const palette = Object.values(CAT_COLORS);
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[h % palette.length];
}

// ─── Formatação ────────────────────────────────────────────────────────────────
function brl(val: number | string | null | undefined, opts: { sign?: boolean; dec?: number } = {}): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "R$ 0";
  const { sign = false, dec = 0 } = opts;
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const s = n < 0 ? "−" : sign ? "+" : "";
  return `${s}R$ ${abs}`;
}
function num(val: number | string | null | undefined, dec = 0): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "0";
  return Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function pct(val: number | string | null | undefined, dec = 1): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "0%";
  return (Math.abs(n) * 100).toFixed(dec) + "%";
}
function periodQuery(p: PeriodState): string {
  if (!p.dateFrom && !p.dateTo) return "";
  const parts: string[] = [];
  if (p.dateFrom) parts.push(`date_from=${p.dateFrom}`);
  if (p.dateTo)   parts.push(`date_to=${p.dateTo}`);
  return "?" + parts.join("&");
}

// Always fetches the 12-month window ending at dateTo (or today). Used for
// sparklines and the "Mês" chart tab — independent of the period filter.
function trailing12Query(dateTo?: string): string {
  const end = dateTo ? new Date(dateTo + "T12:00:00") : new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return `?date_from=${iso(start)}&date_to=${iso(end)}`;
}

// ─── Sankey types ─────────────────────────────────────────────────────────────
type SankeyNodeDef = { id: string; label: string; value: number; color: string; kind?: string };
type SankeyColDef  = { id: string; nodes: SankeyNodeDef[] };
type SankeyLinkDef = { from: string; to: string; value: number; color: string };
interface LayoutNode extends SankeyNodeDef {
  _key: string; _col: number;
  x: number; y0: number; y1: number; flow: number;
  used_out: number; used_in: number;
  in_links: SankeyLinkDef[]; out_links: SankeyLinkDef[];
}
type LayoutFlow = {
  id: string; from: LayoutNode; to: LayoutNode;
  ay0: number; ay1: number; by0: number; by1: number;
  value: number; color: string;
};

// ─── Prototype icons ─────────────────────────────────────────────────────────
const D_ICONS: Record<string, string> = {
  wallet:  "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  arrowDR: "M7 7l10 10 M17 8v9H8",
  arrowUR: "M7 17L17 7 M8 7h9v9",
  flow:    "M4 6h10 M4 6l3-3 M4 6l3 3 M20 18H10 M20 18l-3-3 M20 18l-3 3 M4 12h16",
  pie:     "M12 3v9h9 M21 12a9 9 0 1 1-9-9 M21 12a9 9 0 0 0-9-9",
  zap:     "M13 3l-8 10h6l-1 8 8-10h-6z",
  shield:  "M12 3l7 3.5v5c0 4-3 7-7 8.5C5 18.5 2 15.5 2 11.5v-5L12 3z",
  check:   "M5 12l5 5 9-10",
  lock:    "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3",
  db:      "M12 5c4.4 0 8 1.1 8 2.5S16.4 10 12 10 4 8.9 4 7.5 7.6 5 12 5z M4 7.5v9c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-9 M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5",
  bars:    "M5 20V10 M12 20V4 M19 20v-7 M3 20h18",
  info:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  alert:   "M12 9v4 M12 17h.01 M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z",
  clock:   "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2",
  report:  "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5 M9 12h6 M9 16h4",
  chat:    "M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8 10h.01 M12 10h.01 M16 10h.01",
  flag:    "M5 3v18 M5 5l14 5-14 5",
  target:  "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  star:    "M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.7l-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2z",
  card:    "M3 7h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M3 11h18",
  spark:   "M9 3H5a2 2 0 0 0-2 2v4 M9 3l2.5 2.5L14 3l2.5 2.5L19 3h1a1 1 0 0 1 1 1v4 M2 9v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9 M7 15h4 M15 15h2",
};
function DIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = D_ICONS[name];
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

function Delta({ value, invert = false }: { value: number | null | undefined; invert?: boolean }) {
  if (value == null) return null;
  const up = value > 0;
  const good = invert ? !up : up;
  return (
    <span className={`delta ${up ? "up" : "down"}`} style={{ color: good ? "var(--pos)" : "var(--neg)" }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Bar2({ value, max, color, thin }: { value: number; max: number; color?: string; thin?: boolean }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const c = color ?? (w > 100 ? "var(--neg)" : w > 85 ? "var(--warn)" : "var(--acc)");
  return (
    <div className={`track${thin ? " thin" : ""}`}>
      <div className="fill" style={{ width: `${w}%`, background: c }} />
    </div>
  );
}

function SparkLine({ data, color = "var(--acc)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 72, h = 28;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 3) - 1,
  }));
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${lineD} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
  const gid = `sk-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Sankey layout ────────────────────────────────────────────────────────────
function layoutSankey(
  columns: SankeyColDef[], links: SankeyLinkDef[],
  { width, height, nodeW, gap, padX, padTopBot }:
  { width: number; height: number; nodeW: number; gap: number; padX: number; padTopBot: number },
): { nodes: Record<string, LayoutNode>; flows: LayoutFlow[] } {
  const nodes: Record<string, LayoutNode> = {};
  columns.forEach((col, ci) =>
    col.nodes.forEach(n => {
      const key = col.id + "/" + n.id;
      nodes[key] = { ...n, _key: key, _col: ci, in_links: [], out_links: [],
        x: 0, y0: 0, y1: 0, flow: 0, used_out: 0, used_in: 0 };
    })
  );
  links.forEach(l => {
    const fr = nodes[l.from], to = nodes[l.to];
    if (fr) fr.out_links.push(l);
    if (to) to.in_links.push(l);
  });
  Object.values(nodes).forEach(n => {
    const out = n.out_links.reduce((s, l) => s + l.value, 0);
    const inc = n.in_links.reduce((s, l) => s + l.value, 0);
    n.flow = Math.max(out, inc, n.value ?? 0);
  });
  const colTotals = columns.map(c => c.nodes.reduce((s, n) => s + nodes[c.id + "/" + n.id].flow, 0));
  const maxTotal  = Math.max(...colTotals) || 1;
  const maxNodes  = Math.max(...columns.map(c => c.nodes.length));
  const availH    = height - padTopBot * 2 - (maxNodes - 1) * gap;
  const scale     = availH / maxTotal;
  const cols      = columns.length;
  const colX      = (i: number) => padX + (width - padX * 2 - nodeW) * (i / (cols - 1));
  columns.forEach((col, ci) => {
    const total = colTotals[ci];
    const colH  = total * scale + (col.nodes.length - 1) * gap;
    let cursor  = padTopBot + (availH + (maxNodes - 1) * gap - colH) / 2;
    col.nodes.forEach(n => {
      const node = nodes[col.id + "/" + n.id];
      node.x  = colX(ci);
      node.y0 = cursor;
      node.y1 = cursor + node.flow * scale;
      cursor  = node.y1 + gap;
    });
  });
  Object.values(nodes).forEach(n => { n.used_out = n.y0; n.used_in = n.y0; });
  columns.forEach(col => col.nodes.forEach(n => {
    const node = nodes[col.id + "/" + n.id];
    node.out_links.sort((a, b) => (nodes[a.to]?.y0 ?? 0) - (nodes[b.to]?.y0 ?? 0));
    node.in_links.sort((a, b)  => (nodes[a.from]?.y0 ?? 0) - (nodes[b.from]?.y0 ?? 0));
  }));
  const flows: LayoutFlow[] = [];
  const MIN = 1.4;
  columns.forEach((col, ci) => {
    if (ci === cols - 1) return;
    col.nodes.forEach(n => {
      const a = nodes[col.id + "/" + n.id];
      a.out_links.forEach(l => {
        const b = nodes[l.to];
        if (!b) return;
        const h = l.value * scale;
        const ay0 = a.used_out, ay1 = Math.max(ay0 + h, ay0 + MIN);
        const by0 = b.used_in,  by1 = Math.max(by0 + h, by0 + MIN);
        a.used_out = ay1;
        b.used_in  = by1;
        flows.push({ id: l.from + "→" + l.to, from: a, to: b,
          ay0, ay1, by0, by1, value: l.value, color: l.color || a.color });
      });
    });
  });
  return { nodes, flows };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, cur, unit, iconName, delta, deltaInvert, hint, spark, sub, subColor,
}: {
  label: string; value: string; cur?: string | null; unit?: string;
  iconName: string; delta?: number | null;
  deltaInvert?: boolean; hint?: string; spark?: number[]; sub?: string; subColor?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div className="kpi-ic"><DIcon name={iconName} size={15} /></div>
        <span className="kpi-label">{label}</span>
        {hint && (
          <span title={hint} style={{ marginLeft: "auto", color: "var(--ink-faint)", cursor: "help", lineHeight: 1 }}>
            <DIcon name="info" size={13} />
          </span>
        )}
      </div>
      <div className="kpi-val">
        {cur && <span className="cur">{cur}</span>}
        {value}
        {unit && <span className="cur" style={{ marginLeft: 2 }}>{unit}</span>}
      </div>
      {(delta != null || sub) && (
        <div className="kpi-sub">
          {delta != null && <Delta value={delta} invert={deltaInvert} />}
          {sub && <span style={{ color: subColor ?? "var(--ink-faint)", fontSize: 11, fontWeight: subColor ? 700 : 400 }}>{sub}</span>}
        </div>
      )}
      {spark && (
        <div className="kpi-spark" style={{ opacity: 0.7 }}>
          <SparkLine data={spark} />
        </div>
      )}
    </div>
  );
}

// ─── Story Strip ──────────────────────────────────────────────────────────────
function StoryStrip({ summary }: { summary: DashboardSummary }) {
  const income     = parseFloat(summary.income      ?? "0");
  const expenses   = parseFloat(summary.expenses    ?? "0");
  const balance    = parseFloat(summary.balance     ?? "0");
  const payments   = parseFloat(summary.payments    ?? "0");
  const currentBal = parseFloat(summary.current_balance ?? "0");
  const saldoPrev  = (currentBal || balance) - payments;
  const steps = [
    { label: "Entrou",                value: income,    tone: "pos" as const, iconName: "arrowDR" },
    { label: "Saiu",                  value: -expenses, tone: "neg" as const, iconName: "arrowUR" },
    { label: "Sobrou",                value: balance,   tone: "acc" as const, iconName: "wallet",  strong: true },
    { label: "Compromissos a vencer", value: -payments, tone: "neg" as const, iconName: "clock" },
    { label: "Saldo previsto",        value: saldoPrev, tone: "acc" as const, iconName: "flow",    strong: true },
  ];
  const colors: Record<string, string> = { pos: "var(--pos)", neg: "var(--neg)", acc: "var(--acc-ink)" };
  return (
    <div className="card card-pad story">
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i === 2 || i === 3 ? "1.2" : "1" }}>
            <div className={`story-step${s.strong ? " strong" : ""}`}>
              <div className="story-lab">
                <span className="story-ic" style={{ color: colors[s.tone] }}>
                  <DIcon name={s.iconName} size={14} />
                </span>
                {s.label}
              </div>
              <div className="story-val" style={{ color: colors[s.tone] }}>
                {brl(s.value)}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="story-arrow">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Deck ─────────────────────────────────────────────────────────────────
function KpiDeck({
  summary, monthly, prevMonth, qualityRatio,
}: {
  summary: DashboardSummary;
  monthly: MonthlyCashflowItem[];
  prevMonth: MonthlyCashflowItem | null;
  qualityRatio: number | null;
}) {
  const sr  = summary.savings_rate  ? parseFloat(summary.savings_rate)  * 100 : null;
  const cr  = summary.commitment_rate ? parseFloat(summary.commitment_rate) * 100 : null;
  const savingsTargetPct = summary.savings_target ? parseFloat(summary.savings_target) * 100 : null;
  const commitLimitPct = summary.commitment_limit ? parseFloat(summary.commitment_limit) * 100 : null;

  // build sparklines from last 6 months (values in thousands for proportionality)
  const sparkInc  = monthly.slice(-6).map(m => parseFloat(m.income   ?? "0") / 1000);
  const sparkExp  = monthly.slice(-6).map(m => parseFloat(m.expenses ?? "0") / 1000);
  const sparkBal  = monthly.slice(-6).map(m => parseFloat(m.closing_balance ?? "0") / 1000);
  const sparkFlow = monthly.slice(-6).map(m => (parseFloat(m.income ?? "0") - parseFloat(m.expenses ?? "0")) / 1000);

  // month-over-month delta helpers
  function mdelta(curr: number, prev: number | null | undefined): number | null {
    if (!prev) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }
  const pInc  = prevMonth ? parseFloat(prevMonth.income   ?? "0") : null;
  const pExp  = prevMonth ? parseFloat(prevMonth.expenses ?? "0") : null;
  const pBal  = prevMonth ? parseFloat(prevMonth.balance  ?? "0") : null;
  const pCbal = prevMonth ? parseFloat(prevMonth.closing_balance ?? "0") : null;
  const pSr   = (prevMonth && pInc && pInc > 0)
    ? ((pInc - (pExp ?? 0)) / pInc) * 100 : null;

  const currInc  = parseFloat(summary.income   ?? "0");
  const currExp  = parseFloat(summary.expenses ?? "0");
  const currBal  = parseFloat(summary.balance  ?? "0");
  const currCbal = parseFloat(summary.current_balance ?? summary.balance ?? "0");

  const vsLabel = prevMonth ? "vs. mês ant." : undefined;
  const tiles = [
    { label: "Saldo atual",       value: num(summary.current_balance ?? summary.balance), cur: "R$", iconName: "wallet",
      sub: vsLabel ?? (summary.current_balance ? `em ${summary.current_balance_account ?? "conta"}` : "do fluxo"),
      spark: sparkBal.length >= 2 ? sparkBal : undefined,
      delta: mdelta(currCbal, pCbal) },
    { label: "Receitas",          value: num(summary.income),   cur: "R$", iconName: "arrowDR",
      sub: vsLabel,
      spark: sparkInc.length >= 2 ? sparkInc : undefined,
      delta: mdelta(currInc, pInc) },
    { label: "Despesas",          value: num(summary.expenses), cur: "R$", iconName: "arrowUR",
      sub: vsLabel,
      spark: sparkExp.length >= 2 ? sparkExp : undefined,
      delta: mdelta(currExp, pExp), deltaInvert: true },
    { label: "Fluxo líquido",     value: num(summary.balance),  cur: "R$", iconName: "flow",
      sub: vsLabel,
      spark: sparkFlow.length >= 2 ? sparkFlow : undefined,
      delta: mdelta(currBal, pBal) },
    { label: "Saving rate",       value: sr != null ? num(sr, 1) : "—", unit: sr != null ? "%" : undefined, iconName: "pie",
      sub: savingsTargetPct != null ? `meta ${num(savingsTargetPct, 0)}%${summary.savings_on_target ? " ✓" : ""}` : vsLabel,
      subColor: summary.savings_on_target ? "var(--pos)" : undefined,
      delta: (sr != null && pSr != null) ? (sr - pSr) : null },
    { label: "Burn rate",         value: num(summary.burn_rate), cur: "R$", iconName: "zap",    hint: summary.burn_rate_basis || "Média de gastos dos últimos meses" },
    { label: "Runway",            value: num(summary.burn_rate_months, 0), unit: " meses", iconName: "shield", hint: "Reserva de emergência ÷ burn rate" },
    { label: "Gasto seguro hoje", value: summary.safe_spend ? num(summary.safe_spend) : "—", cur: summary.safe_spend ? "R$" : undefined, iconName: "check", hint: summary.safe_spend_basis || "Saldo disponível ÷ dias restantes do mês" },
    { label: "Comprometimento",   value: cr != null ? num(cr, 0) : "—", unit: cr != null ? "%" : undefined, iconName: "lock",
      hint: `Despesas ÷ receita${commitLimitPct != null ? ` · limite ${num(commitLimitPct, 0)}%` : ""}`,
      sub: commitLimitPct != null ? (summary.commitment_over_limit ? `acima do limite (${num(commitLimitPct, 0)}%)` : `limite ${num(commitLimitPct, 0)}%`) : undefined,
      subColor: summary.commitment_over_limit ? "var(--neg)" : undefined },
    { label: "Qualidade dos dados", value: qualityRatio != null ? num(qualityRatio, 0) : "—", unit: qualityRatio != null ? "%" : undefined, iconName: "db" },
  ];
  return (
    <div className="kpi-deck">
      {tiles.map((t, i) => (
        <KpiCard key={i} {...t} cur={t.cur ?? null} />
      ))}
    </div>
  );
}

// ─── Flow Chart ───────────────────────────────────────────────────────────────
const FLOW_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type FlowEntry = {
  label: string; inc: number; exp: number;
  acc: number | null; accProj: number | null; accPos: number; accNeg: number; proj: boolean;
};

function FlowCard({
  daily, yearMonthly, periodDateFrom, periodDateTo,
}: { daily: DailyCashflowItem[]; yearMonthly: MonthlyCashflowItem[]; periodDateFrom?: string; periodDateTo?: string }) {
  const [mode, setMode] = useState<"day" | "month">("day");

  const today = new Date().toISOString().slice(0, 10);

  const dayData: FlowEntry[] = useMemo(() => {
    const items = daily.map(d => ({
      label: d.date.slice(8),
      inc: parseFloat(d.income   ?? "0"),
      exp: -parseFloat(d.expenses ?? "0"),
      val: parseFloat(d.closing_balance ?? "0"),
      proj: d.date > today,
    }));

    // Extend projection to end of filtered period if API returned fewer days
    const endDate = periodDateTo ?? today;
    const lastDate = items.length ? (daily[daily.length - 1]?.date ?? today) : today;
    if (lastDate < endDate) {
      const actual = items.filter(it => !it.proj);
      const n = actual.length || 1;
      const avgInc = actual.reduce((s, it) => s + it.inc,  0) / n;
      const avgExp = actual.reduce((s, it) => s + (-it.exp), 0) / n;
      let val = items.length ? items[items.length - 1].val : 0;
      const d = new Date(lastDate + "T12:00:00");
      d.setDate(d.getDate() + 1);
      const end = new Date(endDate + "T12:00:00");
      while (d <= end) {
        val += avgInc - avgExp;
        items.push({ label: String(d.getDate()).padStart(2, "0"), inc: avgInc, exp: -avgExp, val, proj: true });
        d.setDate(d.getDate() + 1);
      }
    }

    let lastActualIdx = -1;
    items.forEach((it, i) => { if (!it.proj) lastActualIdx = i; });
    return items.map((it, i) => ({
      label: it.label, inc: it.inc, exp: it.exp, proj: it.proj,
      acc:     it.proj ? null : it.val,
      accProj: (!it.proj && i < lastActualIdx) ? null : it.val,
      accPos:  Math.max(0, it.val),
      accNeg:  Math.min(0, it.val),
    }));
  }, [daily, today, periodDateTo]);

  const monData: FlowEntry[] = useMemo(() => {
    const year = periodDateFrom ? parseInt(periodDateFrom.slice(0, 4)) : new Date().getFullYear();
    const todayD = new Date();
    const currentYM = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, "0")}`;
    const actualMap = new Map(yearMonthly.map(m => [m.month.slice(0, 7), m]));
    const actualItems = yearMonthly.filter(m => m.month.slice(0, 7) <= currentYM);
    const lastN = actualItems.slice(-3);
    const avgInc = lastN.length ? lastN.reduce((s, m) => s + parseFloat(m.income ?? "0"), 0) / lastN.length : 0;
    const avgExp = lastN.length ? lastN.reduce((s, m) => s + parseFloat(m.expenses ?? "0"), 0) / lastN.length : 0;
    let runAcc = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const mo = i + 1;
      const ym = `${year}-${String(mo).padStart(2, "0")}`;
      const isActual = ym <= currentYM;
      const isLast   = ym === currentYM;
      const m = actualMap.get(ym);
      const inc = isActual ? parseFloat(m?.income   ?? "0") : avgInc;
      const exp = isActual ? parseFloat(m?.expenses ?? "0") : avgExp;
      runAcc += inc - exp;
      return {
        label: FLOW_MONTHS[i],
        inc, exp: -exp, proj: !isActual,
        acc:     isActual ? runAcc : null,
        accProj: (!isActual || isLast) ? runAcc : null,
        accPos:  Math.max(0, runAcc),
        accNeg:  Math.min(0, runAcc),
      };
    });
  }, [yearMonthly, periodDateFrom]);

  const data = mode === "day" ? dayData : monData;

  if (!data.length) {
    return (
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260 }}>
        <div className="state"><div className="state-ic"><DIcon name="bars" size={22} /></div><h4>Sem dados de fluxo</h4><p>Importe extratos para ver o gráfico.</p></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><DIcon name="bars" size={15} /></div>
        <div>
          <div className="ttl">A história do seu dinheiro</div>
          <div className="sub">Entradas, saídas e saldo acumulado</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <div className="seg">
            <button className={mode === "day" ? "on" : ""} onClick={() => setMode("day")}>Dia</button>
            <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>Mês</button>
          </div>
        </div>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sobra-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--pos)", stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: "var(--pos)", stopOpacity: 0.02 }} />
              </linearGradient>
              <linearGradient id="neg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--neg)", stopOpacity: 0.02 }} />
                <stop offset="100%" style={{ stopColor: "var(--neg)", stopOpacity: 0.22 }} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `R$${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(0)}k` : Math.abs(v)}`} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
              formatter={(value: number, name: string) => {
                if (name === "accPos" || name === "accNeg") return ["", ""] as [string, string];
                return [brl(Math.abs(value ?? 0)), name === "inc" ? "Receitas" : name === "exp" ? "Despesas" : name === "acc" ? "Saldo acumulado" : "Saldo projetado"];
              }}
              labelStyle={{ color: "var(--ink-2)", fontWeight: 700 }}
            />
            <ReferenceLine y={0} stroke="var(--line-strong)" strokeWidth={1} />
            <Area type="monotone" dataKey="accPos" fill="url(#sobra-grad)" stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />
            <Area type="monotone" dataKey="accNeg" fill="url(#neg-grad)" stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />
            <Bar dataKey="inc" name="inc" maxBarSize={16} radius={[2, 2, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill="var(--acc)" opacity={entry.proj ? 0.45 : 0.9} />
              ))}
            </Bar>
            <Bar dataKey="exp" name="exp" maxBarSize={16} radius={[0, 0, 2, 2]}>
              {data.map((entry, i) => (
                <Cell key={i} fill="var(--neg)" opacity={entry.proj ? 0.4 : 0.72} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="acc" name="acc" stroke="var(--acc-strong)" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="accProj" name="accProj" stroke="var(--acc-strong)" strokeWidth={2} dot={false} strokeDasharray="5 3" connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="legend" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <span className="legend-item"><span className="lz" style={{ background: "var(--acc)" }} />Receitas</span>
          <span className="legend-item"><span className="lz" style={{ background: "var(--neg)" }} />Despesas</span>
          <span className="legend-item"><span className="lz" style={{ background: "var(--acc-strong)" }} />Saldo acumulado</span>
          <span className="legend-item" style={{ gap: 5, alignItems: "center" }}>
            <svg width={20} height={8} style={{ flex: "none" }}><line x1="0" y1="4" x2="20" y2="4" stroke="var(--acc-strong)" strokeWidth={2} strokeDasharray="5 3" /></svg>
            Saldo projetado
          </span>
          <span className="legend-item" style={{ marginLeft: "auto", color: "var(--ink-faint)", fontSize: 11, gap: 4 }}>
            <DIcon name="info" size={12} />
            Pagamentos de fatura não entram como despesa comum
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Health Card ─────────────────────────────────────────────────────────────
function HealthCard({ summary }: { summary: DashboardSummary }) {
  const score = summary.financial_health_score ?? 0;
  const sr    = summary.savings_rate    ? parseFloat(summary.savings_rate)    * 100 : null;
  const cr    = summary.commitment_rate ? parseFloat(summary.commitment_rate) * 100 : null;
  const rm    = summary.burn_rate_months ?? 0;
  const factors = [
    { label: "Saving rate",        val: sr != null ? Math.min(100, sr * 2.5) : 0,  note: sr != null ? `${num(sr, 1)}%` : "—" },
    { label: "Comprometimento",    val: cr != null ? Math.max(0, 100 - cr)   : 0,  note: cr != null ? `${num(cr, 0)}%` : "—" },
    { label: "Runway",             val: Math.min(100, rm * 12),                     note: `${num(rm, 1)} meses` },
    { label: "Qualidade dos dados", val: score, note: `${score}/100` },
  ];
  const angle = (score / 100) * 251;
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <svg width={96} height={96} style={{ flex: "none" }}>
          <circle cx={48} cy={48} r={40} fill="none" stroke="var(--line)" strokeWidth={9} />
          <circle cx={48} cy={48} r={40} fill="none" stroke="var(--acc)" strokeWidth={9}
            strokeDasharray={`${angle} 251`} strokeLinecap="round"
            transform="rotate(-90 48 48)" />
          <text x={48} y={44} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-display)">{score || "—"}</text>
          <text x={48} y={58} textAnchor="middle" fontSize={10} fill="var(--ink-faint)" fontFamily="var(--font-mono)">/100</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="section-title" style={{ fontSize: 15 }}>Saúde financeira</span>

          </div>
          <div className="section-sub">
            {score >= 75 ? "Boa — com espaço para evoluir." : score >= 50 ? "Regular — atenção às despesas." : "Crítica — revise seu orçamento."}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {factors.map((f, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{f.label}</span>
              <span className="mono" style={{ color: "var(--ink-3)" }}>{f.note}</span>
            </div>
            <Bar2 value={f.val} max={100} thin />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top Categorias (expansível) ─────────────────────────────────────────────
function TopCats({
  categories, subcategories, onNav,
}: {
  categories: CategoryRankingItem[];
  subcategories: SubcategoryRankingItem[];
  onNav: (p: Page) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const top = categories.filter(c => c.category_name !== "Renda").slice(0, 6);
  const totalExp = top.reduce((s, c) => s + parseFloat(c.amount ?? "0"), 0) || 1;

  if (!top.length) {
    return (
      <div className="card">
        <div className="card-head">
          <div className="kpi-ic"><DIcon name="pie" size={15} /></div>
          <div><div className="ttl">Top categorias</div></div>
        </div>
        <div className="state"><div className="state-ic"><DIcon name="pie" size={20} /></div><h4>Sem dados de categoria</h4><p>Categorize suas transações para ver o ranking.</p></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><DIcon name="pie" size={15} /></div>
        <div>
          <div className="ttl">Top categorias</div>
          <div className="sub">Clique para ver subcategorias</div>
        </div>
        <div className="spacer" />

        <button className="btn btn-quiet btn-sm" onClick={() => onNav("cashflow")}>
          Detalhar <ChevronRight size={13} />
        </button>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 8, paddingTop: 4 }}>
        {top.map((c, i) => {
          const color  = c.color ?? catColor(c.category_name);
          const amount = parseFloat(c.amount ?? "0");
          const share  = (amount / totalExp) * 100;
          const isOpen = open === (c.category_id ?? c.category_name);
          const subs   = subcategories
            .filter(s => s.category_id === c.category_id)
            .sort((a, b) => parseFloat(b.amount ?? "0") - parseFloat(a.amount ?? "0"));

          return (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setOpen(isOpen ? null : (c.category_id ?? c.category_name))}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 11px",
                  background: isOpen ? "var(--card-2)" : "transparent", transition: "background .12s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", display: "grid" }}>
                    <ChevronRight size={12} />
                  </span>
                  <span className="catdot" style={{ background: color }} />
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{c.category_name}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{brl(amount)}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", width: 42, textAlign: "right" }}>{num(share, 1)}%</span>
                </div>
                <div className="track thin">
                  <div className="fill" style={{ width: `${Math.min(100, share * 2.2)}%`, background: color }} />
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: "1px solid var(--line)", padding: "4px 11px 9px 28px" }}>
                  {subs.length === 0 ? (
                    <div style={{ padding: "8px 0", fontSize: 12, color: "var(--ink-3)" }}>
                      Sem subcategorias no período.
                    </div>
                  ) : subs.map((s, j) => {
                    const sv   = parseFloat(s.amount ?? "0");
                    const spct = amount > 0 ? (sv / amount) * 100 : 0;
                    return (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                        borderBottom: j < subs.length - 1 ? "1px dashed var(--line)" : "none" }}>
                        <span className="catdot" style={{ background: color, width: 7, height: 7, flex: "none" }} />
                        <span style={{ fontWeight: 600, fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.subcategory_name}</span>
                        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", flex: "none" }}>{s.count} lanç.</span>
                        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 12, minWidth: 74, textAlign: "right" }}>{brl(sv)}</span>
                        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", width: 34, textAlign: "right" }}>{num(spct, 0)}%</span>
                      </div>
                    );
                  })}
                  <button className="btn btn-quiet btn-sm" style={{ marginTop: 8 }} onClick={() => onNav("cashflow")}>
                    Ver no fluxo de caixa <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Upcoming ─────────────────────────────────────────────────────────────────
function UpcomingCard({ events, onNav }: { events: CalendarEventRead[]; onNav: (p: Page) => void }) {
  const upcoming = events
    .filter(e => e.status === "planned")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6);

  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><Clock size={15} /></div>
        <div><div className="ttl">Próximos compromissos</div><div className="sub">Vencimentos planejados</div></div>
        <div className="spacer" />
        <button className="btn btn-quiet btn-sm" onClick={() => onNav("calendar")}>
          Calendário <ChevronRight size={13} />
        </button>
      </div>
      {upcoming.length === 0 ? (
        <div className="state" style={{ padding: "28px 20px" }}>
          <div className="state-ic"><Clock size={18} /></div>
          <h4>Nenhum compromisso</h4>
          <p>Crie eventos no calendário para acompanhar vencimentos.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav("calendar")}>Abrir calendário</button>
        </div>
      ) : (
        <div style={{ padding: "6px 8px" }}>
          {upcoming.map((e, i) => {
            const d    = new Date(e.due_date + "T12:00:00");
            const day  = d.getDate();
            const mon  = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
            const amt  = e.amount ? parseFloat(e.amount) : null;
            return (
              <div key={i} className="row-item">
                <div className="date-chip">
                  <span className="d">{day}</span>
                  <span className="m">{mon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-desc" style={{ fontSize: 13 }}>{e.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span className="t-sub">{e.event_type}</span>
                    <span className={`sdot ${e.status}`} />
                    <span className="t-sub">{e.recurrence === "monthly" ? "mensal" : "único"}</span>
                  </div>
                </div>
                {amt != null && (
                  <div style={{ fontWeight: 700, color: "var(--neg)", fontVariantNumeric: "tabular-nums", fontSize: 13.5 }}>
                    {brl(-amt)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Cards Mini ───────────────────────────────────────────────────────────────
function cardShade(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 36);
  const g = Math.max(0, ((n >> 8) & 255) - 26);
  const b = Math.max(0, (n & 255) - 14);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function CardsMini({ cards, onNav }: { cards: CreditCardRead[]; onNav: (p: Page) => void }) {
  const active = cards.filter(c => c.active).slice(0, 3);
  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><CreditCard size={15} /></div>
        <div><div className="ttl">Cartões de crédito</div></div>
        <div className="spacer" />
        <button className="btn btn-quiet btn-sm" onClick={() => onNav("cards")}>
          Gerenciar <ChevronRight size={13} />
        </button>
      </div>
      {active.length === 0 ? (
        <div className="state" style={{ padding: "20px" }}>
          <div className="state-ic"><CreditCard size={18} /></div>
          <p>Nenhum cartão cadastrado.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav("cards")}>Cadastrar cartão</button>
        </div>
      ) : (
        <div className="card-body" style={{ display: "grid", gap: 14 }}>
          {active.map((c, i) => {
            const limit = c.limit_amount ? parseFloat(c.limit_amount) : 0;
            const col = c.color || catColor(c.issuer ?? c.name);
            return (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                  <span style={{ width: 26, height: 18, borderRadius: 4, background: `linear-gradient(135deg, ${col}, ${cardShade(col)})`, flex: "none" }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                  {c.last_four && <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>•{c.last_four}</span>}
                  <span className="t-sub" style={{ marginLeft: "auto" }}>fecha dia {c.closing_day}</span>
                </div>
                {limit > 0 && (
                  <>
                    <div className="track thin">
                      <div className="fill" style={{ width: "0%", background: col }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span className="t-sub">limite {brl(limit)}</span>
                      <span className="t-sub">vence dia {c.due_day}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Data Quality ────────────────────────────────────────────────────────────
function DataQualityCard({ quality, onNav }: { quality: DataQuality; onNav: (p: Page) => void }) {
  const ratio  = quality.categorized_ratio ? parseFloat(quality.categorized_ratio) * 100 : 0;
  const circ   = 2 * Math.PI * 22; // r=22 → C≈138.23
  const dash   = (ratio / 100) * circ;
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <svg width={56} height={56} style={{ flex: "none" }}>
          <circle cx={28} cy={28} r={22} fill="none" stroke="var(--line)" strokeWidth={6} />
          <circle cx={28} cy={28} r={22} fill="none" stroke="var(--acc)" strokeWidth={6}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 28 28)" />
          <text x={28} y={32} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-display)">{num(ratio, 0)}%</text>
        </svg>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Qualidade dos dados</div>
          <div className="t-sub">
            {quality.uncategorized_count > 0
              ? `${quality.uncategorized_count} transações sem categoria`
              : "Todas categorizadas ✓"}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {quality.uncategorized_count > 0
          ? `Categorize ${quality.uncategorized_count} transações pendentes para melhorar a precisão dos indicadores.`
          : "Excelente! Todas as transações estão categorizadas."}
      </p>
      {quality.uncategorized_count > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={() => onNav("review")}>
          <Check size={14} /> Revisar pendências
        </button>
      )}
    </div>
  );
}

// ─── Budget Mini ─────────────────────────────────────────────────────────────
function BudgetMini({ budgets, onNav }: { budgets: BudgetRead[]; onNav: (p: Page) => void }) {
  const active = budgets.filter(b => b.active).slice(0, 4);
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div className="kpi-ic" style={{ width: 28, height: 28 }}><Target size={14} /></div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Orçamento do mês</div>
          <div className="t-sub">Planejado vs. realizado</div>
        </div>
        <button className="btn btn-quiet btn-sm" style={{ marginLeft: "auto" }} onClick={() => onNav("budgets")}>
          Abrir <ChevronRight size={13} />
        </button>
      </div>
      {active.length === 0 ? (
        <div className="state" style={{ padding: "12px 0" }}>
          <p>Nenhum orçamento ativo.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav("budgets")}>Criar orçamento</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {active.map((b, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{b.name}</span>
                <span className="mono" style={{ color: "var(--ink-3)" }}>limite {brl(b.limit_amount)}</span>
              </div>
              <div className="track thin">
                <div className="fill" style={{ width: "0%", background: "var(--acc)" }} />
              </div>
              <div className="t-sub" style={{ marginTop: 3 }}>
                {new Date(b.period_start).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })} →{" "}
                {b.period_end
                  ? new Date(b.period_end).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })
                  : "sem fim"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Goals Mini ──────────────────────────────────────────────────────────────
function GoalsMini({ goals, onNav }: { goals: GoalRead[]; onNav: (p: Page) => void }) {
  const active = goals.filter(g => g.status === "active").slice(0, 3);
  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><Flag size={15} /></div>
        <div><div className="ttl">Metas em andamento</div></div>
        <div className="spacer" />
        <button className="btn btn-quiet btn-sm" onClick={() => onNav("goals")}>
          Ver metas <ChevronRight size={13} />
        </button>
      </div>
      {active.length === 0 ? (
        <div className="state" style={{ padding: "24px 20px" }}>
          <div className="state-ic"><Flag size={18} /></div>
          <h4>Nenhuma meta ativa</h4>
          <p>Crie metas para acompanhar seus objetivos financeiros.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav("goals")}>Criar meta</button>
        </div>
      ) : (
        <div className="card-body" style={{ display: "grid", gap: 13 }}>
          {active.map((g, i) => {
            const target  = parseFloat(g.target_amount ?? "0");
            const current = parseFloat(g.current_amount ?? "0");
            const p = target > 0 ? (current / target) * 100 : 0;
            return (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span className="goal-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                    <Target size={14} />
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{g.name}</span>
                  <span className="mono" style={{ color: "var(--ink-faint)", fontSize: 11 }}>{num(p, 0)}%</span>
                </div>
                <Bar2 value={current} max={target} color={p >= 100 ? "var(--acc)" : "var(--info)"} thin />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span className="t-sub mono">{brl(current)} / {brl(target)}</span>
                  {g.target_date && <span className="t-sub">{new Date(g.target_date).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tip Card ────────────────────────────────────────────────────────────────
function TipCard({ summary, onNav }: { summary: DashboardSummary; onNav: (p: Page) => void }) {
  const sr = summary.savings_rate ? parseFloat(summary.savings_rate) * 100 : null;
  const target = summary.savings_target ? Math.round(parseFloat(summary.savings_target) * 100) : 20;
  return (
    <div className="card card-pad" style={{ background: "linear-gradient(135deg, var(--acc-soft), var(--card))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="goal-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)", border: "1px solid var(--acc-soft-2)" }}>
          <Sparkles size={14} />
        </span>
        <span className="eyebrow" style={{ color: "var(--acc-ink)" }}>Resumo do período</span>

      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink)", fontWeight: 500 }}>
        {sr != null && sr > 0
          ? <>Você poupou <b>{pct(summary.savings_rate)}</b> da renda neste período — {sr >= target ? `acima da sua meta de ${target}%.` : `continue avançando rumo aos ${target}%.`}</>
          : "Importe seus extratos para receber dicas personalizadas baseadas no seu fluxo real."}
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNav("reports")}>
        Ver relatório completo
      </button>
    </div>
  );
}

// ─── Priority Alert ───────────────────────────────────────────────────────────
function PriorityAlert({ events, onNav }: { events: CalendarEventRead[]; onNav: (p: Page) => void }) {
  const soon = events
    .filter(e => e.status === "planned")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);
  const total = soon.reduce((s, e) => s + (e.amount ? parseFloat(e.amount) : 0), 0);
  if (!soon.length || total === 0) return null;
  const titles = soon.map(e => e.title).join(", ");
  return (
    <div className="alert warn" style={{ marginBottom: 16 }}>
      <div className="alert-ic"><AlertTriangle size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="a-ttl">Compromissos próximos: {brl(total)}</div>
        <div className="a-txt">{titles} nos próximos dias.</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNav("calendar")}>
          <Clock size={13} /> Ver calendário
        </button>
        <button className="btn btn-quiet btn-sm" onClick={() => onNav("planning")}>
          Ver projeção
        </button>
      </div>
    </div>
  );
}

// ─── Sankey SVG Chart ─────────────────────────────────────────────────────────
function SankeyChart({
  columns, links, height = 320, width = 1200, nodeW = 14,
  gap = 4, padX = 14, padTopBot = 18, compact = false,
}: {
  columns: SankeyColDef[]; links: SankeyLinkDef[];
  height?: number; width?: number; nodeW?: number;
  gap?: number; padX?: number; padTopBot?: number; compact?: boolean;
}) {
  const [hoverFlow, setHoverFlow] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const { nodes, flows } = useMemo(
    () => layoutSankey(columns, links, { width, height, nodeW, gap, padX, padTopBot }),
    [JSON.stringify(columns), JSON.stringify(links), height, width, nodeW, gap, padX, padTopBot]
  );
  function flowPath(f: LayoutFlow) {
    const x0 = f.from.x + nodeW, x1 = f.to.x, mx = (x0 + x1) / 2;
    return `M ${x0} ${f.ay0} C ${mx} ${f.ay0} ${mx} ${f.by0} ${x1} ${f.by0} L ${x1} ${f.by1} C ${mx} ${f.by1} ${mx} ${f.ay1} ${x0} ${f.ay1} Z`;
  }
  const nodeList = Object.values(nodes);
  const fs = compact ? 10 : 11;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", display: "block", overflow: "visible" }}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => { setHoverFlow(null); setHoverNode(null); }}>
        {flows.map(f => {
          const dim = (hoverFlow && hoverFlow !== f.id) ||
            (hoverNode && f.from._key !== hoverNode && f.to._key !== hoverNode);
          return (
            <path key={f.id} d={flowPath(f)} fill={f.color}
              opacity={dim ? 0.08 : hoverFlow === f.id ? 0.7 : 0.42}
              onMouseEnter={() => setHoverFlow(f.id)}
              onMouseLeave={() => setHoverFlow(null)}
              style={{ transition: "opacity .12s", cursor: "pointer" }} />
          );
        })}
        {nodeList.map(n => (
          <rect key={n._key} x={n.x} y={n.y0} width={nodeW}
            height={Math.max(2, n.y1 - n.y0)} rx={2} fill={n.color}
            opacity={hoverNode && hoverNode !== n._key ? 0.45 : 1}
            onMouseEnter={() => setHoverNode(n._key)}
            onMouseLeave={() => setHoverNode(null)}
            style={{ transition: "opacity .12s" }} />
        ))}
        {nodeList.map(n => {
          const h = n.y1 - n.y0;
          if (h < (compact ? 8 : 10)) return null;
          const isLeft = n._col === 0;
          const x = isLeft ? n.x - 8 : n.x + nodeW + 8;
          const anchor = isLeft ? "end" : "start";
          const yMid = (n.y0 + n.y1) / 2;
          const vTxt = n.value >= 1000
            ? "R$ " + (n.value / 1000).toFixed(1) + "k"
            : "R$ " + n.value.toFixed(0);
          return (
            <g key={"lbl-" + n._key} style={{ pointerEvents: "none" }}>
              <text x={x} y={yMid - 2} textAnchor={anchor} fontSize={fs}
                fill="var(--ink)" fontWeight={600}
                fontFamily="var(--font-display)">{n.label}</text>
              {n._col !== Math.floor(columns.length / 1) && (
                <text x={x} y={yMid + fs + 1} textAnchor={anchor}
                  fontSize={fs - 1} fill="var(--ink-3)"
                  fontFamily="var(--font-mono)">{vTxt}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hoverFlow && (() => {
        const f = flows.find(x => x.id === hoverFlow);
        if (!f) return null;
        const cx = (f.from.x + nodeW + f.to.x) / 2;
        const cy = ((f.ay0 + f.ay1) / 2 + (f.by0 + f.by1) / 2) / 2;
        return (
          <div style={{ position: "absolute", left: (cx / width * 100) + "%",
            top: (cy / height * 100) + "%", transform: "translate(-50%,-110%)", pointerEvents: "none" }}>
            <div className="card card-pad" style={{ fontSize: 12, minWidth: 140, boxShadow: "var(--sh-lg)" }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>{f.from.label} → {f.to.label}</div>
              <div style={{ color: "var(--ink-2)" }}>{brl(f.value)}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Sankey Mini ──────────────────────────────────────────────────────────────
const INCOME_PALETTE = ["#1f8a5b", "#2a9d8f", "#3d7d63", "#5a9d63", "#6cb286"];

function SankeyMini({
  summary, categories, subcategories, onNav,
}: {
  summary: DashboardSummary;
  categories: CategoryRankingItem[];
  subcategories: SubcategoryRankingItem[];
  onNav: (p: Page) => void;
}) {
  const totalIncome = parseFloat(summary.income ?? "0");

  // Income sources — subcategories of income categories
  const incomeCatIds = new Set(
    categories
      .filter(c => ["renda", "receita"].some(t => c.category_name?.toLowerCase().includes(t)))
      .map(c => c.category_id)
      .filter(Boolean)
  );
  const incomeSubs = subcategories.filter(s => s.category_id && incomeCatIds.has(s.category_id));
  let sources: SankeyNodeDef[];
  if (incomeSubs.length > 0 && totalIncome > 0) {
    const raw = incomeSubs.slice(0, 5).map((s, i) => ({
      id: "src_" + i, label: s.subcategory_name,
      value: parseFloat(s.amount ?? "0"),
      color: INCOME_PALETTE[i % INCOME_PALETTE.length],
    }));
    const rawTotal = raw.reduce((s, x) => s + x.value, 0);
    sources = rawTotal > 0
      ? raw.map(s => ({ ...s, value: (s.value / rawTotal) * totalIncome }))
      : [{ id: "src_0", label: "Total de receitas", value: totalIncome, color: "#1f8a5b" }];
  } else {
    sources = [{ id: "src_0", label: "Total de receitas", value: totalIncome, color: "#1f8a5b" }];
  }

  const expenseCats = categories
    .filter(c => !["renda", "receita"].includes(c.category_name?.toLowerCase() ?? "") && parseFloat(c.amount ?? "0") > 0)
    .slice(0, 8)
    .map(c => ({
      id: c.category_id ?? c.category_name,
      label: c.category_name,
      value: parseFloat(c.amount ?? "0"),
      color: c.color ?? catColor(c.category_name),
      kind: "expense" as const,
    }));

  const totalOut = expenseCats.reduce((s, c) => s + c.value, 0);
  const sobra    = Math.max(0, totalIncome - totalOut);
  const allRight: SankeyNodeDef[] = [...expenseCats];
  if (sobra > 0) allRight.push({ id: "sobra", label: "Sobrou", value: sobra, color: "#1f8a5b", kind: "save" });

  if (totalIncome === 0 || !categories.length) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="kpi-ic"><DIcon name="bars" size={15} /></div>
          <div><div className="ttl">De onde veio · para onde foi</div></div>
        </div>
        <div className="state" style={{ padding: "28px 20px" }}>
          <div className="state-ic"><DIcon name="bars" size={20} /></div>
          <h4>Sem dados de fluxo</h4>
          <p>Importe extratos e categorize para ver a visualização.</p>
        </div>
      </div>
    );
  }

  const columns: SankeyColDef[] = [
    { id: "sources", nodes: sources },
    { id: "income",  nodes: [{ id: "total", label: "Renda total", value: totalIncome, color: "#3d7d63" }] },
    { id: "right",   nodes: allRight },
  ];
  const links: SankeyLinkDef[] = [
    ...sources.map(src => ({ from: "sources/" + src.id, to: "income/total", value: src.value, color: src.color })),
    ...allRight.map(n  => ({ from: "income/total", to: "right/" + n.id, value: n.value, color: n.color })),
  ];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div className="kpi-ic"><DIcon name="bars" size={15} /></div>
        <div>
          <div className="ttl">De onde veio · para onde foi</div>
          <div className="sub">Renda → categorias e sobra · todas as origens</div>
        </div>
        <div className="spacer" />

        <button className="btn btn-quiet btn-sm" onClick={() => onNav("cashflow")}>
          Visão completa <ChevronRight size={13} />
        </button>
      </div>
      <div className="card-body" style={{ padding: "8px 12px 12px" }}>
        <SankeyChart columns={columns} links={links} height={320} compact />
        <div style={{ display: "flex", gap: 18, marginTop: 10, paddingTop: 10,
          borderTop: "1px solid var(--line)", fontSize: 11.5 }}>
          <span className="mono" style={{ color: "var(--ink-3)" }}>
            Entrou <b style={{ color: "var(--acc-ink)" }}>{brl(totalIncome)}</b>
          </span>
          <span className="mono" style={{ color: "var(--ink-3)" }}>
            Saiu <b style={{ color: "var(--neg)" }}>{brl(totalOut)}</b>
          </span>
          <span className="mono" style={{ color: "var(--ink-3)" }}>
            Sobrou <b style={{ color: "var(--pos)" }}>{brl(sobra)}</b>
          </span>
          <span style={{ marginLeft: "auto", color: "var(--ink-faint)", fontSize: 11 }}>
            A largura de cada fita é proporcional ao valor em R$
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export function DashboardPage({
  dashboardPeriod,
  onNavigate,
  onOpenImports,
  session,
  workspaceName,
}: {
  dashboardPeriod: PeriodState;
  onNavigate: (page: Page) => void;
  onOpenImports: (drilldown?: ImportDrilldown) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
  setDashboardPeriod: Dispatch<SetStateAction<PeriodState>>;
  workspaceName: string;
}) {
  const q        = periodQuery(dashboardPeriod);
  const historyQ_key = trailing12Query(dashboardPeriod.dateTo);
  const yearQ_key = dashboardPeriod.dateFrom ? yearQueryFromDate(dashboardPeriod.dateFrom) : "";
  const ok = !!session;
  const staleTime = 3 * 60 * 1000;

  const summaryQ  = useQuery({ queryKey: ["dash-summary",  session.token, q], queryFn: () => getDashboardSummary(session, q),                    enabled: ok, staleTime });
  // history: last 12 months ending at period.dateTo — for sparklines
  const histMonthlyQ = useQuery({ queryKey: ["dash-history", session.token, historyQ_key], queryFn: () => getMonthlyCashflow(session, historyQ_key), enabled: ok, staleTime: 10 * 60 * 1000 });
  // year: all 12 months of the selected year — for FlowCard "Mês" tab
  const yearMonthlyQ = useQuery({ queryKey: ["dash-year", session.token, yearQ_key], queryFn: () => getMonthlyCashflow(session, yearQ_key), enabled: ok && !!yearQ_key, staleTime: 10 * 60 * 1000 });
  const dailyQ    = useQuery({ queryKey: ["dash-daily",    session.token, q], queryFn: () => getDailyCashflow(session, q),                        enabled: ok, staleTime });
  const catsQ     = useQuery({ queryKey: ["dash-cats",     session.token, q], queryFn: () => getCategoryRanking(session, q + (q ? "&" : "?") + "limit=8"), enabled: ok, staleTime });
  const subsQ     = useQuery({ queryKey: ["dash-subs",     session.token, q], queryFn: () => getSubcategoryRanking(session, q + (q ? "&" : "?") + "limit=40"), enabled: ok, staleTime });
  const qualityQ  = useQuery({ queryKey: ["dash-quality",  session.token, q], queryFn: () => getDataQuality(session, q),            enabled: ok, staleTime });
  const goalsQ    = useQuery({ queryKey: ["goals",         session.token],     queryFn: () => getGoals(session),                     enabled: ok, staleTime });
  const budgetsQ  = useQuery({ queryKey: ["budgets",       session.token, q],  queryFn: () => getBudgets(session, q),                enabled: ok, staleTime });
  const cardsQ    = useQuery({ queryKey: ["credit-cards",  session.token],     queryFn: () => getCreditCards(session),               enabled: ok, staleTime });
  const eventsQ   = useQuery({ queryKey: ["cal-events",    session.token, q],  queryFn: () => getCalendarEvents(session, q),         enabled: ok, staleTime });

  const summary     = summaryQ.data;
  const histMonthly = histMonthlyQ.data?.items ?? [];
  const yearMonthly = yearMonthlyQ.data?.items ?? [];
  const daily       = dailyQ.data?.items      ?? [];

  // previous month item from history (for KPI delta % comparison)
  const prevMonth: MonthlyCashflowItem | null = (() => {
    if (!dashboardPeriod.dateFrom || !histMonthly.length) return null;
    const pd = new Date(dashboardPeriod.dateFrom + "T12:00:00");
    pd.setMonth(pd.getMonth() - 1);
    const key = pd.toISOString().slice(0, 7); // "2026-05"
    return histMonthly.find(m => m.month.slice(0, 7) === key) ?? null;
  })();
  const cats     = catsQ.data?.items    ?? [];
  const subs     = subsQ.data?.items    ?? [];
  const quality  = qualityQ.data;
  const goals    = goalsQ.data?.items   ?? [];
  const budgets  = budgetsQ.data?.items ?? [];
  const cards    = cardsQ.data?.items   ?? [];
  const events   = eventsQ.data?.items  ?? [];

  const hour   = new Date().getHours();
  const greet  = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const name   = workspaceName ?? "você";
  const MONTHS_PT_D = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const periodDate = dashboardPeriod.dateFrom ? new Date(dashboardPeriod.dateFrom + "T12:00:00") : new Date();
  const periodLabel = MONTHS_PT_D[periodDate.getMonth()] + " de " + periodDate.getFullYear();

  // Empty state — nenhuma transação ainda
  const isEmpty = !summaryQ.isLoading && summary && parseFloat(summary.transaction_count as unknown as string || "0") === 0 && (summary as unknown as { transaction_count: number }).transaction_count === 0;

  return (
    <div className="canvas stg">
      {/* Saudação */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-.4px" }}>
            {greet}, {name}
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 13.5 }}>
            Aqui está a situação de <b style={{ color: "var(--ink-2)" }}>{name}</b> em <b style={{ color: "var(--ink-2)" }}>{periodLabel}</b>.
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("reports")}>
            <DIcon name="report" size={14} /> Relatório
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => {}}>
            <DIcon name="chat" size={14} /> Perguntar ao Copilot
          </button>
        </div>
      </div>

      {/* Empty state — sem dados */}
      {isEmpty && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <div className="alert-ic"><DIcon name="db" size={16} /></div>
          <div>
            <div className="a-ttl">Nenhuma transação importada</div>
            <div className="a-txt">
              Importe seus extratos bancários para ver os indicadores do dashboard.{" "}
              <button className="btn btn-quiet btn-sm" onClick={() => onOpenImports()}>
                Ir para Importações <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Strip */}
      {summary && <><StoryStrip summary={summary} /><div style={{ height: 16 }} /></>}

      {/* KPI Deck */}
      {summary && <><KpiDeck summary={summary} monthly={histMonthly} prevMonth={prevMonth} qualityRatio={quality ? parseFloat(quality.categorized_ratio ?? "0") * 100 : null} /><div style={{ height: 16 }} /></>}

      {/* Loading skeleton quando não tem summary ainda */}
      {!summary && (
        <div className="kpi-deck" style={{ marginBottom: 16 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="kpi"><div className="skel" style={{ height: 80 }} /></div>
          ))}
        </div>
      )}

      {/* Priority alert — compromissos próximos */}
      <PriorityAlert events={events} onNav={onNavigate} />

      {/* Main: gráfico + saúde */}
      <div className="dash-main" style={{ marginBottom: 16 }}>
        <FlowCard daily={daily} yearMonthly={yearMonthly} periodDateFrom={dashboardPeriod.dateFrom} periodDateTo={dashboardPeriod.dateTo} />
        {summary ? <HealthCard summary={summary} /> : <div className="card card-pad"><div className="skel" style={{ height: 260 }} /></div>}
      </div>

      {/* Grid 3 colunas: TopCats + Upcoming + [Cards + Quality] */}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <TopCats categories={cats} subcategories={subs} onNav={onNavigate} />
        <UpcomingCard events={events} onNav={onNavigate} />
        <div className="vstack" style={{ gap: 16 }}>
          <CardsMini cards={cards} onNav={onNavigate} />
          {quality
            ? <DataQualityCard quality={quality} onNav={onNavigate} />
            : <div className="card card-pad"><div className="skel" style={{ height: 120 }} /></div>}
        </div>
      </div>

      {/* Sankey: De onde veio · para onde foi */}
      {summary && <SankeyMini summary={summary} categories={cats} subcategories={subs} onNav={onNavigate} />}

      {/* Grid 3 colunas: Budget + Goals + Tip */}
      <div className="grid cols-3">
        <BudgetMini budgets={budgets} onNav={onNavigate} />
        <GoalsMini goals={goals} onNav={onNavigate} />
        {summary ? <TipCard summary={summary} onNav={onNavigate} /> : <div className="card card-pad"><div className="skel" style={{ height: 120 }} /></div>}
      </div>
    </div>
  );
}
