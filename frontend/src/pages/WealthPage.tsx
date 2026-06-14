import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Building2, Car, Coins, CreditCard, Home, Landmark, Loader2, Minus, Pencil, Plus,
  RefreshCw, TrendingDown, TrendingUp, Trash2, Wallet, X,
} from "lucide-react";

import {
  createWealthItem, createWealthSnapshot, deleteWealthItem, deleteWealthSnapshot,
  getWealth, getWealthSnapshots, updateWealthItem,
} from "../lib/api";
import { apiErrorMessage, money } from "../lib/utils";
import { PageState } from "../components/ui";
import type { ApiSession, WealthRow } from "../lib/api";

const num1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const CATEGORIES: Record<"asset" | "liability", { id: string; label: string }[]> = {
  asset: [
    { id: "property", label: "Imóvel" },
    { id: "vehicle", label: "Veículo" },
    { id: "account", label: "Conta e reserva" },
    { id: "other", label: "Outro ativo" },
  ],
  liability: [
    { id: "loan", label: "Financiamento" },
    { id: "card", label: "Fatura de cartão" },
    { id: "other", label: "Outra dívida" },
  ],
};
const CAT_ICON: Record<string, typeof Home> = {
  property: Home, vehicle: Car, account: Wallet, investments: Coins,
  loan: Landmark, card: CreditCard, other: Building2,
};

type ModalState = { kind: "asset" | "liability"; row?: WealthRow } | null;

export function WealthPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const wealthQ = useQuery({ queryKey: ["wealth", session.token], queryFn: () => getWealth(session) });
  const [modal, setModal] = useState<ModalState>(null);
  const [snapRow, setSnapRow] = useState<WealthRow | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["wealth"] });
  }
  const del = useMutation({ mutationFn: (id: string) => deleteWealthItem(session, id), onSuccess: invalidate });

  if (wealthQ.isLoading) {
    return <PageState icon={Loader2} title="Carregando patrimônio" description="Consolidando ativos e passivos." spin />;
  }
  const w = wealthQ.data;
  if (!w) {
    return <PageState icon={Building2} title="Patrimônio indisponível" description="Confira a API local e tente novamente." />;
  }

  const net = Number(w.net_worth);
  const deltaUp = w.delta_pct >= 0;
  const history = w.history.map(h => ({ label: h.label, value: Number(h.value) }));
  const empty = w.assets.length === 0 && w.liabilities.length === 0;

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Crescimento</div>
          <h2 className="section-title"><Building2 size={18} /> Patrimônio</h2>
          <p className="section-sub">Patrimônio líquido = Ativos − Passivos. Diferente do fluxo de caixa: aqui medimos riqueza acumulada, não o movimento mensal.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ kind: "asset" })}><Plus size={15} /> Ativo</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ kind: "liability" })}><Minus size={15} /> Passivo</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ background: "linear-gradient(135deg, var(--acc-soft), var(--card))" }}>
          <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><Building2 size={15} /></span><span className="kpi-label">Patrimônio líquido</span></div>
          <div className="kpi-val" style={{ fontSize: 28, color: "var(--acc-ink)" }}>{money(net)}</div>
          <div className="kpi-sub" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: deltaUp ? "var(--pos)" : "var(--neg)", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700 }}>
              {deltaUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{num1(Math.abs(w.delta_pct))}%
            </span>
            no último mês
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}><Plus size={15} /></span><span className="kpi-label">Total de ativos</span></div>
          <div className="kpi-val" style={{ fontSize: 20 }}>{money(w.total_assets)}</div>
          <div className="kpi-sub">{w.assets.length} {w.assets.length === 1 ? "item" : "itens"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-ic" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}><Minus size={15} /></span><span className="kpi-label">Total de passivos</span></div>
          <div className="kpi-val" style={{ fontSize: 20 }}>{money(w.total_liabilities)}</div>
          <div className="kpi-sub">{w.liabilities.length} {w.liabilities.length === 1 ? "item" : "itens"}</div>
        </div>
      </div>

      {empty ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "44px 24px" }}>
          <div className="state-ic" style={{ margin: "0 auto 14px" }}><Building2 size={26} /></div>
          <h4 style={{ margin: "0 0 6px" }}>Monte seu patrimônio</h4>
          <p className="t-sub" style={{ maxWidth: 440, margin: "0 auto 18px" }}>
            Cadastre seus <strong>ativos</strong> (imóvel, veículo, conta) e <strong>passivos</strong> (financiamentos, faturas). A sua carteira de <strong>investimentos</strong> entra automaticamente.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: "asset" })}><Plus size={15} /> Adicionar ativo</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal({ kind: "liability" })}><Minus size={15} /> Adicionar passivo</button>
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "stretch" }}>
          {/* Evolution */}
          <div className="card">
            <div className="card-head">
              <span className="kpi-ic"><TrendingUp size={15} /></span>
              <div><span className="ttl">Evolução do patrimônio líquido</span><div className="t-sub">Últimos 12 meses</div></div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="wealth-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="var(--acc)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={52} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
                    formatter={(v: number) => [money(v), "Patrimônio líquido"]}
                    labelStyle={{ color: "var(--ink-2)", fontWeight: 700 }} />
                  <Area type="monotone" dataKey="value" stroke="var(--acc-strong)" strokeWidth={2} fill="url(#wealth-grad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Assets + Liabilities */}
          <div className="vstack" style={{ gap: 16 }}>
            <ListCard title="Ativos" color="var(--acc)" total={w.total_assets} rows={w.assets}
              onEdit={(r) => setModal({ kind: "asset", row: r })}
              onSnapshot={(r) => setSnapRow(r)}
              onDelete={(id) => del.mutate(id)} />
            <ListCard title="Passivos" color="var(--neg)" total={w.total_liabilities} rows={w.liabilities} neg
              onEdit={(r) => setModal({ kind: "liability", row: r })}
              onSnapshot={(r) => setSnapRow(r)}
              onDelete={(id) => del.mutate(id)} />
          </div>
        </div>
      )}

      {modal && (
        <WealthModal session={session} kind={modal.kind} row={modal.row}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />
      )}
      {snapRow && snapRow.id && (
        <WealthSnapshotModal session={session} row={snapRow}
          onClose={() => setSnapRow(null)} onSaved={invalidate} />
      )}
    </div>
  );
}

