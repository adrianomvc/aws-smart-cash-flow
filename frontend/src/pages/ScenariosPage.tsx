import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Edit3, Flag, Loader2, Minus, RefreshCw, SlidersHorizontal, X, XCircle, Zap } from "lucide-react";

import { getDashboardSummary, getPlanningProjection } from "../lib/api";
import { money } from "../lib/utils";
import { PageState } from "../components/ui";
import type { ApiSession } from "../lib/api";
import type { Page } from "../types";

const num = (v: number, dec = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

function SliderRow({ label, value, min, max, step, fmt, onChange, accent = "var(--acc)" }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; accent?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
        <span style={{ color: "var(--ink-2)" }}>{label}</span>
        <span className="mono" style={{ fontWeight: 700, color: value > 0 ? accent : "var(--ink-3)" }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: accent, cursor: "pointer" }} />
    </div>
  );
}

function ImpactRow({ label, before, after, fmt }: { label: string; before: number; after: number; fmt: (v: number) => string }) {
  const changed = Math.abs(after - before) > 0.01;
  const improved = after >= before;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-faint)", textDecoration: changed ? "line-through" : "none" }}>{fmt(before)}</span>
      {changed && <ChevronRight size={13} style={{ color: "var(--ink-faint)" }} />}
      {changed && <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: improved ? "var(--pos)" : "var(--neg)" }}>{fmt(after)}</span>}
    </div>
  );
}

