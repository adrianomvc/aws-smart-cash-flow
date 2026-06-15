import { useQuery } from "@tanstack/react-query";

import { getSpendingBreakdown } from "../lib/api";
import type { ApiSession, SizeBucketItem } from "../lib/api";
import { compactMoneyAbs, money } from "../lib/utils";

// Color per size bucket (small → large = cool → hot).
const SIZE_COLOR: Record<string, string> = {
  P: "var(--info)",
  M: "var(--acc)",
  G: "var(--warn)",
  GG: "var(--neg)",
};
const FIXED_COLOR = "var(--info)";
const VARIABLE_COLOR = "var(--warn)";

function pct(ratio: string | number): number {
  return Math.round(Number(ratio) * 1000) / 10;
}

function useBreakdown(session: ApiSession, query: string) {
  return useQuery({
    queryKey: ["spending-breakdown", session.token, query],
    queryFn: () => getSpendingBreakdown(session, query),
    staleTime: 2 * 60 * 1000,
  });
}

function FixedVariableBar({ fixedTotal, variableTotal }: { fixedTotal: number; variableTotal: number }) {
  const sum = fixedTotal + variableTotal;
  const fixedPct = sum > 0 ? (fixedTotal / sum) * 100 : 0;
  return (
    <div style={{ display: "flex", height: 12, borderRadius: 7, overflow: "hidden", background: "var(--bg-sunken)" }}>
      <div style={{ width: `${fixedPct}%`, background: FIXED_COLOR }} title={`Fixos ${fixedPct.toFixed(0)}%`} />
      <div style={{ flex: 1, background: VARIABLE_COLOR }} title={`Variáveis ${(100 - fixedPct).toFixed(0)}%`} />
    </div>
  );
}

