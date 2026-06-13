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

import { getPlanningProjection } from "../lib/api";
import { dateLabel, isoDate, money, moneyAbs } from "../lib/utils";
import { PageState } from "../components/ui";
import type { ApiSession, PlanningProjection } from "../lib/api";
import type { Page } from "../types";

const HORIZONS = [30, 60, 90];

function riskInfo(level?: string): { cls: string; label: string; text: string } {
  if (level === "risk") return { cls: "b-neg", label: "Risco alto", text: "Possível saldo negativo no período. Ação recomendada." };
  if (level === "attention") return { cls: "b-warn", label: "Atenção", text: "Saldo fica apertado, mas positivo." };
  if (level === "healthy") return { cls: "b-pos", label: "Risco baixo", text: "Sem risco de saldo negativo no período." };
  return { cls: "b-neutral", label: "Sem leitura", text: "Eventos insuficientes para avaliar o risco." };
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    card_payment: "Fatura", expense: "Despesa", goal: "Meta",
    income: "Receita", other: "Outro", subscription: "Assinatura",
  };
  return labels[eventType] ?? eventType;
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

export function PlanningPage({ session, onNavigate }: { session: ApiSession; onNavigate: (page: Page) => void }) {
  const today = isoDate(new Date());
  const [h, setH] = useState(90);
  const projection = useQuery({
    queryKey: ["planning-projection", session.token, today],
    queryFn: () => getPlanningProjection(session, `?date_from=${today}&horizons=30,60,90`),
  });

  if (projection.isLoading) {
    return <PageState icon={Loader2} title="Calculando projeção" description="Lendo eventos, metas e premissas." spin />;
  }
  const data = projection.data;
  if (projection.isError || !data) {
    return <PageState icon={AlertCircle} title="Projeção indisponível" description="Confira a API local e tente novamente." />;
  }

  const horizons = data.horizons;
  const sel = horizons.find((hz) => hz.days === h) ?? horizons[horizons.length - 1];
  const first = horizons[0];
  // Starting balance = projected_balance − (income − expenses) of any horizon.
  const startBalance = first
    ? Number(first.projected_balance) - (Number(first.projected_income) - Number(first.projected_expenses))
    : 0;

  const spreadOf = (hz: PlanningProjection["horizons"][number]) => Math.abs(Number(hz.projected_expenses)) * 0.15;

  const points: ChartPoint[] = [
    { x: "Hoje", prov: startBalance, best: startBalance, worst: startBalance },
    ...horizons
      .filter((hz) => hz.days <= h)
      .map((hz) => {
        const b = Number(hz.projected_balance);
        const s = spreadOf(hz);
        return { x: `${hz.days}d`, prov: b, best: b + s, worst: b - s };
      }),
  ];

  const saldoFim = Number(sel?.projected_balance ?? 0);
  const minSaldo = Math.min(...points.map((p) => p.prov));
  const variacao = saldoFim - startBalance;
  const variacaoPct = startBalance !== 0 ? (variacao / Math.abs(startBalance)) * 100 : 0;
  const selSpread = sel ? spreadOf(sel) : 0;
  const risk = riskInfo(sel?.risk_level);

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h2 className="section-title"><TrendingUp size={18} /> Projeção de saldo futuro</h2>
          <p className="section-sub">Antecipe riscos e veja para onde seu saldo caminha — cenário provável (real) e estimativas otimista/pessimista.</p>
        </div>
        <div className="seg" style={{ flex: "none" }}>
          {HORIZONS.map((d) => (
            <button key={d} type="button" className={h === d ? "on" : ""} onClick={() => setH(d)}>{d} dias</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi icon={<Wallet size={15} />} label="Saldo ao fim do período" value={money(saldoFim)} sub={sel ? `até ${dateLabel(sel.date_to)}` : undefined} />
        <Kpi icon={<ArrowDownRight size={15} />} iconBg="var(--warn-soft)" iconColor="var(--warn)" label="Menor saldo previsto" value={money(minSaldo)} sub="no período projetado" />
        <Kpi icon={<TrendingUp size={15} />} iconBg={variacao >= 0 ? "var(--pos-soft)" : "var(--neg-soft)"} iconColor={variacao >= 0 ? "var(--pos)" : "var(--neg)"} label="Variação no período"
          value={money(variacao)} sub={`${variacao >= 0 ? "+" : ""}${variacaoPct.toFixed(1)}%`} subColor={variacao >= 0 ? "var(--pos)" : "var(--neg)"} />
        <div className="kpi" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--bg-sunken)" }}><ShieldCheck size={15} /></span>
            <span className="kpi-label">Risco de saldo negativo</span>
          </div>
          <div style={{ marginTop: 2 }}><span className={`badge ${risk.cls}`}>{risk.label}</span></div>
          <div className="kpi-sub" style={{ marginTop: 8 }}>{sel?.risk_reason || risk.text}</div>
        </div>
      </div>

      {/* Trajectory chart + assumptions */}
      <div className="dash-main" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><BarChart3 size={15} /></div>
            <div>
              <span className="ttl">Trajetória do saldo</span>
              <div className="sub">Cenários para os próximos {h} dias</div>
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
                <Line dataKey="prov" name="Cenário provável" stroke="var(--acc)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
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
        <ScenarioCard tone="pos" title="Melhor cenário" value={saldoFim + selSpread} note="Receita extra ou cortes em gastos variáveis." />
        <ScenarioCard tone="acc" title="Cenário provável" value={saldoFim} note="Mantendo o padrão atual de receitas e gastos." main />
        <ScenarioCard tone="neg" title="Pior cenário" value={saldoFim - selSpread} note="Queda de receita e despesas acima da média." />
      </div>

      {/* Future events + what needs action */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><Calendar size={15} /></div>
            <div>
              <span className="ttl">Eventos futuros relevantes</span>
              <div className="sub">O que move o saldo no período</div>
            </div>
          </div>
          <div style={{ padding: "6px 8px 10px" }}>
            {data.upcoming_events.length ? data.upcoming_events.slice(0, 6).map((ev) => (
              <div key={`${ev.title}-${ev.due_date}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderBottom: "1px solid var(--line)" }}>
                <span className="mono t-sub" style={{ width: 64, flex: "none" }}>{dateLabel(ev.due_date)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                  <div className="t-sub">{eventLabel(ev.event_type)} · {ev.recurrence === "monthly" ? "mensal" : "pontual"}</div>
                </div>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: ev.event_type === "income" ? "var(--pos)" : "var(--neg)", width: 96, textAlign: "right" }}>{moneyAbs(ev.amount)}</span>
              </div>
            )) : (
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", padding: 12 }}>Nenhum evento planejado para os próximos {h} dias.</p>
            )}
          </div>
        </div>

        <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><AlertCircle size={15} /></span>
            <span className="section-title" style={{ fontSize: 15 }}>O que exige ação</span>
          </div>
          <div className={`alert ${sel?.risk_level === "risk" ? "neg" : sel?.risk_level === "attention" ? "warn" : "info"}`}>
            <span className="alert-ic"><ShieldCheck size={16} /></span>
            <div>
              <div className="a-ttl">{risk.label} no horizonte de {h} dias</div>
              <div className="a-txt">{sel?.risk_reason || risk.text}</div>
            </div>
          </div>
          {data.goals_due.length > 0 && (
            <div className="alert info" style={{ marginTop: 10 }}>
              <span className="alert-ic"><Wallet size={16} /></span>
              <div>
                <div className="a-ttl">{data.goals_due.length} meta(s) com prazo no período</div>
                <div className="a-txt">{data.goals_due.map((g) => `${g.name} (${moneyAbs(g.remaining_amount)} restantes)`).join(" · ")}</div>
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
