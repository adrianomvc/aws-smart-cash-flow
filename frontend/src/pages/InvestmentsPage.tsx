import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import {
  createInvestmentAsset,
  createInvestmentCustody,
  createInvestmentSnapshot,
  deleteInvestmentAsset,
  deleteInvestmentCustody,
  deleteInvestmentSnapshot,
  getInvestmentAssets,
  getInvestmentClasses,
  getInvestmentCustodies,
  getInvestmentPosition,
  getInvestmentSnapshots,
  updateInvestmentAsset,
  updateInvestmentCustody,
} from "../lib/api";
import { apiErrorMessage, money } from "../lib/utils";
import type {
  ApiSession,
  InvestmentAssetRead,
  InvestmentClassRef,
  InvestmentCustodyRead,
  InvestmentPositionAccount,
} from "../lib/api";

// --------------------------------------------------------------------------- //
// Icons
// --------------------------------------------------------------------------- //
const ICONS: Record<string, string> = {
  coins:    "M9 9m-6 0a6 3 0 1 0 12 0a6 3 0 1 0-12 0 M3 9v5c0 1.66 2.7 3 6 3 M3 11.5c0 1.66 2.7 3 6 3 M15 6c3.3 0 6 1.34 6 3v6c0 1.66-2.7 3-6 3-1.1 0-2.13-.15-3-.41",
  trend:    "M3 17l6-6 4 4 8-8 M15 7h6v6",
  plus:     "M12 5v14 M5 12h14",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M9 8h2 M9 12h2 M9 16h2 M15 21V9h3a1 1 0 0 1 1 1v11",
  bars:     "M5 21V10 M12 21V4 M19 21v-7 M3 21h18",
  shield:   "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4",
  globe:    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18",
  lock:     "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3",
  wallet:   "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  list:     "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  refresh:  "M20 11a8 8 0 0 0-14-4 M4 5v4h4 M4 13a8 8 0 0 0 14 4 M20 19v-4h-4",
  edit:     "M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:    "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  x:        "M18 6L6 18 M6 6l12 12",
  chevR:    "M9 18l6-6-6-6",
  info:     "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
};

function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const d = ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      {segs.map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
    </svg>
  );
}

// --------------------------------------------------------------------------- //
// Constants & helpers
// --------------------------------------------------------------------------- //
const ACCOUNT_TYPES: { id: string; label: string; icon: string }[] = [
  { id: "broker", label: "Corretora", icon: "bars" },
  { id: "pension", label: "Previdência", icon: "shield" },
  { id: "cex", label: "Exchange", icon: "globe" },
  { id: "wallet", label: "Self-custody", icon: "lock" },
  { id: "reserve", label: "Reserva", icon: "wallet" },
  { id: "bank", label: "Conta", icon: "building" },
];
const TYPE_ICON: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.id, t.icon]));
const TYPE_LABEL: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.id, t.label]));

const INV_COLOR_CHOICES = ["#FFCC00", "#EC7000", "#820AD1", "#F0B90B", "#1c1c1c", "#3567b8", "#1f8a5b", "#c0392b", "#7c3aed", "#16a085"];
const SYNC_OPTIONS = ["Manual", "OFX", "API conectada", "Endereço público"];

