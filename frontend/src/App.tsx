import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  FileWarning,
  FileUp,
  Filter,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Trash2,
  UploadCloud,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ApiSession,
  type CategoryRead,
  type CategorizationRuleRead,
  type TransactionRead,
  applyRules,
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
  getCategories,
  getCategoryRanking,
  getCurrentWorkspace,
  getDashboardSummary,
  getDataQuality,
  getImportErrors,
  getImports,
  getMonthlyCashflow,
  getRules,
  getTransactions,
  updateCategory,
  updateTransactionCategory,
  uploadImport,
} from "./lib/api";

type Page = "dashboard" | "imports" | "transactions" | "categories" | "rules" | "review" | "settings";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes("replace-me")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const navItems: Array<{ id: Page; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "imports", label: "Importações", icon: FileUp },
  { id: "transactions", label: "Transações", icon: Database },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "rules", label: "Regras", icon: Wand2 },
  { id: "review", label: "Revisão", icon: ShieldCheck },
  { id: "settings", label: "Configurações", icon: Settings },
];

function App() {
  const [session, setSession] = useState<ApiSession | null>(() => {
    const token = localStorage.getItem("scf_token");
    const mode = localStorage.getItem("scf_mode") as ApiSession["mode"] | null;
    return token ? { token, mode: mode ?? "local" } : null;
  });
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSession(nextSession: ApiSession | null) {
    setSession(nextSession);
    if (nextSession) {
      localStorage.setItem("scf_token", nextSession.token);
      localStorage.setItem("scf_mode", nextSession.mode);
    } else {
      localStorage.removeItem("scf_token");
      localStorage.removeItem("scf_mode");
    }
  }

  if (!session) {
    return <LoginScreen onLogin={handleSession} />;
  }

  return (
    <AppShell
      page={page}
      setPage={(nextPage) => {
        setPage(nextPage);
        setMobileOpen(false);
      }}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      onLogout={() => handleSession(null)}
    >
      <ProtectedApp page={page} session={session} />
    </AppShell>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: ApiSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSupabaseLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Supabase não está configurado neste ambiente. Use o acesso local.");
      return;
    }
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError || !data.session?.access_token) {
      setError(signInError?.message ?? "Não foi possível entrar.");
      return;
    }
    onLogin({ token: data.session.access_token, mode: "supabase" });
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">SCF</div>
        <p className="eyebrow">SmartCashFlow</p>
        <h1>Controle financeiro auditável.</h1>
        <p className="muted">
          Importe extratos, revise classificações e acompanhe sua saúde financeira com rastreabilidade.
        </p>

        <form className="login-form" onSubmit={handleSupabaseLogin}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          {error ? <div className="inline-error">{error}</div> : null}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={16} /> : null}
            Entrar
          </button>
        </form>

        <button className="ghost-button full" onClick={() => onLogin({ token: "local-dev", mode: "local" })}>
          Acessar ambiente local
        </button>
      </section>
    </main>
  );
}

function AppShell({
  children,
  page,
  setPage,
  mobileOpen,
  setMobileOpen,
  onLogout,
}: {
  children: ReactNode;
  page: Page;
  setPage: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onLogout: () => void;
}) {
  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">SCF</div>
          <div>
            <strong>SmartCashFlow</strong>
            <span>Mapa financeiro</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={item.id === page ? "active" : ""}
                key={item.id}
                onClick={() => setPage(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>
      {mobileOpen ? <button className="overlay" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" /> : null}
      <section className="content-shell">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </button>
        {children}
      </section>
    </main>
  );
}

function ProtectedApp({ page, session }: { page: Page; session: ApiSession }) {
  const workspaceQuery = useQuery({
    queryKey: ["workspace", session.token],
    queryFn: () => getCurrentWorkspace(session),
  });

  if (workspaceQuery.isLoading) {
    return <PageState icon={Loader2} title="Carregando workspace" description="Preparando seu ambiente." spin />;
  }

  if (workspaceQuery.isError) {
    return (
      <PageState
        icon={AlertCircle}
        title="Não foi possível carregar o workspace"
        description="Confira se a API local está rodando e tente novamente."
      />
    );
  }

  const workspace = workspaceQuery.data;

  if (!workspace) {
    return (
      <PageState
        icon={AlertCircle}
        title="Workspace indisponível"
        description="A API não retornou um workspace ativo."
      />
    );
  }

  return (
    <>
      <Topbar workspaceName={workspace.workspace_name} />
      {page === "dashboard" ? <DashboardPage session={session} /> : null}
      {page === "imports" ? <ImportsPage session={session} /> : null}
      {page === "transactions" ? <TransactionsPage session={session} /> : null}
      {page === "categories" ? <CategoriesPage session={session} /> : null}
      {page === "rules" ? <RulesPage session={session} /> : null}
      {page === "review" ? <ReviewPage session={session} /> : null}
      {page === "settings" ? <SettingsPage workspaceName={workspace.workspace_name} session={session} /> : null}
    </>
  );
}

function Topbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Workspace</p>
        <h1>{workspaceName}</h1>
      </div>
      <div className="topbar-pill">
        <ShieldCheck size={16} />
        Dados isolados por workspace
      </div>
    </header>
  );
}

