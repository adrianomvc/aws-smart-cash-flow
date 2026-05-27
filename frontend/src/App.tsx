import type { Dispatch, FormEvent, KeyboardEvent, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Gem,
  FileWarning,
  FileUp,
  Filter,
  Gauge,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Bell,
  Pencil,
  Percent,
  PiggyBank,
  Plus,
  Presentation,
  RefreshCw,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Users,
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
  login as apiLogin,
  signup as apiSignup,
  resetPassword as apiResetPassword,
  type ApiSession,
  type CategoryGrowthAlertItem,
  type CategoryRankingItem,
  type CategoryRead,
  type CategorizationRuleRead,
  type CreditCardInstallmentItem,
  type CreditCardPaymentMatchItem,
  type DashboardSummary,
  type DataQuality,
  type DuplicateTransactionGroup,
  type ImportJobRead,
  type ImportPreviewResult,
  type RecurringExpenseItem,
  type RulePreview,
  type TransactionRead,
  type WeekdaySpendingItem,
  applyRules,
  createCategory,
  createManualTransaction,
  createRule,
  deleteCategory,
  deleteImport,
  deleteRule,
  deleteTransaction,
  getCategories,
  getCategoryGrowthAlerts,
  getCategoryRanking,
  getCreditCardInstallments,
  getCreditCardPaymentMatches,
  getCurrentWorkspace,
  getDashboardSummary,
  getDataQuality,
  getImportErrors,
  getImports,
  getMerchantRanking,
  getMonthlyCashflow,
  getRecurringExpenses,
  getRulePreview,
  getRules,
  getTransactionDuplicates,
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
import smartCashFlowIcon from "./assets/smartcashflow-icon.png";
import smartCashFlowLogo from "./assets/smartcashflow-logo.png";

type Page = "dashboard" | "cashflow" | "cards" | "imports" | "transactions" | "categories" | "rules" | "review" | "settings";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes("replace-me")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const navSections: Array<{
  items: Array<{ id?: Page; label: string; icon: LucideIcon; status?: string }>;
  label: string;
}> = [
  {
    label: "Analisar",
    items: [
      { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
      { id: "cashflow", label: "Fluxo de caixa", icon: BarChart3 },
      { id: "transactions", label: "Transações", icon: Database },
      { label: "Calendário", icon: CalendarDays, status: "em breve" },
      { id: "cards", label: "Cartões", icon: CreditCard },
    ],
  },
  {
    label: "Planejar",
    items: [
      { label: "Orçamentos", icon: PiggyBank, status: "em breve" },
      { label: "Metas", icon: Target, status: "em breve" },
      { label: "Planejamento", icon: Presentation, status: "em breve" },
      { label: "Investimentos", icon: BarChart3, status: "em breve" },
      { label: "Patrimônio", icon: Gem, status: "em breve" },
    ],
  },
  {
    label: "Evoluir",
    items: [
      { label: "Relatórios", icon: ReceiptText, status: "em breve" },
      { label: "Insights IA", icon: Brain, status: "em breve" },
      { label: "Cenários / Simulador", icon: Sparkles, status: "em breve" },
      { label: "Família / Membros", icon: Users, status: "em breve" },
      { label: "Assinaturas", icon: CreditCard, status: "em breve" },
    ],
  },
  {
    label: "Operar",
    items: [
      { id: "imports", label: "Importações", icon: FileUp },
      { id: "categories", label: "Categorias", icon: Tags },
      { id: "rules", label: "Regras", icon: Wand2 },
      { id: "review", label: "Revisão", icon: ShieldCheck },
      { id: "settings", label: "Configurações", icon: Settings },
    ],
  },
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
  sourceType?: string;
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

type BatchUploadProgress = {
  currentFileName: string;
  done: number;
  label: string;
  total: number;
};

const RECOMMENDED_BATCH_FILE_LIMIT = 20;

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

  async function handleSession(nextSession: ApiSession | null) {
    // If logging out from Supabase, clear the session
    if (!nextSession && session?.mode === "supabase" && supabase) {
      await supabase.auth.signOut();
    }

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
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        // Login via API
        const response = await apiLogin({ email, password });
        onLogin({ token: response.access_token, mode: "supabase" });
      } else {
        // Signup via API
        await apiSignup({
          email,
          password,
          display_name: displayName || undefined,
        });
        setSuccess("Conta criada com sucesso! Faça login para continuar.");
        setIsLogin(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await apiResetPassword(email);
      setSuccess("Email de recuperação enviado se a conta existir.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email de recuperação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <img className="login-brand-logo" src={smartCashFlowLogo} alt="SmartCashFlow" />
        <p className="eyebrow">SmartCashFlow</p>
        <h1>Controle financeiro auditável.</h1>
        <p className="muted">
          Importe extratos, revise classificações e acompanhe sua saúde financeira com rastreabilidade.
        </p>

        {error ? <div className="inline-error">{error}</div> : null}
        {success ? <div className="inline-success">{success}</div> : null}

        <form className="login-form" onSubmit={handleAuth}>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={6}
            />
          </label>
          {!isLogin && (
            <label>
              Nome (opcional)
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                type="text"
              />
            </label>
          )}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={16} /> : null}
            {isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="login-actions">
          <button
            className="ghost-button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
            }}
          >
            {isLogin ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
          {isLogin && (
            <button className="ghost-button" onClick={handlePasswordReset} disabled={loading || !email}>
              Esqueceu a senha?
            </button>
          )}
        </div>

        {!supabase && (
          <button
            className="ghost-button full"
            onClick={() => onLogin({ token: "local-dev", mode: "local" })}
          >
            Acessar demonstração MVP
          </button>
        )}
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
          <img className="brand-mark small" src={smartCashFlowIcon} alt="" aria-hidden="true" />
          <div>
            <strong>SmartCashFlow</strong>
            <span>Controle financeiro familiar</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div className="sidebar-section" key={section.label}>
              <p>{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === page;
                const isDisabled = !item.id;
                return (
                  <button
                    className={`${isActive ? "active" : ""}${isDisabled ? " disabled" : ""}`}
                    disabled={isDisabled}
                    key={`${item.label}-${item.id ?? "future"}`}
                    onClick={() => {
                      if (!item.id) return;
                      setPage(item.id);
                    }}
                    title={isDisabled ? `${item.label} entra em pacote futuro` : item.label}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.status ? <small>{item.status}</small> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-health">
          <span>Saúde financeira</span>
          <strong>MVP</strong>
          <small>Dados reais, leitura em evolução</small>
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={onLogout}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
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

  console.log("Workspace query state:", {
    isLoading: workspaceQuery.isLoading,
    isError: workspaceQuery.isError,
    error: workspaceQuery.error,
    data: workspaceQuery.data,
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
      <Topbar dashboardPeriod={dashboardPeriod} page={page} workspaceName={workspace.workspace_name} />
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
      {page === "cashflow" ? (
        <CashflowPage onNavigate={onNavigate} onOpenTransactions={onOpenTransactions} session={session} />
      ) : null}
      {page === "cards" ? <CardsPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
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
      {page === "settings" ? <SettingsPage onNavigate={onNavigate} workspaceName={workspace.workspace_name} session={session} /> : null}
    </>
  );
}

function Topbar({
  dashboardPeriod,
  page,
  workspaceName,
}: {
  dashboardPeriod: PeriodState;
  page: Page;
  workspaceName: string;
}) {
  const meta = pageMeta(page);
  const periodLabel = page === "dashboard" ? periodSummary(dashboardPeriod) || "Todos os períodos" : "Filtro local";
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{workspaceName}</p>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <div className="topbar-actions">
        <div className="topbar-pill passive" title="Informativo. Os filtros continuam dentro de cada tela.">
          <CalendarDays size={16} />
          {periodLabel}
        </div>
        <button
          aria-label="Notificações em breve"
          className="icon-button disabled"
          disabled
          title="Notificações entram em pacote futuro."
          type="button"
        >
          <Bell size={18} />
        </button>
        <div className="topbar-pill">
          <ShieldCheck size={16} />
          Workspace seguro
        </div>
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
  const recurring = useQuery({
    queryKey: ["recurring-expenses", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
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
      <div className="page-toolbar">
        <div className="header-actions">
          <PeriodFilter period={period} />
          <span className="filter-summary compact">{periodSummary(period)}</span>
        </div>
      </div>
      <DashboardFlowStory periodLabel={periodSummary(period)} summary={summary.data} />
      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Saúde imediata"
          title="Indicadores de controle"
          description="Depois da história do fluxo, acompanhe os índices que ajudam a decidir se pode gastar, cortar ou revisar."
        />
        <div className="metric-grid executive">
          <MetricCard
            icon={Percent}
            label="Comprometimento"
            title={percent(summary.data?.commitment_rate)}
            value={percentAbs(summary.data?.commitment_rate)}
            helper={commitmentHelper(summary.data?.commitment_rate)}
            tone={commitmentTone(summary.data?.commitment_rate)}
            onClick={() => openMetricTransactions("debit", "Comprometimento da receita")}
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
            icon={Gauge}
            label="Burn rate"
            title={moneyAbs(summary.data?.burn_rate)}
            value={compactMoneyAbs(summary.data?.burn_rate)}
            helper={`Média de ${summary.data?.burn_rate_months ?? 0} mês${summary.data?.burn_rate_months === 1 ? "" : "es"}`}
            tone="warning"
            onClick={() => openMetricTransactions("debit", "Burn rate")}
          />
          <MetricCard
            icon={CreditCard}
              label="Fatura"
            title={moneyAbs(summary.data?.payments)}
            value={compactMoneyAbs(summary.data?.payments)}
            helper="Separado de despesas"
            tone="info"
            onClick={() => openMetricTransactions("payment", "Pagamento de fatura")}
          />
          <MetricCard
            icon={ShieldCheck}
            label="Qualidade"
            title={percent(quality.data?.categorized_ratio)}
            value={percent(quality.data?.categorized_ratio)}
            helper={`${quality.data?.uncategorized_count ?? 0} pendente${quality.data?.uncategorized_count === 1 ? "" : "s"}`}
            tone={qualityTone(quality.data?.categorized_ratio)}
            onClick={() => onNavigate("review")}
          />
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Tendência"
          title="Fluxo de caixa"
          description="Depois, acompanhe o movimento mensal para entender se a sobra é consistente."
        />
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

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Controle"
          title="Onde o dinheiro saiu"
          description="Categorias, descrições e recorrências ajudam a separar padrão de consumo de evento pontual."
        />
        <div className="dashboard-grid insight-grid">
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
          <Panel title="Gastos recorrentes" description="Despesas prováveis por repetição mensal no histórico filtrado.">
            <RecurringExpenseList
              items={recurring.data?.items ?? []}
              loading={recurring.isLoading}
              onOpenRecurring={(item) => {
                onOpenTransactions({
                  dateFrom: period.dateFrom,
                  dateTo: period.dateTo,
                  direction: "debit",
                  label: item.description,
                  periodPreset: period.periodPreset,
                  search: item.description,
                });
              }}
            />
          </Panel>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Padrões"
          title="Comportamento no período"
          description="Use estes painéis para entender concentração por dia da semana e sinais de rotina."
        />
        <div className="dashboard-grid analysis-grid">
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
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Operação"
          title="O que precisa de ação"
          description="Alertas, qualidade dos dados e conciliação ficam juntos para orientar revisão antes de decisões."
        />
        <div className="dashboard-grid operations-grid">
          <Panel title="Alertas" description="Pontos que merecem atenção no período selecionado.">
            <DashboardAlerts
              categoryGrowth={categoryGrowth.data?.items ?? []}
              onOpenTransactions={onOpenTransactions}
              onNavigate={onNavigate}
              onOpenImports={onOpenImports}
              period={period}
              quality={quality.data}
              recurring={recurring.data?.items ?? []}
              summary={summary.data}
            />
          </Panel>
          <Panel title="Saúde dos dados" description="Indicadores de confiabilidade para os gráficos.">
            <div className="quality-list">
              <QualityRow label="Transações" value={quality.data?.transaction_count ?? 0} />
              <QualityRow label="Categorizadas" value={quality.data?.categorized_count ?? 0} />
              <QualityRow label="Qualidade" value={percent(quality.data?.categorized_ratio)} />
              <QualityRow label="Pgto. fatura" value={compactMoneyAbs(summary.data?.payments)} />
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
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Fechamento"
          title="Resumo narrativo"
          description="Por fim, uma leitura curta do período para decidir a próxima ação."
        />
        <Panel title="Resumo narrativo" description="Leitura do período para orientar a próxima ação.">
          <DashboardStory
            merchants={merchants.data?.items ?? []}
            period={period}
            quality={quality.data}
            ranking={ranking.data?.items ?? []}
            summary={summary.data}
          />
        </Panel>
      </section>
    </section>
  );
}

function CashflowPage({
  onNavigate,
  onOpenTransactions,
  session,
}: {
  onNavigate: (page: Page) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [cashflowPeriod, setCashflowPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_year");
    return { ...range, periodPreset: "current_year" };
  });
  const period = usePeriod(cashflowPeriod, setCashflowPeriod);
  const summary = useQuery({
    queryKey: ["cashflow-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const cashflow = useQuery({
    queryKey: ["cashflow-monthly", session.token, period.trendQuery],
    queryFn: () => getMonthlyCashflow(session, period.trendQuery),
  });
  const ranking = useQuery({
    queryKey: ["cashflow-category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const recurring = useQuery({
    queryKey: ["cashflow-recurring-expenses", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
  });
  const cashflowAxisDomain = useMemo(
    () => moneyAxisDomain(cashflow.data?.items ?? [], ["income", "expenses", "payments", "balance"], true),
    [cashflow.data?.items],
  );
  const categoryAxisDomain = useMemo(
    () => moneyAxisDomain(ranking.data?.items ?? [], ["amount"], false),
    [ranking.data?.items],
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

  function openMetricTransactions(direction?: string, label = "Fluxo de caixa") {
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
      <div className="page-toolbar">
        <div className="header-actions">
          <PeriodFilter period={period} />
          <span className="filter-summary compact">{periodSummary(period)}</span>
        </div>
      </div>

      <DashboardFlowStory periodLabel={periodSummary(period)} summary={summary.data} />

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Leitura principal"
          title="Evolução do fluxo"
          description="Acompanhe receitas, despesas, pagamento de fatura e saldo para enxergar sobra ou déficit ao longo do tempo."
        />
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
                <Line name="Fatura" type="monotone" dataKey="payments" stroke="#2563eb" strokeWidth={2} />
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

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Controle operacional"
          title="Resumo do período"
          description="Use estes cards para abrir as transações que explicam cada número."
        />
        <div className="metric-grid executive">
          <MetricCard
            icon={ArrowUpCircle}
            label="Receitas"
            title={moneyAbs(summary.data?.income)}
            value={compactMoneyAbs(summary.data?.income)}
            helper="Entradas classificadas"
            tone="positive"
            onClick={() => openMetricTransactions("credit", "Receitas do período")}
          />
          <MetricCard
            icon={ArrowDownCircle}
            label="Despesas"
            title={moneyAbs(summary.data?.expenses)}
            value={compactMoneyAbs(summary.data?.expenses)}
            helper="Saídas de consumo"
            tone="negative"
            onClick={() => openMetricTransactions("debit", "Despesas do período")}
          />
          <MetricCard
            icon={BarChart3}
            label="Saldo"
            title={moneyAbs(summary.data?.balance)}
            value={formatCurrencyCompact(summary.data?.balance)}
            helper="Entradas menos saídas"
            tone={Number(summary.data?.balance ?? 0) < 0 ? "negative" : "positive"}
          />
          <MetricCard
            icon={CreditCard}
            label="Fatura"
            title={moneyAbs(summary.data?.payments)}
            value={compactMoneyAbs(summary.data?.payments)}
            helper="Pagamentos separados"
            tone="info"
            onClick={() => openMetricTransactions("payment", "Pagamentos de fatura")}
          />
          <MetricCard
            icon={Gauge}
            label="Burn rate"
            title={moneyAbs(summary.data?.burn_rate)}
            value={compactMoneyAbs(summary.data?.burn_rate)}
            helper={`Média de ${summary.data?.burn_rate_months ?? 0} mês${summary.data?.burn_rate_months === 1 ? "" : "es"}`}
            tone="warning"
            onClick={() => openMetricTransactions("debit", "Burn rate")}
          />
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Explicação"
          title="O que mais pesa"
          description="Categorias e recorrências ajudam a entender se o fluxo foi afetado por hábito, conta fixa ou evento pontual."
        />
        <div className="dashboard-grid insight-grid">
          <Panel title="Gastos por categoria" description="Clique em uma barra para abrir as transações filtradas.">
            <ChartBox loading={ranking.isLoading} empty={!ranking.data?.items.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ranking.data?.items ?? []}
                  margin={{ top: 16, right: 14, bottom: 8, left: 8 }}
                  onClick={(data) => {
                    const item = data?.activePayload?.[0]?.payload as CategoryRankingItem | undefined;
                    if (item) openCategoryTransactions(item);
                  }}
                  style={{ cursor: "pointer" }}
                >
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
                  <Tooltip
                    formatter={(value) => [chartMoneyLabel(String(value), "amount"), "Valor"]}
                    labelFormatter={(value) => value}
                  />
                  <Bar dataKey="amount" fill="#6d5dfc" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </Panel>
          <Panel title="Recorrências" description="Gastos que aparecem em mais de um mês dentro da janela de análise.">
            <div className="quality-list">
              {recurring.isLoading ? <PageState icon={Loader2} title="Carregando recorrências" description="Aguarde um momento." spin compact /> : null}
              {!recurring.isLoading && !recurring.data?.items.length ? <EmptyInline message="Nenhum gasto recorrente encontrado." /> : null}
              {recurring.data?.items.map((item) => (
                <QualityRow
                  key={item.description}
                  label={item.description}
                  onClick={() =>
                    onOpenTransactions({
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      label: item.description,
                      periodPreset: period.periodPreset,
                      search: item.description,
                    })
                  }
                  value={compactMoneyAbs(item.average_amount)}
                />
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </section>
  );
}

function CardsPage({
  onOpenTransactions,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [cardPeriod, setCardPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const period = usePeriod(cardPeriod, setCardPeriod);
  const cardQuery = withQueryParams(period.query, {
    limit: "100",
    sort_by: "transaction_date",
    sort_dir: "desc",
    source_type: "credit_card_statement",
  });
  const paymentQuery = withQueryParams(period.query, {
    direction: "payment",
    limit: "50",
    sort_by: "transaction_date",
    sort_dir: "desc",
    source_type: "credit_card_statement",
  });
  const cards = useQuery({
    queryKey: ["card-transactions", session.token, cardQuery],
    queryFn: () => getTransactions(session, cardQuery),
  });
  const payments = useQuery({
    queryKey: ["card-payments", session.token, paymentQuery],
    queryFn: () => getTransactions(session, paymentQuery),
  });
  const recurring = useQuery({
    queryKey: ["card-recurring-expenses", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
  });
  const futureInstallmentsQuery = useQuery({
    queryKey: ["card-future-installments", session.token, period.dateTo],
    queryFn: () =>
      getCreditCardInstallments(
        session,
        period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" }),
      ),
  });
  const currentInstallments = useQuery({
    queryKey: ["card-current-installments", session.token, period.query],
    queryFn: () => getCreditCardInstallments(session, withQueryParams(period.query, { limit: "20" })),
  });
  const paymentMatches = useQuery({
    queryKey: ["cards-credit-card-payment-matches", session.token, period.query],
    queryFn: () => getCreditCardPaymentMatches(session, withQueryParams(period.query, { limit: "5", window_days: "7" })),
  });
  const cardItems = cards.data?.items ?? [];
  const paymentItems = payments.data?.items ?? [];
  const cardExpenses = sumTransactions(cardItems.filter((transaction) => transaction.direction === "debit"));
  const cardCredits = sumTransactions(cardItems.filter((transaction) => transaction.direction === "credit"));
  const cardPayments = sumTransactions(paymentItems);
  const activeInstallmentCount = futureInstallmentsQuery.data?.active_count ?? 0;
  const futureInstallments = futureInstallmentsQuery.data?.total_future_amount ?? "0";

  function openCardTransactions(direction?: string, label = "Cartão de crédito") {
    onOpenTransactions({
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      direction,
      label,
      periodPreset: period.periodPreset,
      sourceType: "credit_card_statement",
    });
  }

  function openTransaction(transaction: TransactionRead) {
    onOpenTransactions({
      dateFrom: transaction.transaction_date,
      dateTo: transaction.transaction_date,
      direction: transaction.direction,
      label: transaction.description,
      periodPreset: "custom",
      search: transaction.description,
      sourceType: "credit_card_statement",
    });
  }

  return (
    <section className="page-stack">
      <div className="page-toolbar">
        <div className="header-actions">
          <PeriodFilter period={period} />
          <span className="filter-summary compact">{periodSummary(period)}</span>
        </div>
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Cartão de crédito"
          title="Fatura e compras"
          description="Separe compras, créditos, pagamentos e parcelas para não misturar fatura com gasto do mês."
        />
        <div className="metric-grid executive">
          <MetricCard
            icon={CreditCard}
            label="Compras"
            title={moneyAbs(cardExpenses)}
            value={compactMoneyAbs(cardExpenses)}
            helper="Despesas em faturas"
            tone="negative"
            onClick={() => openCardTransactions("debit", "Compras no cartão")}
          />
          <MetricCard
            icon={ArrowUpCircle}
            label="Créditos"
            title={moneyAbs(cardCredits)}
            value={compactMoneyAbs(cardCredits)}
            helper="Estornos e devoluções"
            tone="positive"
            onClick={() => openCardTransactions("credit", "Créditos no cartão")}
          />
          <MetricCard
            icon={ReceiptText}
            label="Fatura"
            title={moneyAbs(cardPayments)}
            value={compactMoneyAbs(cardPayments)}
            helper="Pagamentos na fatura"
            tone="info"
            onClick={() => openCardTransactions("payment", "Pagamentos da fatura")}
          />
          <MetricCard
            icon={CalendarDays}
            label="Parcelado futuro"
            title={moneyAbs(futureInstallments)}
            value={compactMoneyAbs(futureInstallments)}
            helper={`${activeInstallmentCount} parcela${activeInstallmentCount === 1 ? "" : "s"} no próximo mês`}
            tone="warning"
            onClick={() => openCardTransactions("debit", "Parcelas identificadas")}
          />
          <MetricCard
            icon={Database}
            label="Lançamentos"
            title={String(cards.data?.total ?? cardItems.length)}
            value={String(cards.data?.total ?? cardItems.length)}
            helper="No período filtrado"
            onClick={() => openCardTransactions(undefined, "Lançamentos do cartão")}
          />
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Controle"
          title="Detalhes do cartão"
          description="Revise compras recentes, parcelas e pagamentos conciliáveis antes de tomar decisão."
        />
        <div className="dashboard-grid operations-grid">
          <Panel title="Compras recentes" description="Últimos lançamentos importados de faturas.">
            <CardTransactionList
              emptyMessage="Nenhuma compra de cartão encontrada no período."
              items={cardItems.filter((transaction) => transaction.direction !== "payment").slice(0, 8)}
              loading={cards.isLoading}
              onOpenTransaction={openTransaction}
            />
          </Panel>
          <Panel title="Parcelas identificadas" description="Compras com parcela atual/total detectada na fatura.">
            <div className="panel-summary-line">
              <strong>{currentInstallments.data?.active_count ?? 0} parcela{currentInstallments.data?.active_count === 1 ? "" : "s"} no período</strong>
              <span>{moneyAbs(currentInstallments.data?.total_future_amount ?? 0)}</span>
            </div>
            {currentInstallments.data ? (
              <p className="panel-note">
                Cálculo usando fechamento dia {currentInstallments.data.closing_day} e vencimento dia{" "}
                {currentInstallments.data.due_day} até o cadastro de cartões ficar disponível.
              </p>
            ) : null}
            <CardInstallmentList
              emptyMessage="Nenhuma parcela identificada no período."
              error={currentInstallments.isError}
              items={currentInstallments.data?.items ?? []}
              loading={currentInstallments.isLoading}
              onOpenInstallment={(item) =>
                onOpenTransactions({
                  dateTo: period.dateTo,
                  label: item.description,
                  periodPreset: "custom",
                  search: item.description,
                  sourceType: "credit_card_statement",
                })
              }
            />
          </Panel>
          <Panel title="Conciliação de fatura" description="Pagamentos parecidos entre extrato e fatura.">
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
                  sourceType: side === "card" ? "credit_card_statement" : "bank_statement",
                });
              }}
            />
          </Panel>
          <Panel title="Recorrências" description="Assinaturas e cobranças repetidas detectadas no histórico.">
            <div className="quality-list">
              {recurring.isLoading ? <PageState icon={Loader2} title="Carregando recorrências" description="Aguarde um momento." spin compact /> : null}
              {!recurring.isLoading && !recurring.data?.items.length ? <EmptyInline message="Nenhuma recorrência detectada." /> : null}
              {recurring.data?.items.map((item) => (
                <QualityRow
                  key={item.description}
                  label={item.description}
                  onClick={() =>
                    onOpenTransactions({
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      label: item.description,
                      periodPreset: period.periodPreset,
                      search: item.description,
                    })
                  }
                  value={compactMoneyAbs(item.average_amount)}
                />
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </section>
  );
}

function CardTransactionList({
  emptyMessage,
  items,
  loading,
  onOpenTransaction,
  showInstallments = false,
}: {
  emptyMessage: string;
  items: TransactionRead[];
  loading: boolean;
  onOpenTransaction: (transaction: TransactionRead) => void;
  showInstallments?: boolean;
}) {
  if (loading) {
    return <PageState icon={Loader2} title="Carregando cartão" description="Aguarde um momento." spin compact />;
  }
  if (!items.length) {
    return <EmptyInline message={emptyMessage} />;
  }
  return (
    <div className="merchant-list">
      {items.map((transaction) => (
        <button
          className="merchant-row clickable"
          key={transaction.id}
          onClick={() => onOpenTransaction(transaction)}
          type="button"
        >
          <span>
            <strong>{transaction.description}</strong>
            <small>
              {dateLabel(transaction.transaction_date)} · {directionLabel(transaction.direction)}
              {showInstallments ? ` · ${installmentSummaryLabel(transaction)}` : ""}
            </small>
          </span>
          <strong className={amountClass(transaction)}>{moneyAbs(transaction.amount)}</strong>
        </button>
      ))}
    </div>
  );
}

function CardInstallmentList({
  emptyMessage,
  error,
  items,
  loading,
  onOpenInstallment,
}: {
  emptyMessage: string;
  error: boolean;
  items: CreditCardInstallmentItem[];
  loading: boolean;
  onOpenInstallment: (item: CreditCardInstallmentItem) => void;
}) {
  if (loading) {
    return <PageState icon={Loader2} title="Carregando parcelas" description="Aguarde um momento." spin compact />;
  }
  if (error) {
    return <EmptyInline message="Não foi possível carregar as parcelas do cartão. Confira se a API local foi reiniciada." />;
  }
  if (!items.length) {
    return <EmptyInline message={emptyMessage} />;
  }
  return (
    <div className="installment-list">
      {items.map((item) => (
        <button
          className="installment-row"
          key={`${item.description}-${item.amount}-${item.installment_total}`}
          onClick={() => onOpenInstallment(item)}
          type="button"
        >
          <span>
            <strong>{item.description}</strong>
            <small>
              Parcela {item.installment_current}/{item.installment_total} · Compra em {dateLabel(item.last_transaction_date)} ·
              Fatura inicial: {monthYearLabel(item.first_invoice_month)}
            </small>
          </span>
          <strong className={item.remaining_installments ? "warning" : "muted-strong"}>{moneyAbs(item.future_amount)}</strong>
        </button>
      ))}
    </div>
  );
}

function sumTransactions(items: Array<Pick<TransactionRead, "amount">>) {
  return items.reduce((total, transaction) => total + Math.abs(Number(transaction.amount)), 0);
}

function DashboardFlowStory({
  periodLabel,
  summary,
}: {
  periodLabel: string;
  summary?: DashboardSummary;
}) {
  const balance = Number(summary?.balance ?? 0);
  const steps: Array<{
    helper: string;
    icon: LucideIcon;
    label: string;
    title: string;
    tone: "info" | "negative" | "positive" | "warning";
    value: string;
  }> = [
    {
      helper: "receitas no período",
      icon: ArrowUpCircle,
      label: "Entrou",
      title: moneyAbs(summary?.income),
      tone: "positive",
      value: formatCurrencyCompact(summary?.income),
    },
    {
      helper: "despesas no período",
      icon: ArrowDownCircle,
      label: "Saiu",
      title: moneyAbs(summary?.expenses),
      tone: "negative",
      value: formatCurrencyCompact(summary?.expenses),
    },
    {
      helper: balance < 0 ? "negativo" : "positivo",
      icon: BarChart3,
      label: "Saldo",
      title: moneyAbs(summary?.balance),
      tone: balance < 0 ? "negative" : "positive",
      value: formatCurrencyCompact(summary?.balance),
    },
    {
      helper: "separado das despesas",
      icon: CreditCard,
      label: "Fatura",
      title: moneyAbs(summary?.payments),
      tone: "info",
      value: formatCurrencyCompact(summary?.payments),
    },
    {
      helper: `${summary?.burn_rate_months ?? 0} mês${summary?.burn_rate_months === 1 ? "" : "es"} na média`,
      icon: Gauge,
      label: "Burn rate",
      title: moneyAbs(summary?.burn_rate),
      tone: "warning",
      value: formatCurrencyCompact(summary?.burn_rate),
    },
  ];

  return (
    <section className="flow-story" aria-label="História do fluxo de caixa">
      <div className="flow-story-header">
        <div>
          <span>A história do seu fluxo</span>
          <strong>{periodLabel}</strong>
        </div>
      </div>
      <div className="flow-story-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div className="flow-story-step" key={step.label}>
              <span className={`flow-story-icon ${step.tone}`}>
                <Icon size={22} />
              </span>
              <div>
                <small>{step.label}</small>
                <strong className={step.tone} title={step.title}>{step.value}</strong>
                <p>{step.helper}</p>
              </div>
              {index < steps.length - 1 ? <ChevronRight className="flow-story-arrow" size={18} /> : null}
            </div>
          );
        })}
      </div>
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
  recurring,
  summary,
}: {
  categoryGrowth: CategoryGrowthAlertItem[];
  onNavigate: (page: Page) => void;
  onOpenImports: (drilldown?: ImportDrilldown) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  period: ReturnType<typeof usePeriod>;
  quality?: DataQuality;
  recurring: RecurringExpenseItem[];
  summary?: DashboardSummary;
}) {
  const alerts = dashboardAlerts({ categoryGrowth, period, quality, recurring, summary });
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
              key={`${alert.title}-${alert.description}`}
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
          <div className={className} key={`${alert.title}-${alert.description}`}>
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
  const commitment = Number(summary.commitment_rate ?? 0);
  const savings = Number(summary.savings_rate ?? 0);
  const topCategory = ranking[0];
  const topMerchant = merchants[0];
  const tone = balance < 0 ? "negative" : "positive";
  const nextAction =
    balance < 0
      ? "Revisar despesas do período e priorizar cortes de maior impacto."
      : commitment >= 0.85
        ? "Reduzir categorias com maior peso antes de assumir novos gastos."
        : quality.uncategorized_count > 0
          ? "Concluir a revisão de categorias para aumentar a confiança dos indicadores."
          : topCategory
            ? `Acompanhar ${topCategory.category_name} para confirmar se o gasto faz sentido.`
            : "Manter a rotina de importação e acompanhar a evolução mensal.";

  return (
    <div className="story-panel">
      <div className="story-grid">
        <article className="story-card">
          <span>Resultado</span>
          <strong className={tone}>{balance < 0 ? "Saldo negativo" : "Saldo positivo"}</strong>
          <p>
            Em {periodSummary(period)}, o saldo foi {moneyAbs(summary.balance)}: receitas de {moneyAbs(summary.income)}
            {" "}contra despesas de {moneyAbs(summary.expenses)}.
          </p>
        </article>
        <article className="story-card">
          <span>Saúde</span>
          <strong className={commitmentTone(summary.commitment_rate)}>{percent(summary.commitment_rate)} comprometido</strong>
          <p>
            Burn rate estimado em {moneyAbs(summary.burn_rate)}/mês pela média de {summary.burn_rate_months} mês
            {summary.burn_rate_months === 1 ? "" : "es"}. Taxa de poupança em {percent(summary.savings_rate)}. {commitment >= 0.85
              ? "O gasto está alto para a receita do período."
              : savings < 0
                ? "A sobra ficou negativa no período."
                : "A relação entre entrada e saída está sob controle."}
          </p>
        </article>
        <article className="story-card">
          <span>Maior pressão</span>
          <strong>{topCategory?.category_name ?? "Sem categoria dominante"}</strong>
          <p>
            {topCategory
              ? `${moneyAbs(topCategory.amount)} concentrados nessa categoria.`
              : "Ainda não há volume suficiente para destacar uma categoria."}
            {topMerchant ? ` Principal descrição: ${topMerchant.description}.` : ""}
          </p>
        </article>
        <article className="story-card">
          <span>Confiança</span>
          <strong className={qualityTone(quality.categorized_ratio)}>{percent(quality.categorized_ratio)}</strong>
          <p>
            {quality.uncategorized_count > 0
              ? `${quality.uncategorized_count} transação${quality.uncategorized_count === 1 ? "" : "ões"} ainda precisam de categoria.`
              : "Sem pendências de categoria no período."}
          </p>
        </article>
      </div>
      {Number(summary.payments) > 0 ? (
        <p className="story-note">
          Pagamentos de fatura somaram <strong className="info">{moneyAbs(summary.payments)}</strong> e estão separados das despesas.
        </p>
      ) : null}
      <div className="story-action">
        <strong>Próxima ação</strong>
        <p>{nextAction}</p>
      </div>
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
  const [importActionMessage, setImportActionMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<BatchUploadProgress | null>(null);
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
  const visibleImports = imports.data?.items ?? [];
  const pageValidRows = visibleImports.reduce((total, item) => total + item.valid_rows, 0);
  const pageDuplicateRows = visibleImports.reduce((total, item) => total + item.duplicate_rows, 0);
  const pageErrorRows = visibleImports.reduce((total, item) => total + item.error_rows, 0);
  const pageFailedImports = visibleImports.filter((item) => item.status === "failed").length;
  const nextPageDisabled = imports.isLoading || (page + 1) * pageSize >= totalImports;
  const errors = useQuery({
    queryKey: ["import-errors", session.token, selectedImport],
    queryFn: () => getImportErrors(session, selectedImport ?? ""),
    enabled: Boolean(selectedImport),
  });
  const removeImport = useMutation({
    mutationFn: (importId: string) => deleteImport(session, importId),
    onSuccess: () => {
      setSelectedImport(null);
      setImportActionMessage("Importação excluída. Os lançamentos vinculados foram removidos dos indicadores.");
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["weekday-spending"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const results: BatchUploadResult[] = [];
      setBatchResults([]);
      setUploadProgress({ currentFileName: "", done: 0, label: "Importando lote", total: files.length });
      for (const file of files) {
        setUploadProgress({ currentFileName: file.name, done: results.length, label: "Importando lote", total: files.length });
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
        setUploadProgress({ currentFileName: file.name, done: results.length, label: "Importando lote", total: files.length });
      }
      return results;
    },
    onSuccess: (results) => {
      setBatchResults(results);
      setPreviewResults([]);
      setUploadProgress(null);
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => {
      setUploadProgress(null);
    },
  });
  const preview = useMutation({
    mutationFn: async (files: File[]) => {
      const results: BatchPreviewResult[] = [];
      setBatchResults([]);
      setUploadProgress({ currentFileName: "", done: 0, label: "Gerando prévia", total: files.length });
      setPreviewResults([]);
      for (const file of files) {
        setUploadProgress({ currentFileName: file.name, done: results.length, label: "Gerando prévia", total: files.length });
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
        setUploadProgress({ currentFileName: file.name, done: results.length, label: "Gerando prévia", total: files.length });
        setPreviewResults([...results]);
      }
      return results;
    },
    onSettled: () => {
      setUploadProgress(null);
    },
  });
  const importablePreviewFiles = previewResults
    .filter((item): item is Extract<BatchPreviewResult, { status: "success" }> => item.status === "success")
    .filter((item) => !item.preview.duplicate_file && item.preview.valid_rows > 0)
    .map((item) => item.file);
  const selectedBatchIsLarge = previewResults.length > RECOMMENDED_BATCH_FILE_LIMIT;

  return (
    <section className="page-stack">
      <div className="transaction-summary-grid" aria-label="Resumo das importações da página atual">
        <div className="transaction-summary-card">
          <span>Arquivos</span>
          <strong>{visibleImports.length}</strong>
          <small>Nesta página</small>
        </div>
        <div className="transaction-summary-card positive">
          <span>Novas</span>
          <strong>{pageValidRows}</strong>
          <small>Linhas importadas</small>
        </div>
        <div className="transaction-summary-card info">
          <span>Duplicadas</span>
          <strong>{pageDuplicateRows}</strong>
          <small>Ignoradas no lote</small>
        </div>
        <div className="transaction-summary-card warning">
          <span>Erros</span>
          <strong>{pageErrorRows}</strong>
          <small>Linhas para revisar</small>
        </div>
        <div className="transaction-summary-card negative">
          <span>Falhas</span>
          <strong>{pageFailedImports}</strong>
          <small>Arquivos com problema</small>
        </div>
      </div>
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
          <span>Para dezenas de arquivos, prefira blocos de até {RECOMMENDED_BATCH_FILE_LIMIT}; o MVP processa um arquivo por vez.</span>
          <input
            accept=".txt,.csv,text/plain,text/csv"
            disabled={upload.isPending || preview.isPending}
            multiple
            type="file"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > RECOMMENDED_BATCH_FILE_LIMIT) {
                setImportActionMessage(
                  `Lote grande com ${files.length} arquivos. Vamos processar um por vez; se ficar lento em produção, divida em blocos de até ${RECOMMENDED_BATCH_FILE_LIMIT}.`,
                );
              } else {
                setImportActionMessage("");
              }
              if (files.length) preview.mutate(files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {previewResults.length ? (
          <BatchPreviewSummary
            disabled={!importablePreviewFiles.length || upload.isPending}
            onConfirm={() => upload.mutate(importablePreviewFiles)}
            recommendedLimit={RECOMMENDED_BATCH_FILE_LIMIT}
            results={previewResults}
            selectedBatchIsLarge={selectedBatchIsLarge}
          />
        ) : null}
        {uploadProgress ? <BatchUploadProgressSummary progress={uploadProgress} /> : null}
        {batchResults.length && !uploadProgress ? <BatchUploadSummary results={batchResults} /> : null}
      </Panel>
      {importActionMessage ? <InlineSuccess message={importActionMessage} /> : null}
      {removeImport.isError ? <InlineError message={apiErrorMessage(removeImport.error, "Falha ao excluir importação.")} /> : null}

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
            {visibleImports.map((item) => (
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
          {selectedImportJob ? (
            <div className="danger-zone">
              <div>
                <strong>Excluir importação</strong>
                <p>Remove os lançamentos, linhas e erros deste processamento para permitir nova importação limpa.</p>
              </div>
              <button
                className="danger-button"
                disabled={removeImport.isPending}
                onClick={() => {
                  const filename = selectedImportJob.source_file?.original_filename ?? "esta importação";
                  if (window.confirm(`Excluir "${filename}" e seus lançamentos? Esta ação não pode ser desfeita no MVP.`)) {
                    removeImport.mutate(selectedImportJob.id);
                  }
                }}
                type="button"
              >
                {removeImport.isPending ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          ) : null}
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

function BatchUploadProgressSummary({ progress }: { progress: BatchUploadProgress }) {
  const percentDone = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="batch-upload-summary">
      <div className="batch-upload-head">
        <strong>{progress.label}</strong>
        <span>{percentDone}%</span>
      </div>
      <div className="upload-progress" aria-label="Progresso da importação em lote">
        <div style={{ width: `${percentDone}%` }} />
      </div>
      <div className="filter-summary compact">
        <span>
          {progress.done} de {progress.total} arquivos processados
          {progress.currentFileName ? ` · ${progress.currentFileName}` : ""}
        </span>
      </div>
      <p className="batch-note">Mantenha esta tela aberta. Cada arquivo é enviado separadamente para reduzir risco de timeout.</p>
    </div>
  );
}

function BatchPreviewSummary({
  disabled,
  onConfirm,
  recommendedLimit,
  results,
  selectedBatchIsLarge,
}: {
  disabled: boolean;
  onConfirm: () => void;
  recommendedLimit: number;
  results: BatchPreviewResult[];
  selectedBatchIsLarge: boolean;
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
        <span>
          <strong>
            Prévia de {successCount} arquivo{successCount === 1 ? "" : "s"}
          </strong>
          <small className={errorCount || duplicateCount ? "warning" : "positive"}>
            {importableCount} pronto{importableCount === 1 ? "" : "s"} para importar
          </small>
        </span>
        {importableCount > 0 ? (
          <button className="primary-button compact-button" disabled={disabled} onClick={onConfirm} type="button">
            Confirmar importação
          </button>
        ) : null}
      </div>
      {selectedBatchIsLarge ? (
        <p className="batch-note warning">
          Lote grande detectado. O MVP vai processar arquivo por arquivo; para produção, blocos de até {recommendedLimit} arquivos tendem a ser mais estáveis.
        </p>
      ) : null}
      <div className="batch-upload-list scrollable-list">
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
      {importableCount === 0 ? (
        <p className="batch-note warning">Nenhum arquivo novo pronto para importar. Revise duplicados, erros ou arquivos sem linhas válidas.</p>
      ) : null}
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
    drilldown?.sourceType ?? "",
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
      initialSourceType={drilldown?.sourceType ?? ""}
      initialWeekday={drilldown?.weekday}
      session={session}
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
  const rootCategoryCount = (categories.data?.items ?? []).filter((category) => !category.parent_category_id).length;
  const childCategoryCount = (categories.data?.items ?? []).filter((category) => category.parent_category_id).length;
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
      <div className="transaction-summary-grid compact-four" aria-label="Resumo das categorias">
        <div className="transaction-summary-card">
          <span>Total</span>
          <strong>{categories.data?.items.length ?? 0}</strong>
          <small>Categorias cadastradas</small>
        </div>
        <div className="transaction-summary-card info">
          <span>Principais</span>
          <strong>{rootCategoryCount}</strong>
          <small>Grupos de alto nível</small>
        </div>
        <div className="transaction-summary-card positive">
          <span>Subcategorias</span>
          <strong>{childCategoryCount}</strong>
          <small>Detalhamento dos gastos</small>
        </div>
        <div className="transaction-summary-card warning">
          <span>Modo</span>
          <strong>{editing ? "Edição" : "Cadastro"}</strong>
          <small>{editing ? "Salve ou cancele" : "Crie uma nova categoria"}</small>
        </div>
      </div>
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
  const ruleItems = rules.data?.items ?? [];
  const activeRuleCount = ruleItems.filter((rule) => rule.active).length;
  const categoryRuleCount = ruleItems.filter((rule) => rule.category_id).length;
  const directionRuleCount = ruleItems.filter((rule) => rule.target_direction).length;

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
      <div className="page-toolbar">
        <button className="secondary-button" onClick={() => apply.mutate()} disabled={apply.isPending}>
          <RefreshCw className={apply.isPending ? "spin" : ""} size={16} />
          {apply.isPending ? "Aplicando..." : "Aplicar regras"}
        </button>
      </div>
      <div className="transaction-summary-grid compact-four" aria-label="Resumo das regras">
        <div className="transaction-summary-card">
          <span>Total</span>
          <strong>{ruleItems.length}</strong>
          <small>Regras cadastradas</small>
        </div>
        <div className="transaction-summary-card positive">
          <span>Ativas</span>
          <strong>{activeRuleCount}</strong>
          <small>Aplicadas nas próximas rodadas</small>
        </div>
        <div className="transaction-summary-card info">
          <span>Categorias</span>
          <strong>{categoryRuleCount}</strong>
          <small>Classificam categoria</small>
        </div>
        <div className="transaction-summary-card warning">
          <span>Tipo financeiro</span>
          <strong>{directionRuleCount}</strong>
          <small>Ajustam despesa/receita/fatura</small>
        </div>
      </div>
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
            {ruleItems.map((rule) => (
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
      fixedQuery="category_id=__uncategorized__"
      onSelect={setSelected}
      selected={selected}
      reviewMode
    />
  );
}

function SettingsPage({
  onNavigate,
  workspaceName,
  session,
}: {
  onNavigate: (page: Page) => void;
  workspaceName: string;
  session: ApiSession;
}) {
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
      <div className="transaction-summary-grid compact-four" aria-label="Resumo das configurações">
        <div className="transaction-summary-card">
          <span>Workspace</span>
          <strong title={workspaceName}>{workspaceName}</strong>
          <small>Ambiente ativo</small>
        </div>
        <div className="transaction-summary-card info">
          <span>Sessão</span>
          <strong>{session.mode === "local" ? "Local" : "Supabase"}</strong>
          <small>Modo de autenticação</small>
        </div>
        <div className="transaction-summary-card positive">
          <span>API</span>
          <strong>Conectada</strong>
          <small>Workspace carregado</small>
        </div>
        <div className="transaction-summary-card warning">
          <span>Manutenção</span>
          <strong>{normalizeDescriptions.isPending ? "Rodando" : "Pronta"}</strong>
          <small>Reprocessamento controlado</small>
        </div>
      </div>
      <Panel title="Workspace">
        <div className="settings-list">
          <QualityRow label="Nome" value={workspaceName} />
          <QualityRow label="Modo de sessão" value={session.mode === "local" ? "Local" : "Supabase"} />
          <QualityRow label="API" value="Conectada" />
        </div>
      </Panel>
      <Panel title="Central de configurações" description="Subtelas previstas no produto completo. O MVP mantém atalhos para o que já existe.">
        <div className="settings-hub-grid">
          <SettingsHubCard
            description="Categorias e subcategorias usadas nos indicadores."
            icon={Tags}
            onClick={() => onNavigate("categories")}
            status="Disponível"
            title="Categorias"
          />
          <SettingsHubCard
            description="Regras de categoria, tipo financeiro e normalização."
            icon={Wand2}
            onClick={() => onNavigate("rules")}
            status="Disponível"
            title="Regras e normalização"
          />
          <SettingsHubCard
            description="Arquivos, parser, histórico e reprocessamento."
            icon={FileUp}
            onClick={() => onNavigate("imports")}
            status="Disponível"
            title="Importação de dados"
          />
          <SettingsHubCard
            description="Dados pessoais, família, preferências e avatar."
            icon={Users}
            status="Em breve"
            title="Perfil"
          />
          <SettingsHubCard
            description="Senha, sessões, MFA e dispositivos confiáveis."
            icon={ShieldCheck}
            status="Em breve"
            title="Segurança"
          />
          <SettingsHubCard
            description="Moeda, idioma, burn rate, runway e limites pessoais."
            icon={Gauge}
            status="Em breve"
            title="Preferências financeiras"
          />
          <SettingsHubCard
            description="Contas, bancos, cartões e fontes conectadas."
            icon={CreditCard}
            status="Em breve"
            title="Contas e bancos"
          />
          <SettingsHubCard
            description="Alertas, canais, lembretes e limites de comunicação."
            icon={Bell}
            status="Em breve"
            title="Notificações"
          />
          <SettingsHubCard
            description="Exportação, backup, sincronização e retenção."
            icon={Database}
            status="Em breve"
            title="Backup e sincronização"
          />
          <SettingsHubCard
            description="Plano, cobrança, notas fiscais e cancelamento."
            icon={ReceiptText}
            status="Em breve"
            title="Assinatura e plano"
          />
          <SettingsHubCard
            description="Versão, termos, privacidade e suporte."
            icon={Sparkles}
            status="Em breve"
            title="Sobre o app"
          />
        </div>
      </Panel>
      <Panel
        title="Preferências financeiras"
        description="Campos previstos no v3 para personalizar indicadores, alertas e recomendações."
      >
        <div className="preference-preview-grid">
          <PreferencePreview label="Janela de burn rate" value="12 meses" />
          <PreferencePreview label="Runway" value="Saldo disponível / burn rate" />
          <PreferencePreview label="Reserva mínima protegida" value="Em breve" />
          <PreferencePreview label="Política de gasto seguro" value="Em breve" />
          <PreferencePreview label="Perfil de risco" value="Conservador / Moderado / Arrojado" />
          <PreferencePreview label="Sensibilidade do score" value="Em breve" />
        </div>
      </Panel>
      <Panel title="Segurança e sobre o app" description="Informações rápidas enquanto as subtelas dedicadas não entram no MVP.">
        <div className="settings-info-grid">
          <InfoTile
            icon={ShieldCheck}
            title="Privacidade"
            description="Dados financeiros ficam restritos ao workspace ativo e não devem aparecer em logs ou documentos gerados."
          />
          <InfoTile
            icon={Database}
            title="Backup"
            description="Backup e sincronização entram em etapa futura; por enquanto, mantenha os arquivos originais guardados."
          />
          <InfoTile
            icon={Sparkles}
            title="Versão"
            description="MVP em evolução, com foco atual em importação, categorização, indicadores e revisão visual."
          />
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

function SettingsHubCard({
  description,
  icon: Icon,
  onClick,
  status,
  title,
}: {
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  status: string;
  title: string;
}) {
  const content = (
    <>
      <div className="settings-hub-icon">
        <Icon size={18} />
      </div>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>{status}</em>
    </>
  );

  if (onClick) {
    return (
      <button className="settings-hub-card clickable" onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <div className="settings-hub-card disabled">{content}</div>;
}

function PreferencePreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="preference-preview">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoTile({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="info-tile">
      <Icon size={18} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
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
  initialSourceType = "",
  initialWeekday,
  session,
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
  initialSourceType?: string;
  initialWeekday?: number;
  session: ApiSession;
  onSelect: (transaction: TransactionRead | null) => void;
  selected: TransactionRead | null;
  fixedQuery?: string;
  reviewMode?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [sourceType, setSourceType] = useState(initialSourceType);
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
  const [showCreate, setShowCreate] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateGroupIds, setDuplicateGroupIds] = useState<string[]>([]);
  const [duplicateGroupKey, setDuplicateGroupKey] = useState("");
  const [duplicateGroupPrimaryId, setDuplicateGroupPrimaryId] = useState("");
  const [duplicatePage, setDuplicatePage] = useState(0);
  const pageSize = 50;
  const duplicatePageSize = 10;
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
    if (duplicateGroupIds.length) params.set("ids", duplicateGroupIds.join(","));
    params.set("sort_by", sortBy);
    params.set("sort_dir", sortDir);
    if (fixedQuery && fixedQuery !== "category_id=__uncategorized__") {
      const [key, value] = fixedQuery.split("=");
      params.set(key, value);
    }
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `?${params.toString()}`;
  }, [categoryId, dateFrom, dateTo, direction, duplicateGroupIds, fixedQuery, importJobId, page, search, sortBy, sortDir, sourceType, weekday]);
  const transactions = useQuery({
    queryKey: ["transactions", session.token, query],
    queryFn: () => getTransactions(session, query),
  });
  const duplicatesQuery = `?limit=${duplicatePageSize}&offset=${duplicatePage * duplicatePageSize}`;
  const duplicates = useQuery({
    queryKey: ["transaction-duplicates", session.token, duplicatesQuery],
    queryFn: () => getTransactionDuplicates(session, duplicatesQuery),
    enabled: showDuplicates,
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
  const removeDuplicateReviewItems = useMutation({
    mutationFn: (transactionIds: string[]) =>
      Promise.all(transactionIds.map((transactionId) => deleteTransaction(session, transactionId))),
    onSuccess: (_result, transactionIds) => {
      onSelect(null);
      setDuplicateGroupIds([]);
      setDuplicateGroupKey("");
      setDuplicateGroupPrimaryId("");
      setActionMessage(`${transactionIds.length} lançamento(s) revisado(s) foram excluídos. Indicadores e listas foram atualizados.`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-duplicates"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["weekday-spending"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  const createManual = useMutation({
    mutationFn: (payload: {
      amount: string;
      category_id: string | null;
      description: string;
      direction: string;
      transaction_date: string;
    }) => createManualTransaction(session, payload),
    onSuccess: (transaction) => {
      setShowCreate(false);
      onSelect(transaction);
      setActionMessage("Transação manual cadastrada. Indicadores e listas foram atualizados.");
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
  const pageIncome = visibleTransactions
    .filter((transaction) => transaction.direction === "credit")
    .reduce((total, transaction) => total + Math.abs(Number(transaction.amount)), 0);
  const pageExpenses = visibleTransactions
    .filter((transaction) => transaction.direction === "debit")
    .reduce((total, transaction) => total + Math.abs(Number(transaction.amount)), 0);
  const pagePayments = visibleTransactions
    .filter((transaction) => transaction.direction === "payment")
    .reduce((total, transaction) => total + Math.abs(Number(transaction.amount)), 0);
  const pagePending = visibleTransactions.filter((transaction) => !transaction.category).length;
  const nextPageDisabled =
    transactions.isLoading || fixedQuery === "category_id=__uncategorized__"
      ? visibleTransactions.length < pageSize
      : (page + 1) * pageSize >= totalTransactions;
  const activeFilterCount = [
    search,
    duplicateGroupIds.length ? String(duplicateGroupIds.length) : "",
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
    duplicateGroupCount: duplicateGroupIds.length,
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
    setDuplicateGroupIds([]);
    setDuplicateGroupKey("");
    setDuplicateGroupPrimaryId("");
    setPage(0);
  }

  function filterDuplicateGroup(group: DuplicateTransactionGroup) {
    const dates = group.items.map((item) => item.transaction_date).sort();
    const directions = new Set(group.items.map((item) => item.direction));
    const sourceTypes = new Set(group.items.map((item) => item.source_type));
    setSearch(group.items[0]?.description ?? "");
    setSourceType(sourceTypes.size === 1 ? group.items[0]?.source_type ?? "" : "");
    setDirection(directions.size === 1 ? group.items[0]?.direction ?? "" : "");
    setCategoryId("");
    setImportJobId("");
    setWeekday(undefined);
    setPeriodPreset("custom");
    setDateFrom(dates[0] ?? "");
    setDateTo(dates[dates.length - 1] ?? "");
    setDuplicateGroupIds(group.items.map((item) => item.id));
    setDuplicateGroupKey(group.current_natural_dedupe_key);
    setDuplicateGroupPrimaryId(duplicatePrimaryId(group));
    setPage(0);
    setShowDuplicates(false);
  }

  function deleteReviewedDuplicates() {
    const idsToDelete = duplicateGroupIds.filter((id) => id !== duplicateGroupPrimaryId);
    if (!idsToDelete.length) return;
    const confirmed = window.confirm(
      `Manter o lançamento principal e excluir ${idsToDelete.length} possível(is) duplicado(s)? Esta ação não pode ser desfeita no MVP.`,
    );
    if (confirmed) {
      removeDuplicateReviewItems.mutate(idsToDelete);
    }
  }

  function handleCategoryChanged(transaction: TransactionRead, categoryId: string | null) {
    if (selected?.id === transaction.id) {
      onSelect(transaction);
    }
    if (reviewMode && categoryId) {
      setActionMessage("Categoria aplicada. A transação saiu da revisão porque não está mais pendente.");
      return;
    }
    if (!categoryId) {
      setActionMessage("Categoria removida. A transação voltou para Sem categoria e entrou na revisão pendente.");
      return;
    }
    setActionMessage("Categoria atualizada. Indicadores e listas foram recalculados.");
  }

  return (
    <section className="page-stack">
      {reviewMode ? (
        <div className="transaction-summary-grid compact-four" aria-label="Resumo da revisão">
          <div className="transaction-summary-card warning">
            <span>Pendentes</span>
            <strong>{pagePending}</strong>
            <small>Sem categoria nesta página</small>
          </div>
          <div className="transaction-summary-card negative">
            <span>Despesas</span>
            <strong>{formatCurrencyCompact(pageExpenses)}</strong>
            <small title={moneyAbs(pageExpenses)}>{moneyAbs(pageExpenses)}</small>
          </div>
          <div className="transaction-summary-card positive">
            <span>Receitas</span>
            <strong>{formatCurrencyCompact(pageIncome)}</strong>
            <small title={moneyAbs(pageIncome)}>{moneyAbs(pageIncome)}</small>
          </div>
          <div className="transaction-summary-card">
            <span>Total</span>
            <strong>{visibleTransactions.length}</strong>
            <small>Lançamentos na fila</small>
          </div>
        </div>
      ) : null}
      {!reviewMode ? (
        <div className="page-toolbar">
          <button className="primary-button" onClick={() => setShowCreate(true)} type="button">
            <Plus size={16} />
            Nova transação
          </button>
        </div>
      ) : null}
      <div className="transaction-summary-grid" aria-label="Resumo da página atual">
        <div className="transaction-summary-card">
          <span>Lançamentos</span>
          <strong>{visibleTransactions.length}</strong>
          <small>Nesta página</small>
        </div>
        <div className="transaction-summary-card positive">
          <span>Receitas</span>
          <strong>{formatCurrencyCompact(pageIncome)}</strong>
          <small title={moneyAbs(pageIncome)}>{moneyAbs(pageIncome)}</small>
        </div>
        <div className="transaction-summary-card negative">
          <span>Despesas</span>
          <strong>{formatCurrencyCompact(pageExpenses)}</strong>
          <small title={moneyAbs(pageExpenses)}>{moneyAbs(pageExpenses)}</small>
        </div>
        <div className="transaction-summary-card info">
          <span>Faturas</span>
          <strong>{formatCurrencyCompact(pagePayments)}</strong>
          <small title={moneyAbs(pagePayments)}>{moneyAbs(pagePayments)}</small>
        </div>
        <div className="transaction-summary-card warning">
          <span>Pendentes</span>
          <strong>{pagePending}</strong>
          <small>Sem categoria</small>
        </div>
      </div>
      <Panel title="Busca e filtros">
        <div className="transaction-type-tabs" aria-label="Filtrar por tipo financeiro">
          {[
            { label: "Todos", value: "" },
            { label: "Despesas", value: "debit" },
            { label: "Receitas", value: "credit" },
            { label: "Faturas", value: "payment" },
          ].map((tab) => (
            <button
              className={direction === tab.value ? "active" : ""}
              key={tab.value || "all"}
              onClick={() => {
                setDirection(tab.value);
                setPage(0);
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
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
              <option value="unknown">Manual/Outras</option>
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
      {!reviewMode ? (
        <Panel
          title="Possíveis duplicados"
          description="Grupos encontrados pela regra atual. Confira qual lançamento deve ficar antes de excluir duplicados."
        >
          <div className="panel-actions">
            <button
              className="ghost-button"
              onClick={() => {
                setShowDuplicates((current) => !current);
                setDuplicatePage(0);
              }}
              type="button"
            >
              {showDuplicates ? "Ocultar" : "Ver duplicados"}
            </button>
          </div>
          {showDuplicates ? (
            <DuplicateTransactionsPanel
              groups={duplicates.data?.groups ?? []}
              loading={duplicates.isLoading}
              onFilterGroup={filterDuplicateGroup}
              onNextPage={() => setDuplicatePage((current) => current + 1)}
              onPreviousPage={() => setDuplicatePage((current) => Math.max(current - 1, 0))}
              onRefresh={() => void duplicates.refetch()}
              page={duplicatePage}
              pageSize={duplicatePageSize}
              totalGroups={duplicates.data?.total_groups ?? 0}
              totalTransactions={duplicates.data?.total_transactions ?? 0}
            />
          ) : (
            <div className="filter-summary compact">
              <span>Abra a revisão para conferir grupos históricos sem alterar a base automaticamente.</span>
            </div>
          )}
        </Panel>
      ) : null}
      <Panel title={reviewMode ? "Pendências" : "Lançamentos"}>
        {duplicateGroupIds.length ? (
          <div className="duplicate-filter-banner">
            <span>Revise o grupo, mantenha o principal e exclua apenas lançamentos repetidos.</span>
            <div>
              <button
                className="danger-button compact-button"
                disabled={removeDuplicateReviewItems.isPending || duplicateGroupIds.length < 2}
                onClick={deleteReviewedDuplicates}
                type="button"
              >
                {removeDuplicateReviewItems.isPending ? "Excluindo..." : "Excluir duplicados"}
              </button>
              <button
                className="ghost-button compact-button"
                disabled={removeDuplicateReviewItems.isPending}
                onClick={() => {
                  setDuplicateGroupIds([]);
                  setDuplicateGroupKey("");
                  setDuplicateGroupPrimaryId("");
                  setPage(0);
                }}
                type="button"
              >
                Limpar grupo
              </button>
            </div>
          </div>
        ) : null}
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
              <th>Parcela</th>
              <th>Categoria</th>
              <th><SortHeader active={sortBy === "source_type"} direction={sortDir} label="Fonte" onClick={() => toggleSort("source_type")} /></th>
              {duplicateGroupIds.length ? <th>Revisão</th> : null}
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
                onCategorized={handleCategoryChanged}
                expectedDedupeKey={duplicateGroupKey}
                primaryDedupeId={duplicateGroupPrimaryId}
                session={session}
                showDedupeStatus={Boolean(duplicateGroupIds.length)}
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
            onCategorized={handleCategoryChanged}
            session={session}
            transaction={selected}
          />
        </Drawer>
      ) : null}
      {showCreate ? (
        <Drawer title="Nova transação manual" onClose={() => setShowCreate(false)}>
          <ManualTransactionForm
            categories={categories.data?.items ?? []}
            error={createManual.isError ? apiErrorMessage(createManual.error, "Falha ao cadastrar transação.") : ""}
            loading={createManual.isPending}
            onCancel={() => setShowCreate(false)}
            onSubmit={(payload) => createManual.mutate(payload)}
          />
        </Drawer>
      ) : null}
      {remove.isError ? <InlineError message={apiErrorMessage(remove.error, "Falha ao excluir transação.")} /> : null}
      {removeDuplicateReviewItems.isError ? <InlineError message={apiErrorMessage(removeDuplicateReviewItems.error, "Falha ao excluir lançamentos revisados.")} /> : null}
    </section>
  );
}

function ManualTransactionForm({
  categories,
  error,
  loading,
  onCancel,
  onSubmit,
}: {
  categories: CategoryRead[];
  error: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    amount: string;
    category_id: string | null;
    description: string;
    direction: string;
    transaction_date: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [transactionDate, setTransactionDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("debit");
  const [categoryId, setCategoryId] = useState("");
  const [validationError, setValidationError] = useState("");
  const categoryOptions = orderedCategoryOptions(categories);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedAmount = amount.replace(",", ".").trim();
    const numericAmount = Number(normalizedAmount);
    const missingFields = [
      !transactionDate ? "data" : "",
      !description.trim() ? "descrição" : "",
      !normalizedAmount || Number.isNaN(numericAmount) || numericAmount <= 0 ? "valor maior que zero" : "",
    ].filter(Boolean);
    if (missingFields.length) {
      setValidationError(`Informe ${missingFields.join(", ")}.`);
      return;
    }
    setValidationError("");
    onSubmit({
      transaction_date: transactionDate,
      description: description.trim(),
      amount: normalizedAmount,
      direction,
      category_id: categoryId || null,
    });
  }

  return (
    <form className="manual-transaction-form" onSubmit={submit}>
      <div className="form-grid two-columns">
        <label>
          Data
          <input
            disabled={loading}
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
          />
        </label>
        <label>
          Tipo financeiro
          <select disabled={loading} value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="debit">Despesa</option>
            <option value="credit">Receita/Crédito</option>
            <option value="payment">Pagamento de fatura</option>
          </select>
        </label>
      </div>
      <label>
        Descrição
        <input
          disabled={loading}
          placeholder="Ex: Mercado, salário, ajuste de fatura"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="form-grid two-columns">
        <label>
          Valor
          <input
            disabled={loading}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Categoria
          <select disabled={loading} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Sem categoria</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {validationError ? <InlineError message={validationError} /> : null}
      {error ? <InlineError message={error} /> : null}
      <div className="form-actions">
        <button className="ghost-button" disabled={loading} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
          Cadastrar transação
        </button>
      </div>
    </form>
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

function DuplicateTransactionsPanel({
  groups,
  loading,
  onNextPage,
  onFilterGroup,
  onPreviousPage,
  onRefresh,
  page,
  pageSize,
  totalGroups,
  totalTransactions,
}: {
  groups: DuplicateTransactionGroup[];
  loading: boolean;
  onNextPage: () => void;
  onFilterGroup: (group: DuplicateTransactionGroup) => void;
  onPreviousPage: () => void;
  onRefresh: () => void;
  page: number;
  pageSize: number;
  totalGroups: number;
  totalTransactions: number;
}) {
  const from = totalGroups ? page * pageSize + 1 : 0;
  const to = Math.min((page + 1) * pageSize, totalGroups);
  const nextDisabled = loading || to >= totalGroups;
  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spin" size={18} />
        Carregando possíveis duplicados...
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="filter-summary compact">
        <span>Nenhum grupo de possível duplicidade encontrado.</span>
      </div>
    );
  }
  return (
    <div className="duplicate-stack">
      <div className="filter-summary compact">
        <span>{totalGroups} grupos encontrados · mostrando {from}-{to}</span>
        <strong>{totalTransactions} lançamentos envolvidos</strong>
      </div>
      <div className="duplicate-toolbar">
        <button className="ghost-button compact-button" disabled={loading} onClick={onRefresh} type="button">
          Atualizar
        </button>
        <div>
          <button className="ghost-button compact-button" disabled={loading || page === 0} onClick={onPreviousPage} type="button">
            Anterior
          </button>
          <button className="ghost-button compact-button" disabled={nextDisabled} onClick={onNextPage} type="button">
            Próxima
          </button>
        </div>
      </div>
      {groups.map((group) => {
        const primaryId = duplicatePrimaryId(group);
        return (
          <div className="duplicate-group" key={group.current_natural_dedupe_key}>
            <div className="duplicate-group-head">
              <span>
                <strong>{group.count} lançamentos parecidos</strong>
                <small>{group.current_natural_dedupe_key.slice(0, 12)}</small>
              </span>
              <button className="ghost-button compact-button" onClick={() => onFilterGroup(group)} type="button">
                Filtrar grupo
              </button>
            </div>
            <div className="duplicate-items">
              {group.items.map((item) => (
                <div className="duplicate-item" key={item.id}>
                  <span>
                    <strong>{dateLabel(item.transaction_date)} · {moneyAbs(item.amount)}</strong>
                    <small>
                      {item.description} · {item.source_filename ?? "arquivo sem nome"} · linha {item.source_line ?? "-"}
                    </small>
                  </span>
                  <DedupeStatusBadge status={dedupeStatus(item, group.current_natural_dedupe_key, primaryId)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionRow({
  transaction,
  categories,
  session,
  onDelete,
  onSelect,
  onCategorized,
  expectedDedupeKey = "",
  primaryDedupeId = "",
  showDedupeStatus = false,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  session: ApiSession;
  onDelete: () => void;
  onSelect: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
  expectedDedupeKey?: string;
  primaryDedupeId?: string;
  showDedupeStatus?: boolean;
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
      <td>{installmentLabel(transaction)}</td>
      <td><CategoryPicker categories={categories} onCategorized={onCategorized} session={session} transaction={transaction} /></td>
      <td><SourceBadge source={transaction.category?.source} label={categoryLabel} /></td>
      {showDedupeStatus ? (
        <td>
          <DedupeStatusBadge status={dedupeStatus(transaction, expectedDedupeKey, primaryDedupeId)} />
        </td>
      ) : null}
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
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const categoryOptions = orderedCategoryOptions(categories);
  const mutation = useMutation({
    mutationFn: (categoryId: string | null) => updateTransactionCategory(session, transaction.id, categoryId),
    onSuccess: (updatedTransaction, categoryId) => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      onCategorized?.(updatedTransaction, categoryId);
    },
  });
  return (
    <select
      className="table-select"
      disabled={mutation.isPending}
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
  onCategorized,
  session,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  deleting?: boolean;
  onDelete?: () => void;
  onCategorized?: (transaction: TransactionRead, categoryId: string | null) => void;
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
      <QualityRow label="Parcela" value={installmentSummaryLabel(transaction)} />
      <QualityRow label="Data" value={dateLabel(transaction.transaction_date)} />
      <QualityRow label="Origem" value={sourceTypeLabel(transaction.source_type)} />
      <QualityRow label="Arquivo" value={transaction.source_file_id} />
      <QualityRow label="Importação" value={transaction.import_job_id} />
      <QualityRow label="Linha" value={transaction.source_line ?? "-"} />
      <QualityRow label="Duplicidade" value={transaction.natural_dedupe_key ? "Registro principal ou já regularizado" : "Precisa revisão por possível duplicidade"} />
      <QualityRow label="Categoria atual" value={category ? categoryPath(category, categories) : "Sem categoria"} />
      <QualityRow label="Fonte" value={transaction.category?.source ?? "Pendente"} />
      <div>
        <p className="field-label">Alterar categoria</p>
        <CategoryPicker categories={categories} onCategorized={onCategorized} session={session} transaction={transaction} />
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

function RecurringExpenseList({
  items,
  loading,
  onOpenRecurring,
}: {
  items: RecurringExpenseItem[];
  loading: boolean;
  onOpenRecurring: (item: RecurringExpenseItem) => void;
}) {
  if (loading) {
    return <PageState icon={Loader2} title="Carregando recorrências" description="Aguarde um momento." spin compact />;
  }
  if (!items.length) {
    return <EmptyInline message="Nenhuma recorrência provável com pelo menos 3 meses no período." />;
  }
  return (
    <div className="merchant-list">
      {items.map((item) => (
        <button className="merchant-row clickable" key={item.description} onClick={() => onOpenRecurring(item)} type="button">
          <span>
            <strong>{item.description}</strong>
            <small>
              {item.month_count} meses · último {dateLabel(item.last_transaction_date)}
              {item.category_name ? ` · ${item.category_name}` : ""}
            </small>
          </span>
          <span className="category-summary-values">
            <strong className="negative">{moneyAbs(item.average_amount)}</strong>
            <small>
              Último {moneyAbs(item.last_amount)}
              {item.change_ratio ? ` · ${signedPercent(item.change_ratio)}` : ""}
            </small>
          </span>
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

function DashboardSectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="dashboard-section-header">
      <span>{eyebrow}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
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

function StatusBadge({ label, status }: { label?: string; status: string }) {
  const normalized = status.toLowerCase();
  return <span className={`status-badge ${normalized}`}>{label ?? statusLabel(status)}</span>;
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
    if (
      periodPreset === "current_month" ||
      periodPreset === "previous_month" ||
      isSingleMonthRange(dateFrom, dateTo)
    ) {
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

  const recurringQuery = useMemo(() => {
    if (dateTo && rangeMonthCount(dateFrom || dateTo, dateTo) < 12) {
      return trailingMonthsQuery(dateTo, 12);
    }
    return query;
  }, [dateFrom, dateTo, query]);

  return {
    dateFrom,
    dateTo,
    periodPreset,
    query,
    recurringQuery,
    setDateFrom,
    setDateTo,
    setPeriodPreset,
    trendQuery,
  };
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

function pageMeta(page: Page) {
  const pages: Record<Page, { description: string; title: string }> = {
    cashflow: {
      description: "Entenda entradas, saídas, faturas e tendência mensal do dinheiro.",
      title: "Fluxo de caixa",
    },
    cards: {
      description: "Acompanhe fatura, parcelas, compras no cartão e conciliação com a conta.",
      title: "Cartões",
    },
    categories: {
      description: "Organize categorias e subcategorias para deixar os indicadores confiáveis.",
      title: "Categorias",
    },
    dashboard: {
      description: "Acompanhe a história do seu dinheiro e os sinais que pedem atenção.",
      title: "Visão geral",
    },
    imports: {
      description: "Carregue extratos e faturas, revise a prévia e acompanhe o que entrou na base.",
      title: "Importações",
    },
    review: {
      description: "Resolva pendências de classificação e aumente a qualidade dos dados.",
      title: "Revisão",
    },
    rules: {
      description: "Ensine o sistema a classificar lançamentos recorrentes automaticamente.",
      title: "Regras",
    },
    settings: {
      description: "Acompanhe o ambiente atual e execute manutenções controladas.",
      title: "Configurações",
    },
    transactions: {
      description: "Encontre lançamentos, revise categorias e entenda a origem dos dados.",
      title: "Transações",
    },
  };
  return pages[page];
}

function transactionFilterSummary({
  categoryId,
  categories,
  dateFrom,
  dateTo,
  direction,
  duplicateGroupCount,
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
  duplicateGroupCount: number;
  importJobId: string;
  periodPreset: TransactionPeriodPreset;
  reviewMode: boolean;
  search: string;
  sourceType: string;
  weekday?: number;
}) {
  const parts: string[] = [];
  if (reviewMode) parts.push("pendentes de categoria");
  if (duplicateGroupCount) parts.push(`grupo com ${duplicateGroupCount} possíveis duplicados`);
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

function trailingMonthsQuery(dateTo: string, monthCount: number) {
  const end = parseIsoDate(dateTo);
  if (!end) return "";
  const start = new Date(end.getFullYear(), end.getMonth() - monthCount + 1, 1);
  const params = new URLSearchParams();
  params.set("date_from", isoDate(start));
  params.set("date_to", isoDate(end));
  return `?${params.toString()}`;
}

function rangeMonthCount(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

function isSingleMonthRange(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  return Boolean(start && end && start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth());
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
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
  if (
    period.periodPreset === "current_month" ||
    period.periodPreset === "previous_month" ||
    isSingleMonthRange(period.dateFrom, period.dateTo)
  ) {
    const [year] = (period.dateFrom || period.dateTo).split("-");
    return year ? `Tendência mensal do ano ${year}, mantendo o mês selecionado nos demais indicadores.` : "Receitas, despesas e saldo por mês.";
  }
  return "Receitas, despesas e saldo por mês.";
}

function monthTickLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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

function formatCurrencyCompact(value?: string | number | null) {
  const numeric = Math.abs(Number(value ?? 0));
  if (numeric < 1000) return money(numeric);
  if (numeric < 1000000) {
    const compact = numeric / 1000;
    return `R$ ${compact.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  const compact = numeric / 1000000;
  return `R$ ${compact.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

function compactMoneyAbs(value?: string | number | null) {
  return formatCurrencyCompact(value);
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
  recurring,
  summary,
}: {
  categoryGrowth: CategoryGrowthAlertItem[];
  period: ReturnType<typeof usePeriod>;
  quality?: DataQuality;
  recurring: RecurringExpenseItem[];
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
  recurring
    .filter((item) => Number(item.change_ratio ?? 0) >= 0.3 && Number(item.last_amount) >= 50)
    .slice(0, 3)
    .forEach((item) => {
      alerts.push({
        description: `${item.description} subiu ${signedPercent(item.change_ratio)}: último ${moneyAbs(item.last_amount)} contra média ${moneyAbs(item.average_amount)}.`,
        icon: RefreshCw,
        title: "Recorrente em alta",
        tone: "warning",
        transactionDrilldown: {
          dateFrom: period.dateFrom,
          dateTo: period.dateTo,
          direction: "debit",
          label: item.description,
          periodPreset: period.periodPreset,
          search: item.description,
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
  return `${formatPercentNumber(Number(value) * 100)}%`;
}

function percentAbs(value?: string | null) {
  if (!value) return "0%";
  return `${formatPercentNumber(Math.abs(Number(value) * 100))}%`;
}

function signedPercent(value?: string | null) {
  if (!value) return "0%";
  const numberValue = Number(value) * 100;
  const sign = numberValue > 0 ? "+" : "";
  return `${sign}${formatPercentNumber(numberValue)}%`;
}

function formatPercentNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function qualityTone(value?: string | null): "positive" | "negative" | "warning" {
  const ratio = Number(value ?? 0);
  if (ratio >= 0.9) return "positive";
  if (ratio >= 0.7) return "warning";
  return "negative";
}

function commitmentTone(value?: string | null): "positive" | "negative" | "warning" {
  if (!value) return "warning";
  const ratio = Number(value);
  if (ratio < 0.7) return "positive";
  if (ratio < 0.85) return "warning";
  return "negative";
}

function commitmentHelper(value?: string | null) {
  if (!value) return "Sem receita no período";
  const ratio = Number(value);
  if (ratio < 0.5) return "Excelente";
  if (ratio < 0.7) return "Saudável";
  if (ratio < 0.85) return "Atenção";
  return "Risco";
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
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
      new Date(Number(year), Number(month) - 1, Number(day)),
    );
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
    new Date(value),
  );
}

function amountClass(transaction: TransactionRead) {
  if (transaction.direction === "credit") return "positive";
  if (transaction.direction === "payment") return "muted-strong";
  return "negative";
}

function installmentLabel(transaction: Pick<TransactionRead, "installment_current" | "installment_total">) {
  if (!transaction.installment_current || !transaction.installment_total) return "-";
  return `${transaction.installment_current}/${transaction.installment_total}`;
}

function installmentSummaryLabel(transaction: Pick<TransactionRead, "installment_current" | "installment_total">) {
  if (!transaction.installment_current || !transaction.installment_total) return "-";
  const remaining = Math.max(transaction.installment_total - transaction.installment_current, 0);
  if (remaining === 0) return `${installmentLabel(transaction)} · última parcela`;
  return `${installmentLabel(transaction)} · faltam ${remaining}`;
}

function duplicatePrimaryId(group: DuplicateTransactionGroup) {
  return (
    group.items.find((item) => item.natural_dedupe_key === group.current_natural_dedupe_key)?.id ??
    group.items[0]?.id ??
    ""
  );
}

function dedupeStatus(
  transaction: Pick<TransactionRead, "id" | "natural_dedupe_key">,
  expectedKey = "",
  primaryId = "",
) {
  if (expectedKey && transaction.natural_dedupe_key === expectedKey) return "principal";
  if (primaryId && transaction.id === primaryId) return "suggested";
  return "review";
}

function DedupeStatusBadge({ status }: { status: ReturnType<typeof dedupeStatus> }) {
  if (status === "principal") return <StatusBadge label="Principal" status="completed" />;
  if (status === "suggested") {
    return <StatusBadge label="Principal sugerido" status="completed" />;
  }
  return <StatusBadge label="Revisar" status="completed_with_errors" />;
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
    unknown: "Manual/Outras",
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
