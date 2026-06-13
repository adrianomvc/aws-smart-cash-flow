import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownRight,
  BarChart3,
  Calendar,
  Loader2,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getProjectionFeed } from "../lib/api";
import { dateLabel, money, moneyAbs } from "../lib/utils";
import { PageState } from "../components/ui";
import type { ApiSession, ProjectionFeed } from "../lib/api";
import type { Page } from "../types";

const HORIZONS = [
  { days: 30, label: "1 mês" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function axisFmt(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? "-" : ""}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

const monthlyAmt = (r: ProjectionFeed["recurring_items"][number]) =>
  Number(r.average_amount) * (r.frequency === "weekly" ? 4.33 : 1);

type ChartPoint = { x: string; prov: number; best: number; worst: number };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ChartPoint }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 11px", boxShadow: "var(--sh-pop)", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "var(--acc-ink)" }}>Provável: {money(p.prov)}</div>
      <div style={{ color: "var(--ink-3)" }}>Melhor: {money(p.best)}</div>
      <div style={{ color: "var(--ink-3)" }}>Pior: {money(p.worst)}</div>
    </div>
  );
}

function Kpi({ icon, iconBg, iconColor, label, value, sub, subColor }: {
  icon: React.ReactNode; iconBg?: string; iconColor?: string; label: string; value: React.ReactNode; sub?: React.ReactNode; subColor?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-ic" style={{ background: iconBg, color: iconColor }}>{icon}</span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-val" style={{ fontSize: 18 }}>{value}</div>
      {sub != null && <div className="kpi-sub" style={{ color: subColor }}>{sub}</div>}
    </div>
  );
}

function ScenarioCard({ tone, title, value, note, main }: { tone: "pos" | "acc" | "neg"; title: string; value: number; note: string; main?: boolean }) {
  const col = tone === "neg" ? "var(--neg)" : tone === "pos" ? "var(--acc)" : "var(--acc-ink)";
  return (
    <div className="card card-pad" style={main ? { borderColor: "var(--acc-soft-2)", boxShadow: "var(--sh-md)" } : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: col }} />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
        {main && <span className="badge b-pos" style={{ marginLeft: "auto" }}>principal</span>}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 700, letterSpacing: "-.6px", color: col, fontVariantNumeric: "tabular-nums" }}>{money(value)}</div>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.5 }}>{note}</p>
    </div>
  );
}