function DashboardPage({ session }: { session: ApiSession }) {
  const period = usePeriod();
  const summary = useQuery({
    queryKey: ["dashboard-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const cashflow = useQuery({
    queryKey: ["monthly-cashflow", session.token, period.query],
    queryFn: () => getMonthlyCashflow(session, period.query),
  });
  const ranking = useQuery({
    queryKey: ["category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, `${period.query}&limit=8`),
  });
  const quality = useQuery({
    queryKey: ["data-quality", session.token, period.query],
    queryFn: () => getDataQuality(session, period.query),
  });

  return (
    <section className="page-stack">
      <PageHeader
        title="Dashboard"
        description="Resumo executivo, qualidade dos dados e principais gastos do período."
        action={<PeriodFilter period={period} />}
      />
      <section className="metric-grid">
        <MetricCard
          icon={ArrowUpCircle}
          label="Receitas"
          value={money(summary.data?.income)}
          tone="positive"
        />
        <MetricCard
          icon={ArrowDownCircle}
          label="Despesas"
          value={money(summary.data?.expenses)}
          tone="negative"
        />
        <MetricCard icon={BarChart3} label="Saldo" value={money(summary.data?.balance)} />
        <MetricCard
          icon={ShieldCheck}
          label="Qualidade"
          value={percent(quality.data?.categorized_ratio)}
          helper={`${quality.data?.uncategorized_count ?? 0} sem categoria`}
        />
      </section>

      <section className="dashboard-grid">
        <Panel title="Fluxo mensal" description="Receitas, despesas e saldo por mês.">
          <ChartBox loading={cashflow.isLoading} empty={!cashflow.data?.items.length}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashflow.data?.items ?? []}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => money(String(value))} />
                <Line type="monotone" dataKey="income" stroke="#0f9f6e" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} />
                <Line type="monotone" dataKey="balance" stroke="#6d5dfc" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel title="Gastos por categoria" description="Ranking de despesas classificadas e pendentes.">
          <ChartBox loading={ranking.isLoading} empty={!ranking.data?.items.length}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking.data?.items ?? []}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="category_name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => money(String(value))} />
                <Bar dataKey="amount" fill="#6d5dfc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>
      </section>

      <section className="dashboard-grid compact">
        <Panel title="Saúde dos dados" description="Indicadores de confiabilidade para os gráficos.">
          <div className="quality-list">
            <QualityRow label="Transações" value={quality.data?.transaction_count ?? 0} />
            <QualityRow label="Categorizadas" value={quality.data?.categorized_count ?? 0} />
            <QualityRow label="Sem categoria" value={quality.data?.uncategorized_count ?? 0} warn />
            <QualityRow label="Importações com erro" value={quality.data?.imports_with_errors ?? 0} warn />
            <QualityRow label="Duplicados ignorados" value={quality.data?.duplicate_imports ?? 0} />
          </div>
        </Panel>
        <RecentTransactions session={session} />
      </section>
    </section>
  );
}

function ImportsPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const [selectedImport, setSelectedImport] = useState<string | null>(null);
  const imports = useQuery({
    queryKey: ["imports", session.token],
    queryFn: () => getImports(session),
  });
  const errors = useQuery({
    queryKey: ["import-errors", session.token, selectedImport],
    queryFn: () => getImportErrors(session, selectedImport ?? ""),
    enabled: Boolean(selectedImport),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadImport(session, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  return (
    <section className="page-stack">
      <PageHeader title="Importações" description="Envie TXT/CSV, acompanhe status e revise erros por linha." />
      <Panel title="Upload" description="MVP aceita arquivos TXT e CSV. PDF fica para fase posterior.">
        <label className="upload-zone">
          <UploadCloud size={28} />
          <strong>{upload.isPending ? "Importando..." : "Selecionar arquivo"}</strong>
          <span>O arquivo original é preservado com rastreabilidade.</span>
          <input
            accept=".txt,.csv,text/plain,text/csv"
            disabled={upload.isPending}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {upload.isError ? <InlineError message="Falha ao importar arquivo." /> : null}
        {upload.isSuccess ? (
          <InlineSuccess
            message={`Arquivo importado: ${upload.data.valid_rows} novas, ${upload.data.duplicate_rows} duplicadas, ${upload.data.error_rows} erros.`}
          />
        ) : null}
      </Panel>

      <Panel title="Histórico" description="Status operacional de cada arquivo processado.">
        <ResponsiveTable
          empty={!imports.data?.items.length}
          loading={imports.isLoading}
          emptyMessage="Nenhuma importação encontrada."
        >
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Status</th>
              <th>Novas</th>
              <th>Duplicadas</th>
              <th>Erros</th>
              <th>Data</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(imports.data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.source_file?.original_filename ?? "Arquivo"}</td>
                <td><StatusBadge status={item.status} /></td>
                <td>{item.valid_rows}/{item.total_rows}</td>
                <td>{item.duplicate_rows}</td>
                <td>{item.error_rows}</td>
                <td>{dateLabel(item.created_at)}</td>
                <td>
                  <button className="icon-button" onClick={() => setSelectedImport(item.id)}>
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </Panel>

      {selectedImport ? (
        <Drawer title="Erros da importação" onClose={() => setSelectedImport(null)}>
          <ResponsiveTable
            empty={!errors.data?.items.length}
            loading={errors.isLoading}
            emptyMessage="Esta importação não possui erros."
          >
            <thead>
              <tr>
                <th>Linha</th>
                <th>Campo</th>
                <th>Código</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {(errors.data?.items ?? []).map((error) => (
                <tr key={error.id}>
                  <td>{error.source_line ?? "-"}</td>
                  <td>{error.field_name ?? "-"}</td>
                  <td>{error.error_code}</td>
                  <td>{error.message}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </Drawer>
      ) : null}
    </section>
  );
}

function TransactionsPage({ session }: { session: ApiSession }) {
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  return (
    <TransactionExplorer
      session={session}
      title="Transações"
      description="Filtre, audite origem e corrija categorias manualmente."
      onSelect={setSelected}
      selected={selected}
    />
  );
}

function CategoriesPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [editing, setEditing] = useState<CategoryRead | null>(null);
  const categories = useCategories(session);
  const parentOptions = (categories.data?.items ?? []).filter((category) => category.id !== editing?.id);
  const categoryNames = new Map((categories.data?.items ?? []).map((category) => [category.id, category.name]));
  const orderedCategories = orderedCategoryTree(categories.data?.items ?? []);
  const create = useMutation({
    mutationFn: (payload: { categoryName: string; parentId: string | null }) =>
      createCategory(session, payload.categoryName, payload.parentId),
    onSuccess: () => {
      setName("");
      setParentCategoryId("");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const update = useMutation({
    mutationFn: (payload: { id: string; name: string; parentId: string | null }) =>
      updateCategory(session, payload.id, { name: payload.name, parent_category_id: payload.parentId }),
    onSuccess: () => {
      setEditing(null);
      setName("");
      setParentCategoryId("");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(session, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <section className="page-stack">
      <PageHeader title="Categorias" description="Base manual para organizar e auditar seus lançamentos." />
      <Panel title={editing ? "Editar categoria" : "Nova categoria"}>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const parentId = parentCategoryId || null;
            if (editing) {
              update.mutate({ id: editing.id, name, parentId });
            } else if (name.trim()) {
              create.mutate({ categoryName: name.trim(), parentId });
            }
          }}
        >
          <input
            placeholder="Nome da categoria"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            value={parentCategoryId}
            onChange={(event) => setParentCategoryId(event.target.value)}
          >
            <option value="">Categoria principal</option>
            {parentOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parent_category_id ? `${categoryNames.get(category.parent_category_id) ?? "Pai"} / ${category.name}` : category.name}
              </option>
            ))}
          </select>
          <button className="primary-button" type="submit">
            {editing ? "Salvar" : "Criar"}
          </button>
          {editing ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setEditing(null);
                setName("");
                setParentCategoryId("");
              }}
            >
              Cancelar
            </button>
          ) : null}
        </form>
      </Panel>
      <Panel title="Categorias cadastradas">
        <ResponsiveTable
          loading={categories.isLoading}
          empty={!categories.data?.items.length}
          emptyMessage="Crie sua primeira categoria."
        >
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Categoria pai</th>
              <th>Criada em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orderedCategories.map((category) => (
              <tr key={category.id}>
                <td>{category.parent_category_id ? `↳ ${category.name}` : category.name}</td>
                <td>{category.parent_category_id ? "Subcategoria" : "Principal"}</td>
                <td>{category.parent_category_id ? categoryNames.get(category.parent_category_id) ?? "-" : "-"}</td>
                <td>{dateLabel(category.created_at)}</td>
                <td className="row-actions">
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditing(category);
                      setName(category.name);
                      setParentCategoryId(category.parent_category_id ?? "");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button className="icon-button danger" onClick={() => remove.mutate(category.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </Panel>
    </section>
  );
}

function RulesPage({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const categories = useCategories(session);
  const categoryOptions = orderedCategoryOptions(categories.data?.items ?? []);
  const rules = useQuery({
    queryKey: ["rules", session.token],
    queryFn: () => getRules(session),
  });
  const [form, setForm] = useState({
    name: "",
    field: "description",
    match_type: "contains",
    pattern: "",
    category_id: "",
    priority: 100,
    active: true,
  });
  const [ruleFormError, setRuleFormError] = useState("");
  const create = useMutation({
    mutationFn: () => createRule(session, form),
    onSuccess: () => {
      setForm({ ...form, name: "", pattern: "" });
      setRuleFormError("");
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
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

  return (
    <section className="page-stack">
      <PageHeader
        title="Regras"
        description="Automatize classificações previsíveis. Categorias manuais sempre prevalecem."
        action={
          <button className="secondary-button" onClick={() => apply.mutate()} disabled={apply.isPending}>
            <RefreshCw className={apply.isPending ? "spin" : ""} size={16} />
            {apply.isPending ? "Aplicando..." : "Aplicar regras"}
          </button>
        }
      />
      <Panel title="Nova regra">
        <form
          className="rule-form"
          onSubmit={(event) => {
            event.preventDefault();
            const missingFields = [
              !form.name.trim() ? "nome" : "",
              !form.pattern.trim() ? "padrão" : "",
              !form.category_id ? "categoria" : "",
              !form.priority || form.priority < 1 ? "prioridade" : "",
            ].filter(Boolean);
            if (missingFields.length) {
              setRuleFormError(`Preencha: ${missingFields.join(", ")}.`);
              return;
            }
            setRuleFormError("");
            create.mutate();
          }}
        >
          <label>
            Nome
            <input placeholder="Ex: Delivery" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Campo
            <select value={form.field} onChange={(event) => setForm({ ...form, field: event.target.value })}>
              <option value="description">Descrição normalizada</option>
              <option value="raw_description">Descrição original</option>
              <option value="source_name">Origem</option>
            </select>
          </label>
          <label>
            Comparação
            <select value={form.match_type} onChange={(event) => setForm({ ...form, match_type: event.target.value })}>
              <option value="contains">Contém</option>
              <option value="starts_with">Começa com</option>
              <option value="equals">Igual</option>
            </select>
          </label>
          <label className="rule-pattern">
            Padrão
            <input
              placeholder="Ex: IFOOD"
              value={form.pattern}
              onChange={(event) => setForm({ ...form, pattern: event.target.value })}
            />
          </label>
          <label className="rule-category">
            Categoria
            <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
              <option value="">Escolha categoria/subcategoria</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="rule-priority">
            Prioridade
            <input
              min={1}
              type="number"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })}
            />
          </label>
          <button className="primary-button rule-submit" type="submit"><Plus size={16} /> Criar</button>
        </form>
        {ruleFormError ? <InlineError message={ruleFormError} /> : null}
        {create.isError ? <InlineError message={apiErrorMessage(create.error, "Falha ao criar regra.")} /> : null}
      </Panel>
      {apply.data ? <InlineSuccess message={`${apply.data.applied_count} transações categorizadas.`} /> : null}
      <Panel title="Regras cadastradas">
        <ResponsiveTable loading={rules.isLoading} empty={!rules.data?.items.length} emptyMessage="Nenhuma regra criada.">
          <thead>
            <tr>
              <th>Prior.</th>
              <th>Nome</th>
              <th>Condição</th>
              <th>Categoria</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rules.data?.items ?? []).map((rule) => (
              <RuleRow
                categories={categories.data?.items ?? []}
                key={rule.id}
                onDelete={() => remove.mutate(rule.id)}
                rule={rule}
              />
            ))}
          </tbody>
        </ResponsiveTable>
      </Panel>
    </section>
  );
}

function ReviewPage({ session }: { session: ApiSession }) {
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  return (
    <TransactionExplorer
      session={session}
      title="Revisão"
      description="Fila simples de transações sem categoria para melhorar a confiabilidade dos indicadores."
      fixedQuery="category_id=__uncategorized__"
      onSelect={setSelected}
      selected={selected}
      reviewMode
    />
  );
}

function SettingsPage({ workspaceName, session }: { workspaceName: string; session: ApiSession }) {
  return (
    <section className="page-stack">
      <PageHeader title="Configurações" description="Informações operacionais do ambiente atual." />
      <Panel title="Workspace">
        <div className="settings-list">
          <QualityRow label="Nome" value={workspaceName} />
          <QualityRow label="Modo de sessão" value={session.mode === "local" ? "Local" : "Supabase"} />
          <QualityRow label="API" value="Conectada" />
        </div>
      </Panel>
    </section>
  );
}

function TransactionExplorer({
  session,
  title,
  description,
  onSelect,
  selected,
  fixedQuery,
  reviewMode = false,
}: {
  session: ApiSession;
  title: string;
  description: string;
  onSelect: (transaction: TransactionRead | null) => void;
  selected: TransactionRead | null;
  fixedQuery?: string;
  reviewMode?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [direction, setDirection] = useState("");
  const [sortBy, setSortBy] = useState("transaction_date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [actionMessage, setActionMessage] = useState("");
  const pageSize = 50;
  const categories = useCategories(session);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sourceType) params.set("source_type", sourceType);
    if (direction) params.set("direction", direction);
    params.set("sort_by", sortBy);
    params.set("sort_dir", sortDir);
    if (fixedQuery && fixedQuery !== "category_id=__uncategorized__") {
      const [key, value] = fixedQuery.split("=");
      params.set(key, value);
    }
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `?${params.toString()}`;
  }, [direction, fixedQuery, page, search, sortBy, sortDir, sourceType]);
  const transactions = useQuery({
    queryKey: ["transactions", session.token, query],
    queryFn: () => getTransactions(session, query),
  });
  const visibleTransactions =
    fixedQuery === "category_id=__uncategorized__"
      ? (transactions.data?.items ?? []).filter((transaction) => !transaction.category)
      : transactions.data?.items ?? [];
  function toggleSort(nextSortBy: string) {
    setPage(0);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir(nextSortBy === "transaction_date" ? "desc" : "asc");
  }

  return (
    <section className="page-stack">
      <PageHeader title={title} description={description} />
      <Panel title="Filtros">
        <div className="filters">
          <label>
            <Search size={16} />
            <input
              placeholder="Buscar descrição"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            <Filter size={16} />
            <select
              value={sourceType}
              onChange={(event) => {
                setSourceType(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas as origens</option>
              <option value="bank_statement">Conta corrente</option>
              <option value="credit_card_statement">Cartão</option>
            </select>
          </label>
          <label>
            <BarChart3 size={16} />
            <select
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos os tipos</option>
              <option value="debit">Despesa</option>
              <option value="credit">Receita/Crédito</option>
              <option value="payment">Pagamento de fatura</option>
            </select>
          </label>
        </div>
      </Panel>
      {actionMessage ? <InlineSuccess message={actionMessage} /> : null}
      <Panel title={reviewMode ? "Pendências" : "Lançamentos"}>
        <ResponsiveTable
          loading={transactions.isLoading}
          empty={!visibleTransactions.length}
          emptyMessage={reviewMode ? "Nenhuma transação pendente de categoria." : "Nenhuma transação encontrada."}
        >
          <thead>
            <tr>
              <th><SortHeader active={sortBy === "transaction_date"} direction={sortDir} label="Data" onClick={() => toggleSort("transaction_date")} /></th>
              <th><SortHeader active={sortBy === "description"} direction={sortDir} label="Descrição" onClick={() => toggleSort("description")} /></th>
              <th><SortHeader active={sortBy === "direction"} direction={sortDir} label="Tipo" onClick={() => toggleSort("direction")} /></th>
              <th><SortHeader active={sortBy === "amount"} direction={sortDir} label="Valor" onClick={() => toggleSort("amount")} /></th>
              <th>Categoria</th>
              <th><SortHeader active={sortBy === "source_type"} direction={sortDir} label="Fonte" onClick={() => toggleSort("source_type")} /></th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleTransactions.map((transaction) => (
              <TransactionRow
                categories={categories.data?.items ?? []}
                key={transaction.id}
                onSelect={() => onSelect(transaction)}
                onCategorized={() => {
                  if (reviewMode) {
                    setActionMessage("Categoria aplicada. A transação saiu da revisão porque não está mais pendente.");
                  }
                }}
                session={session}
                transaction={transaction}
              />
            ))}
          </tbody>
        </ResponsiveTable>
        <div className="pagination-bar">
          <button className="ghost-button" disabled={page === 0 || transactions.isLoading} onClick={() => setPage((current) => Math.max(current - 1, 0))}>
            Anterior
          </button>
          <span>
            Página {page + 1} · {visibleTransactions.length} lançamentos
          </span>
          <button
            className="ghost-button"
            disabled={transactions.isLoading || visibleTransactions.length < pageSize}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </div>
      </Panel>
      {selected ? (
        <Drawer title="Detalhe da transação" onClose={() => onSelect(null)}>
          <TransactionDetail
            categories={categories.data?.items ?? []}
            session={session}
            transaction={selected}
          />
        </Drawer>
      ) : null}
    </section>
  );
}

function SortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`sort-header ${active ? "active" : ""}`} onClick={onClick} type="button">
      {label}
      <span>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function TransactionRow({
  transaction,
  categories,
  session,
  onSelect,
  onCategorized,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  session: ApiSession;
  onSelect: () => void;
  onCategorized?: () => void;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const categoryLabel = category ? categoryPath(category, categories) : undefined;
  return (
    <tr>
      <td>{dateLabel(transaction.transaction_date)}</td>
      <td>
        <span className="description-cell">{transaction.description}</span>
        {transaction.description !== transaction.raw_description ? (
          <small>{transaction.raw_description}</small>
        ) : null}
      </td>
      <td><DirectionBadge direction={transaction.direction} /></td>
      <td className={amountClass(transaction)}>{money(transaction.amount)}</td>
      <td><CategoryPicker categories={categories} onCategorized={onCategorized} session={session} transaction={transaction} /></td>
      <td><SourceBadge source={transaction.category?.source} label={categoryLabel} /></td>
      <td>
        <button className="icon-button" onClick={onSelect}><ChevronRight size={16} /></button>
      </td>
    </tr>
  );
}

function CategoryPicker({
  transaction,
  categories,
  session,
  onCategorized,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  session: ApiSession;
  onCategorized?: () => void;
}) {
  const queryClient = useQueryClient();
  const categoryOptions = orderedCategoryOptions(categories);
  const mutation = useMutation({
    mutationFn: (categoryId: string) => updateTransactionCategory(session, transaction.id, categoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      onCategorized?.();
    },
  });
  return (
    <select
      className="table-select"
      value={transaction.category?.category_id ?? ""}
      onChange={(event) => event.target.value && mutation.mutate(event.target.value)}
    >
      <option value="">Sem categoria</option>
      {categoryOptions.map((category) => (
        <option key={category.id} value={category.id}>{category.label}</option>
      ))}
    </select>
  );
}

function TransactionDetail({
  transaction,
  categories,
  session,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  session: ApiSession;
}) {
  const category = categories.find((item) => item.id === transaction.category?.category_id);
  const normalizedChanged = transaction.description !== transaction.raw_description;
  return (
    <div className="detail-stack">
      <QualityRow
        label="Descrição normalizada"
        value={
          <span className={normalizedChanged ? "normalized-value" : ""}>
            {transaction.description}
          </span>
        }
      />
      <QualityRow label="Descrição original" value={transaction.raw_description} />
      <QualityRow label="Tipo" value={directionLabel(transaction.direction)} />
      <QualityRow label="Valor" value={money(transaction.amount)} />
      <QualityRow label="Data" value={dateLabel(transaction.transaction_date)} />
      <QualityRow label="Origem" value={sourceTypeLabel(transaction.source_type)} />
      <QualityRow label="Arquivo" value={transaction.source_file_id} />
      <QualityRow label="Importação" value={transaction.import_job_id} />
      <QualityRow label="Linha" value={transaction.source_line ?? "-"} />
      <QualityRow label="Categoria atual" value={category ? categoryPath(category, categories) : "Sem categoria"} />
      <QualityRow label="Fonte" value={transaction.category?.source ?? "Pendente"} />
      <div>
        <p className="field-label">Alterar categoria</p>
        <CategoryPicker categories={categories} session={session} transaction={transaction} />
      </div>
    </div>
  );
}

function RecentTransactions({ session }: { session: ApiSession }) {
  const transactions = useQuery({
    queryKey: ["transactions", session.token, "recent"],
    queryFn: () => getTransactions(session, "?limit=5"),
  });
  return (
    <Panel title="Transações recentes" description="Últimos lançamentos importados.">
      <div className="mini-list">
        {(transactions.data?.items ?? []).map((transaction) => (
          <div className="mini-row" key={transaction.id}>
            <span>
              {transaction.description}
              <small>{dateLabel(transaction.transaction_date)} · {directionLabel(transaction.direction)}</small>
            </span>
            <strong className={amountClass(transaction)}>{money(transaction.amount)}</strong>
          </div>
        ))}
        {!transactions.isLoading && !transactions.data?.items.length ? (
          <EmptyInline message="Importe seu primeiro arquivo para ver lançamentos." />
        ) : null}
      </div>
    </Panel>
  );
}

function RuleRow({
  rule,
  categories,
  onDelete,
}: {
  rule: CategorizationRuleRead;
  categories: CategoryRead[];
  onDelete: () => void;
}) {
  const category = categories.find((item) => item.id === rule.category_id);
  return (
    <tr>
      <td>{rule.priority}</td>
      <td><strong className="rule-name">{rule.name}</strong></td>
      <td>
        <div className="rule-condition">
          <span>{ruleFieldLabel(rule.field)}</span>
          <strong>{ruleMatchLabel(rule.match_type)}</strong>
          <code>{rule.pattern}</code>
        </div>
      </td>
      <td><span className="category-path">{category ? categoryPath(category, categories) : "Categoria removida"}</span></td>
      <td>{rule.active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}</td>
      <td><button className="icon-button danger" onClick={onDelete}><Trash2 size={16} /></button></td>
    </tr>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={20} />
      </div>
      <strong className={tone}>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function ResponsiveTable({
  children,
  loading,
  empty,
  emptyMessage,
}: {
  children: ReactNode;
  loading: boolean;
  empty: boolean;
  emptyMessage: string;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando dados" description="Aguarde um momento." spin compact />;
  if (empty) return <EmptyInline message={emptyMessage} />;
  return <div className="table-wrap"><table>{children}</table></div>;
}

function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <aside className="drawer">
      <div className="drawer-header">
        <h3>{title}</h3>
        <button className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>
      {children}
    </aside>
  );
}

function ChartBox({
  children,
  loading,
  empty,
}: {
  children: ReactNode;
  loading: boolean;
  empty: boolean;
}) {
  if (loading) return <div className="chart-box loading"><Loader2 className="spin" /></div>;
  if (empty) return <div className="chart-box"><EmptyInline message="Sem dados para o período." /></div>;
  return <div className="chart-box">{children}</div>;
}

function PageState({
  icon: Icon,
  title,
  description,
  spin = false,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  spin?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "page-state compact" : "page-state"}>
      <Icon className={spin ? "spin" : ""} size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <div className="empty-inline"><FileWarning size={18} /> {message}</div>;
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-error"><AlertCircle size={16} /> {message}</div>;
}

function InlineSuccess({ message }: { message: string }) {
  return <div className="inline-success"><CheckCircle2 size={16} /> {message}</div>;
}

function QualityRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="quality-row">
      <span>{label}</span>
      <strong className={warn ? "warning" : ""}>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return <span className={`status-badge ${normalized}`}>{statusLabel(status)}</span>;
}

function SourceBadge({ source, label }: { source?: string; label?: string }) {
  const value = source ?? "pending";
  return <span className={`status-badge ${value}`}>{label ? `${label} · ${sourceLabel(value)}` : sourceLabel(value)}</span>;
}

function DirectionBadge({ direction }: { direction: string }) {
  return <span className={`direction-badge ${direction}`}>{directionLabel(direction)}</span>;
}

function PeriodFilter({ period }: { period: ReturnType<typeof usePeriod> }) {
  return (
    <div className="period-filter">
      <input type="date" value={period.dateFrom} onChange={(event) => period.setDateFrom(event.target.value)} />
      <input type="date" value={period.dateTo} onChange={(event) => period.setDateTo(event.target.value)} />
    </div>
  );
}

function usePeriod() {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);
  const query = `?date_from=${dateFrom}&date_to=${dateTo}`;
  return { dateFrom, dateTo, setDateFrom, setDateTo, query };
}

function useCategories(session: ApiSession) {
  return useQuery({
    queryKey: ["categories", session.token],
    queryFn: () => getCategories(session),
  });
}

function money(value?: string | number | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric);
}

function percent(value?: string | null) {
  if (!value) return "0%";
  return `${(Number(value) * 100).toFixed(0)}%`;
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  try {
    const payload = JSON.parse(error.message) as { detail?: string };
    return payload.detail || fallback;
  } catch {
    return error.message || fallback;
  }
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
    new Date(value),
  );
}

function amountClass(transaction: TransactionRead) {
  if (transaction.direction === "credit") return "positive";
  if (transaction.direction === "payment") return "muted-strong";
  return "negative";
}

function categoryPath(category: CategoryRead, categories: CategoryRead[]) {
  if (!category.parent_category_id) return category.name;
  const parent = categories.find((item) => item.id === category.parent_category_id);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function orderedCategoryOptions(categories: CategoryRead[]) {
  return orderedCategoryTree(categories)
    .map((category) => ({
      id: category.id,
      label: categoryPath(category, categories),
    }));
}

function orderedCategoryTree(categories: CategoryRead[]) {
  const byParent = new Map<string, CategoryRead[]>();
  for (const category of categories) {
    const parentKey = category.parent_category_id ?? "root";
    byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), category]);
  }
  for (const [parentKey, items] of byParent) {
    byParent.set(parentKey, sortCategoriesByName(items));
  }

  const ordered: CategoryRead[] = [];
  for (const root of byParent.get("root") ?? []) {
    ordered.push(root);
    ordered.push(...(byParent.get(root.id) ?? []));
  }
  return ordered;
}

function sortCategoriesByName(categories: CategoryRead[]) {
  return [...categories].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "Completo",
    completed_with_errors: "Com erros",
    duplicate_file: "Duplicado",
    active: "Ativa",
    inactive: "Inativa",
  };
  return labels[status] ?? status;
}

function directionLabel(direction: string) {
  const labels: Record<string, string> = {
    debit: "Despesa",
    credit: "Receita/Crédito",
    payment: "Pagamento de fatura",
  };
  return labels[direction] ?? direction;
}

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

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    manual: "Manual",
    rule: "Regra",
    embedding: "Embedding",
    llm: "LLM",
    pending: "Pendente",
  };
  return labels[source] ?? source;
}

function sourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    bank_statement: "Conta corrente",
    credit_card_statement: "Cartão de crédito",
    unknown: "Desconhecida",
  };
  return labels[sourceType] ?? sourceType;
}

export default App;
