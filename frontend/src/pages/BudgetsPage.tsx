import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBudget,
  deleteBudget,
  getBudgetRecommendation,
  getBudgets,
  getCategoryRanking,
  updateBudget,
} from "../lib/api";
import {
  apiErrorMessage,
  buildBudgetRows,
  categoryPath,
  formatPercentNumber,
  moneyAbs,
  periodRange,
  withQueryParams,
} from "../lib/utils";
import { useCategories, usePeriod } from "../hooks";
import type { ApiSession, BudgetRead, CategoryRankingItem, CategoryRead } from "../lib/api";
import type { PeriodState, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

const B_ICONS: Record<string, string> = {
  target:  "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  plus:    "M12 5v14 M5 12h14",
  check:   "M5 12l5 5 9-10",
  x:       "M18 6L6 18 M6 6l12 12",
  edit:    "M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:   "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  chevR:   "M9 18l6-6-6-6",
  flag:    "M5 3v18 M5 5l14 5-14 5",
  wallet:  "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  info:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  coins:   "M9 9m-6 0a6 3 0 1 0 12 0a6 3 0 1 0-12 0 M3 9v5c0 1.66 2.7 3 6 3 M3 11.5c0 1.66 2.7 3 6 3 M15 6c3.3 0 6 1.34 6 3v6c0 1.66-2.7 3-6 3-1.1 0-2.13-.15-3-.41",
};

function BIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = B_ICONS[name];
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

interface BudgetRow {
  budget: BudgetRead | null;
  categoryId: string | null;
  categoryName: string;
  limit: number;
  spent: number;
  ratio: number;
}

function buildPersistedBudgetRows({
  budgets,
  categories,
  ranking,
}: {
  budgets?: BudgetRead[];
  categories: CategoryRead[];
  ranking: CategoryRankingItem[];
}): BudgetRow[] {
  if (!budgets?.length) return [];
  const spentByCategory = new Map(ranking.map((item) => [item.category_id, Number(item.amount ?? 0)]));
  const categoryNames = new Map(categories.map((category) => [category.id, categoryPath(category, categories)]));
  return budgets.map((budget) => {
    const spent = budget.category_id ? spentByCategory.get(budget.category_id) ?? 0 : 0;
    const limit = Number(budget.limit_amount);
    return {
      budget,
      categoryId: budget.category_id,
      categoryName: budget.category_id ? categoryNames.get(budget.category_id) ?? budget.name : budget.name,
      limit,
      ratio: spent / Math.max(limit, 1),
      spent,
    };
  });
}

function budgetTone(ratio: number): "var(--neg)" | "var(--pos)" | "var(--warn)" {
  if (ratio > 1) return "var(--neg)";
  if (ratio >= 0.85) return "var(--warn)";
  return "var(--pos)";
}

function budgetStatusLabel(ratio: number): string {
  if (ratio > 1) return "Acima do limite";
  if (ratio >= 0.85) return "Atenção";
  return "OK";
}

function commitmentLabel(ratio: number): { label: string; tone: string } {
  if (ratio >= 1) return { label: "Alto", tone: "var(--neg)" };
  if (ratio >= 0.85) return { label: "Moderado", tone: "var(--warn)" };
  return { label: "Saudável", tone: "var(--pos)" };
}

// ---------------------------------------------------------------------------
// Budget form modal (create + edit)
// ---------------------------------------------------------------------------

interface BudgetFormState {
  id: string | null;
  parentId: string;
  subId: string;
  limitAmount: string;
  name: string;
  recurring: boolean;
  periodEnd: string;
  periodStart: string;
}

function emptyBudgetForm(): BudgetFormState {
  const range = periodRange("current_month");
  return { id: null, parentId: "", subId: "", limitAmount: "", name: "", recurring: true, periodEnd: "", periodStart: range.dateFrom };
}

// Full-month [start, end] dates from a "YYYY-MM" value.
function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, "0")}` };
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthYearLabel(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  if (!y || !m) return "";
  return `${MONTH_ABBR[m - 1]}/${y}`;
}

function BudgetModal({
  form,
  setForm,
  saving,
  error,
  categories,
  session,
  existingCatIds,
  onClose,
  onSubmit,
}: {
  form: BudgetFormState;
  setForm: (f: BudgetFormState) => void;
  saving: boolean;
  error: string;
  categories: CategoryRead[];
  session: ApiSession;
  existingCatIds: Set<string>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const parents = categories.filter((c) => !c.parent_category_id);
  const subs = categories.filter((c) => c.parent_category_id === form.parentId);
  const editing = Boolean(form.id);

  const effCat = form.subId || form.parentId;
  const reco = useQuery({
    queryKey: ["budget-reco", session.token, effCat],
    queryFn: () => getBudgetRecommendation(session, effCat, 3),
    enabled: Boolean(effCat),
  });
  const recoAvg = reco.data ? Number(reco.data.average) : 0;
  const recoRounded = recoAvg > 0 ? Math.max(10, Math.ceil(recoAvg / 10) * 10) : 0;

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><BIcon name="wallet" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">{editing ? "Editar orçamento" : "Novo orçamento"}</div>
            <div className="mh-sub">Defina um limite por categoria (subcategoria opcional).</div>
          </div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar">
            <BIcon name="x" size={18} />
          </button>
        </div>

        <div className="mdl-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Categoria *</span>
              <select
                className="fld-select"
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value, subId: "" })}
                autoFocus
              >
                <option value="">Selecione…</option>
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span className="fld-label">Subcategoria (opcional)</span>
              <select
                className="fld-select"
                value={form.subId}
                onChange={(e) => setForm({ ...form, subId: e.target.value })}
                disabled={!form.parentId || subs.length === 0}
              >
                <option value="">Toda a categoria</option>
                {subs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          {effCat && !editing && existingCatIds.has(effCat) && (
            <div style={{ marginTop: -6, marginBottom: 12, fontSize: 11.5, color: "var(--warn)", display: "flex", gap: 6, alignItems: "center" }}>
              <BIcon name="info" size={13} /> Esta categoria já tem um orçamento — só é possível outro em um mês diferente.
            </div>
          )}

          <label className="fld">
            <span className="fld-label">Descrição (opcional)</span>
            <input
              className="fld-input"
              placeholder="Deixe vazio para usar o nome da categoria"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label className="fld" style={{ marginBottom: 6 }}>
            <span className="fld-label">Valor limite *</span>
            <input
              className="fld-input"
              min="0.01"
              step="0.01"
              type="number"
              placeholder="0,00"
              value={form.limitAmount}
              onChange={(e) => setForm({ ...form, limitAmount: e.target.value })}
            />
          </label>
          {effCat && recoRounded > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 14px", fontSize: 12 }}>
              <BIcon name="info" size={13} />
              <span style={{ color: "var(--ink-3)" }}>
                Média de gasto (3 meses): <strong style={{ color: "var(--ink-2)" }}>{moneyAbs(recoAvg)}</strong>/mês
              </span>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => setForm({ ...form, limitAmount: String(recoRounded) })}
              >
                Usar {moneyAbs(recoRounded)}
              </button>
            </div>
          )}

          <div className="fld">
            <span className="fld-label">Vigência</span>
            <div className="seg" style={{ width: "100%" }}>
              <button
                type="button"
                className={!form.recurring ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => setForm({ ...form, recurring: false, periodEnd: monthRange(form.periodStart.slice(0, 7)).end })}
              >
                Mês específico
              </button>
              <button
                type="button"
                className={form.recurring ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => setForm({ ...form, recurring: true, periodEnd: "" })}
              >
                Recorrente (todo mês)
              </button>
            </div>
            <div className="fld-help">
              {form.recurring ? "Aplica a todos os meses, sem data de término." : "Vale apenas para o mês escolhido."}
            </div>
          </div>

          {!form.recurring && (
            <label className="fld">
              <span className="fld-label">Mês / Ano *</span>
              <input
                className="fld-input"
                type="month"
                value={form.periodStart.slice(0, 7)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const { start, end } = monthRange(e.target.value);
                  setForm({ ...form, periodStart: start, periodEnd: end });
                }}
              />
            </label>
          )}

          {error && <div className="fld-error">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            Atalho: <span style={{ fontFamily: "var(--font-mono)", background: "var(--bg-sunken)", padding: "1px 6px", borderRadius: 5 }}>Esc</span> para fechar
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={saving} onClick={onSubmit}>
            <BIcon name="check" size={14} />
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar orçamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function BudgetsPage({
  onOpenTransactions,
  period: budgetPeriod,
  setPeriod,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  period: PeriodState;
  setPeriod: Dispatch<SetStateAction<PeriodState>>;
  session: ApiSession;
}) {
  const [showModal, setShowModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(emptyBudgetForm);
  const [formError, setFormError] = useState("");

  const queryClient = useQueryClient();
  const period = usePeriod(budgetPeriod, setPeriod);

  const ranking = useQuery({
    queryKey: ["budgets-category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const persistedBudgets = useQuery({
    queryKey: ["budgets", session.token, period.query],
    queryFn: () => getBudgets(session, period.query),
  });
  const categories = useCategories(session);
  const catItems = categories.data?.items ?? [];

  function invalidateBudgets() {
    void queryClient.invalidateQueries({ queryKey: ["budgets"] });
  }

  const saveBudget = useMutation({
    mutationFn: () => {
      const categoryId = budgetForm.subId || budgetForm.parentId;
      const effCat = catItems.find((c) => c.id === categoryId);
      const name = budgetForm.name.trim() || (effCat ? categoryPath(effCat, catItems) : "Orçamento");
      const payload = {
        category_id: categoryId || null,
        limit_amount: budgetForm.limitAmount,
        name,
        recurring: budgetForm.recurring,
        period_end: budgetForm.periodEnd || null,
        period_start: budgetForm.periodStart,
      };
      return budgetForm.id ? updateBudget(session, budgetForm.id, payload) : createBudget(session, payload);
    },
    onSuccess: () => {
      setFormError("");
      setShowModal(false);
      setBudgetForm(emptyBudgetForm());
      invalidateBudgets();
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Falha ao salvar orçamento.")),
  });

  const removeBudget = useMutation({
    mutationFn: (id: string) => deleteBudget(session, id),
    onSuccess: invalidateBudgets,
  });

  const persistedRows = buildPersistedBudgetRows({
    budgets: persistedBudgets.data?.items,
    categories: catItems,
    ranking: ranking.data?.items ?? [],
  });
  const rows: BudgetRow[] = (persistedRows.length
    ? persistedRows
    : buildBudgetRows(ranking.data?.items ?? []).map((r) => ({ ...r, budget: null }))
  ).slice().sort((a, b) => b.ratio - a.ratio); // mais consumidos / estourados primeiro
  const isSuggestion = persistedRows.length === 0;

  const overBudget = rows.filter((row) => row.ratio > 1).length;
  const nearLimit = rows.filter((row) => row.ratio >= 0.85 && row.ratio <= 1).length;
  const totalBudget = rows.reduce((total, row) => total + row.limit, 0);
  const totalSpent = rows.reduce((total, row) => total + row.spent, 0);
  const available = totalBudget - totalSpent;
  const overallRatio = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const commitment = commitmentLabel(overallRatio);

  const isLoading = ranking.isLoading || persistedBudgets.isLoading || categories.isLoading;

  function openCreate() {
    const base = emptyBudgetForm();
    const ym = /^\d{4}-\d{2}/.test(period.dateFrom) ? period.dateFrom.slice(0, 7) : base.periodStart.slice(0, 7);
    const { start, end } = monthRange(ym);
    setBudgetForm({ ...base, periodStart: start, periodEnd: base.recurring ? "" : end });
    setFormError("");
    setShowModal(true);
  }
  function openEdit(budget: BudgetRead) {
    const cat = catItems.find((c) => c.id === budget.category_id);
    const parentId = cat ? (cat.parent_category_id ?? cat.id) : "";
    const subId = cat && cat.parent_category_id ? cat.id : "";
    setBudgetForm({
      id: budget.id,
      parentId,
      subId,
      limitAmount: String(budget.limit_amount),
      name: budget.name,
      recurring: budget.recurring,
      periodStart: budget.period_start,
      periodEnd: budget.period_end ?? "",
    });
    setFormError("");
    setShowModal(true);
  }

  function handleSubmit() {
    if (!budgetForm.parentId) { setFormError("Selecione a categoria."); return; }
    if (!budgetForm.limitAmount || Number(budgetForm.limitAmount) <= 0) { setFormError("Informe um valor limite válido."); return; }
    setFormError("");
    saveBudget.mutate();
  }

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="ttl" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Orçamentos</h1>
          <p className="sub" style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
            Controle seus gastos por categoria com limites no período selecionado.
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <BIcon name="plus" size={15} /> Novo orçamento
          </button>
        </div>
      </div>

      {/* KPI deck */}
      <div className="kpi-deck" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic"><BIcon name="wallet" size={16} /></span>
            <span className="kpi-label">Orçado</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{moneyAbs(totalBudget)}</div>
          <div className="kpi-sub">{rows.length} categoria{rows.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}><BIcon name="chevR" size={16} /></span>
            <span className="kpi-label">Realizado</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{moneyAbs(totalSpent)}</div>
          <div className="kpi-sub">Despesas categorizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: available >= 0 ? "var(--pos-soft)" : "var(--neg-soft)", color: available >= 0 ? "var(--pos)" : "var(--neg)" }}><BIcon name="coins" size={16} /></span>
            <span className="kpi-label">Disponível</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 18, color: available >= 0 ? "var(--ink)" : "var(--neg)" }}>{moneyAbs(available)}</div>
          <div className="kpi-sub">{available >= 0 ? "Saldo do orçamento" : "Estourado no período"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><BIcon name="target" size={16} /></span>
            <span className="kpi-label">Comprometimento</span>
          </div>
          <div className="kpi-val">{formatPercentNumber(overallRatio * 100)}%</div>
          <div className="kpi-sub" style={{ color: commitment.tone }}>{commitment.label} · realizado sobre o total orçado</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: overBudget ? "var(--neg-soft)" : "var(--pos-soft)", color: overBudget ? "var(--neg)" : "var(--pos)" }}><BIcon name="flag" size={16} /></span>
            <span className="kpi-label">Acima do limite</span>
          </div>
          <div className="kpi-val">{overBudget}</div>
          <div className="kpi-sub">{nearLimit} perto do limite</div>
        </div>
      </div>

      {/* Budget list (full width) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="kpi-ic"><BIcon name="wallet" size={15} /></div>
          <div>
            <div className="ttl">Categorias monitoradas</div>
            <div className="sub">{isSuggestion ? "Sugestão baseada no histórico — cadastre para fixar limites" : "Limites cadastrados no período"}</div>
          </div>
          <span style={{ flex: 1 }} />
          {/* Legend (substitui o card de política de faixas) */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: "var(--ink-3)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--pos)" }} /> Dentro (até 85%)</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--warn)" }} /> Atenção (85–100%)</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--neg)" }} /> Acima (&gt;100%)</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: "6px 0 8px" }}>
          {isLoading ? (
            <div className="state" style={{ padding: "32px 20px" }}>
              <div className="state-ic"><BIcon name="wallet" size={22} /></div>
              <h4>Carregando orçamentos…</h4>
              <p>Buscando categorias do período.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="state" style={{ padding: "32px 20px" }}>
              <div className="state-ic"><BIcon name="target" size={22} /></div>
              <h4>Nenhum orçamento encontrado</h4>
              <p>Cadastre orçamentos ou categorize transações para sugerir limites.</p>
              <button className="btn btn-ghost btn-sm" onClick={openCreate}>
                <BIcon name="plus" size={14} /> Criar orçamento
              </button>
            </div>
          ) : (
            rows.map((row, i) => {
              const tone = budgetTone(row.ratio);
              const pct = Math.min(row.ratio * 100, 100);
              const remaining = row.limit - row.spent;
              return (
                <div key={row.budget?.id ?? `${row.categoryName}-${i}`} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--line)" }}>
                  <button
                    style={{ display: "block", flex: 1, minWidth: 0, textAlign: "left", padding: "10px 16px", background: "transparent" }}
                    onClick={() => onOpenTransactions({
                      categoryId: row.categoryId ?? undefined,
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      direction: "debit",
                      label: row.categoryName,
                      periodPreset: period.periodPreset,
                    })}
                    type="button"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 120, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {row.categoryName}
                        {row.budget?.recurring && <span className="badge b-info" style={{ fontSize: 9.5, padding: "1px 6px" }}>Recorrente</span>}
                        {row.budget && !row.budget.recurring && (
                          <span className="t-sub" style={{ fontSize: 10.5, fontWeight: 500 }}>{monthYearLabel(row.budget.period_start)}</span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                        {moneyAbs(row.spent)} <span style={{ color: "var(--ink-faint)" }}>de</span> {moneyAbs(row.limit)}
                      </span>
                      <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: remaining >= 0 ? "var(--pos)" : "var(--neg)", minWidth: 92, textAlign: "right" }}>
                        {remaining >= 0 ? `restam ${moneyAbs(remaining)}` : `excedeu ${moneyAbs(remaining)}`}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tone, fontFamily: "var(--font-mono)", minWidth: 40, textAlign: "right" }}>
                        {formatPercentNumber(row.ratio * 100)}%
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: row.ratio > 1 ? "var(--neg-soft)" : row.ratio >= 0.85 ? "var(--warn-soft)" : "var(--pos-soft)", color: tone }}>
                        {budgetStatusLabel(row.ratio)}
                      </span>
                    </div>
                    <div className="track thin">
                      <div className="fill" style={{ width: `${pct}%`, background: tone, transition: "width .3s" }} />
                    </div>
                  </button>
                  {row.budget && (
                    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 10px", borderLeft: "1px solid var(--line)" }}>
                      <button className="btn btn-quiet btn-sm" title="Editar" type="button" onClick={() => openEdit(row.budget!)}>
                        <BIcon name="edit" size={14} />
                      </button>
                      <button
                        className="btn btn-quiet btn-sm"
                        style={{ color: "var(--neg)" }}
                        title="Excluir"
                        type="button"
                        disabled={removeBudget.isPending}
                        onClick={() => { if (window.confirm(`Excluir o orçamento “${row.categoryName}”?`)) removeBudget.mutate(row.budget!.id); }}
                      >
                        <BIcon name="trash" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info alert */}
      <div className="alert info" style={{ marginTop: 4 }}>
        <span className="alert-ic"><BIcon name="info" size={17} /></span>
        <div>
          <div className="a-ttl">Como os orçamentos funcionam</div>
          <div className="a-txt">
            Clique numa categoria para revisar os lançamentos que consumiram o limite.
            Os limites são comparados com as despesas reais do período selecionado no topo.
          </div>
        </div>
      </div>

      {/* Budget form modal */}
      {showModal && (
        <BudgetModal
          form={budgetForm}
          setForm={setBudgetForm}
          saving={saveBudget.isPending}
          error={formError}
          categories={catItems}
          session={session}
          existingCatIds={new Set((persistedBudgets.data?.items ?? []).filter((b) => b.id !== budgetForm.id && b.category_id).map((b) => b.category_id as string))}
          onClose={() => { setShowModal(false); setFormError(""); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