function SizeRow({ b, detailed }: { b: SizeBucketItem; detailed?: boolean }) {
  const share = pct(b.share_ratio);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        width: 28, height: 28, borderRadius: 8, flex: "none", display: "grid", placeItems: "center",
        fontSize: 11, fontWeight: 800, color: "#fff", background: SIZE_COLOR[b.key] ?? "var(--ink-3)",
      }}>{b.key}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
          <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>
            {b.label}{detailed ? <span className="t-sub" style={{ fontWeight: 400 }}> · {b.helper}</span> : null}
          </span>
          <span className="mono" style={{ fontWeight: 700 }}>{money(b.total)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--bg-sunken)", overflow: "hidden" }}>
            <div style={{ width: `${share}%`, height: "100%", background: SIZE_COLOR[b.key] ?? "var(--ink-3)" }} />
          </div>
          <span className="t-sub" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
            {b.count} {b.count === 1 ? "transação" : "transações"} · {share}%{detailed ? ` · méd. ${compactMoneyAbs(b.average)}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Macro — Dashboard (two side-by-side cards meant for a `grid cols-2` row)
// ---------------------------------------------------------------------------
export function SpendingProfileCard({ session, query }: { session: ApiSession; query: string }) {
  const q = useBreakdown(session, query);
  const d = q.data;
  const fixedTotal = Number(d?.fixed.total ?? 0);
  const variableTotal = Number(d?.variable.total ?? 0);
  const sum = fixedTotal + variableTotal;
  const fixedPct = sum > 0 ? Math.round((fixedTotal / sum) * 100) : 0;

  return (
    <>
      {/* Porte P/M/G/GG */}
      <div className="card card-pad">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>Porte das transações</h3>
          <span className="t-sub" style={{ fontSize: 11.5 }}>P · M · G · GG</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {(d?.size_buckets ?? []).map((b) => <SizeRow key={b.key} b={b} />)}
          {q.isLoading && <span className="t-sub" style={{ fontSize: 12 }}>Carregando…</span>}
        </div>
      </div>

      {/* Fixo × Variável */}
      <div className="card card-pad">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>Custos fixos × variáveis</h3>
          <span className="t-sub" style={{ fontSize: 11.5 }}>no período</span>
        </div>
        <FixedVariableBar fixedTotal={fixedTotal} variableTotal={variableTotal} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: FIXED_COLOR }} /> Fixos · {fixedPct}%
            </div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{money(fixedTotal)}</div>
            <div className="t-sub" style={{ fontSize: 11 }}>{d?.fixed.count ?? 0} transações</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)", justifyContent: "flex-end" }}>
              Variáveis · {100 - fixedPct}% <span style={{ width: 8, height: 8, borderRadius: 99, background: VARIABLE_COLOR }} />
            </div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{money(variableTotal)}</div>
            <div className="t-sub" style={{ fontSize: 11 }}>{d?.variable.count ?? 0} transações</div>
          </div>
        </div>
        {(d?.fixed_items?.length ?? 0) > 0 && (
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10 }}>
            <span className="t-sub" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Maiores fixos</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
              {(d?.fixed_items ?? []).slice(0, 3).map((it) => (
                <div key={it.description} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-2)" }}>{it.description}</span>
                  <span className="mono" style={{ fontWeight: 700, flex: "none" }}>{money(it.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Detailed — Fluxo de caixa
// ---------------------------------------------------------------------------
export function SpendingProfileDetailed({ session, query }: { session: ApiSession; query: string }) {
  const q = useBreakdown(session, query);
  const d = q.data;
  const fixedTotal = Number(d?.fixed.total ?? 0);
  const variableTotal = Number(d?.variable.total ?? 0);
  const sum = fixedTotal + variableTotal;
  const fixedPct = sum > 0 ? Math.round((fixedTotal / sum) * 100) : 0;

  return (
    <div className="grid cols-2" style={{ gap: 14 }}>
      {/* Porte */}
      <div className="card card-pad">
        <h3 style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 700 }}>Porte das transações</h3>
        <p className="t-sub" style={{ margin: "0 0 14px", fontSize: 12 }}>
          Quantas e quanto você gasta por faixa de valor. Poucas compras grandes costumam dominar o volume.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {(d?.size_buckets ?? []).map((b) => <SizeRow key={b.key} b={b} detailed />)}
          {q.isLoading && <span className="t-sub" style={{ fontSize: 12 }}>Carregando…</span>}
          {d && Number(d.total_expense) === 0 && <span className="t-sub" style={{ fontSize: 12 }}>Sem despesas no período.</span>}
        </div>
      </div>

      {/* Fixo × Variável + lista */}
      <div className="card card-pad">
        <h3 style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 700 }}>Custos fixos × variáveis</h3>
        <p className="t-sub" style={{ margin: "0 0 14px", fontSize: 12 }}>
          Fixo = despesa que se repete todo mês com valor estável (assinaturas, financiamentos, escola). O resto é variável.
        </p>
        <FixedVariableBar fixedTotal={fixedTotal} variableTotal={variableTotal} />
        <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 14px" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Fixos · {fixedPct}%</div>
            <div className="mono" style={{ fontWeight: 700 }}>{money(fixedTotal)} <span className="t-sub" style={{ fontWeight: 400, fontSize: 11 }}>({d?.fixed.count ?? 0})</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Variáveis · {100 - fixedPct}%</div>
            <div className="mono" style={{ fontWeight: 700 }}>{money(variableTotal)} <span className="t-sub" style={{ fontWeight: 400, fontSize: 11 }}>({d?.variable.count ?? 0})</span></div>
          </div>
        </div>
        <span className="t-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Principais custos fixos</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {(d?.fixed_items ?? []).slice(0, 8).map((it) => (
            <div key={it.description} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.description}</div>
                <div className="t-sub" style={{ fontSize: 11 }}>{it.category_name ?? "Sem categoria"} · ~{money(it.monthly_amount)}/mês · {it.count}×</div>
              </div>
              <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{money(it.total)}</span>
            </div>
          ))}
          {d && d.fixed_items.length === 0 && (
            <span className="t-sub" style={{ fontSize: 12 }}>Nenhum custo fixo recorrente identificado no período.</span>
          )}
        </div>
      </div>
    </div>
  );
}
