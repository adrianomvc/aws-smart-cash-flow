import { useEffect, useState } from "react";

import { CATEGORY_HEX_PALETTE } from "../lib/utils";
import type { CategoryRead } from "../lib/api";

// ---------------------------------------------------------------------------
// SVG Icons (shared category icon set)
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
  // Extra category icons (pets, restaurante, presente, celular, roupas, etc.)
  paw:      "M8.5 8m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M12 6.3m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M15.5 8m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M12 16m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0",
  utensils: "M6 3v4 M9 3v4 M12 3v4 M6 7h6 M9 7v14 M17 3v18 M15 11c0-3 0-6 2-8",
  gift:     "M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  phone:    "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2",
  shirt:    "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z",
  dumbbell: "M4 9v6 M7 7v10 M7 12h10 M17 7v10 M20 9v6",
  heart:    "M12 21C7 17 3 13.5 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5c0 5-4 8.5-9 12.5z",
  fuel:     "M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18 M3 22h12 M5 9h8 M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3",
  coffee:   "M5 8h11a4 4 0 0 1 0 8h-1 M5 8v8a4 4 0 0 0 4 4h3a4 4 0 0 0 4-4V8z M8 2v3 M11 2v3",
  bag:      "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
};

export function CIcon({ name, size = 15 }: { name: string; size?: number }) {
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

// Picker palette = exactly the validated chart palette. Every swatch is
// far apart from every other (no near-duplicate hues), and the array order
// doubles as the auto-assignment order for new categories.
export const CAT_PALETTE = [...CATEGORY_HEX_PALETTE];

export const CAT_ICON_OPTIONS = [
  "home", "wallet", "coins", "car", "cap", "shield", "plane", "spark",
  "flag", "target", "building", "receipt", "tag", "star", "zap", "globe",
  "folder", "repeat",
  "paw", "utensils", "gift", "phone", "shirt", "dumbbell", "heart", "fuel",
  "coffee", "bag",
];

// Human-readable description for each icon (tooltip + "selected icon" caption).
export const CAT_ICON_LABELS: Record<string, string> = {
  home: "Casa / Moradia",
  wallet: "Carteira / Alimentação",
  coins: "Dinheiro / Investimento",
  car: "Carro / Transporte",
  cap: "Educação",
  shield: "Saúde / Seguro",
  plane: "Viagem / Lazer",
  spark: "Filhos / Especial",
  flag: "Meta",
  target: "Objetivo",
  building: "Impostos / Empresa",
  receipt: "Contas / Serviços",
  tag: "Etiqueta / Mercado",
  star: "Favoritos",
  zap: "Energia",
  globe: "Internet / Global",
  folder: "Pasta (genérico)",
  repeat: "Assinatura / Recorrente",
  paw: "Pets / Animais",
  utensils: "Restaurante / Comer fora",
  gift: "Presentes",
  phone: "Celular / Telefonia",
  shirt: "Roupas / Vestuário",
  dumbbell: "Academia / Fitness",
  heart: "Saúde / Doação",
  fuel: "Combustível",
  coffee: "Café / Lazer",
  bag: "Compras",
};

/** First palette color not already used by a category, so new categories get a
 * distinct color automatically. Falls back to a rotating color when all are used. */
export function pickUnusedCatColor(categories: CategoryRead[]): string {
  const used = new Set(
    categories.filter((c) => c.color).map((c) => (c.color as string).toLowerCase()),
  );
  return (
    CAT_PALETTE.find((p) => !used.has(p.toLowerCase())) ??
    CAT_PALETTE[used.size % CAT_PALETTE.length]
  );
}

// Default icon by category name, used when no icon was saved (mirrors prototype).
export function defaultCatIcon(name: string): string {
  const n = name.toLowerCase();
  const map: [string, string][] = [
    ["moradia", "home"], ["aliment", "wallet"], ["mercado", "tag"],
    ["educa", "cap"], ["transporte", "car"], ["saude", "shield"], ["saúde", "shield"],
    ["lazer", "plane"], ["assinatura", "repeat"], ["servi", "receipt"],
    ["invest", "coins"], ["renda", "coins"], ["receita", "coins"],
    ["cart", "wallet"], ["imposto", "building"], ["filho", "spark"],
    ["pet", "paw"], ["animal", "paw"], ["restaurante", "utensils"], ["comer", "utensils"],
    ["presente", "gift"], ["celular", "phone"], ["telefone", "phone"], ["roupa", "shirt"],
    ["vestu", "shirt"], ["academia", "dumbbell"], ["combust", "fuel"], ["caf", "coffee"],
    ["compra", "bag"], ["doa", "heart"],
  ];
  for (const [k, v] of map) if (n.includes(k)) return v;
  return "folder";
}

// ---------------------------------------------------------------------------
// CatModal — the single "create category / subcategory" form, shared by the
// Categories page and the inline categorize flow (Transactions) so there is
// only ONE registration form across the app.
// ---------------------------------------------------------------------------

export interface CatModalState {
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
  /** Override backdrop z-index when opened over another modal. */
  zIndex?: number;
}

export function CatModal({ state, categories, onClose, onSaveCat, onSaveSub, zIndex }: CatModalProps) {
  const [kind, setKind] = useState<"cat" | "sub">(state.kind);
  const [name, setName] = useState(state.editing?.name ?? "");
  const [parentId, setParentId] = useState(
    state.parentId ??
    state.editing?.parent_category_id ??
    (categories.find((c) => !c.parent_category_id)?.id ?? "")
  );
  // Prefill from the category being edited; for a new one, auto-pick an unused color.
  const [color, setColor] = useState(() => state.editing?.color ?? pickUnusedCatColor(categories));
  const [iconName, setIconName] = useState(() => state.editing?.icon ?? defaultCatIcon(state.editing?.name ?? ""));
  // Until the user picks an icon manually, keep it in sync with the typed name.
  const [iconTouched, setIconTouched] = useState(Boolean(state.editing?.icon));
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
    <div className="mdl-backdrop" onClick={onClose} style={zIndex != null ? { zIndex } : undefined}>
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
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                setErr("");
                if (!iconTouched) setIconName(defaultCatIcon(v));
              }}
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
                      title={p}
                      aria-label={p}
                    />
                  ))}
                </div>
                <span className="fld-help">
                  {state.editing ? "Cor da categoria." : "Sugerimos uma cor ainda não usada — clique para trocar."}
                </span>
              </label>

              {/* Icon */}
              <label className="fld">
                <span className="fld-label">Ícone</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CAT_ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => { setIconName(ic); setIconTouched(true); }}
                      title={CAT_ICON_LABELS[ic] ?? ic}
                      style={{
                        width: 34, height: 34, borderRadius: 9,
                        display: "grid", placeItems: "center",
                        border: "1px solid " + (iconName === ic ? color : "var(--line)"),
                        background: iconName === ic ? color : "var(--card-2)",
                        color: iconName === ic ? "#fff" : "var(--ink-2)",
                        transition: "all .12s",
                      }}
                      aria-label={CAT_ICON_LABELS[ic] ?? ic}
                    >
                      <CIcon name={ic} size={16} />
                    </button>
                  ))}
                </div>
                <span className="fld-help">
                  Ícone: <strong>{CAT_ICON_LABELS[iconName] ?? iconName}</strong>
                  {!iconTouched && !state.editing
                    ? " · sugerido pelo nome (clique para trocar)"
                    : " · passe o mouse para ver cada um"}
                </span>
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
