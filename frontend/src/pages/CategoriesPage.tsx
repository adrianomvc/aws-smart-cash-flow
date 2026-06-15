import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyRules,
  categorizePending,
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
  getCategoryRanking,
  getDataQuality,
  getSubcategoryRanking,
  getRulePreview,
  getRules,
  updateCategory,
  updateRule,
} from "../lib/api";
import {
  apiErrorMessage,
  categoryPath,
  dateLabel,
  directionLabel,
  moneyAbs,
  orderedCategoryOptions,
} from "../lib/utils";
import { Tags } from "lucide-react";
import { useCategories, useHasTransactions } from "../hooks";
import {
  Drawer,
  EmptyInline,
  InlineError,
  InlineSuccess,
  NoDataOnboarding,
  QualityRow,
  StatusBadge,
} from "../components/ui";
import { TransactionExplorer } from "./TransactionExplorer";
import type {
  ApiSession,
  CategorizationRuleRead,
  CategoryRead,
  RulePreview,
  TransactionRead,
} from "../lib/api";
import type { PeriodState, RuleFormState, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

const C_ICONS: Record<string, string> = {
  tag:     "M12 2H7a1 1 0 0 0-1 1v5l9.29 9.29a1 1 0 0 0 1.41 0l4.3-4.3a1 1 0 0 0 0-1.41L12 2z M7 7h.01",
  folder:  "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z",
  plus:    "M12 5v14 M5 12h14",
  search:  "M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M16 16l4 4",
  edit:    "M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:   "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  check:   "M5 12l5 5 9-10",
  x:       "M18 6L6 18 M6 6l12 12",
  alert:   "M12 9v4 M12 17h.01 M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z",
  arrowUR: "M7 17L17 7 M8 7h9v9",
  arrowDR: "M7 7l10 10 M17 8v9H8",
  list:    "M9 6h10 M9 12h10 M9 18h10 M5 6h.01 M5 12h.01 M5 18h.01",
  chevR:   "M9 18l6-6-6-6",
  chevL:   "M15 18l-6-6 6-6",
  chevD:   "M6 9l6 6 6-6",
  info:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  zap:     "M13 3l-8 10h6l-1 8 8-10h-6z",
  refresh: "M4 12a8 8 0 0 1 14.93-4 M20 12a8 8 0 0 1-14.93 4 M3 3v5h5 M21 21v-5h-5",
  clock:   "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2",
  // Prototype category icons
  home:     "M4 11l8-6 8 6 M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9 M10 20v-5h4v5",
  wallet:   "M3 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11 M16 12h.01",
  coins:    "M9 9m-6 0a6 3 0 1 0 12 0a6 3 0 1 0-12 0 M3 9v5c0 1.66 2.7 3 6 3 M3 11.5c0 1.66 2.7 3 6 3 M15 6c3.3 0 6 1.34 6 3v6c0 1.66-2.7 3-6 3-1.1 0-2.13-.15-3-.41",
  car:      "M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13 M4 13h16v4H4z M7 17v1.5 M17 17v1.5 M6.5 14.5h.01 M17.5 14.5h.01",
  cap:      "M3 9l9-4 9 4-9 4z M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4 M21 9v4",
  shield:   "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4",
  plane:    "M10 19l1-5-4 1v-2l5-2 1-6a1.3 1.3 0 0 1 2.6 0l1 6 5 2v2l-4-1 1 5-2 1-2-3-2 3z",
  spark:    "M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z M18 16l.7 2 .3.7 2 .3-2 .8-.7 2-.8-2-2-.3 2-.8z",
  flag:     "M5 21V4 M5 4h11l-2 3 2 3H5",
  target:   "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M15 9h4a1 1 0 0 1 1 1v11 M4 21h17 M8 8h3 M8 12h3 M8 16h3",
  receipt:  "M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z M9 8h6 M9 12h6 M9 16h3",
  star:     "M12 4l2.4 5.4 5.6.5-4.2 3.7 1.3 5.4L12 16.6 6.9 19.5l1.3-5.4L4 10.4l5.6-.5z",
  globe:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18",
  repeat:   "M4 9l3-3 3 3 M7 6v9a2 2 0 0 0 2 2h11 M20 15l-3 3-3-3 M17 18V9a2 2 0 0 0-2-2H4",
};

function CIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = C_ICONS[name];
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
// Constants
// ---------------------------------------------------------------------------

const CAT_PALETTE = [
  "#3567b8", "#1f8a5b", "#6a52c9", "#c98a2b", "#cf4d43",
  "#d98234", "#2a9d8f", "#9a6b14", "#7c8696", "#a35a7d", "#3d7d63", "#5a7dc9",
];

const CAT_ICON_OPTIONS = [
  "home", "wallet", "coins", "car", "cap", "shield", "plane", "spark",
  "flag", "target", "building", "receipt", "tag", "star", "zap", "globe",
];

// Default icon by category name, used when no icon was saved (mirrors prototype).
function defaultCatIcon(name: string): string {
  const n = name.toLowerCase();
  const map: [string, string][] = [
    ["moradia", "home"], ["aliment", "wallet"], ["mercado", "tag"],
    ["educa", "cap"], ["transporte", "car"], ["saude", "shield"], ["saúde", "shield"],
    ["lazer", "plane"], ["assinatura", "repeat"], ["servi", "receipt"],
    ["invest", "coins"], ["renda", "coins"], ["receita", "coins"],
    ["cart", "wallet"], ["imposto", "building"], ["filho", "spark"],
  ];
  for (const [k, v] of map) if (n.includes(k)) return v;
  return "folder";
}

// Per-category stats derived from the dashboard ranking endpoints.
type CatStats = { value: number; pct: number; count: number; delta: number | null; lastDate: string | null };

// Ranking query for the selected period (empty period → all-time).
function periodRankingQuery(p: PeriodState): string {
  const parts = ["limit=50"];
  if (p.dateFrom) parts.unshift(`date_from=${p.dateFrom}`);
  if (p.dateTo) parts.unshift(`date_to=${p.dateTo}`);
  return "?" + parts.join("&");
}

// Equal-length window immediately preceding the selected period, for the delta.
function previousPeriodRankingQuery(p: PeriodState): string | null {
  if (!p.dateFrom || !p.dateTo) return null;
  const from = new Date(p.dateFrom + "T12:00:00");
  const to = new Date(p.dateTo + "T12:00:00");
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (to.getTime() - from.getTime()));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return `?date_from=${iso(prevFrom)}&date_to=${iso(prevTo)}&limit=50`;
}

function brlInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