export function PlanningPage({ session, onNavigate }: { session: ApiSession; onNavigate: (page: Page) => void }) {
  const [h, setH] = useState(90);
  const feedQuery = useQuery({
    queryKey: ["projection-feed", session.token],
    queryFn: () => getProjectionFeed(session, 365, 3),
  });
  const selLabel = HORIZONS.find((hz) => hz.days === h)?.label ?? `${h} dias`;

  if (feedQuery.isLoading) {
    return <PageState icon={Loader2} title="Calculando projeção" description="Lendo saldo, recorrências e parcelas." spin />;
  }
  const feed = feedQuery.data;
  if (feedQuery.isError || !feed) {
    return <PageState icon={AlertCircle} title="Projeção indisponível" description="Confira a API local e tente novamente." />;
  }

  const start = Number(feed.current_balance ?? 0);
  const recurring = feed.recurring_items;
  const recIncome = recurring.filter((r) => r.type === "income").reduce((s, r) => s + monthlyAmt(r), 0);
  const recExpense = recurring.filter((r) => r.type === "expense").reduce((s, r) => s + monthlyAmt(r), 0);
  // Exclude the "Sem categoria" bucket: it lumps transfers/investments and
  // would distort the projection. Categorized variable spend only.
  const varCats = feed.variable_categories.filter((v) => v.category_id);
  const uncategorizedVar = feed.variable_categories.filter((v) => !v.category_id).reduce((s, v) => s + Number(v.monthly_average), 0);
  const varExpense = varCats.reduce((s, v) => s + Number(v.monthly_average), 0);
  const monthlyNet = recIncome - recExpense - varExpense;

  const endDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };
  const sumInstallments = (days: number) => {
    const end = endDate(days);
    return feed.credit_card_installments.filter((i) => new Date(i.due_date) <= end).reduce((s, i) => s + Number(i.amount), 0);
  };
  const sumKnown = (days: number) => {
    const end = endDate(days);
    return feed.known_events.filter((e) => new Date(e.date) <= end).reduce((s, e) => s + (e.type === "income" ? 1 : -1) * Number(e.amount), 0);
  };
  const balanceAt = (days: number) => start + monthlyNet * (days / 30) - sumInstallments(days) + sumKnown(days);
  const spreadAt = (days: number) => varExpense * 0.4 * (days / 30);

  const stepDays: number[] = [];
  for (let d = 0; d <= h; d += 30) stepDays.push(d);
  if (stepDays[stepDays.length - 1] < h) stepDays.push(h);
  const points: ChartPoint[] = stepDays.map((d) => {
    const b = balanceAt(d);
    const sp = spreadAt(d);
    return { x: MONTH_ABBR[endDate(d).getMonth()], prov: Math.round(b), best: Math.round(b + sp), worst: Math.round(b - sp) };
  });

  const saldoFim = balanceAt(h);
  const minProv = Math.min(...points.map((p) => p.prov));
  const minWorst = Math.min(...points.map((p) => p.worst));
  const variacao = saldoFim - start;
  const variacaoPct = start !== 0 ? (variacao / Math.abs(start)) * 100 : 0;
  const selSpread = spreadAt(h);
  const reserve = recExpense + varExpense; // ~1 month of expenses

  let risk: { cls: string; label: string; text: string };
  if (minProv < 0) risk = { cls: "b-neg", label: "Risco alto", text: `Saldo pode ficar negativo (mín. ${money(minProv)}) no período. Ação recomendada.` };
  else if (minWorst < 0 || minProv < reserve) risk = { cls: "b-warn", label: "Atenção", text: `Saldo fica apertado (mín. ${money(minProv)}), abaixo de ~1 mês de despesas.` };
  else risk = { cls: "b-pos", label: "Risco baixo", text: "O saldo se mantém confortável no período projetado." };

  // Future events list: dated (installments + known) first, then top monthly recurring.
  const dated = [
    ...feed.credit_card_installments.map((i) => ({ date: i.due_date, title: i.description, kind: "Parcela de cartão", amount: Number(i.amount), income: false, monthly: false })),
    ...feed.known_events.map((e) => ({ date: e.date, title: e.description, kind: e.type === "income" ? "Receita prevista" : "Despesa prevista", amount: Number(e.amount), income: e.type === "income", monthly: false })),
  ].filter((e) => new Date(e.date) <= endDate(h)).sort((a, b) => a.date.localeCompare(b.date));
  const monthly = [...recurring].sort((a, b) => monthlyAmt(b) - monthlyAmt(a)).slice(0, 5).map((r) => ({
    date: "", title: r.description, kind: r.type === "income" ? "Receita mensal" : "Despesa mensal", amount: monthlyAmt(r), income: r.type === "income", monthly: true,
  }));
  const events = [...dated, ...monthly].slice(0, 7);

  const assumptions = [
    feed.current_balance != null
      ? `Saldo inicial real: ${money(start)} (${feed.current_balance_account ?? "conta"}${feed.current_balance_date ? `, em ${dateLabel(feed.current_balance_date)}` : ""}).`
      : "Sem saldo bancário importado — projeção parte de zero.",
    `${recurring.filter((r) => r.type === "expense").length} despesas recorrentes ≈ ${money(recExpense)}/mês.`,
    `${recurring.filter((r) => r.type === "income").length} receitas recorrentes ≈ ${money(recIncome)}/mês.`,
    `${varCats.length} categorias variáveis ≈ ${money(varExpense)}/mês (média histórica).`,
    `Fluxo recorrente líquido ≈ ${money(monthlyNet)}/mês.`,
    ...(uncategorizedVar > 0 ? [`Lançamentos sem categoria (${money(uncategorizedVar)}/mês) ficam fora — categorize-os para refinar.`] : []),
  ];

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h2 className="section-title"><TrendingUp size={18} /> Projeção de saldo futuro</h2>
          <p className="section-sub">Parte do saldo real da conta e projeta com suas recorrências e parcelas — cenário provável + estimativas otimista/pessimista.</p>
        </div>
        <div className="seg" style={{ flex: "none" }}>
          {HORIZONS.map((hz) => (
            <button key={hz.days} type="button" className={h === hz.days ? "on" : ""} onClick={() => setH(hz.days)}>{hz.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi icon={<Wallet size={15} />} label="Saldo ao fim do período" value={money(saldoFim)} sub={`em ${dateLabel(endDate(h).toISOString().slice(0, 10))}`} />
        <Kpi icon={<ArrowDownRight size={15} />} iconBg="var(--warn-soft)" iconColor="var(--warn)" label="Menor saldo previsto" value={money(minProv)} sub="no período projetado" />
        <Kpi icon={<TrendingUp size={15} />} iconBg={variacao >= 0 ? "var(--pos-soft)" : "var(--neg-soft)"} iconColor={variacao >= 0 ? "var(--pos)" : "var(--neg)"} label="Variação no período"
          value={money(variacao)} sub={`${variacao >= 0 ? "+" : ""}${variacaoPct.toFixed(1)}%`} subColor={variacao >= 0 ? "var(--pos)" : "var(--neg)"} />
        <div className="kpi" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--bg-sunken)" }}><ShieldCheck size={15} /></span>
            <span className="kpi-label">Risco de saldo negativo</span>
          </div>
          <div style={{ marginTop: 2 }}><span className={`badge ${risk.cls}`}>{risk.label}</span></div>
          <div className="kpi-sub" style={{ marginTop: 8 }}>{risk.text}</div>
        </div>
      </div>

      {/* Trajectory chart + assumptions */}
      <div className="dash-main" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><BarChart3 size={15} /></div>
            <div>
              <span className="ttl">Trajetória do saldo</span>
              <div className="sub">Cenários para {selLabel}</div>
            </div>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 3" />
                <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
                <YAxis tickFormatter={axisFmt} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="best" name="Melhor cenário" stroke="#7fbf9f" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line dataKey="prov" name="Cenário provável" stroke="var(--acc)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line dataKey="worst" name="Pior cenário" stroke="#d99a8f" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="legend" style={{ marginTop: 4, padding: "12px 20px 16px", borderTop: "1px solid var(--line)" }}>
            <span className="legend-item"><span className="lz" style={{ background: "#7fbf9f" }} />Melhor cenário</span>
            <span className="legend-item"><span className="lz" style={{ background: "var(--acc)" }} />Cenário provável</span>
            <span className="legend-item"><span className="lz" style={{ background: "#d99a8f" }} />Pior cenário</span>
          </div>
        </div>

        {/* Assumptions */}
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><SlidersHorizontal size={15} /></div>
            <div>
              <span className="ttl">Premissas usadas</span>
              <div className="sub">Base do cálculo</div>
            </div>
          </div>
          <div style={{ padding: "6px 16px 8px" }}>
            {assumptions.map((a) => (
              <div key={a} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5, color: "var(--ink-2)" }}>
                <ShieldCheck size={14} style={{ flex: "none", marginTop: 1, color: "var(--ink-faint)" }} />
                <span>{a}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 16px 16px" }}>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={() => onNavigate("settings")}>
              <SettingsIcon size={14} /> Ajustar premissas
            </button>
          </div>
        </div>
      </div>

      {/* Scenario trio */}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <ScenarioCard tone="pos" title="Melhor cenário" value={saldoFim + selSpread} note="Gastos variáveis abaixo da média ou receita extra." />
        <ScenarioCard tone="acc" title="Cenário provável" value={saldoFim} note="Mantendo o padrão atual de receitas e gastos." main />
        <ScenarioCard tone="neg" title="Pior cenário" value={saldoFim - selSpread} note="Gastos variáveis acima da média no período." />
      </div>

      {/* Future events + what needs action */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><Calendar size={15} /></div>
            <div>
              <span className="ttl">Compromissos do período</span>
              <div className="sub">Parcelas, eventos e recorrências que movem o saldo</div>
            </div>
          </div>
          <div style={{ padding: "6px 8px 10px" }}>
            {events.length ? events.map((ev, i) => (
              <div key={`${ev.title}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderBottom: "1px solid var(--line)" }}>
                <span className="mono t-sub" style={{ width: 64, flex: "none" }}>{ev.monthly ? "mensal" : dateLabel(ev.date)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                  <div className="t-sub">{ev.kind}</div>
                </div>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: ev.income ? "var(--pos)" : "var(--neg)", width: 96, textAlign: "right" }}>{moneyAbs(ev.amount)}</span>
              </div>
            )) : (
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", padding: 12 }}>Sem compromissos detectados no período.</p>
            )}
          </div>
        </div>

        <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><AlertCircle size={15} /></span>
            <span className="section-title" style={{ fontSize: 15 }}>O que exige ação</span>
          </div>
          <div className={`alert ${risk.cls === "b-neg" ? "neg" : risk.cls === "b-warn" ? "warn" : "info"}`}>
            <span className="alert-ic"><ShieldCheck size={16} /></span>
            <div>
              <div className="a-ttl">{risk.label} no horizonte de {selLabel}</div>
              <div className="a-txt">{risk.text}</div>
            </div>
          </div>
          {monthlyNet < 0 && (
            <div className="alert warn" style={{ marginTop: 10 }}>
              <span className="alert-ic"><ArrowDownRight size={16} /></span>
              <div>
                <div className="a-ttl">Fluxo recorrente negativo</div>
                <div className="a-txt">Suas despesas recorrentes superam as receitas em {money(Math.abs(monthlyNet))}/mês — revise gastos fixos ou variáveis.</div>
              </div>
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: "auto", marginBottom: 0 }} onClick={() => onNavigate("calendar")}>
            <Calendar size={15} /> Ver calendário financeiro
          </button>
        </div>
      </div>
    </div>
  );
}
