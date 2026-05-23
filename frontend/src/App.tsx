import type { Dispatch, FormEvent, KeyboardEvent, ReactNode, SetStateAction } from "react";
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
  CreditCard,
  Database,
  FileWarning,
  FileUp,
  Filter,
  Gauge,
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
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ApiSession,
  type CategoryGrowthAlertItem,
  type CategoryRankingItem,
  type CategoryRead,
  type CategorizationRuleRead,
  type CreditCardPaymentMatchItem,
  type DashboardSummary,
  type DataQuality,
  type ImportJobRead,
  type ImportPreviewResult,
  type RulePreview,
  type TransactionRead,
  type WeekdaySpendingItem,
  applyRules,
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
  deleteTransaction,
  getCategories,
  getCategoryGrowthAlerts,
  getCategoryRanking,
  getCreditCardPaymentMatches,
  getCurrentWorkspace,
  getDashboardSummary,
  getDataQuality,
  getImportErrors,
  getImports,
  getMerchantRanking,
  getMonthlyCashflow,
  getRulePreview,
  getRules,
  getTransactions,
  getWeekdaySpending,
  normalizeTransactionDescriptions,
  previewImport,
  updateCategory,
  updateRule,
  updateTransactionCategory,
  updateTransactionDirection,
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

type RuleFormState = {
  id: string | null;
  name: string;
  field: string;
  match_type: string;
  pattern: string;
  category_id: string;
  target_direction: string;
  priority: number;
  active: boolean;
};

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
};

type TransactionPeriodPreset =
  | "all"
  | "current_month"
  | "previous_month"
  | "current_year"
  | "previous_year"
  | "custom";

type PeriodState = {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
};

type TransactionDrilldown = {
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  direction?: string;
  importJobId?: string;
  label?: string;
  periodPreset?: TransactionPeriodPreset;
  search?: string;
  weekday?: number;
} | null;

type ImportDrilldown = {
  issueFilter?: string;
  label?: string;
  statusFilter?: string;
} | null;

type UploadImportResult = Awaited<ReturnType<typeof uploadImport>>;

type BatchUploadResult =
  | { fileName: string; result: UploadImportResult; status: "success" }
  | { errorMessage: string; fileName: string; status: "error" };

type BatchPreviewResult =
  | { file: File; fileName: string; preview: ImportPreviewResult; status: "success" }
  | { errorMessage: string; file: File; fileName: string; status: "error" };

