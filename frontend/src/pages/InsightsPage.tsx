import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Database, Info, Loader2, Lightbulb,
  MessageSquare, Sparkles, TrendingUp,
} from "lucide-react";

import { getInsights } from "../lib/api";
import { money } from "../lib/utils";
import { NoDataOnboarding, PageState } from "../components/ui";
import { CopilotChat } from "../components/CopilotChat";
import { useHasTransactions } from "../hooks";
import type { ApiSession, InsightItem } from "../lib/api";
import type { Page, PeriodState, TransactionDrilldown } from "../types";

const TONE: Record<string, { Icon: typeof Info; color: string; soft: string }> = {
  pos: { Icon: CheckCircle2, color: "var(--pos)", soft: "var(--pos-soft)" },
  neg: { Icon: AlertTriangle, color: "var(--neg)", soft: "var(--neg-soft)" },
  warn: { Icon: AlertTriangle, color: "var(--warn)", soft: "var(--warn-soft)" },
  info: { Icon: Lightbulb, color: "var(--info)", soft: "var(--info-soft)" },
};
const num1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function periodLabel(from: string | null, to: string | null): string {
  if (!from || !to) return "todo o período";
  const [fy, fm] = from.split("-");
  const [ty, tm] = to.split("-");
  if (fy === ty && fm === tm) return `${MONTHS[Number(fm) - 1]}/${fy}`;
  return `${MONTHS[Number(fm) - 1]}/${fy.slice(2)} – ${MONTHS[Number(tm) - 1]}/${ty.slice(2)}`;
}

// Bold monetary values and percentages in the reason text.
function renderReason(text: string) {
  const parts = text.split(/(R\$\s?[\d.,]+|[\d.,]+%)/g);
  return parts.map((p, i) =>
    /^(R\$\s?[\d.,]+|[\d.,]+%)$/.test(p)
      ? <strong key={i} style={{ color: "var(--ink-1)" }}>{p}</strong>
      : <span key={i}>{p}</span>,
  );
}

