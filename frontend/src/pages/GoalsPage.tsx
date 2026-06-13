import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  getAccounts,
  getContributionCandidates,
  getDashboardSummary,
  getGoalContributions,
  getGoals,
  removeGoalContribution,
  updateGoal,
} from "../lib/api";
import { apiErrorMessage, dateInputLabel, moneyAbs } from "../lib/utils";
import { usePeriod } from "../hooks";
import type { AccountItem, ApiSession, DashboardSummary, GoalRead } from "../lib/api";
import type { PeriodState } from "../types";

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

const G_ICONS: Record<string, string> = {
  target:  "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  plus:    "M12 5v14 M5 12h14",
  check:   "M5 12l5 5 9-10",
  x:       "M18 6L6 18 M6 6l12 12",
  flag:    "M5 3v18 M5 5l14 5-14 5",
  info:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  edit:    "M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:   "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  link:    "M9 15l6-6 M10 7l1-1a3.5 3.5 0 0 1 5 5l-1 1 M14 17l-1 1a3.5 3.5 0 0 1-5-5l1-1",
  wallet:  "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  star:    "M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.7l-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2z",
  chevR:   "M9 18l6-6-6-6",
  home:    "M4 11l8-6 8 6 M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9 M10 20v-5h4v5",
  plane:   "M10 19l1-5-4 1v-2l5-2 1-6a1.3 1.3 0 0 1 2.6 0l1 6 5 2v2l-4-1 1 5-2 1-2-3-2 3z",
  cap:     "M3 9l9-4 9 4-9 4z M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4 M21 9v4",
  shield:  "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4",
  coins:   "M9 9m-6 0a6 3 0 1 0 12 0a6 3 0 1 0-12 0 M3 9v5c0 1.66 2.7 3 6 3 M3 11.5c0 1.66 2.7 3 6 3 M15 6c3.3 0 6 1.34 6 3v6c0 1.66-2.7 3-6 3-1.1 0-2.13-.15-3-.41",
  car:     "M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13 M4 13h16v4H4z M7 17v1.5 M17 17v1.5",
  heart:   "M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.5 1.5 4 2.5C10.5 6.5 12 5 14 5c3.5 0 5 3.5 3.5 6.5C19 15.65 12 20 12 20z",
};

const GOAL_ICONS = ["target", "shield", "home", "plane", "cap", "car", "coins", "wallet", "star", "heart", "flag"];
const GOAL_COLOR_CHOICES = ["#2a9d8f", "#6a4ba8", "#c98a2b", "#2a4d8f", "#a35a7d", "#1f8a5b", "#c0392b", "#16a085", "#8e44ad", "#34495e"];

function GIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = G_ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }}>
      {segs.map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOAL_COLORS = ["#2a9d8f", "#6a4ba8", "#c98a2b", "#2a4d8f", "#a35a7d", "#1f8a5b"];

interface GoalRow {
  goal: GoalRead | null;
  name: string;
  description: string;
  current: number;
  target: number;
  ratio: number;
  targetDate: string | null;
  deadlineLabel: string;
  monthsLeft: number;
}

function monthsUntil(iso: string | null): number {
  if (!iso) return 12;
  const now = new Date();
  const d = new Date(iso + "T12:00:00");
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function buildGoalRows(summary?: DashboardSummary, persistedGoals?: GoalRead[]): GoalRow[] {
  if (persistedGoals?.length) {
    return persistedGoals.map((goal) => ({
      goal,
      name: goal.name,
      description: goal.description ?? "Meta cadastrada no planejamento.",
      current: Number(goal.current_amount),
      target: Number(goal.target_amount),
      ratio: Number(goal.current_amount) / Math.max(Number(goal.target_amount), 1),
      targetDate: goal.target_date,
      deadlineLabel: goal.target_date ? dateInputLabel(goal.target_date) : "sem prazo",
      monthsLeft: monthsUntil(goal.target_date),
    }));
  }
  const balance = Math.max(Number(summary?.balance ?? 0), 0);
  const boost = Math.min(balance, 1200);
  const demo = [
    { name: "Reserva de emergência", description: "Cobrir despesas essenciais com mais previsibilidade.", current: 16500 + boost, target: 24000, months: 3 },
    { name: "Viagem em família", description: "Separar recursos para uma viagem planejada.", current: 4200 + boost * 0.3, target: 12000, months: 6 },
    { name: "Carteira de longo prazo", description: "Construir uma base de investimento recorrente.", current: 2800 + boost * 0.2, target: 18000, months: 12 },
  ];
  return demo.map((g) => ({
    goal: null,
    name: g.name,
    description: g.description,
    current: g.current,
    target: g.target,
    ratio: g.current / Math.max(g.target, 1),
    targetDate: null,
    deadlineLabel: `${g.months} meses`,
    monthsLeft: g.months,
  }));
}

function goalBadge(ratio: number, targetDate: string | null): { cls: string; label: string } {
  if (ratio >= 1) return { cls: "b-pos", label: "Concluída" };
  if (targetDate && new Date(targetDate + "T12:00:00") < new Date()) return { cls: "b-neg", label: "Atrasada" };
  if (ratio >= 0.5) return { cls: "b-pos", label: "No prazo" };
  return { cls: "b-warn", label: "Atenção" };
}

// ---------------------------------------------------------------------------
// Ring (circular progress)
// ---------------------------------------------------------------------------

function Ring({ value, size = 64, thickness = 7, color }: { value: number; size?: number; thickness?: number; color: string }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100);
  const dash = (pct / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)" }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Card
// ---------------------------------------------------------------------------

function GoalCard({ goal, color, monthlyIncome, onEdit, onDelete, onAporte, onManageContributions }: {
  goal: GoalRow;
  color: string;
  monthlyIncome: number;
  onEdit: (g: GoalRead) => void;
  onDelete: (g: GoalRead) => void;
  onAporte: (g: GoalRead) => void;
  onManageContributions: (g: GoalRead) => void;
}) {
  const pct = Math.min(goal.ratio * 100, 100);
  const remaining = Math.max(goal.target - goal.current, 0);
  const monthly = remaining > 0 ? remaining / goal.monthsLeft : 0;
  const impact = monthlyIncome > 0 ? (monthly / monthlyIncome) * 100 : null;
  const badge = goalBadge(goal.ratio, goal.targetDate);
  const raw = goal.goal;
  const isAccount = raw?.tracking_mode === "account";
  const cardColor = raw?.color || color;
  const cardIcon = raw?.icon || "target";

  return (
    <div className="card card-pad">
      {/* Head */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", flex: "none", background: cardColor + "1e", color: cardColor }}>
          <GIcon name={cardIcon} size={19} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{goal.name}</div>
          <div className="t-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>até {goal.deadlineLabel}</span>
            {isAccount && raw?.linked_account && (
              <span className="badge b-info" style={{ fontSize: 9.5, padding: "1px 6px" }} title={`Segue o saldo de ${raw.linked_account}`}>
                <GIcon name="link" size={10} /> {raw.linked_account}
              </span>
            )}
          </div>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* Ring + value */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
        <Ring value={pct} size={64} thickness={7} color={cardColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-.4px" }}>{moneyAbs(goal.current)}</div>
          <div className="t-sub">de {moneyAbs(goal.target)}</div>
        </div>
      </div>

      <hr className="divider" style={{ margin: "12px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: "var(--ink-3)" }}>Contribuição sugerida</span>
        <span className="mono" style={{ fontWeight: 700 }}>{moneyAbs(monthly)}/mês</span>
      </div>
      {impact != null && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 4 }}>
          <span style={{ color: "var(--ink-3)" }}>Impacto no orçamento</span>
          <span style={{ fontWeight: 600, color: impact > 30 ? "var(--warn)" : "var(--ink-2)" }}>{Math.round(impact)}% da renda</span>
        </div>
      )}

      {raw && (
        <div style={{ display: "flex", gap: 6, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          {raw.tracking_mode === "manual" && (
            <button className="btn btn-quiet btn-sm" type="button" onClick={() => onAporte(raw)} title="Registrar aporte">
              <GIcon name="plus" size={13} /> Aporte
            </button>
          )}
          {raw.tracking_mode === "contributions" && (
            <button className="btn btn-quiet btn-sm" type="button" onClick={() => onManageContributions(raw)} title="Vincular transações/aportes">
              <GIcon name="link" size={13} /> Aportes
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet btn-sm" type="button" onClick={() => onEdit(raw)} title="Editar"><GIcon name="edit" size={13} /></button>
          <button className="btn btn-quiet btn-sm" type="button" style={{ color: "var(--neg)" }} onClick={() => onDelete(raw)} title="Excluir"><GIcon name="trash" size={13} /></button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal form modal
// ---------------------------------------------------------------------------

interface GoalFormState {
  id: string | null;
  currentAmount: string;
  description: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  trackingMode: string;
  linkedAccount: string;
  icon: string;
  color: string;
  aporteText: string;
  aporteMin: string;
  aporteMax: string;
}

function emptyGoalForm(): GoalFormState {
  return { id: null, currentAmount: "0", description: "", name: "", targetAmount: "", targetDate: "", trackingMode: "manual", linkedAccount: "", icon: "target", color: "", aporteText: "", aporteMin: "", aporteMax: "" };
}

function GoalModal({
  form,
  setForm,
  saving,
  error,
  accounts,
  onClose,
  onSubmit,
}: {
  form: GoalFormState;
  setForm: (f: GoalFormState) => void;
  saving: boolean;
  error: string;
  accounts: AccountItem[];
  onClose: () => void;
  onSubmit: () => void;
}) {
  const editing = Boolean(form.id);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><GIcon name="target" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">{editing ? "Editar meta" : "Nova meta financeira"}</div>
            <div className="mh-sub">Defina um objetivo e acompanhe o progresso real.</div>
          </div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar">
            <GIcon name="x" size={18} />
          </button>
        </div>

        <div className="mdl-body">
          <label className="fld">
            <span className="fld-label">Nome</span>
            <input className="fld-input" autoFocus required placeholder="Ex: Reserva de emergência, Viagem…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>

          <div className="fld">
            <span className="fld-label">Ícone e cor</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {GOAL_ICONS.map((ic) => {
                const sel = form.icon === ic;
                const c = form.color || GOAL_COLOR_CHOICES[0];
                return (
                  <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                    style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer",
                      border: "1px solid " + (sel ? c : "var(--line)"),
                      background: sel ? c + "1e" : "var(--card-2)", color: sel ? c : "var(--ink-3)" }}>
                    <GIcon name={ic} size={16} />
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {GOAL_COLOR_CHOICES.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} title={c}
                  style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: "pointer", border: "2px solid " + (form.color === c ? "var(--ink)" : "transparent") }} />
              ))}
              <button type="button" onClick={() => setForm({ ...form, color: "" })} title="Automática"
                style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg-sunken)", fontSize: 9, fontWeight: 700, color: "var(--ink-3)", cursor: "pointer", border: "2px solid " + (form.color === "" ? "var(--ink)" : "transparent") }}>A</button>
            </div>
          </div>

          <div className="fld">
            <span className="fld-label">Como o valor atual evolui</span>
            <div className="seg" style={{ width: "100%" }}>
              <button type="button" className={form.trackingMode === "manual" ? "on" : ""} style={{ flex: 1 }} onClick={() => setForm({ ...form, trackingMode: "manual" })}>Manual</button>
              <button type="button" className={form.trackingMode === "contributions" ? "on" : ""} style={{ flex: 1 }} onClick={() => setForm({ ...form, trackingMode: "contributions" })}>Aportes</button>
              <button type="button" className={form.trackingMode === "account" ? "on" : ""} style={{ flex: 1 }} onClick={() => setForm({ ...form, trackingMode: "account" })}>Conta</button>
            </div>
            <div className="fld-help">
              {form.trackingMode === "account"
                ? "Segue o saldo importado da conta escolhida."
                : form.trackingMode === "contributions"
                  ? "Some as transações (transferências/aportes) que você vincular à meta — gerencie em “Aportes” no card."
                  : "Você atualiza o valor manualmente (botão Aporte no card)."}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: form.trackingMode === "manual" || form.trackingMode === "account" ? "1fr 1fr" : "1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Valor alvo</span>
              <input className="fld-input" min="0.01" required step="0.01" type="number" placeholder="0,00" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
            </label>
            {form.trackingMode === "account" && (
              <label className="fld">
                <span className="fld-label">Conta vinculada</span>
                <select className="fld-select" value={form.linkedAccount} onChange={(e) => setForm({ ...form, linkedAccount: e.target.value })}>
                  <option value="">Selecione…</option>
                  {accounts.map((a) => (
                    <option key={a.account_name} value={a.account_name}>{a.account_name} · {moneyAbs(a.balance)}</option>
                  ))}
                </select>
              </label>
            )}
            {form.trackingMode === "manual" && (
              <label className="fld">
                <span className="fld-label">Valor atual</span>
                <input className="fld-input" min="0" step="0.01" type="number" placeholder="0,00" value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} />
              </label>
            )}
          </div>

          {form.trackingMode === "contributions" && (
            <div className="fld">
              <span className="fld-label">Auto-vincular aportes (opcional)</span>
              <input className="fld-input" placeholder='Descrição contém — ex.: "APORTE XP", "TRANSF INVEST"' value={form.aporteText} onChange={(e) => setForm({ ...form, aporteText: e.target.value })} style={{ marginBottom: 8 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input className="fld-input" type="number" step="0.01" placeholder="Valor mín. (opcional)" value={form.aporteMin} onChange={(e) => setForm({ ...form, aporteMin: e.target.value })} />
                <input className="fld-input" type="number" step="0.01" placeholder="Valor máx. (opcional)" value={form.aporteMax} onChange={(e) => setForm({ ...form, aporteMax: e.target.value })} />
              </div>
              <div className="fld-help">Vincula sozinho os lançamentos que casarem — retroativo ao salvar e nas próximas importações. Você ainda pode vincular/desvincular manualmente em “Aportes”.</div>
            </div>
          )}

          <label className="fld">
            <span className="fld-label">Prazo (opcional)</span>
            <input className="fld-input" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </label>

          <label className="fld">
            <span className="fld-label">Descrição (opcional)</span>
            <input className="fld-input" placeholder="Contexto sobre esta meta…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>

          {error && <div className="fld-error">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={saving} onClick={onSubmit}>
            <GIcon name="check" size={14} />
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar meta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contributions (aportes) modal
// ---------------------------------------------------------------------------

function ContributionsModal({ session, goal, onClose }: { session: ApiSession; goal: GoalRead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const linked = useQuery({ queryKey: ["goal-contribs", goal.id], queryFn: () => getGoalContributions(session, goal.id) });
  const candidates = useQuery({ queryKey: ["goal-cands", goal.id, q], queryFn: () => getContributionCandidates(session, goal.id, q) });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["goal-contribs", goal.id] });
    void queryClient.invalidateQueries({ queryKey: ["goal-cands", goal.id] });
    void queryClient.invalidateQueries({ queryKey: ["goals"] });
  }
  const add = useMutation({ mutationFn: (txId: string) => addGoalContribution(session, goal.id, txId), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (txId: string) => removeGoalContribution(session, goal.id, txId), onSuccess: refresh });

  const linkedItems = linked.data?.items ?? [];

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><GIcon name="link" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">Aportes — {goal.name}</div>
            <div className="mh-sub">Vincule transferências/aportes; o valor da meta é a soma deles.</div>
          </div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar"><GIcon name="x" size={18} /></button>
        </div>
        <div className="mdl-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {/* Linked contributions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="fld-label" style={{ margin: 0 }}>Vinculados ({linkedItems.length})</span>
            <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{moneyAbs(Number(linked.data?.total ?? 0))}</span>
          </div>
          {linkedItems.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12 }}>Nenhum aporte vinculado ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {linkedItems.map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 9 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</div>
                    <div className="t-sub mono">{dateInputLabel(tx.transaction_date)}</div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{moneyAbs(Number(tx.amount))}</span>
                  <button className="btn btn-quiet btn-sm" style={{ color: "var(--neg)" }} type="button" disabled={remove.isPending} onClick={() => remove.mutate(tx.id)} title="Desvincular"><GIcon name="x" size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <hr className="divider" style={{ margin: "4px 0 12px" }} />

          {/* Candidate search */}
          <span className="fld-label">Adicionar transação</span>
          <input className="fld-input" placeholder="Buscar por descrição (transferência, aporte…)" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(candidates.data?.items ?? []).map((tx) => (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</div>
                  <div className="t-sub mono">{dateInputLabel(tx.transaction_date)}</div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)" }}>{moneyAbs(Number(tx.amount))}</span>
                <button className="btn btn-quiet btn-sm" type="button" disabled={add.isPending} onClick={() => add.mutate(tx.id)} title="Vincular como aporte"><GIcon name="plus" size={13} /></button>
              </div>
            ))}
            {(candidates.data?.items ?? []).length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhuma transação disponível.</p>
            )}
          </div>
        </div>
        <div className="mdl-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function GoalsPage({
  session,
  period: goalPeriod,
  setPeriod,
}: {
  session: ApiSession;
  period: PeriodState;
  setPeriod: Dispatch<SetStateAction<PeriodState>>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [goalForm, setGoalForm] = useState<GoalFormState>(emptyGoalForm);
  const [formError, setFormError] = useState("");
  const [aporteGoal, setAporteGoal] = useState<GoalRead | null>(null);
  const [aporteValue, setAporteValue] = useState("");
  const [contribGoal, setContribGoal] = useState<GoalRead | null>(null);

  const queryClient = useQueryClient();
  const period = usePeriod(goalPeriod, setPeriod);

  const summary = useQuery({
    queryKey: ["goals-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedGoals = useQuery({
    queryKey: ["goals", session.token],
    queryFn: () => getGoals(session),
  });
  const accounts = useQuery({
    queryKey: ["accounts", session.token],
    queryFn: () => getAccounts(session),
  });

  function invalidateGoals() {
    void queryClient.invalidateQueries({ queryKey: ["goals"] });
  }

  const saveGoalMutation = useMutation({
    mutationFn: () => {
      const payload = {
        current_amount: goalForm.trackingMode === "manual" ? (goalForm.currentAmount || "0") : "0",
        description: goalForm.description || null,
        name: goalForm.name,
        target_amount: goalForm.targetAmount,
        target_date: goalForm.targetDate || null,
        tracking_mode: goalForm.trackingMode,
        linked_account: goalForm.trackingMode === "account" ? (goalForm.linkedAccount || null) : null,
        icon: goalForm.icon || null,
        color: goalForm.color || null,
        aporte_match_text: goalForm.trackingMode === "contributions" ? (goalForm.aporteText.trim() || null) : null,
        aporte_min: goalForm.trackingMode === "contributions" && goalForm.aporteMin ? goalForm.aporteMin : null,
        aporte_max: goalForm.trackingMode === "contributions" && goalForm.aporteMax ? goalForm.aporteMax : null,
      };
      return goalForm.id ? updateGoal(session, goalForm.id, payload) : createGoal(session, payload);
    },
    onSuccess: () => {
      setGoalForm(emptyGoalForm());
      setFormError("");
      setShowModal(false);
      invalidateGoals();
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Falha ao salvar meta.")),
  });

  const removeGoalMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(session, id),
    onSuccess: invalidateGoals,
  });

  const aporteMutation = useMutation({
    mutationFn: () => {
      const next = (Number(aporteGoal?.current_amount ?? 0) + Number(aporteValue || 0)).toFixed(2);
      return updateGoal(session, aporteGoal!.id, { current_amount: next });
    },
    onSuccess: () => { setAporteGoal(null); setAporteValue(""); invalidateGoals(); },
  });

  function openCreate() { setGoalForm(emptyGoalForm()); setFormError(""); setShowModal(true); }
  function openEdit(g: GoalRead) {
    setGoalForm({
      id: g.id,
      currentAmount: String(g.current_amount),
      description: g.description ?? "",
      name: g.name,
      targetAmount: String(g.target_amount),
      targetDate: g.target_date ?? "",
      trackingMode: g.tracking_mode,
      linkedAccount: g.linked_account ?? "",
      icon: g.icon ?? "target",
      color: g.color ?? "",
      aporteText: g.aporte_match_text ?? "",
      aporteMin: g.aporte_min ?? "",
      aporteMax: g.aporte_max ?? "",
    });
    setFormError("");
    setShowModal(true);
  }

  const isDemo = !persistedGoals.data?.items.length;
  const goals = buildGoalRows(summary.data, persistedGoals.data?.items);
  const monthlyIncome = Number(summary.data?.income ?? 0);

  // KPI metrics (real, derived from the goals + period summary)
  const capacity = Math.max(Number(summary.data?.balance ?? 0), 0);
  const completedCount = goals.filter((g) => g.ratio >= 1).length;
  const averageProgress = goals.reduce((t, g) => t + g.ratio, 0) / Math.max(goals.length, 1);
  const goalMonthly = (g: GoalRow) => { const rem = Math.max(g.target - g.current, 0); return rem > 0 ? rem / g.monthsLeft : 0; };
  const totalMonthly = goals.reduce((t, g) => t + goalMonthly(g), 0);
  const pending = goals.filter((g) => g.ratio < 1);
  const nextMilestone = pending.length ? pending.reduce((a, b) => (a.monthsLeft <= b.monthsLeft ? a : b)) : null;
  const withinCapacity = capacity > 0 && totalMonthly <= capacity;

  function handleSubmit() {
    if (!goalForm.name.trim()) { setFormError("Informe o nome da meta."); return; }
    if (!goalForm.targetAmount) { setFormError("Informe o valor alvo."); return; }
    if (goalForm.trackingMode === "account" && !goalForm.linkedAccount) { setFormError("Selecione a conta vinculada."); return; }
    setFormError("");
    saveGoalMutation.mutate();
  }

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Planejamento</div>
          <h2 className="section-title"><GIcon name="flag" size={18} /> Metas</h2>
          <p className="section-sub">Objetivos financeiros, com progresso e contribuição mensal sugerida.</p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ flex: "none" }} onClick={openCreate}>
          <GIcon name="plus" size={15} /> Nova meta
        </button>
      </div>

      {/* KPI deck */}
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic"><GIcon name="target" size={16} /></span>
            <span className="kpi-label">Metas</span>
          </div>
          <div className="kpi-val">{goals.length}</div>
          <div className="kpi-sub">{completedCount > 0 ? `${completedCount} concluída${completedCount !== 1 ? "s" : ""}` : "em andamento"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: capacity > 0 ? "var(--pos-soft)" : "var(--warn-soft)", color: capacity > 0 ? "var(--pos)" : "var(--warn)" }}><GIcon name="wallet" size={16} /></span>
            <span className="kpi-label">Capacidade mensal</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{moneyAbs(capacity)}</div>
          <div className="kpi-sub">Fluxo líquido do período</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc-ink)" }}><GIcon name="star" size={16} /></span>
            <span className="kpi-label">Progresso médio</span>
          </div>
          <div className="kpi-val">{Math.round(averageProgress * 100)}%</div>
          <div className="kpi-sub">Sobre todas as metas</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><GIcon name="flag" size={16} /></span>
            <span className="kpi-label">Próximo marco</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 16 }}>{nextMilestone ? `${nextMilestone.monthsLeft} ${nextMilestone.monthsLeft === 1 ? "mês" : "meses"}` : "—"}</div>
          <div className="kpi-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nextMilestone ? nextMilestone.name : "Todas concluídas"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: withinCapacity ? "var(--pos-soft)" : "var(--warn-soft)", color: withinCapacity ? "var(--pos)" : "var(--warn)" }}><GIcon name="chevR" size={16} /></span>
            <span className="kpi-label">Sugestão</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 16 }}>{capacity <= 0 ? "Revisar" : withinCapacity ? "Aportar" : "Priorizar"}</div>
          <div className="kpi-sub">{moneyAbs(totalMonthly)}/mês sugerido{capacity > 0 ? ` · ${moneyAbs(capacity)} disp.` : ""}</div>
        </div>
      </div>

      {/* Demo notice */}
      {isDemo && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <span className="alert-ic"><GIcon name="info" size={17} /></span>
          <div>
            <div className="a-ttl">Metas simuladas</div>
            <div className="a-txt">Os cards abaixo são exemplos. Crie sua primeira meta em "Nova meta".</div>
          </div>
        </div>
      )}

      {/* Goals grid */}
      {persistedGoals.isLoading ? (
        <div className="state" style={{ padding: "48px 20px" }}>
          <div className="state-ic"><GIcon name="target" size={24} /></div>
          <h4>Carregando metas…</h4>
        </div>
      ) : (
        <div className="grid cols-3">
          {goals.map((goal, i) => (
            <GoalCard
              key={goal.goal?.id ?? goal.name}
              goal={goal}
              color={GOAL_COLORS[i % GOAL_COLORS.length]}
              monthlyIncome={monthlyIncome}
              onEdit={openEdit}
              onDelete={(g) => { if (window.confirm(`Excluir a meta “${g.name}”?`)) removeGoalMutation.mutate(g.id); }}
              onAporte={(g) => { setAporteValue(""); setAporteGoal(g); }}
              onManageContributions={(g) => setContribGoal(g)}
            />
          ))}
          {/* Add tile */}
          <button
            type="button"
            className="card"
            onClick={openCreate}
            style={{ border: "2px dashed var(--line-strong, var(--line))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 200, color: "var(--ink-3)", boxShadow: "none", background: "transparent" }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--bg-sunken)" }}><GIcon name="plus" size={20} /></span>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Criar nova meta</span>
            <span style={{ fontSize: 12 }}>Reserva, viagem, educação…</span>
          </button>
        </div>
      )}

      {/* Goal modal (create/edit) */}
      {showModal && (
        <GoalModal
          form={goalForm}
          setForm={setGoalForm}
          saving={saveGoalMutation.isPending}
          error={formError}
          accounts={accounts.data?.items ?? []}
          onClose={() => { setShowModal(false); setFormError(""); }}
          onSubmit={handleSubmit}
        />
      )}

      {/* Aporte modal */}
      {aporteGoal && (
        <div className="mdl-backdrop" onClick={() => setAporteGoal(null)}>
          <div className="mdl" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="mdl-head">
              <span className="mh-ic"><GIcon name="plus" size={17} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="mh-ttl">Registrar aporte</div>
                <div className="mh-sub">{aporteGoal.name} · atual {moneyAbs(Number(aporteGoal.current_amount))}</div>
              </div>
              <button className="mh-close" onClick={() => setAporteGoal(null)} aria-label="Fechar"><GIcon name="x" size={18} /></button>
            </div>
            <div className="mdl-body">
              <label className="fld">
                <span className="fld-label">Valor do aporte</span>
                <input className="fld-input" autoFocus min="0.01" step="0.01" type="number" placeholder="0,00" value={aporteValue} onChange={(e) => setAporteValue(e.target.value)} />
              </label>
              <div className="fld-help">Novo valor atual: {moneyAbs(Number(aporteGoal.current_amount) + Number(aporteValue || 0))}</div>
              {aporteMutation.isError && <div className="fld-error">{apiErrorMessage(aporteMutation.error, "Falha ao registrar aporte.")}</div>}
            </div>
            <div className="mdl-foot">
              <span style={{ flex: 1 }} />
              <button className="btn btn-quiet" onClick={() => setAporteGoal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={aporteMutation.isPending || !Number(aporteValue)} onClick={() => aporteMutation.mutate()}>
                <GIcon name="check" size={14} /> {aporteMutation.isPending ? "Salvando…" : "Aportar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contributions (aportes) modal */}
      {contribGoal && (
        <ContributionsModal session={session} goal={contribGoal} onClose={() => setContribGoal(null)} />
      )}
    </div>
  );
}
