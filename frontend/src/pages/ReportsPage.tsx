import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import {
  getBudgets, getCategoryRanking, getCreditCardStatementReport, getCreditCards, getDataQuality,
  getDashboardSummary, getGoals, getMonthlyCashflow, getPlanningProjection, getRecurringIncomes,
  getWealth,
} from "../lib/api";
import { money } from "../lib/utils";
import { PageState } from "../components/ui";
import type { ApiSession } from "../lib/api";
import type { Page, PeriodState } from "../types";

// --------------------------------------------------------------------------- //
// Icons
// --------------------------------------------------------------------------- //
const ICONS: Record<string, string> = {
  report:   "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5 M9 12h6 M9 16h4",
  flow:     "M4 6h10 M4 6l3-3 M4 6l3 3 M20 18H10 M20 18l-3-3 M20 18l-3 3 M4 12h16",
  pie:      "M12 3v9h9 M21 12a9 9 0 1 1-9-9 M21 12a9 9 0 0 0-9-9",
  arrowDR:  "M7 7l10 10 M17 8v9H8",
  card:     "M3 7h18a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M3 11h19",
  target:   "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  flag:     "M5 3v18 M5 5l14 5-14 5",
  db:       "M12 3c5 0 8 1.3 8 3s-3 3-8 3-8-1.3-8-3 3-3 8-3z M4 6v6c0 1.7 3 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3 3 8 3s8-1.3 8-3v-6",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M9 8h2 M9 12h2 M15 21V9h3a1 1 0 0 1 1 1v11",
  trend:    "M3 17l6-6 4 4 8-8 M15 7h6v6",
  bars:     "M5 20V10 M12 20V4 M19 20v-7 M3 20h18",
  refresh:  "M20 11a8 8 0 0 0-14-4 M4 5v4h4 M4 13a8 8 0 0 0 14 4 M20 19v-4h-4",
  calendar: "M3 5h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M16 3v4 M8 3v4 M3 10h18",
  download: "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2 M7 11l5 5 5-5 M12 4v12",
  file:     "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5",
  info:     "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  chevR:    "M9 18l6-6-6-6",
  check:    "M20 6L9 17l-5-5",
  alert:    "M10.3 4l-7.5 13A1.5 1.5 0 0 0 4.1 19.3h15.8A1.5 1.5 0 0 0 21.2 17l-7.5-13a1.5 1.5 0 0 0-2.6 0z M12 9v4 M12 16h.01",
  list:     "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
};

function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const d = ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      {segs.map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
    </svg>
  );
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const num = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const N = (v?: string | number | null) => Number(v ?? 0);

const REPORTS = [
  { id: "exec", label: "Resumo executivo", icon: "report" },
  { id: "cashflow", label: "Fluxo de caixa mensal", icon: "flow" },
  { id: "cats", label: "Despesas por categoria", icon: "pie" },
  { id: "income", label: "Receitas por origem", icon: "arrowDR" },
  { id: "cards", label: "Cartões", icon: "card" },
  { id: "budgets", label: "Orçamentos", icon: "target" },
  { id: "goals", label: "Metas", icon: "flag" },
  { id: "quality", label: "Qualidade dos dados", icon: "db" },
  { id: "wealth", label: "Patrimônio", icon: "building" },
  { id: "proj", label: "Projeção futura", icon: "trend" },
] as const;

type RepId = typeof REPORTS[number]["id"];

