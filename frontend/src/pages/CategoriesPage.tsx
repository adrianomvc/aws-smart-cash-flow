import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import {
  applyRules,
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
  getRulePreview,
  getRuleSuggestions,
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
  orderedCategoryTree,
} from "../lib/utils";
import { useCategories } from "../hooks";
import {
  Drawer,
  EmptyInline,
  InlineError,
  InlineSuccess,
  PageState,
  Panel,
  QualityRow,
  ResponsiveTable,
  StatusBadge,
} from "../components/ui";
import { TransactionExplorer } from "./TransactionExplorer";
import type {
  ApiSession,
  CategorizationRuleRead,
  CategoryRead,
  RulePreview,
  RuleSuggestion,
  TransactionRead,
} from "../lib/api";
import type { RuleFormState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ruleFieldLabel(field: string) {
  const labels: Record<string, string> = { description: "Descrição normalizada", raw_description: "Descrição original", source_name: "Origem" };
  return labels[field] ?? field;
}

function ruleMatchLabel(matchType: string) {
  const labels: Record<string, string> = { contains: "contém", starts_with: "começa com", equals: "igual a" };
  return labels[matchType] ?? matchType;
}

function DirectionBadge({ direction }: { direction: string }) {
  return <span className={`direction-badge ${direction}`}>{directionLabel(direction)}</span>;
}

const emptyRuleForm: RuleFormState = { id: null, name: "", field: "description", match_type: "contains", pattern: "", category_id: "", target_direction: "", priority: 100, active: true };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RuleRow({ rule, categories, onDelete, onEdit, onPreview, previewCount }: { rule: CategorizationRuleRead; categories: CategoryRead[]; onDelete: () => void; onEdit: () => void; onPreview: () => void; previewCount?: number }) {
  const category = categories.find((item) => item.id === rule.category_id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr>
      <td>{rule.priority}</td>
      <td>
        <strong className="rule-name">{rule.name}</strong>
        {previewCount !== undefined ? <span className="impact-badge">{previewCount} txs</span> : null}
      </td>
      <td>
        <div className="rule-condition">
          <span>{ruleFieldLabel(rule.field)}</span>
          <strong>{ruleMatchLabel(rule.match_type)}</strong>
          <code>{rule.pattern}</code>
        </div>
      </td>
      <td><span className="category-path">{rule.category_id ? (category ? categoryPath(category, categories) : "Categoria removida") : "-"}</span></td>
      <td>{rule.target_direction ? <DirectionBadge direction={rule.target_direction} /> : "-"}</td>
      <td>{rule.active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}</td>
      <td>
        {confirmDelete ? (
          <div className="confirm-delete-inline">
            <span>Excluir?</span>
            <button className="ghost-button compact-button" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button className="danger-button compact-button" type="button" onClick={() => { setConfirmDelete(false); onDelete(); }}>Confirmar</button>
          </div>
        ) : (
          <div className="row-actions">
            <button className="icon-button" onClick={onPreview} title="Prévia da regra"><Search size={16} /></button>
            <button className="icon-button" onClick={onEdit} title="Editar regra"><Pencil size={16} /></button>
            <button className="icon-button danger" onClick={() => setConfirmDelete(true)} title="Excluir regra"><Trash2 size={16} /></button>
          </div>
        )}
      </td>
    </tr>
  );
}

function RulePreviewDrawer({ rule, preview, categories, loading, onClose }: { rule: CategorizationRuleRead; preview?: RulePreview; categories: CategoryRead[]; loading: boolean; onClose: () => void }) {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  return (
    <Drawer title={`Prévia: ${rule.name}`} onClose={onClose}>
      {loading ? <PageState icon={Loader2} title="Carregando prévia" description="Buscando transações afetadas." spin compact /> : null}
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
                  <div><strong>{item.description}</strong><small>{dateLabel(item.transaction_date)} · {moneyAbs(item.amount)}</small></div>
                  <div className="preview-actions">
                    <span>{item.current_direction}{item.target_direction ? ` -> ${directionLabel(item.target_direction)}` : ""}</span>
                    <span>{item.current_category_id ? categoryNames.get(item.current_category_id) ?? "Categoria atual" : "Sem categoria"}{item.target_category_id ? ` -> ${categoryNames.get(item.target_category_id) ?? "Categoria alvo"}` : ""}</span>
                    {item.skipped_manual_category ? <StatusBadge status="manual" /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyInline message="Nenhuma transação encontrada para esta regra." />}
        </div>
      ) : null}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function CategoriesPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [editing, setEditing] = useState<CategoryRead | null>(null);
  const categories = useCategories(session);
  const parentOptions = (categories.data?.items ?? []).filter((c) => c.id !== editing?.id);
  const categoryNames = new Map((categories.data?.items ?? []).map((c) => [c.id, c.name]));
  const orderedCategories = orderedCategoryTree(categories.data?.items ?? []);
  const rootCategoryCount = (categories.data?.items ?? []).filter((c) => !c.parent_category_id).length;
  const childCategoryCount = (categories.data?.items ?? []).filter((c) => c.parent_category_id).length;

  const create = useMutation({
    mutationFn: (payload: { categoryName: string; parentId: string | null }) => createCategory(session, payload.categoryName, payload.parentId),
    onSuccess: () => { setName(""); setParentCategoryId(""); void queryClient.invalidateQueries({ queryKey: ["categories"] }); },
  });
  const update = useMutation({
    mutationFn: (payload: { id: string; name: string; parentId: string | null }) => updateCategory(session, payload.id, { name: payload.name, parent_category_id: payload.parentId }),
    onSuccess: () => { setEditing(null); setName(""); setParentCategoryId(""); void queryClient.invalidateQueries({ queryKey: ["categories"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(session, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <section className="page-stack">
      <div className="transaction-summary-grid compact-four" aria-label="Resumo das categorias">
        <div className="transaction-summary-card"><span>Total</span><strong>{categories.data?.items.length ?? 0}</strong><small>Categorias cadastradas</small></div>
        <div className="transaction-summary-card info"><span>Principais</span><strong>{rootCategoryCount}</strong><small>Grupos de alto nível</small></div>
        <div className="transaction-summary-card positive"><span>Subcategorias</span><strong>{childCategoryCount}</strong><small>Detalhamento dos gastos</small></div>
        <div className="transaction-summary-card warning"><span>Modo</span><strong>{editing ? "Edição" : "Cadastro"}</strong><small>{editing ? "Salve ou cancele" : "Crie uma nova categoria"}</small></div>
      </div>
      <Panel title={editing ? "Editar categoria" : "Nova categoria"}>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); const parentId = parentCategoryId || null; if (editing) update.mutate({ id: editing.id, name, parentId }); else if (name.trim()) create.mutate({ categoryName: name.trim(), parentId }); }}>
          <input placeholder="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={parentCategoryId} onChange={(e) => setParentCategoryId(e.target.value)}>
            <option value="">Categoria principal</option>
            {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.parent_category_id ? `${categoryNames.get(c.parent_category_id) ?? "Pai"} / ${c.name}` : c.name}</option>)}
          </select>
          <button className="primary-button" type="submit">{editing ? "Salvar" : "Criar"}</button>
          {editing ? <button className="ghost-button" type="button" onClick={() => { setEditing(null); setName(""); setParentCategoryId(""); }}>Cancelar</button> : null}
        </form>
      </Panel>
      <Panel title="Categorias cadastradas">
        <ResponsiveTable loading={categories.isLoading} empty={!categories.data?.items.length} emptyMessage="Crie sua primeira categoria.">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Categoria pai</th><th>Criada em</th><th>Ações</th></tr></thead>
          <tbody>
            {orderedCategories.map((c) => (
              <tr key={c.id}>
                <td>{c.parent_category_id ? `↳ ${c.name}` : c.name}</td>
                <td>{c.parent_category_id ? "Subcategoria" : "Principal"}</td>
                <td>{c.parent_category_id ? categoryNames.get(c.parent_category_id) ?? "-" : "-"}</td>
                <td>{dateLabel(c.created_at)}</td>
                <td className="row-actions">
                  <button className="icon-button" onClick={() => { setEditing(c); setName(c.name); setParentCategoryId(c.parent_category_id ?? ""); }}><Pencil size={16} /></button>
                  <button className="icon-button danger" onClick={() => remove.mutate(c.id)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </Panel>
    </section>
  );
}

export function RulesPage({ session, prefillPattern }: { session: ApiSession; prefillPattern?: string | null }) {
  const queryClient = useQueryClient();
  const categories = useCategories(session);
  const categoryOptions = useMemo(() => orderedCategoryOptions(categories.data?.items ?? []), [categories.data?.items]);
  const rules = useQuery({ queryKey: ["rules", session.token], queryFn: () => getRules(session) });
  const [form, setForm] = useState<RuleFormState>(() => prefillPattern ? { ...emptyRuleForm, pattern: prefillPattern } : emptyRuleForm);

  useEffect(() => {
    if (prefillPattern) {
      setForm((prev) => ({ ...prev, pattern: prefillPattern }));
    }
  }, [prefillPattern]);
  const [ruleFormError, setRuleFormError] = useState("");
  const [ruleFormSuccess, setRuleFormSuccess] = useState("");
  const [previewRule, setPreviewRule] = useState<CategorizationRuleRead | null>(null);
  const [previewCountMap, setPreviewCountMap] = useState<Map<string, number>>(new Map());
  const preview = useQuery({ queryKey: ["rule-preview", session.token, previewRule?.id], queryFn: () => getRulePreview(session, previewRule?.id ?? ""), enabled: Boolean(previewRule) });
  const rulePayload = { name: form.name, field: form.field, match_type: form.match_type, pattern: form.pattern, category_id: form.category_id || null, target_direction: form.target_direction || null, priority: form.priority, active: form.active };

  useEffect(() => {
    if (preview.data && previewRule) {
      setPreviewCountMap((prev) => new Map(prev).set(previewRule.id, preview.data.total_count));
    }
  }, [preview.data, previewRule]);

  function showSuccess(msg: string) {
    setRuleFormSuccess(msg);
    setTimeout(() => setRuleFormSuccess(""), 3000);
  }

  const create = useMutation({ mutationFn: () => createRule(session, rulePayload), onSuccess: () => { setForm(emptyRuleForm); setRuleFormError(""); showSuccess("Regra criada com sucesso."); void queryClient.invalidateQueries({ queryKey: ["rules"] }); } });
  const update = useMutation({ mutationFn: () => updateRule(session, form.id ?? "", rulePayload), onSuccess: () => { setForm(emptyRuleForm); setRuleFormError(""); showSuccess("Regra salva com sucesso."); void queryClient.invalidateQueries({ queryKey: ["rules"] }); if (previewRule?.id === form.id) void queryClient.invalidateQueries({ queryKey: ["rule-preview", session.token, form.id] }); } });
  const remove = useMutation({ mutationFn: (id: string) => deleteRule(session, id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }) });
  const apply = useMutation({ mutationFn: () => applyRules(session), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["transactions"] }); void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }); } });

  const saving = create.isPending || update.isPending;
  const ruleItems = rules.data?.items ?? [];
  const activeRuleCount = ruleItems.filter((r) => r.active).length;
  const categoryRuleCount = ruleItems.filter((r) => r.category_id).length;
  const directionRuleCount = ruleItems.filter((r) => r.target_direction).length;

  function validateRuleForm() {
    const missingFields = [!form.name.trim() ? "nome" : "", !form.pattern.trim() ? "padrão" : "", !form.category_id && !form.target_direction ? "ação da regra" : "", !form.priority || form.priority < 1 ? "prioridade" : ""].filter(Boolean);
    if (missingFields.length) { setRuleFormError(`Preencha: ${missingFields.join(", ")}.`); return false; }
    setRuleFormError(""); return true;
  }
  function editRule(rule: CategorizationRuleRead) {
    setForm({ id: rule.id, name: rule.name, field: rule.field, match_type: rule.match_type, pattern: rule.pattern, category_id: rule.category_id ?? "", target_direction: rule.target_direction ?? "", priority: rule.priority, active: rule.active });
    setRuleFormError("");
  }

  return (
    <section className="page-stack">
      <div className="page-header-bar">
        <span className="page-header-spacer" />
        <button className="secondary-button" onClick={() => apply.mutate()} disabled={apply.isPending}>
          <RefreshCw className={apply.isPending ? "spin" : ""} size={16} />
          {apply.isPending ? "Aplicando..." : "Aplicar regras"}
        </button>
      </div>
      <div className="transaction-summary-grid compact-four" aria-label="Resumo das regras">
        <div className="transaction-summary-card"><span>Total</span><strong>{ruleItems.length}</strong><small>Regras cadastradas</small></div>
        <div className="transaction-summary-card positive"><span>Ativas</span><strong>{activeRuleCount}</strong><small>Aplicadas nas próximas rodadas</small></div>
        <div className="transaction-summary-card info"><span>Categorias</span><strong>{categoryRuleCount}</strong><small>Classificam categoria</small></div>
        <div className="transaction-summary-card warning"><span>Tipo financeiro</span><strong>{directionRuleCount}</strong><small>Ajustam despesa/receita/fatura</small></div>
      </div>
      <Panel title={form.id ? "Editar regra" : "Nova regra"}>
        <form className="rule-form" onSubmit={(e) => { e.preventDefault(); if (!validateRuleForm()) return; if (form.id) { update.mutate(); } else { create.mutate(); } }}>
          <label>Nome<input placeholder="Ex: Delivery" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>
            <span className="field-label-with-tooltip">
              Campo
              <span className="field-tooltip">
                <Info size={14} />
                <span className="field-tooltip-content">
                  <strong>Descrição normalizada</strong>: texto limpo e padronizado pelo sistema<br />
                  <strong>Descrição original</strong>: texto exato como veio do arquivo importado<br />
                  <strong>Origem</strong>: nome do banco ou cartão de origem
                </span>
              </span>
            </span>
            <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}><option value="description">Descrição normalizada</option><option value="raw_description">Descrição original</option><option value="source_name">Origem</option></select>
          </label>
          <label>Comparação<select value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value })}><option value="contains">Contém</option><option value="starts_with">Começa com</option><option value="equals">Igual</option></select></label>
          <label className="rule-pattern">
            Padrão
            <div className="pattern-input-row">
              <input placeholder="Ex: IFOOD" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
              {form.id ? (
                <button className="ghost-button compact-button" type="button" title="Testar padrão" onClick={() => { const rule = rules.data?.items.find((r) => r.id === form.id); if (rule) setPreviewRule(rule); }}>
                  <Search size={14} /> Testar
                </button>
              ) : (
                <span className="pattern-test-hint" title="Salve a regra primeiro para visualizar o impacto">
                  <Info size={14} /> Testar
                </span>
              )}
            </div>
          </label>
          <label className="rule-category">
            Categoria
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Escolha categoria/subcategoria</option>
              {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Tipo financeiro<select value={form.target_direction} onChange={(e) => setForm({ ...form, target_direction: e.target.value })}><option value="">Não alterar</option><option value="payment">Pagamento de fatura</option><option value="debit">Despesa</option><option value="credit">Receita</option></select></label>
          <label className="toggle-line"><input checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} type="checkbox" />Ativa</label>
          <label className="rule-priority">
            Prioridade
            <input min={1} type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            <small className="field-hint">Menor número = maior prioridade</small>
          </label>
          <div className="rule-submit-group">
            <button className="primary-button rule-submit" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}{form.id ? "Salvar" : "Criar"}
            </button>
            {form.id ? <button className="ghost-button" type="button" onClick={() => setForm(emptyRuleForm)}>Cancelar</button> : null}
          </div>
        </form>
        {ruleFormError ? <InlineError message={ruleFormError} /> : null}
        {ruleFormSuccess ? <InlineSuccess message={ruleFormSuccess} /> : null}
        {create.isError ? <InlineError message={apiErrorMessage(create.error, "Falha ao criar regra.")} /> : null}
        {update.isError ? <InlineError message={apiErrorMessage(update.error, "Falha ao salvar regra.")} /> : null}
      </Panel>
      {apply.data ? <InlineSuccess message={`${apply.data.applied_count} transações alteradas: ${apply.data.category_applied_count} categorias e ${apply.data.direction_applied_count} tipos financeiros.`} /> : null}
      {apply.isError ? <InlineError message={apiErrorMessage(apply.error, "Falha ao aplicar regras.")} /> : null}
      <Panel title="Regras cadastradas">
        <ResponsiveTable loading={rules.isLoading} empty={!rules.data?.items.length} emptyMessage="Nenhuma regra criada.">
          <thead><tr><th>Prior.</th><th>Nome</th><th>Condição</th><th>Categoria</th><th>Tipo financeiro</th><th>Status</th><th /></tr></thead>
          <tbody>
            {ruleItems.map((rule) => <RuleRow categories={categories.data?.items ?? []} key={rule.id} onDelete={() => remove.mutate(rule.id)} onEdit={() => editRule(rule)} onPreview={() => setPreviewRule(rule)} rule={rule} previewCount={previewCountMap.get(rule.id)} />)}
          </tbody>
        </ResponsiveTable>
      </Panel>
      {previewRule ? <RulePreviewDrawer categories={categories.data?.items ?? []} loading={preview.isLoading} onClose={() => setPreviewRule(null)} preview={preview.data} rule={previewRule} /> : null}
    </section>
  );
}