// Small % change pill, like the prototype's Delta. `invert` makes a decrease
// green (good for expenses).
function DeltaPill({ value, invert }: { value: number; invert?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span className={"delta " + (good ? "up" : "down")}>
      <CIcon name={up ? "arrowUR" : "arrowDR"} size={12} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// Resolve the display color for a category: prefer the saved color, fall back to
// a deterministic palette color derived from the name.
function catColor(cat: CategoryRead): string {
  return cat.color ?? CAT_PALETTE[Math.abs(cat.name.charCodeAt(0) + cat.name.length) % CAT_PALETTE.length];
}

// Categories don't carry a stored direction, so classify income by name. Matches
// the heuristic used on the dashboard/cashflow ("Renda", "Receita").
function isIncomeCategory(name: string): boolean {
  const n = name.toLowerCase();
  return ["renda", "receita"].some((t) => n.includes(t));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ruleFieldLabel(field: string) {
  const labels: Record<string, string> = {
    description: "Descrição normalizada",
    raw_description: "Descrição original",
    source_name: "Origem",
  };
  return labels[field] ?? field;
}

function ruleMatchLabel(matchType: string) {
  const labels: Record<string, string> = {
    contains: "contém",
    starts_with: "começa com",
    equals: "igual a",
  };
  return labels[matchType] ?? matchType;
}

function DirectionBadge({ direction }: { direction: string }) {
  return <span className={`direction-badge ${direction}`}>{directionLabel(direction)}</span>;
}

const emptyRuleForm: RuleFormState = {
  id: null,
  name: "",
  field: "description",
  match_type: "contains",
  pattern: "",
  category_id: "",
  target_direction: "",
  priority: 100,
  active: true,
  amount_ref: "",
  amount_tolerance: "",
  day_min: "",
  day_max: "",
  direction_filter: "",
};

// ---------------------------------------------------------------------------
// Category modal
// ---------------------------------------------------------------------------

interface CatModalState {
  kind: "cat" | "sub";
  editing?: CategoryRead;
  parentId?: string;
}

interface CatModalProps {
  state: CatModalState;
  categories: CategoryRead[];
  onClose: () => void;
  onSaveCat: (payload: { name: string; parentId: string | null; color: string; icon: string; subs: string[] }) => void;
  onSaveSub: (name: string, parentId: string) => void;
}

function CatModal({ state, categories, onClose, onSaveCat, onSaveSub }: CatModalProps) {
  const [kind, setKind] = useState<"cat" | "sub">(state.kind);
  const [name, setName] = useState(state.editing?.name ?? "");
  const [parentId, setParentId] = useState(
    state.parentId ??
    state.editing?.parent_category_id ??
    (categories.find((c) => !c.parent_category_id)?.id ?? "")
  );
  const [color, setColor] = useState(CAT_PALETTE[0]);
  const [iconName, setIconName] = useState("folder");
  const [subsText, setSubsText] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const rootCategories = categories.filter((c) => !c.parent_category_id);
  const parentCat = categories.find((c) => c.id === parentId);
  const subsOfParent = categories.filter((c) => c.parent_category_id === parentId);

  const previewSubs = subsText.split(",").map((s) => s.trim()).filter(Boolean);

  function submit() {
    const n = name.trim();
    if (!n) { setErr("Informe um nome."); return; }
    if (kind === "cat") {
      onSaveCat({ name: n, parentId: null, color, icon: iconName, subs: previewSubs });
    } else {
      if (!parentId) { setErr("Escolha uma categoria principal."); return; }
      onSaveSub(n, parentId);
    }
  }

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Head */}
        <div className="mdl-head">
          <span className="mh-ic">
            <CIcon name={kind === "cat" ? "folder" : "tag"} size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">{kind === "cat" ? "Nova categoria" : "Nova subcategoria"}</div>
            <div className="mh-sub">
              {kind === "cat"
                ? "Defina nome e visual. Você pode cadastrar subcategorias depois."
                : "Subcategorias detalham onde o dinheiro vai dentro de uma categoria."}
            </div>
          </div>
          <button className="mh-close" onClick={onClose} aria-label="Fechar">
            <CIcon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="mdl-body">
          {/* Kind toggle */}
          <div className="kind-toggle">
            <button className={kind === "cat" ? "on" : ""} onClick={() => setKind("cat")}>
              <CIcon name="folder" size={14} /> Categoria
            </button>
            <button className={kind === "sub" ? "on" : ""} onClick={() => setKind("sub")}>
              <CIcon name="tag" size={14} /> Subcategoria
            </button>
          </div>

          {/* Sub: choose parent */}
          {kind === "sub" && (
            <label className="fld">
              <span className="fld-label">Categoria principal</span>
              <select
                className="fld-select"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">Escolha uma categoria</option>
                {rootCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {parentCat && (
                <span className="fld-help">
                  {subsOfParent.length} subcategorias atuais
                </span>
              )}
            </label>
          )}

          {/* Name */}
          <label className="fld">
            <span className="fld-label">Nome</span>
            <input
              className="fld-input"
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              placeholder={kind === "cat" ? "Ex.: Pets, Filhos, Trabalho remoto…" : "Ex.: Ração, Veterinário…"}
            />
          </label>

          {/* Cat-only fields */}
          {kind === "cat" && (
            <>
              {/* Color */}
              <label className="fld">
                <span className="fld-label">Cor</span>
                <div className="swatch-row">
                  {CAT_PALETTE.map((p) => (
                    <button
                      key={p}
                      className={"swatch" + (color === p ? " on" : "")}
                      style={{ background: p }}
                      onClick={() => setColor(p)}
                      aria-label={p}
                    />
                  ))}
                </div>
              </label>

              {/* Icon */}
              <label className="fld">
                <span className="fld-label">Ícone</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CAT_ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setIconName(ic)}
                      style={{
                        width: 34, height: 34, borderRadius: 9,
                        display: "grid", placeItems: "center",
                        border: "1px solid " + (iconName === ic ? color : "var(--line)"),
                        background: iconName === ic ? color : "var(--card-2)",
                        color: iconName === ic ? "#fff" : "var(--ink-2)",
                        transition: "all .12s",
                      }}
                      aria-label={ic}
                    >
                      <CIcon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </label>

              {/* Initial subcategories */}
              <label className="fld">
                <span className="fld-label">Subcategorias iniciais (opcional)</span>
                <input
                  className="fld-input"
                  value={subsText}
                  onChange={(e) => setSubsText(e.target.value)}
                  placeholder="Separe por vírgula. Ex.: Ração, Veterinário, Banho"
                />
                <span className="fld-help">Você pode adicionar mais depois — sem limite.</span>
              </label>

              {/* Preview */}
              <div style={{
                padding: 12, borderRadius: 10, border: "1px dashed var(--line-strong)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span
                  className="cc-mark"
                  style={{ background: color, width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}
                >
                  <CIcon name={iconName} size={15} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 14 }}>
                    {name || "Pré-visualização"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    Categoria · {previewSubs.length} subcategorias
                  </div>
                </div>
              </div>
            </>
          )}

          {err && <div className="fld-error">{err}</div>}
        </div>

        {/* Footer */}
        <div className="mdl-foot">
          <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            Atalho: <span style={{ fontFamily: "var(--font-mono)", background: "var(--bg-sunken)", padding: "1px 6px", borderRadius: 5 }}>Esc</span> para fechar
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>
            <CIcon name="check" size={14} />
            {kind === "cat" ? "Cadastrar categoria" : "Cadastrar subcategoria"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category edit modal
// ---------------------------------------------------------------------------

interface EditModalProps {
  category: CategoryRead;
  categories: CategoryRead[];
  onClose: () => void;
  onSave: (payload: {
    id: string;
    name: string;
    parentId: string | null;
    color: string;
    icon: string;
  }) => void;
}

function EditCatModal({ category, categories, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(category.name);
  const [parentId, setParentId] = useState(category.parent_category_id ?? "");
  const [color, setColor] = useState(category.color ?? CAT_PALETTE[0]);
  const [iconName, setIconName] = useState(category.icon ?? "folder");
  const [err, setErr] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const isRoot = !category.parent_category_id;
  const rootCategories = categories.filter((c) => !c.parent_category_id && c.id !== category.id);

  function submit() {
    const n = name.trim();
    if (!n) { setErr("Informe um nome."); return; }
    onSave({ id: category.id, name: n, parentId: parentId || null, color, icon: iconName });
  }

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><CIcon name="edit" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">Editar categoria</div>
            <div className="mh-sub">{category.name}</div>
          </div>
          <button className="mh-close" onClick={onClose}><CIcon name="x" size={18} /></button>
        </div>
        <div className="mdl-body">
          <label className="fld">
            <span className="fld-label">Nome</span>
            <input
              className="fld-input"
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
            />
          </label>
          {!isRoot && (
            <label className="fld">
              <span className="fld-label">Categoria pai</span>
              <select className="fld-select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">Sem categoria pai (promover a principal)</option>
                {rootCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          {/* Color */}
          <label className="fld">
            <span className="fld-label">Cor</span>
            <div className="swatch-row">
              {CAT_PALETTE.map((p) => (
                <button
                  key={p}
                  className={"swatch" + (color === p ? " on" : "")}
                  style={{ background: p }}
                  onClick={() => setColor(p)}
                  aria-label={p}
                />
              ))}
            </div>
          </label>

          {/* Icon */}
          <label className="fld">
            <span className="fld-label">Ícone</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CAT_ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIconName(ic)}
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    display: "grid", placeItems: "center",
                    border: "1px solid " + (iconName === ic ? color : "var(--line)"),
                    background: iconName === ic ? color : "var(--card-2)",
                    color: iconName === ic ? "#fff" : "var(--ink-2)",
                    transition: "all .12s",
                  }}
                  aria-label={ic}
                >
                  <CIcon name={ic} size={16} />
                </button>
              ))}
            </div>
          </label>

          {err && <div className="fld-error">{err}</div>}
        </div>
        <div className="mdl-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>
            <CIcon name="check" size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards view
// ---------------------------------------------------------------------------

interface CatModel {
  cat: CategoryRead;
  subs: CategoryRead[];
}

function CatCardView({
  model,
  stats,
  onEdit,
  onDelete,
  onAddSub,
  onDetail,
  onViewTx,
}: {
  model: CatModel[];
  stats: Map<string, CatStats>;
  onEdit: (c: CategoryRead) => void;
  onDelete: (c: CategoryRead) => void;
  onAddSub: (parentId: string) => void;
  onDetail: (c: CategoryRead) => void;
  onViewTx: (c: CategoryRead) => void;
}) {
  return (
    <div className="cat-grid">
      {model.map(({ cat, subs }) => {
        const visibleSubs = subs.slice(0, 4);
        const overflow = subs.length - visibleSubs.length;
        const color = catColor(cat);
        const income = isIncomeCategory(cat.name);
        const st = stats.get(cat.id);

        return (
          <div key={cat.id} className="cat-card">
            <div className="cc-stripe" style={{ background: color }} />
            <div className="cc-body">
              <div className="cc-head">
                <div className="cc-mark" style={{ background: color }}>
                  <CIcon name={cat.icon ?? defaultCatIcon(cat.name)} size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cc-name">{cat.name}</div>
                  <div className="cc-meta">
                    {income ? "Receita" : "Despesa"} · {subs.length} subcategoria{subs.length !== 1 ? "s" : ""}
                    {st ? ` · ${st.count} lançamento${st.count !== 1 ? "s" : ""}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={() => onViewTx(cat)}
                    title="Ver transações desta categoria"
                  >
                    <CIcon name="search" size={13} />
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={() => onEdit(cat)}
                    title="Editar"
                  >
                    <CIcon name="edit" size={13} />
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    style={{ color: "var(--neg)" }}
                    onClick={() => onDelete(cat)}
                    title="Excluir"
                  >
                    <CIcon name="trash" size={13} />
                  </button>
                </div>
              </div>

              {/* Always render value + bar so cards stay consistent; zeroed when
                  the category has no activity in the selected period. */}
              <div className="cc-val">
                <span className="cur">R$ </span>{brlInt(st?.value ?? 0)}
                {st?.delta != null && (
                  <span style={{ marginLeft: 10, fontSize: 12 }}>
                    <DeltaPill value={st.delta} invert={!income} />
                  </span>
                )}
              </div>
              {!income && (
                <div className="track thin">
                  <div className="fill" style={{ width: `${st ? Math.min(100, (st.pct / 30) * 100) : 0}%`, background: color }} />
                </div>
              )}

              <div className="cc-subs">
                {visibleSubs.map((s) => (
                  <span key={s.id} className="sub-chip">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
                    {s.name}
                  </span>
                ))}
                {overflow > 0 && (
                  <button className="sub-chip more" onClick={() => onDetail(cat)}>+{overflow} mais</button>
                )}
                <button className="sub-chip add" onClick={() => onAddSub(cat.id)}>
                  <CIcon name="plus" size={11} /> subcategoria
                </button>
              </div>
            </div>

            <div className="cc-foot">
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
                {st?.lastDate ? `último uso · ${dateLabel(st.lastDate)}` : `criada em · ${dateLabel(cat.created_at)}`}
              </span>
              <button
                className="btn btn-quiet btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => onDetail(cat)}
              >
                Detalhar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree view
// ---------------------------------------------------------------------------

function TreeView({
  model,
  stats,
  subStats,
  onEdit,
  onDelete,
  onAddSub,
  onViewTx,
  expandId,
}: {
  model: CatModel[];
  stats: Map<string, CatStats>;
  subStats: Map<string, { value: number; count: number }>;
  onEdit: (c: CategoryRead) => void;
  onDelete: (c: CategoryRead) => void;
  onAddSub: (parentId: string) => void;
  onViewTx: (c: CategoryRead) => void;
  expandId?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Auto-expand the category requested via "Detalhar".
  useEffect(() => {
    if (expandId) setOpen((prev) => ({ ...prev, [expandId]: true }));
  }, [expandId]);

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const maxVal = Math.max(1, ...model.map(({ cat }) => stats.get(cat.id)?.value ?? 0));

  return (
    <div>
      {model.map(({ cat, subs }) => {
        const isOpen = !!open[cat.id];
        const color = catColor(cat);
        const st = stats.get(cat.id);

        return (
          <div key={cat.id} className="tree-group">
            <div
              className={"tree-head" + (isOpen ? " open" : "")}
              onClick={() => toggle(cat.id)}
            >
              <span className="tree-chev"><CIcon name="chevR" size={14} /></span>
              <span className="cc-mark" style={{ background: color, width: 28, height: 28, borderRadius: 8 }}>
                <CIcon name={cat.icon ?? defaultCatIcon(cat.name)} size={14} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="tree-name">{cat.name}</div>
                <div className="tree-meta">
                  {subs.length} subcategoria{subs.length !== 1 ? "s" : ""}
                  {st ? ` · ${st.count} lançamento${st.count !== 1 ? "s" : ""}` : ""}
                </div>
              </div>
              <div className="tree-bar-wrap">
                {st && (
                  <div className="track thin">
                    <div className="fill" style={{ width: `${(st.value / maxVal) * 100}%`, background: color }} />
                  </div>
                )}
              </div>
              <div className="tree-val">{st ? `R$ ${brlInt(st.value)}` : ""}</div>
              <div
                style={{ display: "flex", gap: 4 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="btn btn-quiet btn-sm" onClick={() => onViewTx(cat)} title="Ver transações desta categoria">
                  <CIcon name="search" size={13} />
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => onEdit(cat)} title="Editar">
                  <CIcon name="edit" size={13} />
                </button>
                <button
                  className="btn btn-quiet btn-sm"
                  style={{ color: "var(--neg)" }}
                  onClick={() => onDelete(cat)}
                  title="Excluir"
                >
                  <CIcon name="trash" size={13} />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="tree-body">
                {subs.length === 0 ? (
                  <div style={{ padding: "18px 16px 18px 50px", color: "var(--ink-3)", fontSize: 12.5 }}>
                    Nenhuma subcategoria cadastrada ainda.
                  </div>
                ) : (
                  subs.map((s) => {
                    const sst = subStats.get(`${cat.id}|${s.name.toLowerCase()}`);
                    const catVal = st?.value ?? 0;
                    return (
                      <div key={s.id} className="tree-sub">
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                        <span className="ts-name">{s.name}</span>
                        <div className="tree-bar-wrap">
                          <div className="track thin">
                            <div className="fill" style={{ width: `${catVal > 0 && sst ? Math.min(100, (sst.value / catVal) * 100) : 0}%`, background: color }} />
                          </div>
                        </div>
                        <span className="ts-count">{sst ? `${sst.count} lanç.` : "—"}</span>
                        <span className="ts-val">R$ {brlInt(sst?.value ?? 0)}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-quiet btn-sm" onClick={() => onEdit(s)} title="Editar">
                            <CIcon name="edit" size={12} />
                          </button>
                          <button
                            className="btn btn-quiet btn-sm"
                            style={{ color: "var(--neg)" }}
                            onClick={() => onDelete(s)}
                            title="Excluir"
                          >
                            <CIcon name="trash" size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <button className="tree-add" onClick={() => onAddSub(cat.id)}>
                  <CIcon name="plus" size={14} /> Adicionar subcategoria em {cat.name}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

function TableView({
  model,
  stats,
  subStats,
  onEdit,
  onDelete,
  onAddSub,
  onViewTx,
}: {
  model: CatModel[];
  stats: Map<string, CatStats>;
  subStats: Map<string, { value: number; count: number }>;
  onEdit: (c: CategoryRead) => void;
  onDelete: (c: CategoryRead) => void;
  onAddSub: (parentId: string) => void;
  onViewTx: (c: CategoryRead) => void;
}) {
  type Row = { cat: CategoryRead; sub: CategoryRead | null };
  const rows: Row[] = model.flatMap(({ cat, subs }): Row[] =>
    subs.length > 0
      ? subs.map((s) => ({ cat, sub: s as CategoryRead | null }))
      : [{ cat, sub: null }]
  );

  return (
    <div className="card">
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Tipo</th>
              <th className="num">Lançamentos</th>
              <th className="num">Valor no mês</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const color = catColor(r.cat);
              const income = isIncomeCategory(r.cat.name);
              const catSt = stats.get(r.cat.id);
              const subSt = r.sub ? subStats.get(`${r.cat.id}|${r.sub.name.toLowerCase()}`) : undefined;
              const count = r.sub ? subSt?.count : catSt?.count;
              const value = r.sub ? subSt?.value : catSt?.value;
              return (
                <tr key={idx}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                      <strong>{r.cat.name}</strong>
                    </span>
                  </td>
                  <td>
                    {r.sub ? (
                      <span style={{ color: "var(--ink-2)" }}>{r.sub.name}</span>
                    ) : (
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => onAddSub(r.cat.id)}
                      >
                        <CIcon name="plus" size={12} /> Adicionar
                      </button>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: income ? "var(--pos-soft)" : "var(--bg-sunken)",
                      color: income ? "var(--pos)" : "var(--ink-2)",
                    }}>
                      {income ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td className="num">{count ?? "—"}</td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {value != null ? `R$ ${brlInt(value)}` : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => onViewTx(r.sub ?? r.cat)}
                        title="Ver transações"
                      >
                        <CIcon name="search" size={13} />
                      </button>
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => onEdit(r.sub ?? r.cat)}
                        title="Editar"
                      >
                        <CIcon name="edit" size={13} />
                      </button>
                      <button
                        className="btn btn-quiet btn-sm"
                        style={{ color: "var(--neg)" }}
                        onClick={() => onDelete(r.sub ?? r.cat)}
                        title="Excluir"
                      >
                        <CIcon name="trash" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoriesPage
// ---------------------------------------------------------------------------

export function CategoriesPage({ session, period, onOpenImports, onOpenTransactions }: {
  session: ApiSession;
  period: PeriodState;
  onOpenImports?: () => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
}) {
  const hasTransactions = useHasTransactions(session);
  const queryClient = useQueryClient();
  const categories = useCategories(session);
  const allCats = categories.data?.items ?? [];

  const [view, setView] = useState<"cards" | "tree" | "table">("cards");
  const [dirFilter, setDirFilter] = useState<"all" | "expense" | "income">("all");
  const [q, setQ] = useState("");
  const [modalState, setModalState] = useState<CatModalState | null>(null);
  const [editingCat, setEditingCat] = useState<CategoryRead | null>(null);
  const [expandId, setExpandId] = useState<string | undefined>(undefined);

  const rootCats = allCats.filter((c) => !c.parent_category_id);
  const subCats = allCats.filter((c) => c.parent_category_id);

  // ── Per-category stats (value, share %, delta vs previous period) ─────────
  const rankingQuery = periodRankingQuery(period);
  const prevRankingQuery = previousPeriodRankingQuery(period);

  const rankQ = useQuery({
    queryKey: ["cat-rank", session.token, rankingQuery],
    queryFn: () => getCategoryRanking(session, rankingQuery),
    staleTime: 5 * 60 * 1000,
  });
  const prevRankQ = useQuery({
    queryKey: ["cat-rank-prev", session.token, prevRankingQuery],
    queryFn: () => getCategoryRanking(session, prevRankingQuery!),
    enabled: !!prevRankingQuery,
    staleTime: 5 * 60 * 1000,
  });
  const subRankQ = useQuery({
    queryKey: ["cat-subrank", session.token, rankingQuery],
    queryFn: () => getSubcategoryRanking(session, rankingQuery),
    staleTime: 5 * 60 * 1000,
  });

  // value/count per subcategory, keyed by "<parentId>|<subname lowercased>".
  const subStatsByCat = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const item of subRankQ.data?.items ?? []) {
      if (!item.category_id) continue;
      const key = `${item.category_id}|${item.subcategory_name.toLowerCase()}`;
      map.set(key, { value: parseFloat(item.amount ?? "0"), count: item.count });
    }
    return map;
  }, [subRankQ.data]);

  const statsByCat = useMemo(() => {
    const prev = new Map((prevRankQ.data?.items ?? []).map((i) => [i.category_id, i]));
    const map = new Map<string, CatStats>();
    for (const item of rankQ.data?.items ?? []) {
      if (!item.category_id) continue;
      const value = parseFloat(item.amount ?? "0");
      const pct = item.share_ratio ? parseFloat(item.share_ratio) * 100 : 0;
      const prevItem = prev.get(item.category_id);
      const prevValue = prevItem ? parseFloat(prevItem.amount ?? "0") : 0;
      const delta = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null;
      map.set(item.category_id, { value, pct, count: item.count, delta, lastDate: item.last_transaction_date });
    }
    return map;
  }, [rankQ.data, prevRankQ.data]);

  // Highest-spending expense category in the reference month, for the KPI.
  const topCat = useMemo(() => {
    let best: { cat: CategoryRead; st: CatStats } | null = null;
    for (const cat of rootCats) {
      if (isIncomeCategory(cat.name)) continue;
      const st = statsByCat.get(cat.id);
      if (!st) continue;
      if (!best || st.value > best.st.value) best = { cat, st };
    }
    return best;
  }, [rootCats, statsByCat]);

  // Build model: root cats with their subs
  const fullModel = useMemo<CatModel[]>(() => {
    return rootCats.map((cat) => ({
      cat,
      subs: allCats.filter((c) => c.parent_category_id === cat.id),
    }));
  }, [allCats, rootCats]);

  const filteredModel = useMemo<CatModel[]>(() => {
    return fullModel.filter(({ cat, subs }) => {
      if (dirFilter === "income" && !isIncomeCategory(cat.name)) return false;
      if (dirFilter === "expense" && isIncomeCategory(cat.name)) return false;
      if (!q) return true;
      const ql = q.toLowerCase();
      return (
        cat.name.toLowerCase().includes(ql) ||
        subs.some((s) => s.name.toLowerCase().includes(ql))
      );
    });
  }, [fullModel, dirFilter, q]);

  const create = useMutation({
    mutationFn: async (payload: { name: string; parentId: string | null; color?: string; icon?: string; subs?: string[] }) => {
      const parent = await createCategory(session, payload.name, payload.parentId, { color: payload.color, icon: payload.icon });
      // Create any initial subcategories under the new category.
      for (const subName of payload.subs ?? []) {
        await createCategory(session, subName, parent.id, { color: payload.color });
      }
      return parent;
    },
    onSuccess: () => {
      setModalState(null);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const update = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      parentId: string | null;
      color?: string;
      icon?: string;
    }) =>
      updateCategory(session, payload.id, {
        name: payload.name,
        parent_category_id: payload.parentId,
        color: payload.color,
        icon: payload.icon,
      }),
    onSuccess: () => {
      setEditingCat(null);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (cat: CategoryRead) => {
      // Cascade: remove the category's subcategories first, then the category.
      const subs = allCats.filter((c) => c.parent_category_id === cat.id);
      for (const sub of subs) {
        await deleteCategory(session, sub.id);
      }
      await deleteCategory(session, cat.id);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      window.alert(`Não foi possível excluir: ${apiErrorMessage(err, "tente novamente.")}`);
    },
  });

  function handleAddSub(parentId: string) {
    setModalState({ kind: "sub", parentId });
  }

  // "Detalhar" jumps to the tree view, filtered to this category and expanded.
  function handleDetail(cat: CategoryRead) {
    setView("tree");
    setQ(cat.name);
    setExpandId(cat.id);
  }

  // Lupa: open the transactions page filtered to this category and period.
  function handleViewTransactions(cat: CategoryRead) {
    onOpenTransactions({
      categoryId: cat.id,
      label: cat.name,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      periodPreset: period.periodPreset,
    });
  }

  function handleDelete(cat: CategoryRead) {
    const subCount = allCats.filter((c) => c.parent_category_id === cat.id).length;
    const extra = subCount > 0
      ? ` e suas ${subCount} subcategoria${subCount !== 1 ? "s" : ""}`
      : "";
    if (window.confirm(`Excluir "${cat.name}"${extra}? Esta ação não pode ser desfeita.`)) {
      remove.mutate(cat);
    }
  }

  if (hasTransactions === false) {
    return (
      <NoDataOnboarding
        icon={Tags}
        eyebrow="Categorias"
        title="Suas categorias ganham vida com os lançamentos"
        description="O SmartCashFlow classifica automaticamente cada transação em categorias e mostra para onde vai o seu dinheiro. Importe seus extratos para ver a distribuição por categoria e ajustar as regras."
        onImport={onOpenImports}
      />
    );
  }

  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="ttl" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Categorias e Subcategorias</h1>
          <p className="sub" style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
            Organize seus lançamentos por categoria principal e subcategoria.
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onOpenTransactions({ dateFrom: period.dateFrom, dateTo: period.dateTo, periodPreset: period.periodPreset })}
          >
            <CIcon name="list" size={14} /> Ver lançamentos
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModalState({ kind: "cat" })}>
            <CIcon name="plus" size={15} /> Nova categoria
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic"><CIcon name="folder" size={16} /></span>
            <span className="kpi-label">Categorias</span>
          </div>
          <div className="kpi-val">{rootCats.length}</div>
          <div className="kpi-sub">
            {subCats.length === 0 ? "nenhuma subcategoria" : `${subCats.length} subcategoria${subCats.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic"><CIcon name="tag" size={16} /></span>
            <span className="kpi-label">Subcategorias</span>
          </div>
          <div className="kpi-val">{subCats.length}</div>
          <div className="kpi-sub">
            média de {rootCats.length > 0 ? (subCats.length / rootCats.length).toFixed(1) : "0"} por categoria
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><CIcon name="arrowUR" size={16} /></span>
            <span className="kpi-label">Maior do mês</span>
          </div>
          <div className="kpi-val" style={{ fontSize: 18 }}>
            {topCat ? topCat.cat.name : "—"}
          </div>
          <div className="kpi-sub">
            {topCat ? `R$ ${brlInt(topCat.st.value)} · ${topCat.st.pct.toFixed(1)}%` : "categoria principal"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ic" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}><CIcon name="alert" size={16} /></span>
            <span className="kpi-label">Sem categoria</span>
          </div>
          <div className="kpi-val">0</div>
          <div className="kpi-sub">tudo classificado</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", flexWrap: "wrap" }}>
          <div className="seg">
            {(["cards", "tree", "table"] as const).map((v) => (
              <button
                key={v}
                className={view === v ? "on" : ""}
                onClick={() => setView(v)}
              >
                {v === "cards" ? "Visão geral" : v === "tree" ? "Hierarquia" : "Lista"}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: "var(--line)" }} />
          <div className="seg">
            {([
              ["all", "Todas"],
              ["expense", "Despesas"],
              ["income", "Receitas"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                className={dirFilter === val ? "on" : ""}
                onClick={() => setDirFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", marginLeft: "auto", minWidth: 220 }}>
            <span style={{ position: "absolute", left: 11, top: 9, color: "var(--ink-faint)", pointerEvents: "none" }}>
              <CIcon name="search" size={15} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar categoria ou subcategoria…"
              style={{ width: "100%", padding: "8px 12px 8px 34px", borderRadius: 9, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" }}
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {categories.isLoading && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--ink-3)" }}>Carregando categorias…</div>
      )}

      {/* Views */}
      {!categories.isLoading && filteredModel.length > 0 && view === "cards" && (
        <CatCardView
          model={filteredModel}
          stats={statsByCat}
          onEdit={setEditingCat}
          onDelete={handleDelete}
          onAddSub={handleAddSub}
          onDetail={handleDetail}
          onViewTx={handleViewTransactions}
        />
      )}
      {!categories.isLoading && filteredModel.length > 0 && view === "tree" && (
        <TreeView
          model={filteredModel}
          stats={statsByCat}
          subStats={subStatsByCat}
          onEdit={setEditingCat}
          onDelete={handleDelete}
          onAddSub={handleAddSub}
          onViewTx={handleViewTransactions}
          expandId={expandId}
        />
      )}
      {!categories.isLoading && filteredModel.length > 0 && view === "table" && (
        <TableView
          model={filteredModel}
          stats={statsByCat}
          subStats={subStatsByCat}
          onEdit={setEditingCat}
          onDelete={handleDelete}
          onAddSub={handleAddSub}
          onViewTx={handleViewTransactions}
        />
      )}

      {/* Empty state */}
      {!categories.isLoading && filteredModel.length === 0 && (
        <div className="card card-pad" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ marginBottom: 8, color: "var(--ink-faint)" }}><CIcon name="search" size={32} /></div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma categoria encontrada</div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {q ? "Ajuste os filtros ou a busca." : "Cadastre sua primeira categoria clicando em \"Nova categoria\"."}
          </div>
        </div>
      )}

      {/* Info alert */}
      <div className="alert info" style={{ marginTop: 18 }}>
        <span className="alert-ic"><CIcon name="info" size={17} /></span>
        <div>
          <div className="a-ttl">Como o SmartCashFlow usa categorias</div>
          <div className="a-txt">
            Cada transação importada é classificada automaticamente quando o padrão de descrição já é conhecido.
            Você pode criar quantas categorias e subcategorias quiser — elas alimentam Orçamentos, Relatórios e o Copilot.
          </div>
        </div>
      </div>

      {/* New category / subcategory modal */}
      {modalState && (
        <CatModal
          state={modalState}
          categories={allCats}
          onClose={() => setModalState(null)}
          onSaveCat={(payload) => create.mutate(payload)}
          onSaveSub={(name, parentId) => create.mutate({ name, parentId })}
        />
      )}

      {/* Edit modal */}
      {editingCat && (
        <EditCatModal
          category={editingCat}
          categories={allCats}
          onClose={() => setEditingCat(null)}
          onSave={(payload) => update.mutate(payload)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RulesPage
// ---------------------------------------------------------------------------

function RulePreviewDrawer({
  rule,
  preview,
  categories,
  loading,
  onClose,
}: {
  rule: CategorizationRuleRead;
  preview?: RulePreview;
  categories: CategoryRead[];
  loading: boolean;
  onClose: () => void;
}) {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  return (
    <Drawer title={`Prévia: ${rule.name}`} onClose={onClose}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--ink-3)" }}>Carregando prévia…</div>
      ) : null}
      {preview ? (
        <div className="preview-stack">
          <div className="preview-summary">
            <QualityRow label="Encontradas" value={preview.total_count} />
            <QualityRow label="Serão alteradas" value={preview.change_count} />
            <QualityRow label="Categorias" value={preview.category_change_count} />
            <QualityRow label="Tipos financeiros" value={preview.direction_change_count} />
            <QualityRow label="Manuais preservadas" value={preview.skipped_manual_count} />
          </div>
          {preview.items.length ? (
            <div className="preview-list">
              {preview.items.map((item) => (
                <div className="preview-item" key={item.transaction_id}>
                  <div>
                    <strong>{item.description}</strong>
                    <small>{dateLabel(item.transaction_date)} · {moneyAbs(item.amount)}</small>
                  </div>
                  <div className="preview-actions">
                    <span>
                      {item.current_direction}
                      {item.target_direction ? ` -> ${directionLabel(item.target_direction)}` : ""}
                    </span>
                    <span>
                      {item.current_category_id
                        ? categoryNames.get(item.current_category_id) ?? "Categoria atual"
                        : "Sem categoria"}
                      {item.target_category_id
                        ? ` -> ${categoryNames.get(item.target_category_id) ?? "Categoria alvo"}`
                        : ""}
                    </span>
                    {item.skipped_manual_category ? <StatusBadge status="manual" /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInline message="Nenhuma transação encontrada para esta regra." />
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

// Rule form modal
function RuleFormModal({
  form,
  setForm,
  categoryOptions,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  form: RuleFormState;
  setForm: (f: RuleFormState) => void;
  categoryOptions: { id: string; label: string }[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const isRecurring = form.match_type === "amount_recurring";

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdl-head">
          <span className="mh-ic"><CIcon name="zap" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="mh-ttl">{form.id ? "Editar regra" : "Nova regra"}</div>
            <div className="mh-sub">Defina o padrão de texto que aciona a regra.</div>
          </div>
          <button className="mh-close" onClick={onClose}><CIcon name="x" size={18} /></button>
        </div>

        <div className="mdl-body">
          <label className="fld">
            <span className="fld-label">Nome</span>
            <input
              className="fld-input"
              autoFocus
              placeholder="Ex: Delivery"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Campo</span>
              <select className="fld-select" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                <option value="description">Descrição normalizada</option>
                <option value="raw_description">Descrição original</option>
                <option value="source_name">Origem</option>
              </select>
            </label>
            <label className="fld">
              <span className="fld-label">Tipo de match</span>
              <select className="fld-select" value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value })}>
                <option value="contains">Contém</option>
                <option value="starts_with">Começa com</option>
                <option value="equals">Igual</option>
                <option value="regex">Regex (avançado)</option>
                <option value="amount_recurring">Valor recorrente</option>
              </select>
            </label>
          </div>

          {isRecurring ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="fld">
                  <span className="fld-label">Valor de referência</span>
                  <input
                    className="fld-input"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 49.90"
                    value={form.amount_ref}
                    onChange={(e) => setForm({ ...form, amount_ref: e.target.value })}
                  />
                </label>
                <label className="fld">
                  <span className="fld-label">Tolerância (±)</span>
                  <input
                    className="fld-input"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1.00"
                    value={form.amount_tolerance}
                    onChange={(e) => setForm({ ...form, amount_tolerance: e.target.value })}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label className="fld">
                  <span className="fld-label">Dia do mês (de)</span>
                  <input
                    className="fld-input"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1"
                    value={form.day_min}
                    onChange={(e) => setForm({ ...form, day_min: e.target.value })}
                  />
                </label>
                <label className="fld">
                  <span className="fld-label">Dia do mês (até)</span>
                  <input
                    className="fld-input"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="31"
                    value={form.day_max}
                    onChange={(e) => setForm({ ...form, day_max: e.target.value })}
                  />
                </label>
                <label className="fld">
                  <span className="fld-label">Só esta direção</span>
                  <select className="fld-select" value={form.direction_filter} onChange={(e) => setForm({ ...form, direction_filter: e.target.value })}>
                    <option value="">Qualquer</option>
                    <option value="debit">Despesa</option>
                    <option value="credit">Receita</option>
                    <option value="payment">Pagamento de fatura</option>
                  </select>
                </label>
              </div>
              <label className="fld">
                <span className="fld-label">Descrição contém (opcional)</span>
                <input
                  className="fld-input"
                  placeholder="Ex: TIT  (deixe vazio p/ casar só pelo valor)"
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                />
              </label>
              <p className="t-sub" style={{ margin: "-2px 0 0", fontSize: 12, lineHeight: 1.5 }}>
                Casa lançamentos com valor próximo ao de referência (dentro da tolerância) que caem na <strong>janela de dias</strong> — use a janela para absorver o pagamento que cai em fim de semana/feriado e vai para o próximo dia útil (ex.: dia 8 a 12). O texto da descrição é um filtro extra para distinguir cobranças de mesmo valor (ex.: <strong>TIT</strong> do colégio vs. fatura do cartão).
              </p>
            </>
          ) : (
            <label className="fld">
              <span className="fld-label">Padrão</span>
              <input
                className="fld-input"
                placeholder={form.match_type === "regex" ? "Ex: ^uber\\s" : "Ex: IFOOD"}
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              />
              {form.match_type === "regex" && (
                <span className="t-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
                  Expressão regular aplicada sobre o campo escolhido (case-insensitive).
                </span>
              )}
            </label>
          )}

          <label className="fld">
            <span className="fld-label">Categoria</span>
            <select className="fld-select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Não alterar categoria</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Direção</span>
              <select className="fld-select" value={form.target_direction} onChange={(e) => setForm({ ...form, target_direction: e.target.value })}>
                <option value="">Não alterar</option>
                <option value="payment">Pagamento de fatura</option>
                <option value="debit">Despesa</option>
                <option value="credit">Receita</option>
              </select>
            </label>
            <label className="fld">
              <span className="fld-label">Prioridade</span>
              <input
                className="fld-input"
                type="number"
                min={1}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Regra ativa</span>
          </label>

          {error && <div className="fld-error">{error}</div>}
        </div>

        <div className="mdl-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={saving} onClick={onSubmit}>
            <CIcon name="check" size={14} />
            {saving ? "Salvando…" : form.id ? "Salvar" : "Criar regra"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RulesPage({ session, embedded = false }: { session: ApiSession; embedded?: boolean }) {
  const queryClient = useQueryClient();
  const categories = useCategories(session);
  const [tab, setTab] = useState<"rules" | "merchants" | "aliases">("rules");
  const [ruleSearch, setRuleSearch] = useState("");
  const [rulePage, setRulePage] = useState(0);
  const [rulePageSize, setRulePageSize] = useState(10);
  const dataQuality = useQuery({
    queryKey: ["data-quality-rules", session.token],
    queryFn: () => getDataQuality(session, ""),
  });
  const categoryOptions = useMemo(
    () => orderedCategoryOptions(categories.data?.items ?? []),
    [categories.data?.items]
  );
  const rules = useQuery({
    queryKey: ["rules", session.token],
    queryFn: () => getRules(session),
  });
  const [form, setForm] = useState<RuleFormState>(emptyRuleForm);
  const [ruleFormError, setRuleFormError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [previewRule, setPreviewRule] = useState<CategorizationRuleRead | null>(null);
  const preview = useQuery({
    queryKey: ["rule-preview", session.token, previewRule?.id],
    queryFn: () => getRulePreview(session, previewRule?.id ?? ""),
    enabled: Boolean(previewRule),
  });

  const isRecurring = form.match_type === "amount_recurring";
  const rulePayload = {
    name: form.name,
    field: form.field,
    match_type: form.match_type,
    // For recurring rules the pattern is an optional extra text filter.
    pattern: form.pattern,
    category_id: form.category_id || null,
    target_direction: form.target_direction || null,
    priority: form.priority,
    active: form.active,
    // amount_recurring fields — only meaningful for that match type
    amount_ref: isRecurring && form.amount_ref !== "" ? form.amount_ref : null,
    amount_tolerance: isRecurring && form.amount_tolerance !== "" ? form.amount_tolerance : null,
    day_min: isRecurring && form.day_min !== "" ? Number(form.day_min) : null,
    day_max: isRecurring && form.day_max !== "" ? Number(form.day_max) : null,
    direction_filter: isRecurring && form.direction_filter ? form.direction_filter : null,
  };

  const create = useMutation({
    mutationFn: () => createRule(session, rulePayload),
    onSuccess: () => {
      setForm(emptyRuleForm);
      setRuleFormError("");
      setShowModal(false);
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
  const update = useMutation({
    mutationFn: () => updateRule(session, form.id ?? "", rulePayload),
    onSuccess: () => {
      setForm(emptyRuleForm);
      setRuleFormError("");
      setShowModal(false);
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
      if (previewRule?.id === form.id) {
        void queryClient.invalidateQueries({ queryKey: ["rule-preview", session.token, form.id] });
      }
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRule(session, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
  });
  const apply = useMutation({
    mutationFn: () => applyRules(session),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
  const categorize = useMutation({
    mutationFn: () => categorizePending(session),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality-rules"] });
    },
  });

  const saving = create.isPending || update.isPending;
  const ruleItems = rules.data?.items ?? [];
  const activeRuleCount = ruleItems.filter((r) => r.active).length;
  const dq = dataQuality.data;
  const autoPct = dq && dq.transaction_count > 0
    ? Math.round((dq.categorized_count / dq.transaction_count) * 100)
    : null;
  const ruleQuery = ruleSearch.trim().toLowerCase();
  const filteredRules = ruleQuery
    ? ruleItems.filter((r) =>
        r.name.toLowerCase().includes(ruleQuery) ||
        r.pattern.toLowerCase().includes(ruleQuery))
    : ruleItems;
  const rulePageCount = Math.max(1, Math.ceil(filteredRules.length / rulePageSize));
  const safeRulePage = Math.min(rulePage, rulePageCount - 1);
  const pagedRules = filteredRules.slice(
    safeRulePage * rulePageSize,
    safeRulePage * rulePageSize + rulePageSize,
  );
  const ruleFrom = filteredRules.length === 0 ? 0 : safeRulePage * rulePageSize + 1;
  const ruleTo = safeRulePage * rulePageSize + pagedRules.length;

  function validateRuleForm() {
    const recurring = form.match_type === "amount_recurring";
    const missing = [
      !form.name.trim() ? "nome" : "",
      !recurring && !form.pattern.trim() ? "padrão" : "",
      recurring && form.amount_ref.trim() === "" ? "valor de referência" : "",
      !form.category_id && !form.target_direction ? "ação da regra" : "",
      !form.priority || form.priority < 1 ? "prioridade" : "",
    ].filter(Boolean);
    if (missing.length) {
      setRuleFormError(`Preencha: ${missing.join(", ")}.`);
      return false;
    }
    setRuleFormError("");
    return true;
  }

  function editRule(rule: CategorizationRuleRead) {
    setForm({
      id: rule.id,
      name: rule.name,
      field: rule.field,
      match_type: rule.match_type,
      pattern: rule.pattern,
      category_id: rule.category_id ?? "",
      target_direction: rule.target_direction ?? "",
      priority: rule.priority,
      active: rule.active,
      amount_ref: rule.amount_ref != null ? String(rule.amount_ref) : "",
      amount_tolerance: rule.amount_tolerance != null ? String(rule.amount_tolerance) : "",
      day_min: rule.day_min != null ? String(rule.day_min) : "",
      day_max: rule.day_max != null ? String(rule.day_max) : "",
      direction_filter: rule.direction_filter ?? "",
    });
    setRuleFormError("");
    setShowModal(true);
  }

  function handleSubmit() {
    if (!validateRuleForm()) return;
    if (form.id) update.mutate();
    else create.mutate();
  }

  const content = (
    <>
      {!embedded && (
        <div style={{ marginBottom: 18 }}>
          <h1 className="ttl" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Regras e Normalização</h1>
          <p className="sub" style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
            Automatize a classificação de transações por padrão de texto.
          </p>
        </div>
      )}

      {/* KPIs do motor de regras */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic"><CIcon name="zap" size={15} /></div><span className="kpi-label">Regras ativas</span></div>
          <div className="kpi-val">{activeRuleCount}</div>
          <div className="kpi-sub">de {ruleItems.length} cadastradas</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}><CIcon name="spark" size={15} /></div><span className="kpi-label">Auto-classificados</span></div>
          <div className="kpi-val">{autoPct != null ? `${autoPct}%` : "—"}</div>
          <div className="kpi-sub">{dq ? `${dq.categorized_count} de ${dq.transaction_count} lanç.` : "calculando…"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}><CIcon name="check" size={15} /></div><span className="kpi-label">Categorizadas</span></div>
          <div className="kpi-val">{dq ? dq.categorized_count : "—"}</div>
          <div className="kpi-sub">com categoria definida</div>
        </div>
        <button className="kpi" style={{ textAlign: "left" }} type="button" onClick={() => apply.mutate()} disabled={apply.isPending}>
          <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><CIcon name="alert" size={15} /></div><span className="kpi-label">Sem categoria</span></div>
          <div className="kpi-val">{dq ? dq.uncategorized_count : "—"}</div>
          <div className="kpi-sub">{apply.isPending ? "aplicando regras…" : "aguardam revisão"}</div>
        </button>
      </div>

      {/* Info alert */}
      <div className="alert info" style={{ marginBottom: 16 }}>
        <span className="alert-ic"><CIcon name="info" size={17} /></span>
        <div>
          <div className="a-ttl">Sobre as regras de categorização</div>
          <div className="a-txt">
            As regras são aplicadas na ordem de prioridade. Números menores têm maior prioridade.
            Transações classificadas manualmente não são sobrescritas.
          </div>
        </div>
      </div>

      {/* Apply feedback */}
      {apply.data && (
        <InlineSuccess
          message={`${apply.data.applied_count} transações alteradas: ${apply.data.category_applied_count} categorias e ${apply.data.direction_applied_count} tipos financeiros.`}
        />
      )}
      {apply.isError && (
        <InlineError message={apiErrorMessage(apply.error, "Falha ao aplicar regras.")} />
      )}
      {categorize.data && (
        <InlineSuccess
          message={`${categorize.data.total_applied} pendentes categorizadas: ${categorize.data.trgm_applied} por memória (similaridade) e ${categorize.data.llm_applied} por IA. Alta confiança já entrou; o restante ficou como sugestão para revisar.`}
        />
      )}
      {categorize.isError && (
        <InlineError message={apiErrorMessage(categorize.error, "Falha ao categorizar pendentes.")} />
      )}

      {/* Tabbed card: Regras / Normalização / Apelidos */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="seg">
            <button className={tab === "rules" ? "on" : ""} onClick={() => setTab("rules")}>Regras</button>
            <button className={tab === "merchants" ? "on" : ""} onClick={() => setTab("merchants")}>Normalização de Merchants</button>
            <button className={tab === "aliases" ? "on" : ""} onClick={() => setTab("aliases")}>Apelidos / Alias</button>
          </div>
          <span style={{ flex: 1 }} />
          {tab === "rules" && (
            <>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)", pointerEvents: "none", display: "inline-flex" }}>
                  <CIcon name="search" size={14} />
                </span>
                <input
                  placeholder="Buscar regra ou padrão…"
                  value={ruleSearch}
                  onChange={(e) => { setRuleSearch(e.target.value); setRulePage(0); }}
                  style={{ width: 210, padding: "7px 10px 7px 32px", borderRadius: 9, border: "1px solid var(--line)", fontSize: 12.5, background: "var(--card-2)", color: "var(--ink)" }}
                />
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => apply.mutate()}
                disabled={apply.isPending}
                title="Reaplica suas regras atuais em todas as transações (não mexe no que você categorizou na mão)."
              >
                <CIcon name="refresh" size={14} />
                {apply.isPending ? "Aplicando…" : "Aplicar regras"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => categorize.mutate()}
                disabled={categorize.isPending}
                title="Para o que as regras não pegaram: usa memória (similaridade) e IA. Alta confiança entra direto; o resto fica como sugestão para revisar."
              >
                <CIcon name="zap" size={14} />
                {categorize.isPending ? "Categorizando…" : "Categorizar pendentes"}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setForm(emptyRuleForm); setRuleFormError(""); setShowModal(true); }}
              >
                <CIcon name="plus" size={15} /> Nova regra
              </button>
            </>
          )}
        </div>
        {tab === "rules" && (rules.isLoading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--ink-3)" }}>Carregando regras…</div>
        ) : ruleItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ color: "var(--ink-faint)", marginBottom: 8 }}><CIcon name="zap" size={32} /></div>
            <div style={{ fontWeight: 600 }}>Nenhuma regra criada</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
              Clique em "Nova regra" para automatizar a categorização.
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ color: "var(--ink-faint)", marginBottom: 8 }}><CIcon name="search" size={32} /></div>
            <div style={{ fontWeight: 600 }}>Nenhuma regra encontrada</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
              Nenhuma regra corresponde a “{ruleSearch}”.
            </div>
          </div>
        ) : (
          <>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Prioridade</th>
                  <th>Nome</th>
                  <th>Condição</th>
                  <th>Categoria</th>
                  <th>Direção</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedRules.map((rule) => {
                  const category = (categories.data?.items ?? []).find(
                    (item) => item.id === rule.category_id
                  );
                  return (
                    <tr key={rule.id}>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: 8, background: "var(--bg-sunken)",
                          fontWeight: 700, fontSize: 12, fontFamily: "var(--font-mono)",
                        }}>
                          {rule.priority}
                        </span>
                      </td>
                      <td><strong>{rule.name}</strong></td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap", fontSize: 12 }}>
                          <span style={{ color: "var(--ink-3)" }}>{ruleFieldLabel(rule.field)}</span>
                          <strong style={{ color: "var(--acc)" }}>{ruleMatchLabel(rule.match_type)}</strong>
                          <code style={{ background: "var(--bg-sunken)", padding: "1px 6px", borderRadius: 5, fontSize: 11.5 }}>
                            {rule.pattern}
                          </code>
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                          {rule.category_id
                            ? category
                              ? categoryPath(category, categories.data?.items ?? [])
                              : "Categoria removida"
                            : "—"}
                        </span>
                      </td>
                      <td>
                        {rule.target_direction ? (
                          <DirectionBadge direction={rule.target_direction} />
                        ) : "—"}
                      </td>
                      <td>
                        {rule.active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-quiet btn-sm"
                            onClick={() => setPreviewRule(rule)}
                            title="Pré-visualizar"
                          >
                            <CIcon name="search" size={13} />
                          </button>
                          <button
                            className="btn btn-quiet btn-sm"
                            onClick={() => editRule(rule)}
                            title="Editar"
                          >
                            <CIcon name="edit" size={13} />
                          </button>
                          <button
                            className="btn btn-quiet btn-sm"
                            style={{ color: "var(--neg)" }}
                            onClick={() => {
                              if (window.confirm(`Excluir a regra "${rule.name}"? Esta ação não pode ser desfeita.`)) {
                                remove.mutate(rule.id);
                              }
                            }}
                            title="Excluir"
                          >
                            <CIcon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Paginação */}
          <div style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--ink-3)", flexWrap: "wrap", gap: 8 }}>
            Mostrando <b style={{ margin: "0 4px", color: "var(--ink-2)" }}>{ruleFrom}–{ruleTo}</b> de {filteredRules.length} regra{filteredRules.length === 1 ? "" : "s"}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={safeRulePage === 0}
                onClick={() => setRulePage((c) => Math.max(c - 1, 0))}
                type="button"
                title="Anterior"
              >
                <CIcon name="chevL" size={13} />
              </button>
              <span>Página {safeRulePage + 1} de {rulePageCount}</span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={safeRulePage >= rulePageCount - 1}
                onClick={() => setRulePage((c) => Math.min(c + 1, rulePageCount - 1))}
                type="button"
                title="Próxima"
              >
                <CIcon name="chevR" size={13} />
              </button>
              <select
                value={rulePageSize}
                onChange={(e) => { setRulePageSize(Number(e.target.value)); setRulePage(0); }}
                className="cat-select"
                style={{ padding: "4px 8px" }}
              >
                <option value={10}>10 / pág</option>
                <option value={25}>25 / pág</option>
                <option value={50}>50 / pág</option>
              </select>
            </div>
          </div>
          </>
        ))}

        {tab === "merchants" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ color: "var(--ink-faint)", marginBottom: 8 }}><CIcon name="spark" size={32} /></div>
            <div style={{ fontWeight: 600 }}>Normalização de Merchants</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4, maxWidth: 440, marginInline: "auto" }}>
              A normalização de descrições (ex.: “IFOOD *PIZZARIA NAPOLI” → “iFood — Pizzaria Napoli”)
              já é aplicada automaticamente nas importações. O gerenciamento manual de padrões chega em breve.
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => apply.mutate()} disabled={apply.isPending}>
              <CIcon name="refresh" size={14} /> Reprocessar agora
            </button>
          </div>
        )}

        {tab === "aliases" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ color: "var(--ink-faint)", marginBottom: 8 }}><CIcon name="tag" size={32} /></div>
            <div style={{ fontWeight: 600 }}>Apelidos / Alias</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4, maxWidth: 440, marginInline: "auto" }}>
              Apelidos para instituições e estabelecimentos (ex.: “BANCO ITAU SA” → “Itaú”)
              estarão disponíveis em breve.
            </div>
          </div>
        )}
      </div>

      {/* Como aplicamos as regras */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="kpi-ic"><CIcon name="info" size={15} /></span>
          <span className="ttl">Como aplicamos as regras</span>
        </div>
        <div style={{ padding: "4px 18px 16px" }}>
          <div className="pref-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Aplicar regras em importações</div>
              <div className="t-sub" style={{ marginTop: 2 }}>Classifica automaticamente os arquivos novos ao importar.</div>
            </div>
            <span className="badge b-pos">Ativo</span>
          </div>
          <div className="pref-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Normalização de descrição (merchants)</div>
              <div className="t-sub" style={{ marginTop: 2 }}>Limpa as descrições antes de aplicar as regras.</div>
            </div>
            <span className="badge b-pos">Ativo</span>
          </div>
          <div className="pref-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Reprocessar transações antigas</div>
              <div className="t-sub" style={{ marginTop: 2 }}>Reaplica as regras a todo o histórico (não sobrescreve ajustes manuais).</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? "Aplicando…" : "Aplicar agora"}
            </button>
          </div>
        </div>
      </div>

      {/* Rule form modal */}
      {showModal && (
        <RuleFormModal
          form={form}
          setForm={setForm}
          categoryOptions={categoryOptions}
          saving={saving}
          error={ruleFormError}
          onClose={() => { setShowModal(false); setForm(emptyRuleForm); setRuleFormError(""); }}
          onSubmit={handleSubmit}
        />
      )}

      {/* Preview drawer */}
      {previewRule && (
        <RulePreviewDrawer
          categories={categories.data?.items ?? []}
          loading={preview.isLoading}
          onClose={() => setPreviewRule(null)}
          preview={preview.data}
          rule={previewRule}
        />
      )}
    </>
  );

  if (embedded) return content;
  return <div className="canvas stg">{content}</div>;
}

// ---------------------------------------------------------------------------
// ReviewPage
// ---------------------------------------------------------------------------

export function ReviewPage({ session }: { session: ApiSession }) {
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  return (
    <div className="canvas stg">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="ttl" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Revisão de Transações
        </h1>
        <p className="sub" style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
          Transações sem categoria atribuída que precisam de revisão.
        </p>
      </div>
      <TransactionExplorer
        session={session}
        fixedQuery="category_id=__uncategorized__"
        onSelect={setSelected}
        selected={selected}
        reviewMode
      />
    </div>
  );
}