function periodQuery(p?: PeriodState) {
  if (!p || p.periodPreset === "all") return "";
  return `?date_from=${p.dateFrom}&date_to=${p.dateTo}`;
}
function trailing12Query(p?: PeriodState) {
  const to = p?.dateTo || new Date().toISOString().slice(0, 10);
  const d = new Date(to + "T12:00:00");
  d.setMonth(d.getMonth() - 11);
  d.setDate(1);
  return `?date_from=${d.toISOString().slice(0, 10)}&date_to=${to}`;
}
function periodLabel(p?: PeriodState) {
  if (!p || p.periodPreset === "all") return "Todo o período";
  const fmt = (s: string) => { const [y, m, dd] = s.split("-"); return `${dd}/${m}/${y.slice(2)}`; };
  const [fy, fm] = p.dateFrom.split("-");
  const [ty, tm] = p.dateTo.split("-");
  if (fy === ty && fm === tm) return `${MONTHS[Number(fm) - 1]}/${fy}`;
  return `${fmt(p.dateFrom)} – ${fmt(p.dateTo)}`;
}

function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

type CsvFn = (() => void) | null;

function withLimit(q: string, limit: number) {
  return `${q || "?"}${q ? "&" : ""}limit=${limit}`;
}

// --------------------------------------------------------------------------- //
// Shared UI
// --------------------------------------------------------------------------- //
function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon?: string; tone?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        {icon && <span className="kpi-ic" style={tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : undefined}><Icon name={icon} size={15} /></span>}
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-val" style={{ fontSize: 19 }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function CardHead({ title, sub, icon }: { title: string; sub?: string; icon?: string }) {
  return (
    <div className="card-head">
      {icon && <span className="kpi-ic"><Icon name={icon} size={15} /></span>}
      <div><span className="ttl">{title}</span>{sub && <div className="t-sub">{sub}</div>}</div>
    </div>
  );
}

function Bar({ value, max, color = "var(--acc)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max;
  return (
    <div className="track" style={{ height: 8 }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 20, background: over ? "var(--neg)" : color }} />
    </div>
  );
}

function Donut({ data, size = 180, thickness = 26, center }: { data: { value: number; color: string }[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {data.map((d, i) => {
            const dash = (d.value / total) * circ;
            const seg = <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-off} />;
            off += dash;
            return seg;
          })}
        </g>
      </svg>
      {center && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{center}</div>}
    </div>
  );
}

const PALETTE = ["#1f8a5b", "#3567b8", "#c98a2b", "#6a52c9", "#a35a7d", "#16a085", "#c0392b", "#7c3aed", "#2a9d8f", "#8a8f99"];

function Loading() {
  return <PageState icon={Loader2} title="Carregando relatório" description="Consolidando seus dados." spin />;
}