export function InsightsPage({ session, period, onNavigate, onOpenImports, onOpenTransactions }: {
  session: ApiSession;
  period?: PeriodState;
  onNavigate: (page: Page) => void;
  onOpenImports?: () => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
}) {
  const hasTransactions = useHasTransactions(session);
  const [view, setView] = useState<"insights" | "copilot">("insights");
  const query = period && period.periodPreset !== "all"
    ? `?date_from=${period.dateFrom}&date_to=${period.dateTo}`
    : "";
  const insightsQ = useQuery({
    queryKey: ["insights", session.token, query],
    queryFn: () => getInsights(session, query),
    enabled: hasTransactions !== false && view === "insights",
  });

  const tabBar = (
    <div className="seg" style={{ marginBottom: 16 }}>
      <button className={view === "insights" ? "on" : ""} onClick={() => setView("insights")} type="button">
        <Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Insights
      </button>
      <button className={view === "copilot" ? "on" : ""} onClick={() => setView("copilot")} type="button">
        <MessageSquare size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Copiloto IA
      </button>
    </div>
  );

  if (hasTransactions !== false && view === "copilot") {
    return (
      <div className="canvas stg">
        <div style={{ marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Insights</div>
          <h2 className="section-title"><MessageSquare size={18} /> Copiloto Financeiro</h2>
        </div>
        {tabBar}
        <CopilotChat session={session} period={period} />
      </div>
    );
  }

  if (hasTransactions === false) {
    return (
      <NoDataOnboarding
        icon={Sparkles}
        eyebrow="Insights"
        title="Insights inteligentes a partir dos seus dados"
        description="O SmartCashFlow analisa seus gastos e identifica oportunidades de economia, alertas de orçamento e tendências — tudo explicável e baseado nas suas transações reais. Importe seus extratos para gerar os primeiros insights."
        onImport={onOpenImports}
      />
    );
  }

  if (insightsQ.isLoading) {
    return <PageState icon={Loader2} title="Analisando seus dados" description="Gerando insights a partir das suas transações reais." spin />;
  }
  const data = insightsQ.data;
  if (!data) {
    return <PageState icon={AlertTriangle} title="Insights indisponíveis" description="Confira a API local e tente novamente." />;
  }

  const { kpis, items } = data;

  // Carry the insight's period so the destination shows only the relevant rows.
  const periodDrill = period && period.periodPreset !== "all"
    ? { dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset }
    : {};

  function act(it: InsightItem) {
    if (it.action_target === "transactions") {
      onOpenTransactions({ categoryId: it.action_param ?? undefined, label: it.title, ...periodDrill });
    } else if (it.action_target === "review") {
      // Data-quality insight: show exactly the uncategorized transactions.
      onOpenTransactions({ fixedQuery: "category_id=__uncategorized__", label: it.title, ...periodDrill });
    } else {
      onNavigate(it.action_target as Page);
    }
  }

  const alerts = items.filter(it => it.type === "neg" || it.type === "warn");
  const improvements = items.filter(it => it.type === "pos" || it.type === "info");
  const period_lbl = periodLabel(data.date_from, data.date_to);

  function InsightCard({ it }: { it: InsightItem }) {
    const tone = TONE[it.type] ?? TONE.info;
    const imp = Number(it.impact);
    const sav = Number(it.saving);
    const showImpact = imp !== 0;
    const showSaving = !showImpact && sav > 0;
    return (
      <div className="card card-pad" style={{ borderLeft: `3px solid ${tone.color}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", background: tone.soft, color: tone.color }}>
            <tone.Icon size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{it.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {showImpact && (
                <span className="mono" style={{ fontWeight: 700, color: imp >= 0 ? "var(--acc)" : "var(--neg)" }}>
                  {it.impact_label ?? "Impacto"}: {imp >= 0 ? "+" : "−"}{money(Math.abs(imp))}
                </span>
              )}
              {showSaving && (
                <span className="mono" style={{ fontWeight: 700, color: "var(--acc)" }}>
                  Economia: +{money(sav)}
                </span>
              )}
              <span className="badge b-neutral">Confiança: {it.confidence}</span>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, margin: "12px 0" }}>{renderReason(it.reason)}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <span className="mono t-sub" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Database size={13} /> Dados: {it.data}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => act(it)}>
            {it.action} <ChevronRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Crescimento</div>
        <h2 className="section-title"><Sparkles size={18} /> Insights IA</h2>
        <p className="section-sub">Recomendações acionáveis e explicáveis, a partir dos dados do seu workspace. Nada de mágica — sempre mostramos o porquê e os dados usados.</p>
        <div className="t-sub" style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CalendarDays size={13} /> Período analisado: <strong style={{ color: "var(--ink-2)" }}>{period_lbl}</strong>
        </div>
      </div>

      {tabBar}

      {/* KPIs */}
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic"><Sparkles size={16} /></span><span className="kpi-label">Insights ativos</span></div>
          <div className="kpi-val">{kpis.insights_count}</div>
          <div className="kpi-sub">no período analisado</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}><TrendingUp size={16} /></span><span className="kpi-label">Economia potencial</span></div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{money(kpis.potential_savings)}</div>
          <div className="kpi-sub">estimada / mês</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic" style={{ background: kpis.risk_alerts > 0 ? "var(--neg-soft)" : "var(--pos-soft)", color: kpis.risk_alerts > 0 ? "var(--neg)" : "var(--pos)" }}><AlertTriangle size={16} /></span><span className="kpi-label">Alertas de risco</span></div>
          <div className="kpi-val">{kpis.risk_alerts}</div>
          <div className="kpi-sub">{kpis.risk_alerts > 0 ? "exigem atenção" : "nenhum no momento"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc-ink)" }}><Database size={16} /></span><span className="kpi-label">Qualidade dos dados</span></div>
          <div className="kpi-val">{kpis.data_quality_pct != null ? `${num1(kpis.data_quality_pct)}%` : "—"}</div>
          <div className="kpi-sub">transações categorizadas</div>
        </div>
      </div>

      {/* Insight cards */}
      {items.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "44px 24px" }}>
          <div className="state-ic" style={{ margin: "0 auto 14px" }}><Sparkles size={24} /></div>
          <h4 style={{ margin: "0 0 6px" }}>Sem insights neste período</h4>
          <p className="t-sub" style={{ maxWidth: 420, margin: "0 auto" }}>
            Nada que exija atenção agora. Conforme novas transações entram, geramos recomendações explicáveis aqui.
          </p>
        </div>
      ) : (
        <>
          {alerts.length > 0 && (
            <div style={{ marginBottom: improvements.length > 0 ? 20 : 0 }}>
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 10 }}>
                <AlertTriangle size={15} style={{ color: "var(--warn)" }} /> Alertas
                <span className="t-sub" style={{ fontWeight: 400 }}>· {alerts.length}</span>
              </h3>
              <div className="grid cols-2">
                {alerts.map((it, i) => <InsightCard key={i} it={it} />)}
              </div>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 10 }}>
                <TrendingUp size={15} style={{ color: "var(--acc)" }} /> Melhorias e oportunidades
                <span className="t-sub" style={{ fontWeight: 400 }}>· {improvements.length}</span>
              </h3>
              <div className="grid cols-2">
                {improvements.map((it, i) => <InsightCard key={i} it={it} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* How it works */}
      <div className="alert info" style={{ marginTop: 16 }}>
        <span className="alert-ic"><Info size={17} /></span>
        <div>
          <div className="a-ttl">Como a IA funciona aqui</div>
          <div className="a-txt">Os insights são gerados a partir das suas transações reais e regras explicáveis. Quando os dados são insuficientes, dizemos claramente — e nunca inventamos números nem prometemos retorno financeiro.</div>
        </div>
      </div>
    </div>
  );
}