function ListCard({ title, color, total, rows, neg, onEdit, onSnapshot, onDelete }: {
  title: string; color: string; total: string; rows: WealthRow[]; neg?: boolean;
  onEdit: (r: WealthRow) => void; onSnapshot: (r: WealthRow) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="card">
      <div className="card-head" style={{ paddingBottom: 11 }}>
        <span className="ttl" style={{ color }}>{title}</span>
        <span className="spacer" />
        <span className="mono" style={{ fontWeight: 700, color }}>{money(total)}</span>
      </div>
      <div style={{ padding: "4px 8px 8px" }}>
        {rows.length === 0 && <div className="t-sub" style={{ padding: "10px 10px" }}>Nenhum item cadastrado.</div>}
        {rows.map((r, i) => {
          const Ic = CAT_ICON[r.category ?? "other"] ?? Building2;
          return (
            <div key={r.id ?? i} className="row-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px" }}>
              <span className="kpi-ic" style={{ width: 30, height: 30, background: "var(--bg-sunken)", color: "var(--ink-2)" }}><Ic size={14} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {r.note && <span className="t-sub">{r.note}</span>}
                  {r.source === "auto" && <span className="badge b-info" style={{ fontSize: 10 }}>automático</span>}
                </div>
              </div>
              <span className="mono" style={{ fontWeight: 700, color: neg ? "var(--neg)" : "var(--ink)" }}>{money(r.value)}</span>
              {r.source === "manual" && r.id && (
                <span style={{ display: "inline-flex", gap: 2 }}>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} title="Atualizar valor" onClick={() => onSnapshot(r)}><RefreshCw size={13} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} title="Editar" onClick={() => onEdit(r)}><Pencil size={13} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} title="Excluir" onClick={() => { if (window.confirm(`Excluir "${r.label}"?`)) onDelete(r.id!); }}><Trash2 size={13} /></button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WealthModal({ session, kind, row, onClose, onSaved }: {
  session: ApiSession; kind: "asset" | "liability"; row?: WealthRow;
  onClose: () => void; onSaved: () => void;
}) {
  const editing = Boolean(row?.id);
  const cats = CATEGORIES[kind];
  const [form, setForm] = useState({
    label: row?.label ?? "",
    value: row ? String(row.value) : "",
    category: row?.category ?? cats[0].id,
    note: row?.note ?? "",
  });
  const [error, setError] = useState("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { kind, label: form.label.trim(), value: form.value || "0", category: form.category, note: form.note.trim() || null };
      return editing && row?.id ? updateWealthItem(session, row.id, payload) : createWealthItem(session, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e, "Falha ao salvar item.")),
  });
  function submit() { if (!form.label.trim()) { setError("Informe o nome."); return; } setError(""); save.mutate(); }

  const noun = kind === "asset" ? "ativo" : "passivo";
  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic">{kind === "asset" ? <Plus size={17} /> : <Minus size={17} />}</span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">{editing ? `Editar ${noun}` : `Novo ${noun}`}</div>
            <div className="mh-sub">{kind === "asset" ? "Imóvel, veículo, conta, reserva…" : "Financiamento, fatura, outra dívida…"}</div>
          </div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="mdl-body">
          <label className="fld"><span className="fld-label">Nome</span>
            <input className="fld-input" autoFocus placeholder={kind === "asset" ? "Ex: Apartamento, SUV 2023…" : "Ex: Financiamento imóvel…"} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="fld"><span className="fld-label">Valor (R$)</span>
              <input className="fld-input" type="number" step="0.01" min="0" placeholder="0,00" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
            <label className="fld"><span className="fld-label">Categoria</span>
              <select className="fld-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></label>
          </div>
          <label className="fld"><span className="fld-label">Observação (opcional)</span>
            <input className="fld-input" placeholder="Ex: Avaliação manual, 142 parcelas…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <div className="mdl-foot">
          <span className="spacer" style={{ color: "var(--neg)", fontSize: 12 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={save.isPending}>{editing ? "Salvar" : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}

function WealthSnapshotModal({ session, row, onClose, onSaved }: {
  session: ApiSession; row: WealthRow; onClose: () => void; onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [value, setValue] = useState(String(row.value));
  const [asOf, setAsOf] = useState(today);
  const [error, setError] = useState("");
  const itemId = row.id as string;
  const snapsQ = useQuery({ queryKey: ["wealth-snaps", itemId], queryFn: () => getWealthSnapshots(session, itemId) });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["wealth-snaps", itemId] });
    onSaved();
  }
  const save = useMutation({
    mutationFn: () => createWealthSnapshot(session, itemId, { value: value || "0", as_of: asOf }),
    onSuccess: () => { setError(""); refresh(); },
    onError: (e) => setError(apiErrorMessage(e, "Falha ao registrar valor.")),
  });
  const del = useMutation({ mutationFn: (id: string) => deleteWealthSnapshot(session, id), onSuccess: refresh });
  const snaps = snapsQ.data?.items ?? [];

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><RefreshCw size={17} /></span>
          <div style={{ minWidth: 0 }}><div className="mh-ttl">Atualizar valor</div><div className="mh-sub">{row.label}</div></div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="mdl-body">
          <p className="t-sub" style={{ marginTop: 0 }}>Registre o valor numa data. Um registro com a data de hoje atualiza o valor atual; datas anteriores alimentam a evolução do patrimônio.</p>
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
                    <button className="icon-btn" style={{ width: 26, height: 26 }} title="Remover" onClick={() => del.mutate(s.id)}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mdl-foot">
          <span className="spacer" style={{ color: "var(--neg)", fontSize: 12 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={save.isPending}>Registrar</button>
        </div>
      </div>
    </div>
  );
}