// --------------------------------------------------------------------------- //
// Page
// --------------------------------------------------------------------------- //
export function ReportsPage({ session, period, onNavigate }: {
  session: ApiSession; period?: PeriodState; onNavigate: (page: Page) => void;
}) {
  const [rep, setRep] = useState<RepId>("exec");
  const [csv, setCsv] = useState<CsvFn>(null);
  const q = periodQuery(period);
  // Store the CSV callback as state WITHOUT invoking it. Passing a function
  // straight to setCsv makes React treat it as an updater and run it immediately
  // (which downloaded the CSV the moment Reports opened) — wrap it so the function
  // itself is stored and only runs when the user clicks "CSV".
  const common: RepProps = { session, q, period, onNavigate, registerCsv: (fn) => setCsv(() => fn) };

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Crescimento</div>
          <h2 className="section-title"><Icon name="report" size={18} /> Relatórios</h2>
          <p className="section-sub">Visões consolidadas e executivas dos seus dados financeiros.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button className="btn btn-ghost btn-sm" disabled={!csv} onClick={() => csv?.()}><Icon name="download" size={14} /> CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Icon name="file" size={14} /> Exportar PDF</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "232px 1fr", alignItems: "start", gap: 16 }}>
        {/* Sidebar */}
        <div className="card card-pad" style={{ position: "sticky", top: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8, paddingLeft: 4 }}>Tipo de relatório</div>
          <div className="list-select">
            {REPORTS.map(r => (
              <button key={r.id} className={rep === r.id ? "on" : ""} onClick={() => { setRep(r.id); setCsv(null); }}>
                <Icon name={r.icon} size={16} /><span style={{ flex: 1, textAlign: "left" }}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="vstack" style={{ gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="chip on"><Icon name="calendar" size={13} /> {periodLabel(period)}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>{REPORTS.find(r => r.id === rep)?.label}</span>
          </div>

          {rep === "exec" && <ExecReport {...common} />}
          {rep === "cashflow" && <CashflowReport {...common} />}
          {rep === "cats" && <CatsReport {...common} />}
          {rep === "income" && <IncomeReport {...common} />}
          {rep === "cards" && <CardsReport {...common} />}
          {rep === "budgets" && <BudgetsReport {...common} />}
          {rep === "goals" && <GoalsReport {...common} />}
          {rep === "quality" && <QualityReport {...common} />}
          {rep === "wealth" && <WealthReport {...common} />}
          {rep === "proj" && <ProjReport {...common} />}
        </div>
      </div>
    </div>
  );
}

type RepProps = {
  session: ApiSession; q: string; period?: PeriodState;
  onNavigate: (page: Page) => void; registerCsv: (fn: CsvFn) => void;
};

// --------------------------------------------------------------------------- //
// Reports
// --------------------------------------------------------------------------- //
function ExecReport({ session, q, period, registerCsv }: RepProps) {
  const summaryQ = useQuery({ queryKey: ["rep-summary", session.token, q], queryFn: () => getDashboardSummary(session, q) });
  const monthlyQ = useQuery({ queryKey: ["rep-monthly12", session.token, trailing12Query(period)], queryFn: () => getMonthlyCashflow(session, trailing12Query(period)) });
  const catsQ = useQuery({ queryKey: ["rep-cats", session.token, q], queryFn: () => getCategoryRanking(session, withLimit(q, 6)) });

  const months = monthlyQ.data?.items ?? [];
  const chart = months.map(m => ({ label: MONTHS[Number(m.month.slice(5, 7)) - 1], inc: N(m.income), exp: N(m.expenses) }));
  const cats = catsQ.data?.items ?? [];
  const catMax = cats.reduce((s, c) => Math.max(s, N(c.amount)), 0);

  useEffect(() => {
    registerCsv(() => downloadCsv("resumo-executivo.csv", ["Mes", "Receitas", "Despesas", "Resultado"],
      months.map(m => [m.month, N(m.income), N(m.expenses), N(m.income) - N(m.expenses)])));
    return () => registerCsv(null);
  }, [months, registerCsv]);

  if (summaryQ.isLoading || monthlyQ.isLoading) return <Loading />;
  const s = summaryQ.data;
  const income = N(s?.income), expenses = N(s?.expenses), result = income - expenses;
  const saving = income > 0 ? (result / income) * 100 : 0;

  return (
    <>
      <div className="kpi-deck">
        <Kpi label="Receitas" value={money(income)} icon="arrowDR" tone="pos" />
        <Kpi label="Despesas" value={money(expenses)} icon="bars" tone="neg" />
        <Kpi label="Resultado" value={money(result)} icon="flow" tone={result >= 0 ? "pos" : "neg"} />
        <Kpi label="Saving rate" value={`${num(saving)}%`} icon="target" tone="acc" />
      </div>
      <div className="card">
        <CardHead title="Fluxo de caixa — 12 meses" icon="bars" />
        <div className="card-body">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={46} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} formatter={(v: number, n) => [money(v), n === "inc" ? "Receitas" : "Despesas"]} />
              <Line type="monotone" dataKey="inc" name="inc" stroke="var(--acc)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="exp" name="exp" stroke="var(--neg)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <CardHead title="Top categorias de despesa" icon="pie" />
        <div className="card-body" style={{ display: "grid", gap: 11 }}>
          {cats.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="catdot" style={{ background: c.color ?? PALETTE[i % PALETTE.length] }} />
              <span style={{ fontSize: 12.5, width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.category_name}</span>
              <div style={{ flex: 1 }}><Bar value={N(c.amount)} max={catMax} color={c.color ?? PALETTE[i % PALETTE.length]} /></div>
              <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{money(c.amount)}</span>
            </div>
          ))}
          {cats.length === 0 && <span className="t-sub">Sem despesas no período.</span>}
        </div>
      </div>
    </>
  );
}

function CashflowReport({ session, period, registerCsv }: RepProps) {
  const monthlyQ = useQuery({ queryKey: ["rep-cf12", session.token, trailing12Query(period)], queryFn: () => getMonthlyCashflow(session, trailing12Query(period)) });
  const months = monthlyQ.data?.items ?? [];
  let acc = 0;
  const rows = months.map(m => { const r = N(m.income) - N(m.expenses); acc += r; return { month: m.month, income: m.income, expenses: m.expenses, r, acc }; });

  useEffect(() => {
    registerCsv(() => downloadCsv("fluxo-mensal.csv", ["Mes", "Receitas", "Despesas", "Resultado", "Acumulado"],
      rows.map(m => [m.month, N(m.income), N(m.expenses), m.r, m.acc])));
    return () => registerCsv(null);
  }, [rows, registerCsv]);

  if (monthlyQ.isLoading) return <Loading />;
  return (
    <div className="card">
      <CardHead title="Fluxo de caixa mensal" icon="flow" />
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Mês</th><th className="num">Receitas</th><th className="num">Despesas</th><th className="num">Resultado</th><th className="num">Acum.</th></tr></thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.month}</td>
                <td className="num" style={{ color: "var(--acc)" }}>{money(m.income)}</td>
                <td className="num" style={{ color: "var(--neg)" }}>{money(m.expenses)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{money(m.r)}</td>
                <td className="num t-sub mono">{money(m.acc)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="t-sub" style={{ textAlign: "center", padding: 24 }}>Sem dados no período.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatsReport({ session, q, registerCsv }: RepProps) {
  const catsQ = useQuery({ queryKey: ["rep-cats-full", session.token, q], queryFn: () => getCategoryRanking(session, withLimit(q, 20)) });
  const cats = catsQ.data?.items ?? [];
  const total = cats.reduce((s, c) => s + N(c.amount), 0);

  useEffect(() => {
    registerCsv(() => downloadCsv("despesas-por-categoria.csv", ["Categoria", "Valor", "% do total", "Lancamentos"],
      cats.map(c => [c.category_name, N(c.amount), total > 0 ? num((N(c.amount) / total) * 100) : "0", c.count])));
    return () => registerCsv(null);
  }, [cats, total, registerCsv]);

  if (catsQ.isLoading) return <Loading />;
  return (
    <div className="grid" style={{ gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="eyebrow" style={{ alignSelf: "flex-start", marginBottom: 14 }}>Distribuição</div>
        <Donut data={cats.slice(0, 8).map((c, i) => ({ value: N(c.amount), color: c.color ?? PALETTE[i % PALETTE.length] }))}
          center={<div><div className="mono" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{money(total)}</div><div className="t-sub">total</div></div>} />
      </div>
      <div className="card">
        <CardHead title="Despesas por categoria" icon="pie" />
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">% do total</th><th className="num">Lanç.</th></tr></thead>
            <tbody>
              {cats.map((c, i) => (
                <tr key={i}>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="catdot" style={{ background: c.color ?? PALETTE[i % PALETTE.length] }} /><span className="t-desc">{c.category_name}</span></span></td>
                  <td className="num" style={{ fontWeight: 700 }}>{money(c.amount)}</td>
                  <td className="num t-sub mono">{total > 0 ? num((N(c.amount) / total) * 100) : "0"}%</td>
                  <td className="num t-sub mono">{c.count}</td>
                </tr>
              ))}
              {cats.length === 0 && <tr><td colSpan={4} className="t-sub" style={{ textAlign: "center", padding: 24 }}>Sem despesas no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IncomeReport({ session, q, registerCsv }: RepProps) {
  const incQ = useQuery({ queryKey: ["rep-income", session.token, q], queryFn: () => getRecurringIncomes(session, q) });
  const items = incQ.data?.items ?? [];
  const total = items.reduce((s, it) => s + N(it.average_amount), 0);

  useEffect(() => {
    registerCsv(() => downloadCsv("receitas-por-origem.csv", ["Origem", "Categoria", "Valor medio", "Ocorrencias"],
      items.map(it => [it.description, it.category_name ?? "—", N(it.average_amount), it.transaction_count])));
    return () => registerCsv(null);
  }, [items, registerCsv]);

  if (incQ.isLoading) return <Loading />;
  return (
    <>
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <Kpi label="Receita recorrente" value={money(total)} icon="arrowDR" tone="pos" sub={`${items.length} origens`} />
        <Kpi label="Maior fonte" value={items[0] ? money(items[0].average_amount) : "—"} icon="target" tone="acc" sub={items[0]?.description ?? "—"} />
        <Kpi label="Origens ativas" value={String(items.length)} icon="list" tone="acc" sub="recorrentes" />
      </div>
      <div className="card">
        <CardHead title="Receitas por origem" sub="Fontes recorrentes de entrada" icon="arrowDR" />
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Origem</th><th>Categoria</th><th className="num">Valor médio</th><th className="num">% do total</th><th className="num">Ocorr.</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td><span className="t-desc">{it.description}</span></td>
                  <td className="t-sub">{it.category_name ?? "—"}</td>
                  <td className="num" style={{ fontWeight: 700, color: "var(--acc)" }}>{money(it.average_amount)}</td>
                  <td className="num t-sub mono">{total > 0 ? num((N(it.average_amount) / total) * 100) : "0"}%</td>
                  <td className="num t-sub mono">{it.transaction_count}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="t-sub" style={{ textAlign: "center", padding: 24 }}>Sem receitas recorrentes detectadas no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CardsReport({ session, registerCsv }: RepProps) {
  const cardsQ = useQuery({ queryKey: ["rep-cards", session.token], queryFn: () => getCreditCards(session) });
  const stmtQ = useQuery({ queryKey: ["rep-stmt", session.token], queryFn: () => getCreditCardStatementReport(session) });
  const cards = cardsQ.data?.items ?? [];
  const statements = stmtQ.data?.items ?? [];
  const totalLimit = cards.reduce((s, c) => s + N(c.limit_amount), 0);
  const openStatements = statements.filter(st => st.status !== "paid");
  const openTotal = openStatements.reduce((s, st) => s + N(st.file_total), 0);

  useEffect(() => {
    registerCsv(() => downloadCsv("cartoes-faturas.csv", ["Cartao", "Vencimento", "Total", "Pago", "Status"],
      statements.map(st => [st.card_name, st.due_date, N(st.file_total), N(st.paid_amount), st.status])));
    return () => registerCsv(null);
  }, [statements, registerCsv]);

  if (cardsQ.isLoading || stmtQ.isLoading) return <Loading />;
  return (
    <>
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <Kpi label="Limite total" value={money(totalLimit)} icon="card" tone="acc" />
        <Kpi label="Cartões" value={String(cards.length)} icon="bars" tone="acc" sub="cadastrados" />
        <Kpi label="Faturas em aberto" value={money(openTotal)} icon="refresh" tone="warn" sub={`${openStatements.length} fatura(s)`} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <CardHead title="Cartões cadastrados" icon="card" />
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          {cards.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color ?? "var(--acc)" }} />
              <span style={{ fontWeight: 700 }}>{c.name}</span>
              <span className="mono t-sub">{c.last_four ? `•${c.last_four}` : ""} {c.brand ?? ""}</span>
              <span className="mono" style={{ marginLeft: "auto", fontWeight: 700 }}>limite {money(c.limit_amount)}</span>
            </div>
          ))}
          {cards.length === 0 && <span className="t-sub">Nenhum cartão cadastrado.</span>}
        </div>
      </div>
      <div className="card">
        <CardHead title="Faturas" icon="list" />
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Cartão</th><th>Vencimento</th><th className="num">Total</th><th className="num">Pago</th><th>Status</th></tr></thead>
            <tbody>
              {statements.map((st, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{st.card_name}</td>
                  <td className="mono t-sub">{st.due_date.split("-").reverse().join("/")}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{st.file_total != null ? money(st.file_total) : "—"}</td>
                  <td className="num t-sub">{st.paid_amount != null ? money(st.paid_amount) : "—"}</td>
                  <td><span className={"badge " + (st.status === "paid" ? "b-pos" : "b-warn")}>{st.status}</span></td>
                </tr>
              ))}
              {statements.length === 0 && <tr><td colSpan={5} className="t-sub" style={{ textAlign: "center", padding: 24 }}>Nenhuma fatura registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function BudgetsReport({ session, q, registerCsv }: RepProps) {
  const budgetsQ = useQuery({ queryKey: ["rep-budgets", session.token, q], queryFn: () => getBudgets(session, q) });
  const catsQ = useQuery({ queryKey: ["rep-budget-cats", session.token, q], queryFn: () => getCategoryRanking(session, withLimit(q, 1000)) });
  const budgets = budgetsQ.data?.items ?? [];
  const spentByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of catsQ.data?.items ?? []) if (c.category_id) m[c.category_id] = N(c.amount);
    return m;
  }, [catsQ.data]);

  const rows = budgets.map(b => {
    const spent = b.category_id ? (spentByCat[b.category_id] ?? 0) : 0;
    const limit = N(b.limit_amount);
    return { b, spent, limit, ratio: limit > 0 ? (spent / limit) * 100 : 0 };
  }).sort((a, c) => c.ratio - a.ratio);
  const totPl = rows.reduce((s, r) => s + r.limit, 0);
  const totAc = rows.reduce((s, r) => s + r.spent, 0);
  const over = rows.filter(r => r.spent > r.limit).length;

  useEffect(() => {
    registerCsv(() => downloadCsv("orcamentos.csv", ["Orcamento", "Planejado", "Realizado", "% consumido"],
      rows.map(r => [r.b.name, r.limit, r.spent, num(r.ratio)])));
    return () => registerCsv(null);
  }, [rows, registerCsv]);

  if (budgetsQ.isLoading || catsQ.isLoading) return <Loading />;
  return (
    <>
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <Kpi label="Planejado" value={money(totPl)} icon="target" tone="acc" />
        <Kpi label="Realizado" value={money(totAc)} icon="bars" tone="acc" sub={totPl > 0 ? `${num((totAc / totPl) * 100, 0)}% do planejado` : undefined} />
        <Kpi label="Sobra" value={money(totPl - totAc)} icon="flow" tone={totPl - totAc >= 0 ? "pos" : "neg"} />
        <Kpi label="Estouradas" value={String(over)} icon="alert" tone={over > 0 ? "neg" : "pos"} />
      </div>
      <div className="card">
        <CardHead title="Categorias × orçamento" sub="Da mais comprometida para a menos" icon="pie" />
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          {rows.map((r, i) => {
            const label = r.ratio > 100 ? "Estourou" : r.ratio > 90 ? "No limite" : "Ok";
            const badge = r.ratio > 100 ? "b-neg" : r.ratio > 90 ? "b-warn" : "b-pos";
            return (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.b.name}</span>
                  <span className="mono" style={{ marginLeft: "auto", fontWeight: 700 }}>{money(r.spent)}<span className="t-sub" style={{ fontWeight: 400 }}> / {money(r.limit)}</span></span>
                  <span className={"badge " + badge}>{label}</span>
                </div>
                <Bar value={r.spent} max={r.limit} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
                  <span className="mono">{num(r.ratio, 0)}% consumido</span>
                  <span>{r.spent > r.limit ? `estourou ${money(r.spent - r.limit)}` : `restam ${money(r.limit - r.spent)}`}</span>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <span className="t-sub">Nenhum orçamento cadastrado.</span>}
        </div>
      </div>
    </>
  );
}

function GoalsReport({ session, registerCsv }: RepProps) {
  const goalsQ = useQuery({ queryKey: ["rep-goals", session.token], queryFn: () => getGoals(session) });
  const goals = goalsQ.data?.items ?? [];
  const totC = goals.reduce((s, g) => s + N(g.current_amount), 0);
  const totT = goals.reduce((s, g) => s + N(g.target_amount), 0);

  useEffect(() => {
    registerCsv(() => downloadCsv("metas.csv", ["Meta", "Guardado", "Alvo", "% atingido", "Prazo"],
      goals.map(g => [g.name, N(g.current_amount), N(g.target_amount), num((N(g.current_amount) / Math.max(N(g.target_amount), 1)) * 100, 0), g.target_date ?? "—"])));
    return () => registerCsv(null);
  }, [goals, registerCsv]);

  if (goalsQ.isLoading) return <Loading />;
  return (
    <>
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <Kpi label="Total guardado" value={money(totC)} icon="flag" tone="acc" />
        <Kpi label="Meta combinada" value={money(totT)} icon="target" tone="acc" sub={totT > 0 ? `${num((totC / totT) * 100, 0)}% atingido` : undefined} />
        <Kpi label="Metas" value={String(goals.length)} icon="check" tone="acc" />
      </div>
      <div className="card">
        <CardHead title="Acompanhamento das metas" icon="flag" />
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          {goals.map((g, i) => {
            const cur = N(g.current_amount), tgt = N(g.target_amount);
            const pct = tgt > 0 ? (cur / tgt) * 100 : 0;
            const color = g.color ?? PALETTE[i % PALETTE.length];
            return (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="catdot" style={{ background: color, width: 10, height: 10 }} />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{g.name}</span>
                  <span className="mono faint" style={{ marginLeft: "auto" }}>{num(pct, 0)}%</span>
                </div>
                <Bar value={cur} max={tgt} color={color} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
                  <span className="mono">{money(cur)} / {money(tgt)}</span>
                  <span>{g.target_date ? `até ${g.target_date.split("-").reverse().join("/")}` : "sem prazo"}</span>
                </div>
              </div>
            );
          })}
          {goals.length === 0 && <span className="t-sub">Nenhuma meta cadastrada.</span>}
        </div>
      </div>
    </>
  );
}

function QualityReport({ session, q, onNavigate, registerCsv }: RepProps) {
  const dqQ = useQuery({ queryKey: ["rep-dq", session.token, q], queryFn: () => getDataQuality(session, q) });
  useEffect(() => { registerCsv(null); }, [registerCsv]);
  if (dqQ.isLoading) return <Loading />;
  const dq = dqQ.data;
  const ratio = dq?.categorized_ratio != null ? Number(dq.categorized_ratio) * 100 : 0;
  const items = [
    { label: "Transações categorizadas", val: ratio, total: `${dq?.categorized_count ?? 0} de ${dq?.transaction_count ?? 0}` },
    { label: "Importações sem erro", val: dq && dq.imports_with_errors === 0 ? 100 : 60, total: `${dq?.imports_with_errors ?? 0} com erro` },
  ];
  return (
    <div className="grid cols-2" style={{ gap: 16, alignItems: "start" }}>
      <div className="card card-pad" style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <Donut size={104} thickness={11} data={[{ value: ratio, color: "var(--acc)" }, { value: 100 - ratio, color: "var(--bg-sunken)" }]}
          center={<div><div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>{num(ratio, 0)}%</div><div className="t-sub">qualidade</div></div>} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{ratio >= 90 ? "Boa qualidade de dados" : "Pode melhorar"}</div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
            {dq?.uncategorized_count ? `Resolver ${dq.uncategorized_count} transação(ões) sem categoria eleva a precisão dos indicadores.` : "Tudo categorizado."}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate("review")}>Revisar pendências</button>
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 14 }}>Critérios de qualidade</div>
        <div style={{ display: "grid", gap: 13 }}>
          {items.map((it, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{it.label}</span><span className="mono t-sub">{it.total}</span>
              </div>
              <Bar value={it.val} max={100} color={it.val < 75 ? "var(--warn)" : "var(--acc)"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WealthReport({ session, onNavigate, registerCsv }: RepProps) {
  const wealthQ = useQuery({ queryKey: ["rep-wealth", session.token], queryFn: () => getWealth(session) });
  useEffect(() => { registerCsv(null); }, [registerCsv]);
  if (wealthQ.isLoading) return <Loading />;
  const w = wealthQ.data;
  return (
    <>
      <div className="card card-pad">
        <div className="grid cols-3" style={{ gap: 12 }}>
          <Kpi label="Patrimônio líquido" value={money(w?.net_worth)} icon="building" tone="acc" />
          <Kpi label="Ativos" value={money(w?.total_assets)} icon="trend" tone="pos" />
          <Kpi label="Passivos" value={money(w?.total_liabilities)} icon="bars" tone="neg" />
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16, alignSelf: "flex-start" }} onClick={() => onNavigate("wealth")}>
        Abrir módulo Patrimônio <Icon name="chevR" size={15} />
      </button>
    </>
  );
}

function ProjReport({ session, registerCsv }: RepProps) {
  const projQ = useQuery({ queryKey: ["rep-proj", session.token], queryFn: () => getPlanningProjection(session, 365) });
  const proj = projQ.data;
  const points = (proj?.points ?? []).map(p => {
    const [y, m] = p.month.split("-");
    return { label: `${MONTHS[Number(m) - 1]}/${y.slice(2)}`, best: N(p.best), prob: N(p.probable), worst: N(p.worst) };
  });

  useEffect(() => {
    registerCsv(() => downloadCsv("projecao.csv", ["Mes", "Otimista", "Provavel", "Pessimista"],
      points.map(p => [p.label, p.best, p.prob, p.worst])));
    return () => registerCsv(null);
  }, [points, registerCsv]);

  if (projQ.isLoading) return <Loading />;
  return (
    <>
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <Kpi label="Saldo provável (12m)" value={money(proj?.end_probable)} icon="trend" tone="acc" />
        <Kpi label="Otimista (12m)" value={money(proj?.end_best)} icon="bars" tone="pos" />
        <Kpi label="Pessimista (12m)" value={money(proj?.end_worst)} icon="flow" tone="neg" />
        <Kpi label="Menor saldo previsto" value={money(proj?.min_balance)} icon="alert" tone="warn" />
      </div>
      <div className="card">
        <CardHead title="Projeção de saldo — 12 meses" sub="Cenários otimista, provável e pessimista" icon="trend" />
        <div className="card-body">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `R$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={46} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} formatter={(v: number, n) => [money(v), n === "best" ? "Otimista" : n === "prob" ? "Provável" : "Pessimista"]} />
              <Line type="monotone" dataKey="best" name="best" stroke="var(--pos)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="prob" name="prob" stroke="var(--acc)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="worst" name="worst" stroke="var(--neg)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
          <div className="legend" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", gap: 18, fontSize: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="catdot" style={{ background: "var(--pos)" }} /> Otimista</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="catdot" style={{ background: "var(--acc)" }} /> Provável</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="catdot" style={{ background: "var(--neg)" }} /> Pessimista</span>
          </div>
        </div>
      </div>
      {(proj?.assumptions?.length ?? 0) > 0 && (
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Premissas usadas</div>
          <div style={{ display: "grid", gap: 8 }}>
            {proj?.assumptions.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
                <Icon name="check" size={13} />{a}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
