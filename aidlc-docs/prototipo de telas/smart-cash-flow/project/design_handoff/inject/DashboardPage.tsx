/**
 * SmartCashFlow — DashboardPage.tsx
 * Visual idêntico ao wireframe aprovado + dados reais da API.
 * Copiar para: frontend/src/pages/DashboardPage.tsx
 *
 * Deps já no repo: react, @tanstack/react-query, recharts, lucide-react
 * CSS adicional: copiar design_handoff/inject/styles-additions.css → append em src/styles.css
 */

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line,
} from "recharts";
import {
  Wallet, ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown,
  Clock, Shield, PieChart, Zap, Lock, Database, Check,
  ChevronRight, AlertTriangle, Sparkles, BarChart2, MessageSquare,
  Target, CreditCard, Flag, Star,
} from "lucide-react";

import type { ApiSession } from "../lib/api";
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

// ─── Micro-componentes ─────────────────────────────────────────────────────────
type Prov = "real" | "est" | "integ" | "future";
function ProvBadge({ prov }: { prov: Prov }) {
  const map: Record<Prov, { label: string; cls: string }> = {
    real:   { label: "real",   cls: "b-real" },
    est:    { label: "est.",   cls: "b-est" },
    integ:  { label: "integ.", cls: "b-integ" },
    future: { label: "prev.",  cls: "b-future" },
  };
  const { label, cls } = map[prov] ?? map.real;
  return <span className={`badge tag-mono ${cls}`}>{label}</span>;
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
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 72, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, cur, unit, icon: Icon, prov, delta, deltaInvert, hint, spark, sub,
}: {
  label: string; value: string; cur?: string | null; unit?: string;
  icon: React.ElementType; prov: Prov; delta?: number | null;
  deltaInvert?: boolean; hint?: string; spark?: number[]; sub?: string;
}) {
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-top">
        <div className="kpi-ic"><Icon size={15} /></div>
        <span className="kpi-label">{label}</span>
        <div style={{ marginLeft: "auto" }}><ProvBadge prov={prov} /></div>
      </div>
      <div className="kpi-val">
        {cur && <span className="cur">{cur}</span>}
        {value}
        {unit && <span className="cur" style={{ marginLeft: 2 }}>{unit}</span>}
      </div>
      {(delta != null || sub) && (
        <div className="kpi-sub">
          {delta != null && <Delta value={delta} invert={deltaInvert} />}
          {sub && <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>{sub}</span>}
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
  const income   = parseFloat(summary.income   ?? "0");
  const expenses = parseFloat(summary.expenses ?? "0");
  const balance  = parseFloat(summary.balance  ?? "0");
  const steps = [
    { label: "Entrou",    value: income,    tone: "pos" as const, prov: "real" as Prov, icon: ArrowDownRight },
    { label: "Saiu",      value: -expenses, tone: "neg" as const, prov: "real" as Prov, icon: ArrowUpRight },
    { label: "Sobrou",    value: balance,   tone: "acc" as const, prov: "real" as Prov, icon: TrendingUp, strong: true },
    { label: "Saldo atual", value: parseFloat(summary.current_balance ?? String(balance)), tone: "acc" as const, prov: (summary.current_balance ? "integ" : "est") as Prov, icon: Wallet, strong: true },
  ];
  const colors: Record<string, string> = { pos: "var(--pos)", neg: "var(--neg)", acc: "var(--acc-ink)" };
  return (
    <div className="card card-pad story">
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i === 2 || i === 3 ? "1.2" : "1" }}>
            <div className={`story-step${s.strong ? " strong" : ""}`}>
              <div className="story-lab">
                <span className={`story-ic`} style={{ color: colors[s.tone] }}>
                  <s.icon size={14} />
                </span>
                {s.label}
              </div>
              <div className="story-val" style={{ color: colors[s.tone] }}>
                {brl(s.value)}
              </div>
              <ProvBadge prov={s.prov} />
            </div>
            {i < steps.length - 1 && (
              <div className="story-arrow"><ChevronRight size={18} /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Deck ─────────────────────────────────────────────────────────────────
function KpiDeck({ summary }: { summary: DashboardSummary }) {
  const sr  = summary.savings_rate  ? parseFloat(summary.savings_rate)  * 100 : null;
  const cr  = summary.commitment_rate ? parseFloat(summary.commitment_rate) * 100 : null;
  const hs  = summary.financial_health_score;
  const tiles = [
    { label: "Saldo atual",        value: num(summary.current_balance ?? summary.balance), cur: "R$", icon: Wallet,        prov: "integ" as Prov, sub: summary.current_balance ? `em ${summary.current_balance_account ?? "conta"}` : "do fluxo" },
    { label: "Receitas do mês",    value: num(summary.income),   cur: "R$", icon: ArrowDownRight, prov: "real" as Prov },
    { label: "Despesas do mês",    value: num(summary.expenses), cur: "R$", icon: ArrowUpRight,   prov: "real" as Prov },
    { label: "Fluxo líquido",      value: num(summary.balance),  cur: "R$", icon: TrendingUp,     prov: "real" as Prov },
    { label: "Saving rate",        value: sr != null ? num(sr, 1) : "—", unit: sr != null ? "%" : undefined, icon: PieChart,  prov: "real" as Prov },
    { label: "Burn rate",          value: num(summary.burn_rate), cur: "R$", icon: Zap,            prov: "est" as Prov, hint: summary.burn_rate_basis },
    { label: "Runway",             value: num(summary.burn_rate_months, 0), unit: " meses", icon: Shield, prov: "est" as Prov, hint: "Reserva ÷ burn rate" },
    { label: "Gasto seguro hoje",  value: summary.safe_spend ? num(summary.safe_spend) : "—", cur: summary.safe_spend ? "R$" : undefined, icon: Check, prov: "est" as Prov, hint: summary.safe_spend_basis },
    { label: "Comprometimento",    value: cr != null ? num(cr, 0) : "—", unit: cr != null ? "%" : undefined, icon: Lock, prov: "real" as Prov, hint: "Despesas fixas + dívidas ÷ receita" },
    { label: "Saúde financeira",   value: hs != null ? String(hs) : "—", unit: hs != null ? "/100" : undefined, icon: Star, prov: "est" as Prov },
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
function FlowCard({
  daily, monthly,
}: { daily: DailyCashflowItem[]; monthly: MonthlyCashflowItem[] }) {
  const [mode, setMode] = useState<"day" | "month">("day");

  const dayData = daily.map(d => ({
    label: d.date.slice(8),
    inc: parseFloat(d.income   ?? "0"),
    exp: parseFloat(d.expenses ?? "0"),
    acc: parseFloat(d.closing_balance ?? "0"),
  }));
  const monData = monthly.map(m => ({
    label: m.month.slice(0, 7),
    inc: parseFloat(m.income   ?? "0"),
    exp: parseFloat(m.expenses ?? "0"),
    acc: parseFloat(m.closing_balance ?? "0"),
  }));
  const data = mode === "day" ? dayData : monData;

  if (!data.length) {
    return (
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260 }}>
        <div className="state"><div className="state-ic"><BarChart2 size={22} /></div><h4>Sem dados de fluxo</h4><p>Importe extratos para ver o gráfico.</p></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><BarChart2 size={15} /></div>
        <div>
          <div className="ttl">Fluxo do período</div>
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
              formatter={(value: number, name: string) => [brl(value), name === "inc" ? "Receitas" : name === "exp" ? "Despesas" : "Saldo"]}
              labelStyle={{ color: "var(--ink-2)", fontWeight: 700 }}
            />
            <Area type="monotone" dataKey="inc" name="inc" stroke="var(--pos)" fill="rgba(0,184,107,.10)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="exp" name="exp" stroke="var(--neg)" fill="rgba(255,77,109,.08)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="acc" name="acc" stroke="var(--info)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="legend" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <span className="legend-item"><span className="lz" style={{ background: "var(--acc)" }} />Receitas</span>
          <span className="legend-item"><span className="lz" style={{ background: "var(--neg)" }} />Despesas</span>
          <span className="legend-item"><span className="lz dash" style={{ borderColor: "var(--info)" }} />Saldo acum.</span>
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
    { label: "Saúde (score)",      val: score,                                       note: `${score}/100` },
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
            <ProvBadge prov="est" />
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
          <div className="kpi-ic"><PieChart size={15} /></div>
          <div><div className="ttl">Top categorias</div></div>
        </div>
        <div className="state"><div className="state-ic"><PieChart size={20} /></div><h4>Sem dados de categoria</h4><p>Categorize suas transações para ver o ranking.</p></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><PieChart size={15} /></div>
        <div>
          <div className="ttl">Top categorias</div>
          <div className="sub">Clique para ver subcategorias</div>
        </div>
        <div className="spacer" />
        <ProvBadge prov="real" />
        <button className="btn btn-quiet btn-sm" onClick={() => onNav("cashflow")}>
          Detalhar <ChevronRight size={13} />
        </button>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 8, paddingTop: 4 }}>
        {top.map((c, i) => {
          const color  = catColor(c.category_name);
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
            return (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                  <span style={{ width: 26, height: 18, borderRadius: 4, background: catColor(c.issuer ?? c.name), flex: "none" }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                  {c.last_four && <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>•{c.last_four}</span>}
                  <span className="t-sub" style={{ marginLeft: "auto" }}>fecha dia {c.closing_day}</span>
                </div>
                {limit > 0 && (
                  <>
                    <div className="track thin">
                      <div className="fill" style={{ width: "0%", background: "var(--acc)" }} />
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
  const angle  = (ratio / 100) * 251;
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <svg width={56} height={56} style={{ flex: "none" }}>
          <circle cx={28} cy={28} r={22} fill="none" stroke="var(--line)" strokeWidth={6} />
          <circle cx={28} cy={28} r={22} fill="none" stroke="var(--acc)" strokeWidth={6}
            strokeDasharray={`${angle} 251`} strokeLinecap="round"
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
          <div style={{ fontWeight: 700, fontSize: 14 }}>Orçamentos ativos</div>
          <div className="t-sub">Limites configurados</div>
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
                {new Date(b.period_end).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
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
  return (
    <div className="card card-pad" style={{ background: "linear-gradient(135deg, var(--acc-soft), var(--card))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="goal-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)", border: "1px solid var(--acc-soft-2)" }}>
          <Sparkles size={14} />
        </span>
        <span className="eyebrow" style={{ color: "var(--acc-ink)" }}>Resumo do período</span>
        <ProvBadge prov="real" />
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink)", fontWeight: 500 }}>
        {sr != null && sr > 0
          ? <>Você poupou <b>{pct(summary.savings_rate)}</b> da renda neste período — {sr >= 20 ? "acima da meta recomendada de 20%." : "continue avançando rumo aos 20%."}</>
          : "Importe seus extratos para receber dicas personalizadas baseadas no seu fluxo real."}
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNav("reports")}>
        Ver relatório completo
      </button>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export function DashboardPage({
  dashboardPeriod,
  onNavigate,
  onOpenImports,
  onOpenTransactions,
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
  const q  = periodQuery(dashboardPeriod);
  const ok = !!session;
  const staleTime = 3 * 60 * 1000;

  const summaryQ  = useQuery({ queryKey: ["dash-summary",  session.token, q], queryFn: () => getDashboardSummary(session, q),        enabled: ok, staleTime });
  const monthlyQ  = useQuery({ queryKey: ["dash-monthly",  session.token, q], queryFn: () => getMonthlyCashflow(session, q),         enabled: ok, staleTime });
  const dailyQ    = useQuery({ queryKey: ["dash-daily",    session.token, q], queryFn: () => getDailyCashflow(session, q),           enabled: ok, staleTime });
  const catsQ     = useQuery({ queryKey: ["dash-cats",     session.token, q], queryFn: () => getCategoryRanking(session, q + (q ? "&" : "?") + "limit=8"), enabled: ok, staleTime });
  const subsQ     = useQuery({ queryKey: ["dash-subs",     session.token, q], queryFn: () => getSubcategoryRanking(session, q + (q ? "&" : "?") + "limit=40"), enabled: ok, staleTime });
  const qualityQ  = useQuery({ queryKey: ["dash-quality",  session.token, q], queryFn: () => getDataQuality(session, q),            enabled: ok, staleTime });
  const goalsQ    = useQuery({ queryKey: ["goals",         session.token],     queryFn: () => getGoals(session),                     enabled: ok, staleTime });
  const budgetsQ  = useQuery({ queryKey: ["budgets",       session.token, q],  queryFn: () => getBudgets(session, q),                enabled: ok, staleTime });
  const cardsQ    = useQuery({ queryKey: ["credit-cards",  session.token],     queryFn: () => getCreditCards(session),               enabled: ok, staleTime });
  const eventsQ   = useQuery({ queryKey: ["cal-events",    session.token, q],  queryFn: () => getCalendarEvents(session, q),         enabled: ok, staleTime });

  const summary  = summaryQ.data;
  const monthly  = monthlyQ.data?.items ?? [];
  const daily    = dailyQ.data?.items   ?? [];
  const cats     = catsQ.data?.items    ?? [];
  const subs     = subsQ.data?.items    ?? [];
  const quality  = qualityQ.data;
  const goals    = goalsQ.data?.items   ?? [];
  const budgets  = budgetsQ.data?.items ?? [];
  const cards    = cardsQ.data?.items   ?? [];
  const events   = eventsQ.data?.items  ?? [];

  const hour   = new Date().getHours();
  const greet  = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const name   = workspaceName ?? "você";

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
            Período: <b style={{ color: "var(--ink-2)" }}>{dashboardPeriod.dateFrom} → {dashboardPeriod.dateTo}</b>
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("reports")}>
            <BarChart2 size={14} /> Relatório
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenImports()}>
            <Database size={14} /> Importar
          </button>
        </div>
      </div>

      {/* Empty state — sem dados */}
      {isEmpty && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <div className="alert-ic"><Database size={16} /></div>
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
      {summary && <><KpiDeck summary={summary} /><div style={{ height: 16 }} /></>}

      {/* Loading skeleton quando não tem summary ainda */}
      {!summary && (
        <div className="kpi-deck" style={{ marginBottom: 16 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="kpi"><div className="skel" style={{ height: 80 }} /></div>
          ))}
        </div>
      )}

      {/* Main: gráfico + saúde */}
      <div className="dash-main" style={{ marginBottom: 16 }}>
        <FlowCard daily={daily} monthly={monthly} />
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

      {/* Grid 3 colunas: Budget + Goals + Tip */}
      <div className="grid cols-3">
        <BudgetMini budgets={budgets} onNav={onNavigate} />
        <GoalsMini goals={goals} onNav={onNavigate} />
        {summary ? <TipCard summary={summary} onNav={onNavigate} /> : <div className="card card-pad"><div className="skel" style={{ height: 120 }} /></div>}
      </div>
    </div>
  );
}
