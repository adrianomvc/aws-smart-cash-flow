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
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getPlanningProjection } from "../lib/api";
import { dateLabel, money, moneyAbs } from "../lib/utils";
import { EmptyState, NoDataOnboarding, PageState } from "../components/ui";
import { useHasTransactions } from "../hooks";
import type { ApiSession } from "../lib/api";
import type { Page } from "../types";

const HORIZONS = [
  { days: 30, label: "1 mês" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (ym: string) => MONTH_ABBR[Number(ym.slice(5, 7)) - 1] ?? ym;

function riskInfo(level: string): { cls: string; label: string } {
  if (level === "risk") return { cls: "b-neg", label: "Risco alto" };
  if (level === "attention") return { cls: "b-warn", label: "Atenção" };
  return { cls: "b-pos", label: "Risco baixo" };
}

function axisFmt(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? "-" : ""}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

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

export function PlanningPage({ session, onNavigate, onOpenImports }: { session: ApiSession; onNavigate: (page: Page) => void; onOpenImports?: () => void }) {
  const hasTransactions = useHasTransactions(session);
  const [h, setH] = useState(90);
  const projection = useQuery({
    queryKey: ["planning-projection", session.token, h],
    queryFn: () => getPlanningProjection(session, h),
    enabled: hasTransactions !== false,
  });
  const selLabel = HORIZONS.find((hz) => hz.days === h)?.label ?? `${h} dias`;

  if (hasTransactions === false) {
    return (
      <NoDataOnboarding
        icon={TrendingUp}
        eyebrow="Planejamento"
        title="Projete seu saldo futuro"
        description="A projeção usa seu saldo atual, recorrências, parcelas e eventos sazonais para mostrar como seu dinheiro evolui nos próximos meses. Importe seus extratos para o SmartCashFlow montar os cenários."
        onImport={onOpenImports ?? (() => onNavigate("dashboard"))}
      />
    );
  }

  if (projection.isLoading) {
    return <PageState icon={Loader2} title="Calculando projeção" description="Saldo, recorrências, parcelas e eventos anuais." spin />;
  }
  const data = projection.data;
  if (projection.isError || !data) {
    return <PageState icon={AlertCircle} title="Projeção indisponível" description="Confira a API local e tente novamente." />;
  }

  const noData = Number(data.start_balance) === 0 && Number(data.recurring_income) === 0
    && Number(data.recurring_expense) === 0 && data.commitments.length === 0;
  if (noData) {
    return (
      <div className="canvas stg">
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h2 className="section-title"><TrendingUp size={18} /> Projeção de saldo</h2>
        </div>
        <EmptyState icon={TrendingUp} title="Ainda não há dados para projetar"
          description="A projeção usa seu saldo atual, recorrências, parcelas e eventos sazonais. Importe seus extratos para o SmartCashFlow montar os cenários futuros."
          actionLabel="Ir para o Dashboard" onAction={() => onNavigate("dashboard")} />
      </div>
    );
  }

  const points: ChartPoint[] = data.points.map((p) => ({
    x: monthLabel(p.month), prov: Number(p.probable), best: Number(p.best), worst: Number(p.worst),
  }));
  const minWorst = Math.min(...points.map((p) => p.worst));
  const saldoFim = Number(data.end_probable);
  const variation = Number(data.variation);
  const risk = riskInfo(data.risk_level);

  const commitsIn = data.commitments.filter((c) => c.income).reduce((s, c) => s + Number(c.amount), 0);
  const commitsOut = data.commitments.filter((c) => !c.income).reduce((s, c) => s + Number(c.amount), 0);
  const shownCommits = data.commitments.slice(0, 10);
  const moreCommits = data.commitments.length - shownCommits.length;

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h2 className="section-title"><TrendingUp size={18} /> Projeção de saldo futuro</h2>
          <p className="section-sub">Saldo real + recorrências + parcelas + eventos anuais (13º, férias, IPVA…). Cenário provável e estimativas otimista/pessimista.</p>
        </div>
        <div className="seg" style={{ flex: "none" }}>
          {HORIZONS.map((hz) => (
            <button key={hz.days} type="button" className={h === hz.days ? "on" : ""} onClick={() => setH(hz.days)}>{hz.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi icon={<Wallet size={15} />} label="Saldo ao fim do período" value={money(saldoFim)} sub={`em ${selLabel}`} />
        <Kpi icon={<ArrowDownRight size={15} />} iconBg="var(--warn-soft)" iconColor="var(--warn)" label="Menor saldo previsto" value={money(Number(data.min_balance))} sub="no período projetado" />
        <Kpi icon={<TrendingUp size={15} />} iconBg={variation >= 0 ? "var(--pos-soft)" : "var(--neg-soft)"} iconColor={variation >= 0 ? "var(--pos)" : "var(--neg)"} label="Variação no período"
          value={money(variation)} sub={`${variation >= 0 ? "+" : ""}${Number(data.variation_pct).toFixed(1)}%`} subColor={variation >= 0 ? "var(--pos)" : "var(--neg)"} />
        <div className="kpi" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--bg-sunken)" }}><ShieldCheck size={15} /></span>
            <span className="kpi-label">Risco de saldo negativo</span>
          </div>
          <div style={{ marginTop: 2 }}><span className={`badge ${risk.cls}`}>{risk.label}</span></div>
          <div className="kpi-sub" style={{ marginTop: 8 }}>{data.risk_reason}</div>
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
              <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="provGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--acc)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--acc)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                {minWorst < 0 && <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 3" />}
                <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
                <YAxis tickFormatter={axisFmt} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "var(--ink-3)" }} />
                <Tooltip content={<ChartTooltip />} />
                <Area dataKey="prov" name="Cenário provável" stroke="var(--acc)" strokeWidth={2.5} fill="url(#provGrad)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line dataKey="best" name="Melhor cenário" stroke="#7fbf9f" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line dataKey="worst" name="Pior cenário" stroke="#d99a8f" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
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
            {data.assumptions.map((a) => (
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
        <ScenarioCard tone="pos" title="Melhor cenário" value={Number(data.end_best)} note="Gastos variáveis abaixo da média (disciplina)." />
        <ScenarioCard tone="acc" title="Cenário provável" value={saldoFim} note="Mantendo o padrão atual de receitas e gastos." main />
        <ScenarioCard tone="neg" title="Pior cenário" value={Number(data.end_worst)} note="Variáveis acima da média e receita um pouco menor." />
      </div>

      {/* Commitments + what needs action */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><Calendar size={15} /></div>
            <div>
              <span className="ttl">Compromissos do período</span>
              <div className="sub">Parcelas, eventos, recorrências e itens anuais</div>
            </div>
          </div>
          <div style={{ padding: "6px 8px 0" }}>
            {data.commitments.length ? shownCommits.map((ev, i) => (
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
            {moreCommits > 0 && (
              <div style={{ padding: "9px 10px", fontSize: 12, color: "var(--ink-3)" }}>+ {moreCommits} mais</div>
            )}
          </div>
          {data.commitments.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderTop: "1px solid var(--line)", fontSize: 12.5 }}>
              <span style={{ color: "var(--ink-3)" }}>Somatória</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--pos)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>entradas {moneyAbs(commitsIn)}</span>
              <span style={{ color: "var(--neg)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>saídas {moneyAbs(commitsOut)}</span>
            </div>
          )}
        </div>

        <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><AlertCircle size={15} /></span>
            <span className="section-title" style={{ fontSize: 15 }}>O que exige ação</span>
          </div>
          <div className={`alert ${data.risk_level === "risk" ? "neg" : data.risk_level === "attention" ? "warn" : "info"}`}>
            <span className="alert-ic"><ShieldCheck size={16} /></span>
            <div>
              <div className="a-ttl">{risk.label} no horizonte de {selLabel}</div>
              <div className="a-txt">{data.risk_reason}</div>
            </div>
          </div>
          {Number(data.monthly_net) < 0 && (
            <div className="alert warn" style={{ marginTop: 10 }}>
              <span className="alert-ic"><ArrowDownRight size={16} /></span>
              <div>
                <div className="a-ttl">Fluxo recorrente negativo</div>
                <div className="a-txt">As despesas recorrentes superam as receitas em {money(Math.abs(Number(data.monthly_net)))}/mês.</div>
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