function App() {
  const [session, setSession] = useState<ApiSession | null>(() => {
    const token = localStorage.getItem("scf_token");
    const mode = localStorage.getItem("scf_mode") as ApiSession["mode"] | null;
    return token ? { token, mode: mode ?? "local" } : null;
  });
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [transactionDrilldown, setTransactionDrilldown] = useState<TransactionDrilldown>(null);
  const [importDrilldown, setImportDrilldown] = useState<ImportDrilldown>(null);

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

  function navigate(nextPage: Page) {
    setImportDrilldown(null);
    if (nextPage !== "transactions") {
      setTransactionDrilldown(null);
    }
    setPage(nextPage);
    setMobileOpen(false);
  }

  function openTransactions(drilldown: TransactionDrilldown = null) {
    setTransactionDrilldown(drilldown);
    setPage("transactions");
    setMobileOpen(false);
  }

  function openImports(drilldown: ImportDrilldown = null) {
    setImportDrilldown(drilldown);
    setTransactionDrilldown(null);
    setPage("imports");
    setMobileOpen(false);
  }

  return (
    <AppShell
      page={page}
      setPage={navigate}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      onLogout={() => handleSession(null)}
    >
      <ProtectedApp
        dashboardPeriod={dashboardPeriod}
        importDrilldown={importDrilldown}
        onNavigate={navigate}
        onOpenImports={openImports}
        onOpenTransactions={openTransactions}
        page={page}
        session={session}
        setDashboardPeriod={setDashboardPeriod}
        transactionDrilldown={transactionDrilldown}
      />
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
          Acessar demonstração MVP
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

function ProtectedApp({
  dashboardPeriod,
  importDrilldown,
  onNavigate,
  onOpenImports,
  onOpenTransactions,
  page,
  session,
  setDashboardPeriod,
  transactionDrilldown,
}: {
  dashboardPeriod: PeriodState;
  importDrilldown: ImportDrilldown;
  onNavigate: (page: Page) => void;
  onOpenImports: (drilldown?: ImportDrilldown) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  page: Page;
  session: ApiSession;
  setDashboardPeriod: Dispatch<SetStateAction<PeriodState>>;
  transactionDrilldown: TransactionDrilldown;
}) {
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
        description="Confira sua sessão ou a disponibilidade da API e tente novamente."
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
      {page === "dashboard" ? (
        <DashboardPage
          dashboardPeriod={dashboardPeriod}
          onNavigate={onNavigate}
          onOpenImports={onOpenImports}
          onOpenTransactions={onOpenTransactions}
          session={session}
          setDashboardPeriod={setDashboardPeriod}
        />
      ) : null}
      {page === "imports" ? (
        <ImportsPage
          drilldown={importDrilldown}
          onOpenTransactions={onOpenTransactions}
          session={session}
        />
      ) : null}
      {page === "transactions" ? <TransactionsPage drilldown={transactionDrilldown} session={session} /> : null}
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

function DashboardPage({
  dashboardPeriod,
  onNavigate,
  onOpenImports,
  onOpenTransactions,
  session,
  setDashboardPeriod,
}: {
  dashboardPeriod: PeriodState;
  onNavigate: (page: Page) => void;
  onOpenImports: (drilldown?: ImportDrilldown) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
  setDashboardPeriod: Dispatch<SetStateAction<PeriodState>>;
}) {
  const period = usePeriod(dashboardPeriod, setDashboardPeriod);
  const summary = useQuery({
    queryKey: ["dashboard-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const cashflow = useQuery({
    queryKey: ["monthly-cashflow", session.token, period.trendQuery],
    queryFn: () => getMonthlyCashflow(session, period.trendQuery),
  });
  const weekdaySpending = useQuery({
    queryKey: ["weekday-spending", session.token, period.query],
    queryFn: () => getWeekdaySpending(session, period.query),
  });
  const ranking = useQuery({
    queryKey: ["category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const merchants = useQuery({
    queryKey: ["merchant-ranking", session.token, period.query],
    queryFn: () => getMerchantRanking(session, withQueryParams(period.query, { limit: "6" })),
  });
  const quality = useQuery({
    queryKey: ["data-quality", session.token, period.query],
    queryFn: () => getDataQuality(session, period.query),
  });
  const categoryGrowth = useQuery({
    queryKey: ["category-growth-alerts", session.token, period.query],
    queryFn: () => getCategoryGrowthAlerts(session, withQueryParams(period.query, { limit: "3" })),
  });
  const paymentMatches = useQuery({
    queryKey: ["credit-card-payment-matches", session.token, period.query],
    queryFn: () => getCreditCardPaymentMatches(session, withQueryParams(period.query, { limit: "5", window_days: "7" })),
  });
  const cashflowAxisDomain = useMemo(
    () => moneyAxisDomain(cashflow.data?.items ?? [], ["income", "expenses", "payments", "balance"], true),
    [cashflow.data?.items],
  );
  const categoryAxisDomain = useMemo(
    () => moneyAxisDomain(ranking.data?.items ?? [], ["amount"], false),
    [ranking.data?.items],
  );
  const weekdayAxisDomain = useMemo(
    () => moneyAxisDomain(weekdaySpending.data?.items ?? [], ["amount"], false),
    [weekdaySpending.data?.items],
  );

  function openMonthlyTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    const range = monthRange(data.activeLabel);
    if (!range) return;
    onOpenTransactions({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      label: `Fluxo mensal ${monthTickLabel(data.activeLabel)}`,
      periodPreset: "custom",
    });
  }

  function openMetricTransactions(direction?: string, label = "Indicador") {
    onOpenTransactions({
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      direction,
      label,
      periodPreset: period.periodPreset,
    });
  }

  function openCategoryTransactions(item: CategoryRankingItem) {
    if (!item.category_id) {
      onNavigate("review");
      return;
    }
    onOpenTransactions({
      categoryId: item.category_id,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      label: item.category_name,
      periodPreset: period.periodPreset,
    });
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Dashboard"
        description="Resumo executivo, qualidade dos dados e principais gastos do período."
        action={(
          <div className="header-actions">
            <PeriodFilter period={period} />
            <span className="filter-summary compact">{periodSummary(period)}</span>
          </div>
        )}
      />
      <section className="metric-grid">
        <MetricCard
          icon={ArrowUpCircle}
          label="Receitas"
          title={moneyAbs(summary.data?.income)}
          value={compactMoneyAbs(summary.data?.income)}
          tone="positive"
          onClick={() => openMetricTransactions("credit", "Receitas")}
        />
        <MetricCard
          icon={ArrowDownCircle}
          label="Despesas"
          title={moneyAbs(summary.data?.expenses)}
          value={compactMoneyAbs(summary.data?.expenses)}
          tone="negative"
          onClick={() => openMetricTransactions("debit", "Despesas")}
        />
        <MetricCard
          icon={CreditCard}
          label="Pgto. fatura"
          title={moneyAbs(summary.data?.payments)}
          value={compactMoneyAbs(summary.data?.payments)}
          helper="Separado das despesas"
          tone="info"
          onClick={() => openMetricTransactions("payment", "Pgto. fatura")}
        />
        <MetricCard
          icon={BarChart3}
          label="Saldo"
          title={moneyAbs(summary.data?.balance)}
          value={compactMoneyAbs(summary.data?.balance)}
          tone={Number(summary.data?.balance ?? 0) < 0 ? "negative" : "positive"}
          onClick={() => openMetricTransactions(undefined, "Saldo")}
        />
        <MetricCard
          icon={Gauge}
          label="Taxa de poupança"
          title={percent(summary.data?.savings_rate)}
          value={percentAbs(summary.data?.savings_rate)}
          helper="Saldo dividido por receitas"
          tone={Number(summary.data?.savings_rate ?? 0) < 0 ? "negative" : "positive"}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Qualidade"
          value={percent(quality.data?.categorized_ratio)}
          helper={`${quality.data?.uncategorized_count ?? 0} sem categoria`}
          tone={qualityTone(quality.data?.categorized_ratio)}
        />
      </section>

      <section className="dashboard-wide-chart">
        <Panel title="Fluxo mensal" description={cashflowDescription(period)}>
          <ChartBox loading={cashflow.isLoading} empty={!cashflow.data?.items.length} size="large">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={cashflow.data?.items ?? []}
                margin={{ top: 16, right: 22, bottom: 8, left: 8 }}
                onClick={openMonthlyTransactions}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={monthTickLabel} tickLine={false} axisLine={false} />
                <YAxis
                  allowDataOverflow={false}
                  domain={cashflowAxisDomain}
                  tickFormatter={compactMoneyAxis}
                  tickLine={false}
                  axisLine={false}
                  width={76}
                />
                <Tooltip
                  formatter={(value, name) => [chartMoneyLabel(String(value), String(name)), chartSeriesLabel(String(name))]}
                  labelFormatter={monthTickLabel}
                />
                <Legend />
                <Line name="Receitas" type="monotone" dataKey="income" stroke="#0f9f6e" strokeWidth={2} />
                <Line name="Despesas" type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} />
                <Line name="Pgto. fatura" type="monotone" dataKey="payments" stroke="#2563eb" strokeWidth={2} />
                <Line
                  name="Saldo"
                  type="monotone"
                  dataKey="balance"
                  stroke="#6d5dfc"
                  strokeDasharray="6 5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>
      </section>

      <Panel title="Resumo narrativo" description="Leitura do período para orientar a próxima ação.">
        <DashboardStory
          merchants={merchants.data?.items ?? []}
          period={period}
          quality={quality.data}
          ranking={ranking.data?.items ?? []}
          summary={summary.data}
        />
      </Panel>

      <section className="dashboard-grid">
        <Panel title="Gastos por categoria" description="Ranking de despesas classificadas e pendentes.">
          <ChartBox loading={ranking.isLoading} empty={!ranking.data?.items.length}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking.data?.items ?? []} margin={{ top: 16, right: 14, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="category_name" tickFormatter={shortChartLabel} tickLine={false} axisLine={false} />
                <YAxis
                  allowDataOverflow={false}
                  domain={categoryAxisDomain}
                  tickFormatter={compactMoneyAxis}
                  tickLine={false}
                  axisLine={false}
                  width={76}
                />
                <Tooltip formatter={(value, name) => [moneyAbs(String(value)), chartSeriesLabel(String(name))]} />
                <Bar
                  cursor="pointer"
                  dataKey="amount"
                  fill="#dc2626"
                  onClick={(data) => {
                    const item = data.payload as CategoryRankingItem | undefined;
                    if (item) openCategoryTransactions(item);
                  }}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <CategorySummaryList
            items={ranking.data?.items ?? []}
            loading={ranking.isLoading}
            onOpenCategory={openCategoryTransactions}
          />
        </Panel>
        <Panel title="Maiores descrições" description="Estabelecimentos normalizados com maior impacto no período.">
          <MerchantRankingList
            items={merchants.data?.items ?? []}
            loading={merchants.isLoading}
            onOpenMerchant={(description) => {
              onOpenTransactions({
                dateFrom: period.dateFrom,
                dateTo: period.dateTo,
                direction: "debit",
                label: description,
                periodPreset: period.periodPreset,
                search: description,
              });
            }}
          />
        </Panel>
      </section>

      <section className="dashboard-grid">
        <Panel title="Gastos por dia da semana" description="Padrão de despesas por dia dentro do período filtrado.">
          <ChartBox loading={weekdaySpending.isLoading} empty={!hasWeekdaySpending(weekdaySpending.data?.items)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdaySpending.data?.items ?? []} margin={{ top: 16, right: 14, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="weekday_name" tickFormatter={shortWeekdayLabel} tickLine={false} axisLine={false} />
                <YAxis
                  allowDataOverflow={false}
                  domain={weekdayAxisDomain}
                  tickFormatter={compactMoneyAxis}
                  tickLine={false}
                  axisLine={false}
                  width={76}
                />
                <Tooltip formatter={(value, name) => [moneyAbs(String(value)), chartSeriesLabel(String(name))]} />
                <Bar
                  cursor="pointer"
                  dataKey="amount"
                  fill="#2563eb"
                  onClick={(data) => {
                    const item = data.payload as WeekdaySpendingItem | undefined;
                    if (!item || item.count === 0) return;
                    onOpenTransactions({
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      direction: "debit",
                      label: item.weekday_name,
                      periodPreset: period.periodPreset,
                      weekday: item.weekday,
                    });
                  }}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <WeekdaySummaryList
            items={weekdaySpending.data?.items ?? []}
            loading={weekdaySpending.isLoading}
            onOpenWeekday={(item) => {
              onOpenTransactions({
                dateFrom: period.dateFrom,
                dateTo: period.dateTo,
                direction: "debit",
                label: item.weekday_name,
                periodPreset: period.periodPreset,
                weekday: item.weekday,
              });
            }}
          />
        </Panel>
        <Panel title="Leitura rápida" description="Atalhos para comparar comportamento no período.">
          <WeekdayInsight items={weekdaySpending.data?.items ?? []} loading={weekdaySpending.isLoading} />
        </Panel>
      </section>

      <section className="dashboard-grid compact">
        <Panel title="Alertas" description="Pontos que merecem atenção no período selecionado.">
          <DashboardAlerts
            categoryGrowth={categoryGrowth.data?.items ?? []}
            onOpenTransactions={onOpenTransactions}
            onNavigate={onNavigate}
            onOpenImports={onOpenImports}
            period={period}
            quality={quality.data}
            summary={summary.data}
          />
        </Panel>
        <Panel title="Saúde dos dados" description="Indicadores de confiabilidade para os gráficos.">
          <div className="quality-list">
            <QualityRow label="Transações" value={quality.data?.transaction_count ?? 0} />
            <QualityRow label="Categorizadas" value={quality.data?.categorized_count ?? 0} />
            <QualityRow
              disabled={(quality.data?.uncategorized_count ?? 0) === 0}
              label="Sem categoria"
              onClick={() => onNavigate("review")}
              value={quality.data?.uncategorized_count ?? 0}
              warn
            />
            <QualityRow
              disabled={(quality.data?.imports_with_errors ?? 0) === 0}
              label="Importações com erro"
              onClick={() => onOpenImports({ issueFilter: "with_errors", label: "Importações com erro" })}
              value={quality.data?.imports_with_errors ?? 0}
              warn
            />
            <QualityRow
              disabled={(quality.data?.duplicate_imports ?? 0) === 0}
              label="Duplicados ignorados"
              onClick={() => onOpenImports({ label: "Duplicados ignorados", statusFilter: "duplicate_file" })}
              value={quality.data?.duplicate_imports ?? 0}
            />
          </div>
          <div className="panel-actions">
            {(quality.data?.uncategorized_count ?? 0) === 0 &&
            (quality.data?.imports_with_errors ?? 0) === 0 &&
            (quality.data?.duplicate_imports ?? 0) === 0 ? (
              <InlineSuccess message="Nenhuma ação pendente nos dados do período." />
            ) : null}
          </div>
        </Panel>
        <Panel title="Conciliação de fatura" description="Pagamentos de cartão que parecem corresponder entre conta e fatura.">
          <PaymentMatchList
            items={paymentMatches.data?.items ?? []}
            loading={paymentMatches.isLoading}
            onOpenMatch={(item, side) => {
              onOpenTransactions({
                dateFrom: side === "bank" ? item.bank_date : item.card_date,
                dateTo: side === "bank" ? item.bank_date : item.card_date,
                direction: "payment",
                label: side === "bank" ? "Pagamento no extrato" : "Pagamento na fatura",
                periodPreset: "custom",
                search: side === "bank" ? item.bank_description : item.card_description,
              });
            }}
          />
        </Panel>
        <RecentTransactions
          onOpenTransactions={onOpenTransactions}
          periodQuery={period.query}
          session={session}
        />
      </section>
    </section>
  );
}

function DashboardAlerts({
  categoryGrowth,
  onNavigate,
  onOpenImports,
  onOpenTransactions,
  period,
  quality,
  summary,
}: {
  categoryGrowth: CategoryGrowthAlertItem[];
  onNavigate: (page: Page) => void;
  onOpenImports: (drilldown?: ImportDrilldown) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  period: ReturnType<typeof usePeriod>;
  quality?: DataQuality;
  summary?: DashboardSummary;
}) {
  const alerts = dashboardAlerts({ categoryGrowth, period, quality, summary });
  if (!alerts.length) {
    return <InlineSuccess message="Nenhum alerta relevante para o período." />;
  }
  return (
    <div className="alert-list">
      {alerts.map((alert) => {
        const Icon = alert.icon;
        const target = alert.target;
        const isClickable = target || alert.transactionDrilldown;
        const className = `alert-item ${alert.tone}${isClickable ? " clickable" : ""}`;
        const content = (
          <>
            <Icon size={18} />
            <span>
              <strong>{alert.title}</strong>
              <small>{alert.description}</small>
            </span>
          </>
        );
        if (isClickable) {
          return (
            <button
              className={className}
              key={alert.title}
              onClick={() => {
                if (alert.importDrilldown) {
                  onOpenImports(alert.importDrilldown);
                  return;
                }
                if (alert.transactionDrilldown) {
                  onOpenTransactions(alert.transactionDrilldown);
                  return;
                }
                if (!target) return;
                onNavigate(target);
              }}
              type="button"
            >
              {content}
            </button>
          );
        }
        return (
          <div className={className} key={alert.title}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function DashboardStory({
  merchants,
  period,
  quality,
  ranking,
  summary,
}: {
  merchants: Array<{ description: string; amount: string; count: number }>;
  period: ReturnType<typeof usePeriod>;
  quality?: DataQuality;
  ranking: Array<{ category_id: string | null; category_name: string; amount: string; count: number }>;
  summary?: DashboardSummary;
}) {
  if (!summary || !quality) {
    return <PageState icon={Loader2} title="Montando resumo" description="Aguarde um momento." spin compact />;
  }

  const balance = Number(summary.balance);
  const topCategory = ranking[0];
  const topMerchant = merchants[0];
  const tone = balance < 0 ? "negative" : "positive";

  return (
    <div className="story-panel">
      <p>
        Em <strong>{periodSummary(period)}</strong>, sua carteira fechou com saldo{" "}
        <strong className={tone}>{balance < 0 ? "negativo" : "positivo"} de {moneyAbs(summary.balance)}</strong>.
        {" "}As despesas somaram <strong className="negative">{moneyAbs(summary.expenses)}</strong> e as receitas
        somaram <strong className="positive"> {moneyAbs(summary.income)}</strong>.
      </p>
      {Number(summary.payments) > 0 ? (
        <p>
          Pagamentos de fatura somaram <strong className="info">{moneyAbs(summary.payments)}</strong> e estão separados
          das despesas para evitar dupla contagem.
        </p>
      ) : null}
      {topCategory ? (
        <p>
          O maior peso por categoria foi <strong>{topCategory.category_name}</strong>, com{" "}
          <strong className="negative">{moneyAbs(topCategory.amount)}</strong>.
        </p>
      ) : null}
      {topMerchant ? (
        <p>
          Entre as descrições normalizadas, <strong>{topMerchant.description}</strong> concentrou{" "}
          <strong className="negative">{moneyAbs(topMerchant.amount)}</strong> em {topMerchant.count} lançamento
          {topMerchant.count === 1 ? "" : "s"}.
        </p>
      ) : null}
      <p>
        A qualidade da categorização está em <strong className={qualityTone(quality.categorized_ratio)}>
          {percent(quality.categorized_ratio)}
        </strong>
        {quality.uncategorized_count > 0
          ? `, com ${quality.uncategorized_count} transação${quality.uncategorized_count === 1 ? "" : "ões"} pendente${quality.uncategorized_count === 1 ? "" : "s"} de categoria.`
          : ", sem pendências de categoria no período."}
      </p>
    </div>
  );
}

function ImportsPage({
  drilldown,
  onOpenTransactions,
  session,
}: {
  drilldown: ImportDrilldown;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const queryClient = useQueryClient();
  const [selectedImport, setSelectedImport] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(drilldown?.statusFilter ?? "");
  const [issueFilter, setIssueFilter] = useState(drilldown?.issueFilter ?? "");
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);
  const [previewResults, setPreviewResults] = useState<BatchPreviewResult[]>([]);
  const [uploadSourceKind, setUploadSourceKind] = useState("auto");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (issueFilter === "with_errors") params.set("has_errors", "true");
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `?${params.toString()}`;
  }, [issueFilter, page, search, statusFilter]);
  const imports = useQuery({
    queryKey: ["imports", session.token, query],
    queryFn: () => getImports(session, query),
  });
  const selectedImportJob = (imports.data?.items ?? []).find((item) => item.id === selectedImport);
  const totalImports = imports.data?.total ?? 0;
  const nextPageDisabled = imports.isLoading || (page + 1) * pageSize >= totalImports;
  const errors = useQuery({
    queryKey: ["import-errors", session.token, selectedImport],
    queryFn: () => getImportErrors(session, selectedImport ?? ""),
    enabled: Boolean(selectedImport),
  });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const results: BatchUploadResult[] = [];
      setBatchResults([]);
      for (const file of files) {
        try {
          const result = await uploadImport(session, file, uploadSourceKind);
          results.push({ fileName: file.name, result, status: "success" });
        } catch (error) {
          results.push({
            errorMessage: apiErrorMessage(error, "Falha ao importar arquivo."),
            fileName: file.name,
            status: "error",
          });
        }
        setBatchResults([...results]);
      }
      return results;
    },
    onSuccess: () => {
      setPreviewResults([]);
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
  const preview = useMutation({
    mutationFn: async (files: File[]) => {
      const results: BatchPreviewResult[] = [];
      setBatchResults([]);
      setPreviewResults([]);
      for (const file of files) {
        try {
          const result = await previewImport(session, file, uploadSourceKind);
          results.push({ file, fileName: file.name, preview: result, status: "success" });
        } catch (error) {
          results.push({
            errorMessage: apiErrorMessage(error, "Falha ao pré-visualizar arquivo."),
            file,
            fileName: file.name,
            status: "error",
          });
        }
        setPreviewResults([...results]);
      }
      return results;
    },
  });
  const importablePreviewFiles = previewResults
    .filter((item): item is Extract<BatchPreviewResult, { status: "success" }> => item.status === "success")
    .filter((item) => !item.preview.duplicate_file && item.preview.valid_rows > 0)
    .map((item) => item.file);

  return (
    <section className="page-stack">
      <PageHeader title="Importações" description="Envie TXT/CSV, acompanhe status e revise erros por linha." />
      <Panel title="Upload" description="MVP aceita arquivos TXT e CSV. PDF fica para fase posterior.">
        <div className="upload-options">
          <label>
            Layout
            <select
              disabled={upload.isPending || preview.isPending}
              value={uploadSourceKind}
              onChange={(event) => setUploadSourceKind(event.target.value)}
            >
              <option value="auto">Detectar automaticamente</option>
              <option value="bank_statement_txt">Extrato TXT</option>
              <option value="credit_card_csv">Fatura CSV</option>
            </select>
          </label>
        </div>
        <label className="upload-zone">
          <UploadCloud size={28} />
          <strong>
            {preview.isPending ? "Gerando prévia..." : upload.isPending ? "Importando lote..." : "Selecionar arquivos"}
          </strong>
          <span>Selecione um ou mais TXT/CSV, revise a prévia e confirme para gravar.</span>
          <input
            accept=".txt,.csv,text/plain,text/csv"
            disabled={upload.isPending || preview.isPending}
            multiple
            type="file"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) preview.mutate(files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {previewResults.length ? (
          <BatchPreviewSummary
            disabled={!importablePreviewFiles.length || upload.isPending}
            onConfirm={() => upload.mutate(importablePreviewFiles)}
            results={previewResults}
          />
        ) : null}
        {batchResults.length ? <BatchUploadSummary results={batchResults} /> : null}
      </Panel>

      <Panel title="Histórico" description="Status operacional de cada arquivo processado.">
        <div className="filters">
          <label>
            <Search size={16} />
            <input
              placeholder="Buscar arquivo"
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
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos os status</option>
              <option value="completed">Concluído</option>
              <option value="completed_with_errors">Concluído com erros</option>
              <option value="duplicate_file">Arquivo duplicado</option>
              <option value="failed">Falhou</option>
            </select>
          </label>
          <label>
            <FileWarning size={16} />
            <select
              value={issueFilter}
              onChange={(event) => {
                setIssueFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas as ocorrências</option>
              <option value="with_errors">Somente com erros</option>
            </select>
          </label>
          <button
            className="ghost-button filter-clear"
            disabled={!search && !statusFilter && !issueFilter}
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setIssueFilter("");
              setPage(0);
            }}
            type="button"
          >
            Limpar filtros
          </button>
        </div>
        <div className="filter-summary">
          <span>{importFilterSummary({ issueFilter, search, statusFilter })}</span>
          <strong>{totalImports} importações</strong>
        </div>
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
                <td className="row-actions">
                  <button
                    className="ghost-button compact"
                    disabled={item.valid_rows === 0}
                    onClick={() => {
                      onOpenTransactions({
                        importJobId: item.id,
                        label: item.source_file?.original_filename ?? "Importação",
                      });
                    }}
                    type="button"
                  >
                    Transações
                  </button>
                  <button className="icon-button" onClick={() => setSelectedImport(item.id)}>
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
        <div className="pagination-bar">
          <button
            className="ghost-button"
            disabled={page === 0 || imports.isLoading}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} · {(imports.data?.items ?? []).length} de {totalImports} importações
          </span>
          <button
            className="ghost-button"
            disabled={nextPageDisabled}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </div>
      </Panel>

      {selectedImport ? (
        <Drawer title="Detalhe da importação" onClose={() => setSelectedImport(null)}>
          {selectedImportJob ? <ImportDetailSummary item={selectedImportJob} /> : null}
          <h3 className="drawer-section-title">Erros por linha</h3>
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

function BatchUploadSummary({ results }: { results: BatchUploadResult[] }) {
  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.length - successCount;
  return (
    <div className="batch-upload-summary">
      <div className="batch-upload-head">
        <strong>
          {successCount} arquivo{successCount === 1 ? "" : "s"} importado{successCount === 1 ? "" : "s"}
        </strong>
        {errorCount > 0 ? (
          <span className="negative">{errorCount} falha{errorCount === 1 ? "" : "s"}</span>
        ) : (
          <span className="positive">Lote concluído</span>
        )}
      </div>
      <div className="batch-upload-list">
        {results.map((item) => (
          <div className="batch-upload-row" key={item.fileName}>
            <span>
              <strong>{item.fileName}</strong>
              {item.status === "success" ? (
                <small>
                  {item.result.valid_rows} novas · {item.result.duplicate_rows} duplicadas · {item.result.error_rows} erros
                </small>
              ) : (
                <small>{item.errorMessage}</small>
              )}
            </span>
            <StatusBadge status={item.status === "success" ? item.result.status : "failed"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchPreviewSummary({
  disabled,
  onConfirm,
  results,
}: {
  disabled: boolean;
  onConfirm: () => void;
  results: BatchPreviewResult[];
}) {
  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.length - successCount;
  const duplicateCount = results.filter((item) => item.status === "success" && item.preview.duplicate_file).length;
  const importableCount = results.filter(
    (item) => item.status === "success" && !item.preview.duplicate_file && item.preview.valid_rows > 0,
  ).length;
  return (
    <div className="batch-upload-summary">
      <div className="batch-upload-head">
        <strong>
          Prévia de {successCount} arquivo{successCount === 1 ? "" : "s"}
        </strong>
        <span className={errorCount || duplicateCount ? "warning" : "positive"}>
          {importableCount} pronto{importableCount === 1 ? "" : "s"} para importar
        </span>
      </div>
      <div className="batch-upload-list">
        {results.map((item) => (
          <div className="batch-upload-row" key={item.fileName}>
            <span>
              <strong>{item.fileName}</strong>
              {item.status === "success" ? (
                <small>
                  {sourceKindLabel(item.preview.source_kind)} · {item.preview.valid_rows} válidas ·{" "}
                  {item.preview.duplicate_rows} duplicadas · {item.preview.error_rows} erros
                  {item.preview.items.length ? ` · ${item.preview.items[0].description}` : ""}
                </small>
              ) : (
                <small>{item.errorMessage}</small>
              )}
            </span>
            <StatusBadge
              status={
                item.status === "error"
                  ? "failed"
                  : item.preview.duplicate_file
                    ? "duplicate_file"
                    : item.preview.error_rows
                      ? "completed_with_errors"
                      : "completed"
              }
            />
          </div>
        ))}
      </div>
      <div className="batch-upload-actions">
        <button className="primary-button" disabled={disabled} onClick={onConfirm} type="button">
          Confirmar importação
        </button>
      </div>
    </div>
  );
}

function ImportDetailSummary({ item }: { item: ImportJobRead }) {
  const file = item.source_file;
  return (
    <div className="import-detail">
      <div className="import-detail-header">
        <div>
          <p className="eyebrow">Arquivo</p>
          <h3>{file?.original_filename ?? "Arquivo sem metadados"}</h3>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="detail-grid">
        <QualityRow label="Status" value={statusLabel(item.status)} />
        <QualityRow label="Parser" value={sourceKindLabel(file?.source_kind)} />
        <QualityRow label="Tipo MIME" value={file?.mime_type ?? "-"} />
        <QualityRow label="Tamanho" value={file ? fileSizeLabel(file.size_bytes) : "-"} />
        <QualityRow label="Linhas totais" value={item.total_rows} />
        <QualityRow label="Novas" value={item.valid_rows} />
        <QualityRow label="Duplicadas" value={item.duplicate_rows} />
        <QualityRow label="Erros" value={item.error_rows} warn={item.error_rows > 0} />
        <QualityRow label="Recebido em" value={file ? dateLabel(file.received_at) : "-"} />
        <QualityRow label="Processado em" value={item.finished_at ? dateLabel(item.finished_at) : "-"} />
      </div>
    </div>
  );
}

function TransactionsPage({
  drilldown,
  session,
}: {
  drilldown: TransactionDrilldown;
  session: ApiSession;
}) {
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  const drilldownKey = [
    drilldown?.categoryId ?? "all",
    drilldown?.dateFrom ?? "",
    drilldown?.dateTo ?? "",
    drilldown?.direction ?? "",
    drilldown?.importJobId ?? "",
    drilldown?.search ?? "",
    drilldown?.weekday ?? "",
  ].join("-");
  return (
    <TransactionExplorer
      key={drilldownKey}
      initialCategoryId={drilldown?.categoryId ?? ""}
      initialDateFrom={drilldown?.dateFrom ?? ""}
      initialDateTo={drilldown?.dateTo ?? ""}
      initialDirection={drilldown?.direction ?? ""}
      initialImportJobId={drilldown?.importJobId ?? ""}
      initialMessage={drilldown?.label ? `Filtro aplicado pelo gráfico: ${drilldown.label}.` : ""}
      initialPeriodPreset={drilldown?.periodPreset ?? "all"}
      initialSearch={drilldown?.search ?? ""}
      initialWeekday={drilldown?.weekday}
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
  const [form, setForm] = useState<RuleFormState>(emptyRuleForm);
  const [ruleFormError, setRuleFormError] = useState("");
  const [previewRule, setPreviewRule] = useState<CategorizationRuleRead | null>(null);
  const preview = useQuery({
    queryKey: ["rule-preview", session.token, previewRule?.id],
    queryFn: () => getRulePreview(session, previewRule?.id ?? ""),
    enabled: Boolean(previewRule),
  });
  const rulePayload = {
    name: form.name,
    field: form.field,
    match_type: form.match_type,
    pattern: form.pattern,
    category_id: form.category_id || null,
    target_direction: form.target_direction || null,
    priority: form.priority,
    active: form.active,
  };
  const create = useMutation({
    mutationFn: () => createRule(session, rulePayload),
    onSuccess: () => {
      setForm(emptyRuleForm);
      setRuleFormError("");
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
  const update = useMutation({
    mutationFn: () => updateRule(session, form.id ?? "", rulePayload),
    onSuccess: () => {
      setForm(emptyRuleForm);
      setRuleFormError("");
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
  const saving = create.isPending || update.isPending;

  function validateRuleForm() {
    const missingFields = [
      !form.name.trim() ? "nome" : "",
      !form.pattern.trim() ? "padrão" : "",
      !form.category_id && !form.target_direction ? "ação da regra" : "",
      !form.priority || form.priority < 1 ? "prioridade" : "",
    ].filter(Boolean);
    if (missingFields.length) {
      setRuleFormError(`Preencha: ${missingFields.join(", ")}.`);
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
    });
    setRuleFormError("");
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Regras"
        description="Automatize categorias e tipos financeiros. Categorias manuais sempre prevalecem."
        action={
          <button className="secondary-button" onClick={() => apply.mutate()} disabled={apply.isPending}>
            <RefreshCw className={apply.isPending ? "spin" : ""} size={16} />
            {apply.isPending ? "Aplicando..." : "Aplicar regras"}
          </button>
        }
      />
      <Panel title={form.id ? "Editar regra" : "Nova regra"}>
        <form
          className="rule-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validateRuleForm()) return;
            if (form.id) update.mutate();
            else create.mutate();
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
          <label>
            Tipo financeiro
            <select
              value={form.target_direction}
              onChange={(event) => setForm({ ...form, target_direction: event.target.value })}
            >
              <option value="">Não alterar</option>
              <option value="payment">Pagamento de fatura</option>
              <option value="debit">Despesa</option>
              <option value="credit">Receita</option>
            </select>
          </label>
          <label className="toggle-line">
            <input
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
              type="checkbox"
            />
            Ativa
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
          <div className="rule-submit-group">
            <button className="primary-button rule-submit" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar" : "Criar"}
            </button>
            {form.id ? (
              <button className="ghost-button" type="button" onClick={() => setForm(emptyRuleForm)}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
        {ruleFormError ? <InlineError message={ruleFormError} /> : null}
        {create.isError ? <InlineError message={apiErrorMessage(create.error, "Falha ao criar regra.")} /> : null}
        {update.isError ? <InlineError message={apiErrorMessage(update.error, "Falha ao salvar regra.")} /> : null}
      </Panel>
      {apply.data ? (
        <InlineSuccess
          message={`${apply.data.applied_count} transações alteradas: ${apply.data.category_applied_count} categorias e ${apply.data.direction_applied_count} tipos financeiros.`}
        />
      ) : null}
      {apply.isError ? <InlineError message={apiErrorMessage(apply.error, "Falha ao aplicar regras.")} /> : null}
      <Panel title="Regras cadastradas">
        <ResponsiveTable loading={rules.isLoading} empty={!rules.data?.items.length} emptyMessage="Nenhuma regra criada.">
          <thead>
            <tr>
              <th>Prior.</th>
              <th>Nome</th>
              <th>Condição</th>
              <th>Categoria</th>
              <th>Tipo financeiro</th>
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
                onEdit={() => editRule(rule)}
                onPreview={() => setPreviewRule(rule)}
                rule={rule}
              />
            ))}
          </tbody>
        </ResponsiveTable>
      </Panel>
      {previewRule ? (
        <RulePreviewDrawer
          categories={categories.data?.items ?? []}
          loading={preview.isLoading}
          onClose={() => setPreviewRule(null)}
          preview={preview.data}
          rule={previewRule}
        />
      ) : null}
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
  const queryClient = useQueryClient();
  const normalizeDescriptions = useMutation({
    mutationFn: () => normalizeTransactionDescriptions(session),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
    },
  });

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
      <Panel
        title="Manutenção dos dados"
        description="Ações controladas para alinhar dados já importados com regras atuais."
      >
        <div className="maintenance-action">
          <div>
            <strong>Reprocessar descrições normalizadas</strong>
            <p>
              Atualiza a descrição operacional das transações existentes preservando a descrição original.
            </p>
          </div>
          <button
            className="secondary-button"
            disabled={normalizeDescriptions.isPending}
            onClick={() => normalizeDescriptions.mutate()}
          >
            {normalizeDescriptions.isPending ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            Reprocessar
          </button>
        </div>
        {normalizeDescriptions.isSuccess ? (
          <InlineSuccess
            message={`${normalizeDescriptions.data.changed_count} de ${normalizeDescriptions.data.scanned_count} transações foram atualizadas.`}
          />
        ) : null}
        {normalizeDescriptions.isError ? (
          <InlineError message={apiErrorMessage(normalizeDescriptions.error, "Falha ao reprocessar descrições.")} />
        ) : null}
      </Panel>
    </section>
  );
}

function TransactionExplorer({
  initialCategoryId = "",
  initialDateFrom = "",
  initialDateTo = "",
  initialDirection = "",
  initialImportJobId = "",
  initialMessage = "",
  initialPeriodPreset = "all",
  initialSearch = "",
  initialWeekday,
  session,
  title,
  description,
  onSelect,
  selected,
  fixedQuery,
  reviewMode = false,
}: {
  initialCategoryId?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialDirection?: string;
  initialImportJobId?: string;
  initialMessage?: string;
  initialPeriodPreset?: TransactionPeriodPreset;
  initialSearch?: string;
  initialWeekday?: number;
  session: ApiSession;
  title: string;
  description: string;
  onSelect: (transaction: TransactionRead | null) => void;
  selected: TransactionRead | null;
  fixedQuery?: string;
  reviewMode?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [sourceType, setSourceType] = useState("");
  const [direction, setDirection] = useState(initialDirection);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [importJobId, setImportJobId] = useState(initialImportJobId);
  const [periodPreset, setPeriodPreset] = useState<TransactionPeriodPreset>(initialPeriodPreset);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [weekday, setWeekday] = useState<number | undefined>(initialWeekday);
  const [sortBy, setSortBy] = useState("transaction_date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [actionMessage, setActionMessage] = useState(initialMessage);
  const pageSize = 50;
  const categories = useCategories(session);
  const queryClient = useQueryClient();
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (sourceType) params.set("source_type", sourceType);
    if (direction) params.set("direction", direction);
    if (importJobId) params.set("import_job_id", importJobId);
    if (categoryId && fixedQuery !== "category_id=__uncategorized__") {
      params.set("category_id", categoryId);
    }
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (weekday !== undefined) params.set("weekday", String(weekday));
    params.set("sort_by", sortBy);
    params.set("sort_dir", sortDir);
    if (fixedQuery && fixedQuery !== "category_id=__uncategorized__") {
      const [key, value] = fixedQuery.split("=");
      params.set(key, value);
    }
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `?${params.toString()}`;
  }, [categoryId, dateFrom, dateTo, direction, fixedQuery, importJobId, page, search, sortBy, sortDir, sourceType, weekday]);
  const transactions = useQuery({
    queryKey: ["transactions", session.token, query],
    queryFn: () => getTransactions(session, query),
  });
  const remove = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(session, transactionId),
    onSuccess: () => {
      onSelect(null);
      setActionMessage("Transação excluída. Indicadores e listas foram atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["weekday-spending"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  const visibleTransactions =
    fixedQuery === "category_id=__uncategorized__"
      ? (transactions.data?.items ?? []).filter((transaction) => !transaction.category)
      : transactions.data?.items ?? [];
  const totalTransactions =
    fixedQuery === "category_id=__uncategorized__" ? visibleTransactions.length : transactions.data?.total ?? 0;
  const nextPageDisabled =
    transactions.isLoading || fixedQuery === "category_id=__uncategorized__"
      ? visibleTransactions.length < pageSize
      : (page + 1) * pageSize >= totalTransactions;
  const activeFilterCount = [
    search,
    sourceType,
    direction,
    importJobId,
    !reviewMode ? categoryId : "",
    dateFrom || dateTo,
    weekday !== undefined ? String(weekday) : "",
  ].filter(Boolean).length;
  const emptyMessage = activeFilterCount
    ? "Nenhuma transação encontrada para os filtros selecionados."
    : reviewMode
      ? "Nenhuma transação pendente de categoria."
      : "Nenhuma transação encontrada.";
  const filterSummary = transactionFilterSummary({
    categoryId,
    categories: categories.data?.items ?? [],
    dateFrom,
    dateTo,
    direction,
    importJobId,
    periodPreset,
    reviewMode,
    search,
    sourceType,
    weekday,
  });
  function toggleSort(nextSortBy: string) {
    setPage(0);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir(nextSortBy === "transaction_date" ? "desc" : "asc");
  }

  function applyPeriodPreset(nextPreset: TransactionPeriodPreset) {
    setPeriodPreset(nextPreset);
    setPage(0);
    const range = periodRange(nextPreset);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  }

  function updateDateFrom(value: string) {
    setPeriodPreset("custom");
    setDateFrom(value);
    setPage(0);
  }

  function updateDateTo(value: string) {
    setPeriodPreset("custom");
    setDateTo(value);
    setPage(0);
  }

  function clearFilters() {
    setSearch("");
    setSourceType("");
    setDirection("");
    setCategoryId("");
    setImportJobId("");
    setWeekday(undefined);
    setPeriodPreset("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
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
          {!reviewMode ? (
            <label>
              <Tags size={16} />
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas as categorias</option>
                {orderedCategoryOptions(categories.data?.items ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
          <label>
            <Filter size={16} />
            <select value={periodPreset} onChange={(event) => applyPeriodPreset(event.target.value as TransactionPeriodPreset)}>
              <option value="all">Todos os períodos</option>
              <option value="current_month">Mês atual</option>
              <option value="previous_month">Mês anterior</option>
              <option value="current_year">Ano atual</option>
              <option value="previous_year">Ano anterior</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <label className="date-filter">
            De
            <input type="date" value={dateFrom} onChange={(event) => updateDateFrom(event.target.value)} />
          </label>
          <label className="date-filter">
            Até
            <input type="date" value={dateTo} onChange={(event) => updateDateTo(event.target.value)} />
          </label>
          <button className="ghost-button filter-clear" disabled={!activeFilterCount} onClick={clearFilters} type="button">
            Limpar filtros
          </button>
        </div>
        <div className="filter-summary">
          <span>{filterSummary}</span>
          <strong>{totalTransactions} lançamentos</strong>
        </div>
      </Panel>
      {actionMessage ? <InlineSuccess message={actionMessage} /> : null}
      <Panel title={reviewMode ? "Pendências" : "Lançamentos"}>
        <ResponsiveTable
          loading={transactions.isLoading}
          empty={!visibleTransactions.length}
          emptyMessage={emptyMessage}
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
                onDelete={() => {
                  if (window.confirm(`Excluir a transação "${transaction.description}"? Esta ação não pode ser desfeita no MVP.`)) {
                    remove.mutate(transaction.id);
                  }
                }}
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
            Página {page + 1} · {visibleTransactions.length} de {totalTransactions} lançamentos
          </span>
          <button
            className="ghost-button"
            disabled={nextPageDisabled}
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
            deleting={remove.isPending}
            onDelete={() => {
              if (window.confirm(`Excluir a transação "${selected.description}"? Esta ação não pode ser desfeita no MVP.`)) {
                remove.mutate(selected.id);
              }
            }}
            session={session}
            transaction={selected}
          />
        </Drawer>
      ) : null}
      {remove.isError ? <InlineError message={apiErrorMessage(remove.error, "Falha ao excluir transação.")} /> : null}
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
  onDelete,
  onSelect,
  onCategorized,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  session: ApiSession;
  onDelete: () => void;
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
      <td><DirectionPicker session={session} transaction={transaction} /></td>
      <td className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</td>
      <td><CategoryPicker categories={categories} onCategorized={onCategorized} session={session} transaction={transaction} /></td>
      <td><SourceBadge source={transaction.category?.source} label={categoryLabel} /></td>
      <td>
        <div className="row-actions">
          <button className="icon-button danger" onClick={onDelete} title="Excluir transação" type="button">
            <Trash2 size={16} />
          </button>
          <button className="icon-button" onClick={onSelect} title="Ver detalhe" type="button">
            <ChevronRight size={16} />
          </button>
        </div>
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
    mutationFn: (categoryId: string | null) => updateTransactionCategory(session, transaction.id, categoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      onCategorized?.();
    },
  });
  return (
    <select
      className="table-select"
      value={transaction.category?.category_id ?? ""}
      onChange={(event) => mutation.mutate(event.target.value || null)}
    >
      <option value="">Sem categoria</option>
      {categoryOptions.map((category) => (
        <option key={category.id} value={category.id}>{category.label}</option>
      ))}
    </select>
  );
}

function DirectionPicker({ transaction, session }: { transaction: TransactionRead; session: ApiSession }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (direction: string) => updateTransactionDirection(session, transaction.id, direction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["weekday-spending"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-card-payment-matches"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  return (
    <select
      className={`table-select direction-select ${transaction.direction}`}
      disabled={mutation.isPending}
      value={transaction.direction}
      onChange={(event) => mutation.mutate(event.target.value)}
    >
      <option value="debit">Despesa</option>
      <option value="credit">Receita/Crédito</option>
      <option value="payment">Pagamento de fatura</option>
    </select>
  );
}

function TransactionDetail({
  transaction,
  categories,
  deleting = false,
  onDelete,
  session,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  deleting?: boolean;
  onDelete?: () => void;
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
      <div>
        <p className="field-label">Tipo financeiro</p>
        <DirectionPicker session={session} transaction={transaction} />
      </div>
      <QualityRow
        label="Valor"
        value={<span className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</span>}
      />
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
      {onDelete ? (
        <div className="danger-zone">
          <div>
            <strong>Excluir transação</strong>
            <p>Remove este lançamento e sua classificação dos indicadores do MVP.</p>
          </div>
          <button className="danger-button" disabled={deleting} onClick={onDelete} type="button">
            {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            Excluir
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RecentTransactions({
  onOpenTransactions,
  periodQuery,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  periodQuery: string;
  session: ApiSession;
}) {
  const query = periodQuery ? `${periodQuery}&limit=5` : "?limit=5";
  const transactions = useQuery({
    queryKey: ["transactions", session.token, "recent", periodQuery],
    queryFn: () => getTransactions(session, query),
  });
  return (
    <Panel title="Transações recentes" description="Últimos lançamentos do período selecionado.">
      <div className="mini-list">
        {(transactions.data?.items ?? []).map((transaction) => (
          <button
            className="mini-row clickable"
            key={transaction.id}
            onClick={() => {
              onOpenTransactions({
                dateFrom: transaction.transaction_date,
                dateTo: transaction.transaction_date,
                direction: transaction.direction,
                label: transaction.description,
                periodPreset: "custom",
                search: transaction.description,
              });
            }}
            type="button"
          >
            <span>
              {transaction.description}
              <small>{dateLabel(transaction.transaction_date)} · {directionLabel(transaction.direction)}</small>
            </span>
            <strong className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</strong>
          </button>
        ))}
        {!transactions.isLoading && !transactions.data?.items.length ? (
          <EmptyInline message="Importe seu primeiro arquivo para ver lançamentos." />
        ) : null}
      </div>
    </Panel>
  );
}

function PaymentMatchList({
  items,
  loading,
  onOpenMatch,
}: {
  items: CreditCardPaymentMatchItem[];
  loading: boolean;
  onOpenMatch: (item: CreditCardPaymentMatchItem, side: "bank" | "card") => void;
}) {
  if (loading) {
    return <PageState icon={Loader2} title="Buscando pares" description="Aguarde um momento." spin compact />;
  }
  if (!items.length) {
    return <EmptyInline message="Nenhum pagamento conciliável encontrado no período." />;
  }
  return (
    <div className="payment-match-list">
      {items.map((item) => (
        <div className="payment-match-row" key={`${item.bank_transaction_id}-${item.card_transaction_id}`}>
          <div>
            <strong>{moneyAbs(item.amount)}</strong>
            <small>
              {dateLabel(item.bank_date)} no extrato · {dateLabel(item.card_date)} na fatura
              {item.date_delta_days ? ` · diferença de ${item.date_delta_days} dia${item.date_delta_days === 1 ? "" : "s"}` : ""}
            </small>
          </div>
          <div className="payment-match-actions">
            <button className="ghost-button compact" onClick={() => onOpenMatch(item, "bank")} type="button">
              Extrato
            </button>
            <button className="ghost-button compact" onClick={() => onOpenMatch(item, "card")} type="button">
              Fatura
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MerchantRankingList({
  items,
  loading,
  onOpenMerchant,
}: {
  items: Array<{ description: string; amount: string; count: number }>;
  loading: boolean;
  onOpenMerchant: (description: string) => void;
}) {
  if (loading) {
    return <PageState icon={Loader2} title="Carregando ranking" description="Aguarde um momento." spin compact />;
  }
  if (!items.length) {
    return <EmptyInline message="Sem despesas para o período." />;
  }
  return (
    <div className="merchant-list">
      {items.map((item) => (
        <button className="merchant-row clickable" key={item.description} onClick={() => onOpenMerchant(item.description)} type="button">
          <span>
            <strong>{item.description}</strong>
            <small>{item.count} lançamento{item.count === 1 ? "" : "s"}</small>
          </span>
          <strong className="negative">{moneyAbs(item.amount)}</strong>
        </button>
      ))}
    </div>
  );
}

function CategorySummaryList({
  items,
  loading,
  onOpenCategory,
}: {
  items: CategoryRankingItem[];
  loading: boolean;
  onOpenCategory: (item: CategoryRankingItem) => void;
}) {
  if (loading || !items.length) return null;
  return (
    <div className="category-summary-list">
      {items.slice(0, 5).map((item) => (
        <button className="category-summary-row" key={item.category_id ?? "uncategorized"} onClick={() => onOpenCategory(item)} type="button">
          <span>
            <strong>{item.category_name}</strong>
            <small>
              {item.count} transação{item.count === 1 ? "" : "ões"} · {percent(item.share_ratio)} do total
            </small>
          </span>
          <span className="category-summary-values">
            <strong className="negative">{moneyAbs(item.amount)}</strong>
            <small>Ticket médio {moneyAbs(item.average_amount)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function WeekdaySummaryList({
  items,
  loading,
  onOpenWeekday,
}: {
  items: WeekdaySpendingItem[];
  loading: boolean;
  onOpenWeekday: (item: WeekdaySpendingItem) => void;
}) {
  const activeItems = items.filter((item) => item.count > 0);
  if (loading || !activeItems.length) return null;
  return (
    <div className="category-summary-list">
      {activeItems.slice(0, 5).map((item) => (
        <button className="category-summary-row" key={item.weekday} onClick={() => onOpenWeekday(item)} type="button">
          <span>
            <strong>{item.weekday_name}</strong>
            <small>
              {item.count} transação{item.count === 1 ? "" : "ões"} · {percent(item.share_ratio)} do total
            </small>
          </span>
          <span className="category-summary-values">
            <strong className="negative">{moneyAbs(item.amount)}</strong>
            <small>Ticket médio {moneyAbs(item.average_amount)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function WeekdayInsight({ items, loading }: { items: WeekdaySpendingItem[]; loading: boolean }) {
  if (loading) {
    return <PageState icon={Loader2} title="Lendo dias" description="Aguarde um momento." spin compact />;
  }
  const activeItems = items.filter((item) => item.count > 0);
  if (!activeItems.length) {
    return <EmptyInline message="Sem despesas para comparar no período." />;
  }
  const topDay = [...activeItems].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const weekdayAmount = activeItems
    .filter((item) => item.weekday <= 4)
    .reduce((total, item) => total + Number(item.amount), 0);
  const weekendAmount = activeItems
    .filter((item) => item.weekday >= 5)
    .reduce((total, item) => total + Number(item.amount), 0);
  return (
    <div className="story-panel">
      <p>
        O dia com maior gasto foi <strong>{topDay.weekday_name}</strong>, com{" "}
        <strong className="negative">{moneyAbs(topDay.amount)}</strong>.
      </p>
      <p>
        Dias úteis somaram <strong className="negative">{moneyAbs(weekdayAmount)}</strong>; fim de semana somou{" "}
        <strong className="negative">{moneyAbs(weekendAmount)}</strong>.
      </p>
    </div>
  );
}

function RuleRow({
  rule,
  categories,
  onDelete,
  onEdit,
  onPreview,
}: {
  rule: CategorizationRuleRead;
  categories: CategoryRead[];
  onDelete: () => void;
  onEdit: () => void;
  onPreview: () => void;
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
      <td>
        <span className="category-path">
          {rule.category_id ? (category ? categoryPath(category, categories) : "Categoria removida") : "-"}
        </span>
      </td>
      <td>{rule.target_direction ? <DirectionBadge direction={rule.target_direction} /> : "-"}</td>
      <td>{rule.active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}</td>
      <td>
        <div className="row-actions">
          <button className="icon-button" onClick={onPreview} title="Prévia da regra">
            <Search size={16} />
          </button>
          <button className="icon-button" onClick={onEdit} title="Editar regra">
            <Pencil size={16} />
          </button>
          <button className="icon-button danger" onClick={onDelete} title="Excluir regra">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

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
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
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
                      {item.current_category_id ? categoryNames.get(item.current_category_id) ?? "Categoria atual" : "Sem categoria"}
                      {item.target_category_id ? ` -> ${categoryNames.get(item.target_category_id) ?? "Categoria alvo"}` : ""}
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
  onClick,
  title,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  onClick?: () => void;
  title?: string;
  tone?: "positive" | "negative" | "warning" | "info";
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      className={onClick ? "metric-card clickable" : "metric-card"}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={20} />
      </div>
      <strong className={tone} title={title}>{value}</strong>
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
  size = "default",
}: {
  children: ReactNode;
  loading: boolean;
  empty: boolean;
  size?: "default" | "large";
}) {
  const className = size === "large" ? "chart-box large" : "chart-box";
  if (loading) return <div className={`${className} loading`}><Loader2 className="spin" /></div>;
  if (empty) return <div className={className}><EmptyInline message="Sem dados para o período." /></div>;
  return <div className={className}>{children}</div>;
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
  disabled = false,
  label,
  onClick,
  value,
  warn,
}: {
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  value: ReactNode;
  warn?: boolean;
}) {
  if (onClick && !disabled) {
    return (
      <button className="quality-row clickable" onClick={onClick} type="button">
        <span>{label}</span>
        <strong className={warn ? "warning" : ""}>{value}</strong>
      </button>
    );
  }

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
      <select
        value={period.periodPreset}
        onChange={(event) => period.setPeriodPreset(event.target.value as TransactionPeriodPreset)}
      >
        <option value="all">Todos os períodos</option>
        <option value="current_month">Mês atual</option>
        <option value="previous_month">Mês anterior</option>
        <option value="current_year">Ano atual</option>
        <option value="previous_year">Ano anterior</option>
        <option value="custom">Personalizado</option>
      </select>
      <input
        aria-label="Data inicial"
        type="date"
        value={period.dateFrom}
        onChange={(event) => period.setDateFrom(event.target.value)}
      />
      <input
        aria-label="Data final"
        type="date"
        value={period.dateTo}
        onChange={(event) => period.setDateTo(event.target.value)}
      />
    </div>
  );
}

function usePeriod(periodState: PeriodState, setPeriodState: Dispatch<SetStateAction<PeriodState>>) {
  const { dateFrom, dateTo, periodPreset } = periodState;
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [dateFrom, dateTo]);
  const trendQuery = useMemo(() => {
    if (periodPreset === "current_month" || periodPreset === "previous_month") {
      return yearQueryFromDate(dateFrom || dateTo);
    }
    return query;
  }, [dateFrom, dateTo, periodPreset, query]);

  function setPeriodPreset(nextPreset: TransactionPeriodPreset) {
    const range = periodRange(nextPreset);
    setPeriodState({ ...range, periodPreset: nextPreset });
  }

  function setDateFrom(nextDateFrom: string) {
    setPeriodState((current) => ({ ...current, dateFrom: nextDateFrom, periodPreset: "custom" }));
  }

  function setDateTo(nextDateTo: string) {
    setPeriodState((current) => ({ ...current, dateTo: nextDateTo, periodPreset: "custom" }));
  }

  return { dateFrom, dateTo, periodPreset, query, setDateFrom, setDateTo, setPeriodPreset, trendQuery };
}

function periodRange(preset: TransactionPeriodPreset) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  if (preset === "all" || preset === "custom") {
    return { dateFrom: "", dateTo: "" };
  }
  if (preset === "current_year") {
    return {
      dateFrom: isoDate(new Date(currentYear, 0, 1)),
      dateTo: isoDate(new Date(currentYear, 11, 31)),
    };
  }
  if (preset === "previous_year") {
    return {
      dateFrom: isoDate(new Date(currentYear - 1, 0, 1)),
      dateTo: isoDate(new Date(currentYear - 1, 11, 31)),
    };
  }
  if (preset === "previous_month") {
    return {
      dateFrom: isoDate(new Date(currentYear, currentMonth - 1, 1)),
      dateTo: isoDate(new Date(currentYear, currentMonth, 0)),
    };
  }
  return {
    dateFrom: isoDate(new Date(currentYear, currentMonth, 1)),
    dateTo: isoDate(now),
  };
}

function transactionFilterSummary({
  categoryId,
  categories,
  dateFrom,
  dateTo,
  direction,
  importJobId,
  periodPreset,
  reviewMode,
  search,
  sourceType,
  weekday,
}: {
  categoryId: string;
  categories: CategoryRead[];
  dateFrom: string;
  dateTo: string;
  direction: string;
  importJobId: string;
  periodPreset: TransactionPeriodPreset;
  reviewMode: boolean;
  search: string;
  sourceType: string;
  weekday?: number;
}) {
  const parts: string[] = [];
  if (reviewMode) parts.push("pendentes de categoria");
  if (search) parts.push(`busca "${search}"`);
  if (sourceType) parts.push(sourceTypeLabel(sourceType));
  if (direction) parts.push(directionLabel(direction));
  if (weekday !== undefined) parts.push(weekdayLabel(weekday));
  if (importJobId) parts.push("importação selecionada");
  if (!reviewMode && categoryId) {
    const category = categories.find((item) => item.id === categoryId);
    parts.push(category ? categoryPath(category, categories) : "categoria selecionada");
  }
  const period = periodSummary({ dateFrom, dateTo, periodPreset });
  if (period) parts.push(period);
  return parts.length ? `Filtros ativos: ${parts.join(" · ")}` : "Mostrando todos os lançamentos disponíveis.";
}

function importFilterSummary({
  issueFilter,
  search,
  statusFilter,
}: {
  issueFilter: string;
  search: string;
  statusFilter: string;
}) {
  const parts: string[] = [];
  if (search) parts.push(`arquivo "${search}"`);
  if (statusFilter) parts.push(statusLabel(statusFilter));
  if (issueFilter === "with_errors") parts.push("somente com erros");
  return parts.length ? `Filtros ativos: ${parts.join(" · ")}` : "Mostrando todas as importações.";
}

function periodSummary({
  dateFrom,
  dateTo,
  periodPreset,
}: {
  dateFrom: string;
  dateTo: string;
  periodPreset: TransactionPeriodPreset;
}) {
  if (periodPreset === "current_month") return monthYearLabel(dateFrom || dateTo);
  if (periodPreset === "previous_month") return monthYearLabel(dateFrom || dateTo);
  if (periodPreset === "current_year") return yearLabel(dateFrom || dateTo);
  if (periodPreset === "previous_year") return yearLabel(dateFrom || dateTo);
  if (dateFrom && dateTo) return `${dateInputLabel(dateFrom)} a ${dateInputLabel(dateTo)}`;
  if (dateFrom) return `desde ${dateInputLabel(dateFrom)}`;
  if (dateTo) return `até ${dateInputLabel(dateTo)}`;
  return "";
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function yearQueryFromDate(value: string) {
  const [year] = value.split("-");
  if (!year) return "";
  const params = new URLSearchParams();
  params.set("date_from", `${year}-01-01`);
  params.set("date_to", `${year}-12-31`);
  return `?${params.toString()}`;
}

function monthRange(value: string) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;
  return {
    dateFrom: isoDate(new Date(year, month - 1, 1)),
    dateTo: isoDate(new Date(year, month, 0)),
  };
}

function cashflowDescription(period: ReturnType<typeof usePeriod>) {
  if (period.periodPreset === "current_month" || period.periodPreset === "previous_month") {
    const [year] = (period.dateFrom || period.dateTo).split("-");
    return year ? `Tendência mensal do ano ${year}, mantendo o mês selecionado nos demais indicadores.` : "Receitas, despesas e saldo por mês.";
  }
  return "Receitas, despesas e saldo por mês.";
}

function monthTickLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${labels[month - 1]}/${String(year).slice(-2)}`;
}

function shortWeekdayLabel(value: string) {
  return value.slice(0, 3);
}

function hasWeekdaySpending(items?: WeekdaySpendingItem[]) {
  return Boolean(items?.some((item) => item.count > 0));
}

function weekdayLabel(value: number) {
  const labels = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  return labels[value] ?? "Dia da semana";
}

function monthYearLabel(value: string) {
  if (!value) return "período selecionado";
  return monthTickLabel(value.slice(0, 7));
}

function yearLabel(value: string) {
  const [year] = value.split("-");
  return year || "período selecionado";
}

function shortChartLabel(value: string) {
  return value.length > 12 ? `${value.slice(0, 11)}...` : value;
}

function useCategories(session: ApiSession) {
  return useQuery({
    queryKey: ["categories", session.token],
    queryFn: () => getCategories(session),
  });
}

function withQueryParams(query: string, params: Record<string, string>) {
  const search = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  Object.entries(params).forEach(([key, value]) => search.set(key, value));
  const text = search.toString();
  return text ? `?${text}` : "";
}

function money(value?: string | number | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric);
}

function moneyAbs(value?: string | number | null) {
  return money(Math.abs(Number(value ?? 0)));
}

function compactMoneyAbs(value?: string | number | null) {
  const numeric = Math.abs(Number(value ?? 0));
  if (numeric < 100000) return money(numeric);
  if (numeric < 1000000) {
    const compact = numeric / 1000;
    return `R$ ${compact.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  const compact = numeric / 1000000;
  return `R$ ${compact.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

function compactMoneyAxis(value: string | number) {
  const raw = Number(value);
  const numeric = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  if (numeric < 1000) return `${sign}${numeric.toLocaleString("pt-BR")}`;
  if (numeric < 1000000) {
    return `${sign}${(numeric / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return `${sign}${(numeric / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

function moneyAxisDomain<T extends Record<string, unknown>>(
  items: T[],
  keys: Array<keyof T>,
  allowNegative: boolean,
): [number, number] {
  const values = items.flatMap((item) =>
    keys.map((key) => Number(item[key] ?? 0)).filter((value) => Number.isFinite(value)),
  );
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const lower = allowNegative && min < 0 ? -niceMoneyCeiling(Math.abs(min) * 1.15) : 0;
  const upper = niceMoneyCeiling(Math.max(100, max) * 1.15);
  return [lower, upper];
}

function niceMoneyCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function dashboardAlerts({
  categoryGrowth,
  period,
  quality,
  summary,
}: {
  categoryGrowth: CategoryGrowthAlertItem[];
  period: ReturnType<typeof usePeriod>;
  quality?: DataQuality;
  summary?: DashboardSummary;
}): Array<{
  description: string;
  icon: LucideIcon;
  importDrilldown?: ImportDrilldown;
  target?: Page;
  title: string;
  tone: "negative" | "warning";
  transactionDrilldown?: TransactionDrilldown;
}> {
  const alerts: Array<{
    description: string;
    icon: LucideIcon;
    importDrilldown?: ImportDrilldown;
    target?: Page;
    title: string;
    tone: "negative" | "warning";
    transactionDrilldown?: TransactionDrilldown;
  }> = [];
  const balance = Number(summary?.balance ?? 0);
  const qualityRatio = Number(quality?.categorized_ratio ?? 0);
  const uncategorized = quality?.uncategorized_count ?? 0;
  const importsWithErrors = quality?.imports_with_errors ?? 0;

  if (balance < 0) {
    alerts.push({
      description: `Saldo negativo de ${moneyAbs(balance)} no período.`,
      icon: AlertCircle,
      title: "Saldo negativo",
      tone: "negative",
    });
  }
  if (qualityRatio > 0 && qualityRatio < 0.7) {
    alerts.push({
      description: `${percent(quality?.categorized_ratio)} das transações estão categorizadas.`,
      icon: ShieldCheck,
      target: "review",
      title: "Qualidade baixa",
      tone: "warning",
    });
  }
  if (uncategorized > 0) {
    alerts.push({
      description: `${uncategorized} transação${uncategorized === 1 ? "" : "ões"} sem categoria.`,
      icon: ShieldCheck,
      target: "review",
      title: "Revisão pendente",
      tone: "warning",
    });
  }
  if (importsWithErrors > 0) {
    alerts.push({
      description: `${importsWithErrors} importação${importsWithErrors === 1 ? "" : "ões"} com erro.`,
      icon: FileWarning,
      importDrilldown: { issueFilter: "with_errors", label: "Importações com erro" },
      target: "imports",
      title: "Importação com erro",
      tone: "negative",
    });
  }
  categoryGrowth.forEach((item) => {
    alerts.push({
      description: `${item.category_name} subiu ${percent(item.change_ratio)} (${moneyAbs(item.change_amount)}) contra o período anterior.`,
      icon: BarChart3,
      title: "Categoria em alta",
      tone: "warning",
      transactionDrilldown: {
        categoryId: item.category_id,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        label: item.category_name,
        periodPreset: period.periodPreset,
      },
    });
  });
  return alerts;
}

function chartSeriesLabel(name: string) {
  const labels: Record<string, string> = {
    amount: "Valor",
    balance: "Saldo",
    expenses: "Despesas",
    income: "Receitas",
    payments: "Pgto. fatura",
  };
  return labels[name] ?? name;
}

function chartMoneyLabel(value: string, name: string) {
  return name === "balance" ? money(value) : moneyAbs(value);
}

function percent(value?: string | null) {
  if (!value) return "0%";
  return `${(Number(value) * 100).toFixed(0)}%`;
}

function percentAbs(value?: string | null) {
  if (!value) return "0%";
  return `${Math.abs(Number(value) * 100).toFixed(0)}%`;
}

function qualityTone(value?: string | null): "positive" | "negative" | "warning" {
  const ratio = Number(value ?? 0);
  if (ratio >= 0.9) return "positive";
  if (ratio >= 0.7) return "warning";
  return "negative";
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
    failed: "Falhou",
    pending: "Pendente",
    processing: "Processando",
    active: "Ativa",
    inactive: "Inativa",
    manual: "Manual",
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

function sourceKindLabel(sourceKind?: string) {
  const labels: Record<string, string> = {
    bank_statement_txt: "Extrato TXT",
    credit_card_csv: "Fatura CSV",
    unknown: "Desconhecido",
  };
  return sourceKind ? labels[sourceKind] ?? sourceKind : "-";
}

function fileSizeLabel(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(sizeBytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export default App;