function RuleSuggestionCard({ suggestion, onCreateRule }: { suggestion: RuleSuggestion; onCreateRule: (pattern: string) => void }) {
  const totalAbs = Math.abs(parseFloat(suggestion.total_amount));
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAbs);
  return (
    <div className="rule-suggestion-card">
      <div className="rule-suggestion-header">
        <code className="rule-suggestion-pattern">{suggestion.pattern}</code>
        <div className="rule-suggestion-meta">
          <span className="rule-suggestion-count">{suggestion.transaction_count} transações</span>
          <span className="rule-suggestion-amount">{formatted}</span>
        </div>
      </div>
      <div className="rule-suggestion-samples">
        {suggestion.sample_descriptions.map((desc) => (
          <span className="rule-suggestion-sample" key={desc}>{desc}</span>
        ))}
      </div>
      <button className="primary-button compact-button" type="button" onClick={() => onCreateRule(suggestion.pattern)}>
        <Plus size={14} /> Criar regra
      </button>
    </div>
  );
}

export function ReviewPage({ session, onCreateRule }: { session: ApiSession; onCreateRule?: (pattern: string) => void }) {
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  const suggestions = useQuery({
    queryKey: ["rule-suggestions", session.token],
    queryFn: () => getRuleSuggestions(session),
  });

  return (
    <div className="page-stack">
      <Panel title="Sugestões de Regras" action={suggestions.data ? <span className="impact-badge">{suggestions.data.total_uncategorized} sem categoria</span> : undefined}>
        {suggestions.isLoading ? <PageState icon={Loader2} title="Carregando sugestões" description="Analisando padrões de descrição." spin compact /> : null}
        {suggestions.data?.suggestions.length === 0 ? (
          <EmptyInline message="Nenhum padrão recorrente encontrado." />
        ) : null}
        {suggestions.data?.suggestions.length ? (
          <div className="rule-suggestions-list">
            {suggestions.data.suggestions.map((s) => (
              <RuleSuggestionCard
                key={s.pattern}
                suggestion={s}
                onCreateRule={onCreateRule ?? (() => undefined)}
              />
            ))}
          </div>
        ) : null}
      </Panel>
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
