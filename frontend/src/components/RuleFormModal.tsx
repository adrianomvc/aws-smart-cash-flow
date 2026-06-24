import { useEffect } from "react";

import { CIcon } from "./CatModal";
import type { CategorizationRulePayload } from "../lib/api";
import type { RuleFormState } from "../types";

export const emptyRuleForm: RuleFormState = {
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
  origin: "manual",
};

// Maps the form state (inputs hold strings) to the API payload.
export function ruleFormToPayload(form: RuleFormState): CategorizationRulePayload {
  const isRecurring = form.match_type === "amount_recurring";
  return {
    name: form.name,
    field: form.field,
    match_type: form.match_type,
    pattern: form.pattern,
    category_id: form.category_id || null,
    target_direction: form.target_direction || null,
    priority: form.priority,
    active: form.active,
    amount_ref: isRecurring && form.amount_ref !== "" ? form.amount_ref : null,
    amount_tolerance: isRecurring && form.amount_tolerance !== "" ? form.amount_tolerance : null,
    day_min: isRecurring && form.day_min !== "" ? Number(form.day_min) : null,
    day_max: isRecurring && form.day_max !== "" ? Number(form.day_max) : null,
    direction_filter: isRecurring && form.direction_filter ? form.direction_filter : null,
    origin: form.origin,
  };
}

// Shared "create / edit rule" form, used by the Categories page (Regras tab) and
// by the inline "Criar regra" shortcut in Transactions.
export function RuleFormModal({
  form,
  setForm,
  categoryOptions,
  saving,
  error,
  onClose,
  onSubmit,
  onRequestNewCategory,
}: {
  form: RuleFormState;
  setForm: (f: RuleFormState) => void;
  categoryOptions: { id: string; label: string }[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  onRequestNewCategory: () => void;
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            <select
              className="fld-select"
              value={form.category_id}
              onChange={(e) => {
                if (e.target.value === "__new__") { onRequestNewCategory(); return; }
                setForm({ ...form, category_id: e.target.value });
              }}
            >
              <option value="">Não alterar categoria</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
              <option value="__new__">＋ Nova categoria…</option>
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="fld">
              <span className="fld-label">Filtrar por tipo financeiro</span>
              <select className="fld-select" value={form.direction_filter} onChange={(e) => setForm({ ...form, direction_filter: e.target.value })}>
                <option value="">Qualquer</option>
                <option value="debit">Despesa</option>
                <option value="credit">Receita</option>
                <option value="payment">Pagamento de fatura</option>
              </select>
              <span className="fld-help">A regra só se aplica a lançamentos deste tipo.</span>
            </label>
            <label className="fld">
              <span className="fld-label">Alterar tipo para (opcional)</span>
              <select className="fld-select" value={form.target_direction} onChange={(e) => setForm({ ...form, target_direction: e.target.value })}>
                <option value="">Não alterar</option>
                <option value="debit">Despesa</option>
                <option value="credit">Receita</option>
                <option value="payment">Pagamento de fatura</option>
              </select>
              <span className="fld-help">Marca os lançamentos casados com este tipo.</span>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