const num = (v: number, dec = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

function Delta({ v }: { v: number }) {
  const pos = v >= 0;
  return (
    <span className="mono" style={{ fontWeight: 700, color: v === 0 ? "var(--ink-3)" : pos ? "var(--pos)" : "var(--neg)" }}>
      {pos ? "+" : "−"}{num(Math.abs(v), 2)}%
    </span>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const h = diff / 3_600_000;
  if (h < 1) return "agora";
  if (h < 24) return `há ${Math.round(h)}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d}d`;
  if (d < 30) return `há ${Math.round(d / 7)} sem`;
  return `há ${Math.round(d / 30)} mês`;
}

// --------------------------------------------------------------------------- //
// Page
// --------------------------------------------------------------------------- //
export function InvestmentsPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const positionQ = useQuery({ queryKey: ["inv-position", session.token], queryFn: () => getInvestmentPosition(session) });
  const classesQ = useQuery({ queryKey: ["inv-classes"], queryFn: () => getInvestmentClasses(session) });
  const custodiesQ = useQuery({ queryKey: ["inv-custodies", session.token], queryFn: () => getInvestmentCustodies(session) });
  const assetsQ = useQuery({ queryKey: ["inv-assets", session.token], queryFn: () => getInvestmentAssets(session) });

  const [classFilter, setClassFilter] = useState("all");
  const [custodyModal, setCustodyModal] = useState<InvestmentCustodyRead | "new" | null>(null);
  const [assetModal, setAssetModal] = useState<InvestmentAssetRead | "new" | null>(null);
  const [snapshotAsset, setSnapshotAsset] = useState<InvestmentAssetRead | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["inv-position"] });
    void queryClient.invalidateQueries({ queryKey: ["inv-custodies"] });
    void queryClient.invalidateQueries({ queryKey: ["inv-assets"] });
  }

  const delCustody = useMutation({ mutationFn: (id: string) => deleteInvestmentCustody(session, id), onSuccess: invalidate });
  const delAsset = useMutation({ mutationFn: (id: string) => deleteInvestmentAsset(session, id), onSuccess: invalidate });

  const pos = positionQ.data;
  const classes = classesQ.data?.items ?? [];
  const custodies = custodiesQ.data?.items ?? [];
  const assets = assetsQ.data?.items ?? [];
  const classMeta = useMemo(() => {
    const m: Record<string, InvestmentClassRef> = {};
    for (const c of classes) m[c.id] = c;
    return m;
  }, [classes]);
  const classOf = (id: string) => classMeta[id] ?? { id, label: id, color: "#999" };

  if (positionQ.isLoading) {
    return (
      <div className="canvas stg">
        <div className="state" style={{ padding: "64px 20px" }}>
          <div className="state-ic"><Icon name="coins" size={24} /></div>
          <h4>Carregando carteira…</h4>
        </div>
      </div>
    );
  }

  const total = pos?.total ?? 0;
  const empty = (custodies.length === 0) && (assets.length === 0);

  // Filtered views
  const filteredAssets = (pos?.assets ?? []).filter(a => classFilter === "all" || a.asset_class === classFilter);
  const filteredAccounts = (pos?.accounts ?? []).filter(acc =>
    classFilter === "all" || acc.classes.some(c => c.id === classFilter));
  const gainPct = pos && pos.total_contributed > 0 ? (pos.total_gain / pos.total_contributed) * 100 : 0;
  const filteredAssetsTotal = filteredAssets.reduce((s, a) => s + a.value, 0);

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Crescimento</div>
          <h2 className="section-title"><Icon name="coins" size={18} /> Investimentos</h2>
          <p className="section-sub">Visão de posição da carteira — patrimônio, alocação por classe e onde cada parte está custodiada. Sem trades, sem operações.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCustodyModal("new")}><Icon name="building" size={15} /> Custódia</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAssetModal("new")} disabled={custodies.length === 0}><Icon name="plus" size={15} /> Ativo</button>
        </div>
      </div>

      {empty ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="state-ic" style={{ margin: "0 auto 14px" }}><Icon name="coins" size={26} /></div>
          <h4 style={{ margin: "0 0 6px" }}>Monte sua carteira</h4>
          <p className="t-sub" style={{ maxWidth: 440, margin: "0 auto 18px" }}>
            Comece cadastrando uma <strong>custódia</strong> (corretora, previdência, exchange ou reserva) e depois adicione os <strong>ativos</strong> que você mantém nela. A rentabilidade é calculada conforme você registra o valor ao longo do tempo.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setCustodyModal("new")}><Icon name="building" size={15} /> Cadastrar primeira custódia</button>
        </div>
      ) : (
        <>
          {/* Class filter chips */}
          {(pos?.classes.length ?? 0) > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span className="eyebrow" style={{ marginRight: 4 }}>Filtrar:</span>
              <button className={"chip" + (classFilter === "all" ? " on" : "")} onClick={() => setClassFilter("all")}>Todas as classes</button>
              {pos?.classes.map(c => (
                <button key={c.id} className={"chip" + (classFilter === c.id ? " on" : "")} onClick={() => setClassFilter(c.id)}
                  style={classFilter === c.id ? { borderColor: c.color, color: c.color, background: c.color + "14" } : undefined}>
                  <span className="catdot" style={{ background: c.color, width: 8, height: 8 }} />{c.label}
                </button>
              ))}
            </div>
          )}

          {/* KPIs */}
          <div className="kpi-deck" style={{ marginBottom: 16 }}>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-ic"><Icon name="coins" size={16} /></span><span className="kpi-label">Patrimônio investido</span></div>
              <div className="kpi-val" style={{ fontSize: 19 }}>{money(total)}</div>
              <div className="kpi-sub">{pos?.custody_count} custódia{pos?.custody_count !== 1 ? "s" : ""} · {pos?.asset_count} ativo{pos?.asset_count !== 1 ? "s" : ""}</div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc-ink)" }}><Icon name="trend" size={16} /></span><span className="kpi-label">Rentabilidade no mês</span></div>
              <div className="kpi-val" style={{ fontSize: 19 }}><Delta v={pos?.month_return ?? 0} /></div>
              <div className="kpi-sub">Sobre o valor de ~30 dias atrás</div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc-ink)" }}><Icon name="bars" size={16} /></span><span className="kpi-label">Rentabilidade no ano</span></div>
              <div className="kpi-val" style={{ fontSize: 19 }}><Delta v={pos?.year_return ?? 0} /></div>
              <div className="kpi-sub">YTD: <Delta v={pos?.ytd_return ?? 0} /></div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-ic" style={{ background: (pos?.total_gain ?? 0) >= 0 ? "var(--pos-soft)" : "var(--neg-soft)", color: (pos?.total_gain ?? 0) >= 0 ? "var(--pos)" : "var(--neg)" }}><Icon name="plus" size={16} /></span><span className="kpi-label">Ganho acumulado</span></div>
              <div className="kpi-val" style={{ fontSize: 19, color: (pos?.total_gain ?? 0) >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(pos?.total_gain ?? 0)}</div>
              <div className="kpi-sub">{gainPct >= 0 ? "+" : ""}{num(gainPct, 1)}% sobre {money(pos?.total_contributed ?? 0)} aportados</div>
            </div>
          </div>

          {/* Evolution + allocation */}
          <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 8, alignItems: "stretch" }}>
            <div className="card">
              <div className="card-head">
                <span className="kpi-ic"><Icon name="trend" size={15} /></span>
                <div><span className="ttl">Evolução do patrimônio investido</span><div className="t-sub">Últimos 12 meses</div></div>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={pos?.history ?? []} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="inv-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.26} />
                        <stop offset="100%" stopColor="var(--acc)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={48} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number) => [money(v), "Patrimônio"]}
                      labelStyle={{ color: "var(--ink-2)", fontWeight: 700 }} />
                    <Area type="monotone" dataKey="value" stroke="var(--acc-strong)" strokeWidth={2} fill="url(#inv-grad)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Alocação por classe</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Como está dividido</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <Donut data={(pos?.classes ?? []).map(c => ({ value: c.value, color: c.color }))} size={176} thickness={26}
                  center={<div style={{ textAlign: "center" }}>
                    <div className="mono" style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, letterSpacing: "-.3px" }}>{money(total)}</div>
                    <div className="t-sub" style={{ fontSize: 10.5 }}>patrimônio</div>
                  </div>} />
              </div>
              <div style={{ display: "grid", gap: 9 }}>
                {(pos?.classes ?? []).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span className="catdot" style={{ background: c.color }} />
                    <span style={{ flex: 1, color: "var(--ink-2)", fontWeight: 600 }}>{c.label}</span>
                    <span className="mono t-sub">{num(c.pct, 1)}%</span>
                    <span className="mono" style={{ fontWeight: 700, width: 92, textAlign: "right" }}>{money(c.value)}</span>
                  </div>
                ))}
                {(pos?.classes.length ?? 0) === 0 && <div className="t-sub" style={{ textAlign: "center" }}>Sem ativos com valor.</div>}
              </div>
            </div>
          </div>

          {/* Custodies */}
          <div style={{ marginTop: 24, marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Onde está</div>
            <h3 className="section-title" style={{ fontSize: 17 }}><Icon name="building" size={16} /> Por custódia</h3>
            <p className="section-sub">Cada conta, corretora ou carteira é uma custódia. Posição consolidada por onde o dinheiro está guardado.</p>
          </div>
          <div className="grid cols-3">
            {filteredAccounts.map(acc => (
              <AccountCard key={acc.id} account={acc} classOf={classOf}
                onEdit={() => { const c = custodies.find(x => x.id === acc.id); if (c) setCustodyModal(c); }}
                onDelete={() => { if (window.confirm(`Excluir a custódia "${acc.name}" e seus ativos?`)) delCustody.mutate(acc.id); }} />
            ))}
            {filteredAccounts.length === 0 && (
              <div className="card card-pad t-sub" style={{ textAlign: "center", gridColumn: "1 / -1" }}>Nenhuma custódia com essa classe.</div>
            )}
          </div>

          {/* Performance by class */}
          {(pos?.classes.length ?? 0) > 0 && (
            <>
              <div style={{ marginTop: 24, marginBottom: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Performance</div>
                <h3 className="section-title" style={{ fontSize: 17 }}><Icon name="bars" size={16} /> Rentabilidade por classe</h3>
              </div>
              <div className="card card-pad">
                <div style={{ display: "grid", gap: 16 }}>
                  {pos?.classes.map(c => (
                    <div key={c.id} style={{ opacity: classFilter !== "all" && classFilter !== c.id ? 0.4 : 1, transition: "opacity .15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span className="catdot" style={{ background: c.color, width: 10, height: 10 }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</span>
                        <span className="mono t-sub" style={{ marginLeft: "auto" }}>{num(c.pct, 1)}%</span>
                      </div>
                      <div className="track" style={{ marginBottom: 8 }}>
                        <div style={{ width: `${c.pct}%`, height: "100%", background: c.color, borderRadius: 20 }} />
                      </div>
                      <div style={{ display: "flex", gap: 18, fontSize: 12 }}>
                        <Stat label="Posição"><span className="mono" style={{ fontWeight: 700 }}>{money(c.value)}</span></Stat>
                        <Stat label="No mês"><Delta v={c.month_return} /></Stat>
                        <Stat label="No ano"><Delta v={c.year_return} /></Stat>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Detailed positions */}
          <div style={{ marginTop: 24, marginBottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Ativos</div>
              <h3 className="section-title" style={{ fontSize: 17 }}><Icon name="list" size={16} /> Posição detalhada</h3>
              <p className="section-sub">Cada linha é uma posição, não uma operação. Use os filtros acima para focar em uma classe.</p>
            </div>
            <span className="t-sub mono">{filteredAssets.length} ativos · {money(filteredAssetsTotal)}</span>
          </div>
          <div className="card">
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr>
                  <th>Ativo</th><th>Classe</th><th>Custódia</th><th>Detalhe</th><th>Risco</th>
                  <th className="num">Posição</th><th className="num">Mês</th><th className="num">Ano</th><th />
                </tr></thead>
                <tbody>
                  {filteredAssets.map(a => {
                    const cls = classOf(a.asset_class);
                    return (
                      <tr key={a.id}>
                        <td><span className="t-desc">{a.name}</span></td>
                        <td><span className="pill" style={{ background: cls.color + "1a", color: cls.color, border: "1px solid " + cls.color + "33", fontWeight: 700 }}>
                          <span className="catdot" style={{ background: cls.color, width: 7, height: 7 }} />{cls.label}</span></td>
                        <td className="t-sub">{a.account}</td>
                        <td className="t-sub">{a.detail || "—"}</td>
                        <td>{a.risk ? <span className="pill">{a.risk}</span> : <span className="t-sub">—</span>}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{money(a.value)}</td>
                        <td className="num"><Delta v={a.month_return} /></td>
                        <td className="num"><Delta v={a.ytd_return} /></td>
                        <td className="num" style={{ whiteSpace: "nowrap" }}>
                          {(() => { const asset = assets.find(x => x.id === a.id); return (
                            <span style={{ display: "inline-flex", gap: 4 }}>
                              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Atualizar valor" onClick={() => asset && setSnapshotAsset(asset)}><Icon name="refresh" size={14} /></button>
                              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Editar" onClick={() => asset && setAssetModal(asset)}><Icon name="edit" size={14} /></button>
                              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Excluir" onClick={() => { if (asset && window.confirm(`Excluir "${asset.name}"?`)) delAsset.mutate(asset.id); }}><Icon name="trash" size={14} /></button>
                            </span>
                          ); })()}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAssets.length === 0 && <tr><td colSpan={9} className="t-sub" style={{ textAlign: "center", padding: 24 }}>Nenhum ativo nesta classe.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {custodyModal && (
        <CustodyModal session={session} custody={custodyModal === "new" ? null : custodyModal}
          onClose={() => setCustodyModal(null)} onSaved={() => { setCustodyModal(null); invalidate(); }} />
      )}
      {assetModal && (
        <AssetModal session={session} asset={assetModal === "new" ? null : assetModal} custodies={custodies} classes={classes}
          onClose={() => setAssetModal(null)} onSaved={() => { setAssetModal(null); invalidate(); }} />
      )}
      {snapshotAsset && (
        <SnapshotModal session={session} asset={snapshotAsset}
          onClose={() => setSnapshotAsset(null)} onSaved={invalidate} />
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="t-sub" style={{ fontSize: 10.5 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Donut
// --------------------------------------------------------------------------- //
function Donut({ data, size = 176, thickness = 26, center }: {
  data: { value: number; color: string }[]; size?: number; thickness?: number; center?: React.ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {data.map((d, i) => {
            const dash = (d.value / total) * circ;
            const seg = <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
            offset += dash;
            return seg;
          })}
        </g>
      </svg>
      {center && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{center}</div>}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Account (custody) card
// --------------------------------------------------------------------------- //
function AccountCard({ account, classOf, onEdit, onDelete }: {
  account: InvestmentPositionAccount; classOf: (id: string) => InvestmentClassRef; onEdit: () => void; onDelete: () => void;
}) {
  const a = account;
  const deltaPct = a.prev > 0 ? ((a.value - a.prev) / a.prev) * 100 : 0;
  const gain = a.value - a.contrib;
  const gainPct = a.contrib > 0 ? (gain / a.contrib) * 100 : 0;
  const totalForBars = a.classes.reduce((s, c) => s + c.value, 0) || 1;
  const color = a.color || "#3d7d63";
  const brand = a.brand || a.name.slice(0, 2).toUpperCase();

  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, background: color + "22", color, border: "1px solid " + color + "55" }}>{brand}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
          <div className="t-sub" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name={TYPE_ICON[a.account_type] || "building"} size={11} />{a.kind || TYPE_LABEL[a.account_type] || "Custódia"}
          </div>
        </div>
        <button className="icon-btn" style={{ width: 30, height: 30 }} title="Editar" onClick={onEdit}><Icon name="edit" size={14} /></button>
        <button className="icon-btn" style={{ width: 30, height: 30 }} title="Excluir" onClick={onDelete}><Icon name="trash" size={14} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div className="t-sub" style={{ fontSize: 10.5 }}>Posição atual</div>
          <div className="mono" style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-.3px" }}>{money(a.value)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="t-sub" style={{ fontSize: 10.5 }}>No mês</div>
          <Delta v={Number(deltaPct.toFixed(2))} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {a.classes.map((c, i) => {
          const cls = classOf(c.id);
          const pct = (c.value / totalForBars) * 100;
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, marginBottom: 3 }}>
                <span className="catdot" style={{ background: cls.color, width: 7, height: 7 }} />
                <span style={{ flex: 1, color: "var(--ink-2)" }}>{cls.label}</span>
                <span className="mono t-sub">{money(c.value)}</span>
              </div>
              <div className="track" style={{ height: 5 }}><div style={{ width: `${pct}%`, height: "100%", background: cls.color, borderRadius: 20 }} /></div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <FootCell label="Aporte"><span className="mono">{money(a.contrib)}</span></FootCell>
        <FootCell label="Ganho"><span className="mono" style={{ color: gain >= 0 ? "var(--pos)" : "var(--neg)" }}>{gain >= 0 ? "+" : "−"}{money(Math.abs(gain))}</span></FootCell>
        <FootCell label="% s/aporte"><span className="mono" style={{ color: gain >= 0 ? "var(--pos)" : "var(--neg)" }}>{gain >= 0 ? "+" : ""}{num(gainPct, 1)}%</span></FootCell>
      </div>

      {a.sync_mode && (
        <div className="t-sub" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
          <Icon name="refresh" size={11} /><span>{a.sync_mode}</span><span>· {relativeTime(a.updated_at)}</span>
        </div>
      )}
    </div>
  );
}

function FootCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="t-sub" style={{ fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{children}</span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Modals
// --------------------------------------------------------------------------- //
function ModalShell({ icon, title, sub, onClose, children, footer }: {
  icon: string; title: string; sub: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><Icon name={icon} size={17} /></span>
          <div style={{ minWidth: 0 }}><div className="mh-ttl">{title}</div><div className="mh-sub">{sub}</div></div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <div className="mdl-body">{children}</div>
        <div className="mdl-foot">{footer}</div>
      </div>
    </div>
  );
}

function CustodyModal({ session, custody, onClose, onSaved }: {
  session: ApiSession; custody: InvestmentCustodyRead | null; onClose: () => void; onSaved: () => void;
}) {
  const editing = Boolean(custody);
  const [form, setForm] = useState({
    name: custody?.name ?? "",
    kind: custody?.kind ?? "",
    account_type: custody?.account_type ?? "broker",
    brand: custody?.brand ?? "",
    color: custody?.color ?? INV_COLOR_CHOICES[0],
    sync_mode: custody?.sync_mode ?? "Manual",
  });
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), kind: form.kind.trim() || null, account_type: form.account_type,
        brand: form.brand.trim() || null, color: form.color, sync_mode: form.sync_mode || null };
      return custody ? updateInvestmentCustody(session, custody.id, payload) : createInvestmentCustody(session, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e, "Falha ao salvar custódia.")),
  });
  function submit() { if (!form.name.trim()) { setError("Informe o nome."); return; } setError(""); save.mutate(); }

  return (
    <ModalShell icon="building" title={editing ? "Editar custódia" : "Nova custódia"}
      sub="Corretora, previdência, exchange, carteira ou reserva." onClose={onClose}
      footer={<>
        <span className="spacer" style={{ color: "var(--neg)", fontSize: 12 }}>{error}</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={save.isPending}>{editing ? "Salvar" : "Criar"}</button>
      </>}>
      <label className="fld"><span className="fld-label">Nome</span>
        <input className="fld-input" autoFocus placeholder="Ex: XP Investimentos, Itaú — Reserva…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="fld"><span className="fld-label">Tipo</span>
          <select className="fld-select" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
            {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select></label>
        <label className="fld"><span className="fld-label">Detalhe (opcional)</span>
          <input className="fld-input" placeholder="Ex: PGBL, CDB liquidez…" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="fld"><span className="fld-label">Sigla (2 letras)</span>
          <input className="fld-input" maxLength={2} placeholder="XP" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value.toUpperCase() })} /></label>
        <label className="fld"><span className="fld-label">Atualização</span>
          <select className="fld-select" value={form.sync_mode} onChange={(e) => setForm({ ...form, sync_mode: e.target.value })}>
            {SYNC_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
      </div>
      <div className="fld"><span className="fld-label">Cor</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {INV_COLOR_CHOICES.map(c => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
              style={{ width: 28, height: 28, borderRadius: 8, background: c, cursor: "pointer",
                border: form.color === c ? "2px solid var(--ink)" : "2px solid transparent", boxShadow: "0 0 0 1px var(--line)" }} />
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function AssetModal({ session, asset, custodies, classes, onClose, onSaved }: {
  session: ApiSession; asset: InvestmentAssetRead | null; custodies: InvestmentCustodyRead[]; classes: InvestmentClassRef[];
  onClose: () => void; onSaved: () => void;
}) {
  const editing = Boolean(asset);
  const [form, setForm] = useState({
    custody_id: asset?.custody_id ?? custodies[0]?.id ?? "",
    name: asset?.name ?? "",
    asset_class: asset?.asset_class ?? (classes[0]?.id ?? "rf"),
    risk: asset?.risk ?? "",
    detail: asset?.detail ?? "",
    current_value: asset ? String(asset.current_value) : "",
    contributed: asset ? String(asset.contributed) : "",
  });
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const payload = { custody_id: form.custody_id, name: form.name.trim(), asset_class: form.asset_class,
        risk: form.risk.trim() || null, detail: form.detail.trim() || null,
        current_value: form.current_value || "0", contributed: form.contributed || "0" };
      return asset ? updateInvestmentAsset(session, asset.id, payload) : createInvestmentAsset(session, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e, "Falha ao salvar ativo.")),
  });
  function submit() {
    if (!form.custody_id) { setError("Selecione a custódia."); return; }
    if (!form.name.trim()) { setError("Informe o nome do ativo."); return; }
    setError(""); save.mutate();
  }

  return (
    <ModalShell icon="coins" title={editing ? "Editar ativo" : "Novo ativo"}
      sub="Uma posição mantida dentro de uma custódia." onClose={onClose}
      footer={<>
        <span className="spacer" style={{ color: "var(--neg)", fontSize: 12 }}>{error}</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={save.isPending}>{editing ? "Salvar" : "Criar"}</button>
      </>}>
      <label className="fld"><span className="fld-label">Nome</span>
        <input className="fld-input" autoFocus placeholder="Ex: Tesouro Selic 2029, IVVB11…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="fld"><span className="fld-label">Custódia</span>
          <select className="fld-select" value={form.custody_id} onChange={(e) => setForm({ ...form, custody_id: e.target.value })}>
            {custodies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="fld"><span className="fld-label">Classe</span>
          <select className="fld-select" value={form.asset_class} onChange={(e) => setForm({ ...form, asset_class: e.target.value })}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="fld"><span className="fld-label">Valor atual (R$)</span>
          <input className="fld-input" type="number" step="0.01" min="0" placeholder="0,00" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} /></label>
        <label className="fld"><span className="fld-label">Total aportado (R$)</span>
          <input className="fld-input" type="number" step="0.01" min="0" placeholder="0,00" value={form.contributed} onChange={(e) => setForm({ ...form, contributed: e.target.value })} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="fld"><span className="fld-label">Risco (opcional)</span>
          <input className="fld-input" placeholder="Baixo, Alto, Moderado…" value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })} /></label>
        <label className="fld"><span className="fld-label">Detalhe (opcional)</span>
          <input className="fld-input" placeholder="Venc. 2029, DY 9%, 350 cotas…" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></label>
      </div>
    </ModalShell>
  );
}

function SnapshotModal({ session, asset, onClose, onSaved }: {
  session: ApiSession; asset: InvestmentAssetRead; onClose: () => void; onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [value, setValue] = useState(String(asset.current_value));
  const [asOf, setAsOf] = useState(today);
  const [error, setError] = useState("");
  const snapsQ = useQuery({ queryKey: ["inv-snaps", asset.id], queryFn: () => getInvestmentSnapshots(session, asset.id) });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["inv-snaps", asset.id] });
    onSaved();
  }
  const save = useMutation({
    mutationFn: () => createInvestmentSnapshot(session, asset.id, { value: value || "0", as_of: asOf }),
    onSuccess: () => { setError(""); refresh(); },
    onError: (e) => setError(apiErrorMessage(e, "Falha ao registrar valor.")),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteInvestmentSnapshot(session, id),
    onSuccess: refresh,
  });
  const snaps = snapsQ.data?.items ?? [];

  return (
    <ModalShell icon="refresh" title="Atualizar valor" sub={asset.name} onClose={onClose}
      footer={<>
        <span className="spacer" style={{ color: "var(--neg)", fontSize: 12 }}>{error}</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        <button className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={save.isPending}>Registrar</button>
      </>}>
      <p className="t-sub" style={{ marginTop: 0 }}>Registre o valor da posição numa data. Um registro com a data de hoje atualiza o valor atual; datas anteriores alimentam a rentabilidade e a evolução.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
        <label className="fld"><span className="fld-label">Valor (R$)</span>
          <input className="fld-input" autoFocus type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label className="fld"><span className="fld-label">Data</span>
          <input className="fld-input" type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
      </div>
      {snaps.length > 0 && (
        <div className="fld">
          <span className="fld-label">Histórico ({snaps.length})</span>
          <div style={{ display: "grid", gap: 4, maxHeight: 180, overflowY: "auto" }}>
            {snaps.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "5px 8px", borderRadius: 7, background: "var(--card-2)" }}>
                <span className="mono t-sub">{s.as_of.split("-").reverse().join("/")}</span>
                <span className="mono" style={{ marginLeft: "auto", fontWeight: 600 }}>{money(s.value)}</span>
                <button className="icon-btn" style={{ width: 26, height: 26 }} title="Remover" onClick={() => del.mutate(s.id)}><Icon name="trash" size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