export function ScenariosPage({ session, onNavigate }: { session: ApiSession; onNavigate: (page: Page) => void }) {
  const summaryQ = useQuery({ queryKey: ["dash-summary", session.token, "scenarios"], queryFn: () => getDashboardSummary(session, "") });
  const projQ = useQuery({ queryKey: ["planning-projection", session.token, 90], queryFn: () => getPlanningProjection(session, 90) });

  const [purchase, setPurchase] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [variableCut, setVariableCut] = useState(0);
  const [incomeDrop, setIncomeDrop] = useState(0);
  const [newSub, setNewSub] = useState(0);
  const [extra, setExtra] = useState(0);

  function reset() { setPurchase(0); setInstallments(1); setVariableCut(0); setIncomeDrop(0); setNewSub(0); setExtra(0); }

  if (summaryQ.isLoading || projQ.isLoading) {
    return <PageState icon={Loader2} title="Carregando simulador" description="Lendo seus indicadores reais." spin />;
  }
  const summary = summaryQ.data;
  const proj = projQ.data;
  if (!summary || !proj) {
    return <PageState icon={AlertTriangle} title="Simulador indisponível" description="Confira a API local e tente novamente." />;
  }

  // Real base values
  const saldo = Number(summary.current_balance ?? proj.start_balance);
  const safeSpend = Number(summary.safe_spend ?? 0);
  const minProj = Number(proj.min_balance);
  const monthlyNet = Number(proj.monthly_net);
  const recIncome = Number(proj.recurring_income);
  const variableAvg = Number(proj.variable_average);
  const monthlyExpense = Number(proj.recurring_expense) + variableAvg;
  const burnRate = Number(summary.burn_rate) || monthlyExpense;
  const runway = burnRate > 0 ? saldo / burnRate : 0;
  const savingRate = summary.savings_rate ? Number(summary.savings_rate) * 100 : (recIncome > 0 ? (monthlyNet / recIncome) * 100 : 0);
  const reserve = Number(summary.protected_reserve ?? 0) || monthlyExpense;

  // Scenario deltas
  const monthlyPurchase = installments > 1 ? purchase / installments : 0;
  const oneOffPurchase = installments === 1 ? purchase : 0;
  const variableSaving = variableAvg * (variableCut / 100);
  const incomeLoss = recIncome * (incomeDrop / 100);
  const monthlyImpact = -monthlyPurchase + variableSaving - incomeLoss - newSub;
  const oneOffImpact = oneOffPurchase + extra;

  const newMonthlyNet = monthlyNet + monthlyImpact;
  const newMinProj = minProj + monthlyImpact - oneOffImpact;
  const newSafe = safeSpend - (installments === 1 ? purchase : monthlyPurchase) + variableSaving - newSub - extra;
  const newRunway = monthlyExpense > 0 ? runway + (variableSaving - newSub - incomeLoss) / monthlyExpense : runway;
  const newSaving = savingRate + (monthlyImpact / Math.max(recIncome, 1)) * 100;

  let verdict: "seguro" | "atencao" | "nao";
  if (newMinProj > reserve && newMonthlyNet > 0) verdict = "seguro";
  else if (newMinProj > 0) verdict = "atencao";
  else verdict = "nao";

  const reasons: { ok: boolean | null; t: string }[] = [];
  if (newMinProj > reserve) reasons.push({ ok: true, t: `Menor saldo previsto permanece confortável (${money(newMinProj)})` });
  else if (newMinProj > 0) reasons.push({ ok: null, t: `Saldo fica apertado: menor ponto em ${money(newMinProj)}` });
  else reasons.push({ ok: false, t: `Saldo previsto fica negativo (${money(newMinProj)})` });
  if (newMonthlyNet > 0) reasons.push({ ok: true, t: `Você ainda termina o mês no positivo (${money(newMonthlyNet)})` });
  else reasons.push({ ok: false, t: "O mês fecharia no negativo" });
  if (newRunway >= runway) reasons.push({ ok: true, t: `Runway se mantém ou melhora (${num(newRunway, 1)} meses)` });
  else if (newRunway > 4) reasons.push({ ok: null, t: `Runway cai levemente para ${num(newRunway, 1)} meses` });
  else reasons.push({ ok: false, t: `Runway cai abaixo do recomendado (${num(newRunway, 1)} meses)` });

  const vmap = {
    seguro: { col: "var(--acc)", label: "Decisão segura", Icon: CheckCircle2 },
    atencao: { col: "var(--warn)", label: "Requer atenção", Icon: AlertTriangle },
    nao: { col: "var(--neg)", label: "Não recomendado", Icon: XCircle },
  } as const;
  const v = vmap[verdict];

  const presets = [
    { label: "Comprar algo de R$ 800", fn: () => { reset(); setPurchase(800); } },
    { label: "Reduzir variáveis 15%", fn: () => { reset(); setVariableCut(15); } },
    { label: "Desembolso extra R$ 3.000", fn: () => { reset(); setExtra(3000); } },
    { label: "E se a receita cair 20%?", fn: () => { reset(); setIncomeDrop(20); } },
    { label: "Nova assinatura R$ 60", fn: () => { reset(); setNewSub(60); } },
  ];

  const goalsDays = Math.round(Math.abs(monthlyImpact) / 1200 * 30);

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
        <h2 className="section-title"><SlidersHorizontal size={18} /> Simulador de cenários</h2>
        <p className="section-sub">Teste uma decisão antes de tomá-la. Veja o impacto no saldo, no runway e nas metas — em tempo real, sobre seus números atuais.</p>
      </div>

      {/* Preset chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {presets.map((p) => (
          <button key={p.label} type="button" className="btn btn-quiet btn-sm" onClick={p.fn}>
            <Zap size={13} /> {p.label}
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Controls */}
        <div className="card">
          <div className="card-head">
            <div className="kpi-ic"><Edit3 size={15} /></div>
            <div><span className="ttl">Monte seu cenário</span></div>
            <span style={{ flex: 1 }} />
            <button className="btn btn-quiet btn-sm" type="button" onClick={reset}><RefreshCw size={14} /> Limpar</button>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 18 }}>
            <SliderRow label="Valor de uma compra" value={purchase} min={0} max={8000} step={50} fmt={money} onChange={setPurchase} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: "var(--ink-2)" }}>Parcelar em</span>
                <span className="mono" style={{ fontWeight: 700 }}>{installments}x</span>
              </div>
              <div className="seg" style={{ width: "100%" }}>
                {[1, 2, 3, 6, 10, 12].map((x) => (
                  <button key={x} type="button" className={installments === x ? "on" : ""} style={{ flex: 1 }} onClick={() => setInstallments(x)}>{x}x</button>
                ))}
              </div>
            </div>
            <SliderRow label="Reduzir gastos variáveis" value={variableCut} min={0} max={50} step={5} fmt={(x) => `${x}%`} onChange={setVariableCut} accent="var(--acc)" />
            <SliderRow label="Queda de receita" value={incomeDrop} min={0} max={40} step={5} fmt={(x) => `${x}%`} onChange={setIncomeDrop} accent="var(--neg)" />
            <SliderRow label="Nova assinatura mensal" value={newSub} min={0} max={500} step={10} fmt={money} onChange={setNewSub} accent="var(--warn)" />
            <SliderRow label="Desembolso extra (uma vez)" value={extra} min={0} max={6000} step={100} fmt={money} onChange={setExtra} accent="var(--neg)" />
          </div>
        </div>

        {/* Result */}
        <div className="vstack" style={{ gap: 16 }}>
          <div className="card card-pad" style={{ borderColor: v.col + "44", background: `linear-gradient(135deg, ${v.col}0f, var(--card) 60%)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span className="kpi-ic" style={{ width: 40, height: 40, background: v.col, color: "#fff" }}><v.Icon size={22} /></span>
              <div>
                <div className="eyebrow">Recomendação</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: v.col, letterSpacing: "-.3px" }}>{v.label}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              {reasons.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
                  <span style={{ color: r.ok === true ? "var(--pos)" : r.ok === false ? "var(--neg)" : "var(--warn)", flex: "none", marginTop: 1 }}>
                    {r.ok === true ? <Check size={14} /> : r.ok === false ? <X size={14} /> : <Minus size={14} />}
                  </span>
                  {r.t}
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Impacto nos indicadores</div>
            <div style={{ display: "grid", gap: 12 }}>
              <ImpactRow label="Menor saldo previsto" before={minProj} after={newMinProj} fmt={money} />
              <ImpactRow label="Gasto seguro restante" before={safeSpend} after={newSafe} fmt={money} />
              <ImpactRow label="Resultado do mês" before={monthlyNet} after={newMonthlyNet} fmt={money} />
              <ImpactRow label="Runway financeiro" before={runway} after={newRunway} fmt={(x) => `${num(x, 1)} meses`} />
              <ImpactRow label="Saving rate" before={savingRate} after={newSaving} fmt={(x) => `${num(x, 1)}%`} />
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Flag size={16} style={{ color: "var(--ink-3)" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Impacto nas metas</span>
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: monthlyImpact >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 600 }}>
                {monthlyImpact === 0 ? "Sem mudança" : monthlyImpact > 0 ? `Acelera reserva em ${goalsDays} dias` : `Atrasa reserva em ${goalsDays} dias`}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={() => onNavigate("goals")}>
              Ver metas afetadas <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
