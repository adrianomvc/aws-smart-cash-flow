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
  Link as LinkIcon,
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
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
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
  type BudgetRead,
  type CalendarEventRead,
  type CategoryGrowthAlertItem,
  type CategoryRankingItem,
  type CategoryRead,
  type CategorizationRuleRead,
  type CreditCardInstallmentItem,
  type CreditCardPaymentMatchItem,
  type CreditCardRead,
  type CreditCardStatementRead,
  type DailyCashflowItem,
  type DashboardSummary,
  type DataQuality,
  type DuplicateTransactionGroup,
  type ExpenseSizeProfileItem,
  type GoalRead,
  type ImportJobRead,
  type ImportPreviewResult,
  type PlanningProjection,
  type ReportCardRead,
  type RecurringExpenseItem,
  type RulePreview,
  type SubcategoryRankingItem,
  type TransactionRead,
  associateCreditCardSourceFile,
  applyRules,
  createCategory,
  createBudget,
  createCalendarEvent,
  createCreditCard,
  createCreditCardStatement,
  createGoal,
  createManualTransaction,
  createRule,
  deleteCategory,
  deleteImport,
  deleteRule,
  deleteTransaction,
  getBudgets,
  getCalendarEvents,
  getCategories,
  getCategoryGrowthAlerts,
  getCategoryRanking,
  getCreditCardInstallments,
  getCreditCardPaymentMatches,
  getCreditCards,
  getCreditCardStatements,
  getCurrentWorkspace,
  getDailyCashflow,
  getDashboardSummary,
  getDataQuality,
  getExpenseSizeProfile,
  getGoals,
  getImportErrors,
  getImports,
  getMonthlyCashflow,
  getPlanningProjection,
  getRecurringExpenses,
  getRecurringIncomes,
  getReports,
  getRulePreview,
  getRules,
  getSubcategoryRanking,
  getTransactionDuplicates,
  getTransactions,
  normalizeTransactionDescriptions,
  previewImport,
  updateCategory,
  updateCreditCard,
  updateRule,
  updateTransactionCategory,
  updateTransactionDirection,
  uploadImport,
} from "./lib/api";
import { buildDailyCashflow, buildMonthlyCashflow } from "./lib/cashflow";
import {
  buildRollingCashFlowProjection,
  type CashFlowProjectionChartPoint,
  type CashFlowProjectionPoint,
} from "./lib/cashflowProjection";
import smartCashFlowIcon from "./assets/smartcashflow-icon.png";
import smartCashFlowLogo from "./assets/smartcashflow-logo.png";

type Page =
  | "dashboard"
  | "cashflow"
  | "transactions"
  | "calendar"
  | "cards"
  | "budgets"
  | "goals"
  | "planning"
  | "reports"
  | "imports"
  | "categories"
  | "rules"
  | "review"
  | "settings";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes("replace-me")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const chartPalette = ["#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#64748b", "#2563eb", "#14b8a6"];

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
      { id: "calendar", label: "Calendário", icon: CalendarDays },
      { id: "cards", label: "Cartões", icon: CreditCard },
    ],
  },
  {
    label: "Planejar",
    items: [
      { id: "budgets", label: "Orçamentos", icon: PiggyBank },
      { id: "goals", label: "Metas", icon: Target },
      { id: "planning", label: "Planejamento", icon: Presentation },
      { label: "Investimentos", icon: BarChart3, status: "em breve" },
      { label: "Patrimônio", icon: Gem, status: "em breve" },
    ],
  },
  {
    label: "Evoluir",
    items: [
      { id: "reports", label: "Relatórios", icon: ReceiptText },
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
          {supabase ? (
            <button
              className="ghost-button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccess(null);
              }}
              type="button"
            >
              {isLogin ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
            </button>
          ) : (
            <p className="muted">Cadastro real indisponível no modo local. Use a demonstração MVP.</p>
          )}

          {isLogin && supabase ? (
            <button className="ghost-button" onClick={handlePasswordReset} disabled={loading || !email}>
              Esqueceu a senha?
            </button>
          ) : null}
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
      {page === "calendar" ? <CalendarPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "cards" ? <CardsPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "budgets" ? <BudgetsPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "goals" ? <GoalsPage session={session} /> : null}
      {page === "planning" ? <PlanningPage session={session} /> : null}
      {page === "reports" ? <ReportsPage onNavigate={onNavigate} session={session} /> : null}
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
  const [cashflowView, setCashflowView] = useState<"day" | "month">("day");
  const cashflowYearQuery = yearQueryFromDate(period.dateFrom || period.dateTo);
  const evolutionProjectionRange = useMemo(
    () => projectionRangeFromPeriod(period.dateFrom, period.dateTo),
    [period.dateFrom, period.dateTo],
  );
  const evolutionProjectionQuery = useMemo(
    () =>
      evolutionProjectionRange
        ? withQueryParams("", {
            date_from: evolutionProjectionRange.dateFrom,
            date_to: evolutionProjectionRange.dateTo,
          })
        : "",
    [evolutionProjectionRange],
  );
  const projection30Range = useMemo(() => nextDaysRange(30), []);
  const projection30Query = useMemo(
    () =>
      withQueryParams("", {
        date_from: projection30Range.dateFrom,
        date_to: projection30Range.dateTo,
      }),
    [projection30Range.dateFrom, projection30Range.dateTo],
  );
  const summary = useQuery({
    queryKey: ["dashboard-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const cashflow = useQuery({
    queryKey: ["monthly-cashflow", session.token, cashflowYearQuery],
    queryFn: () => getMonthlyCashflow(session, cashflowYearQuery),
  });
  const dailyCashflowQuery = useQuery({
    queryKey: ["daily-cashflow", session.token, period.query],
    queryFn: () => getDailyCashflow(session, period.query),
  });
  const ranking = useQuery({
    queryKey: ["category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const recurring = useQuery({
    queryKey: ["recurring-expenses", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
  });
  const recurringIncome = useQuery({
    queryKey: ["recurring-incomes", session.token, period.recurringQuery],
    queryFn: () => getRecurringIncomes(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
  });
  const quality = useQuery({
    queryKey: ["data-quality", session.token, period.query],
    queryFn: () => getDataQuality(session, period.query),
  });
  const categoryGrowth = useQuery({
    queryKey: ["category-growth-alerts", session.token, period.query],
    queryFn: () => getCategoryGrowthAlerts(session, withQueryParams(period.query, { limit: "3" })),
  });
  const installments = useQuery({
    queryKey: ["dashboard-credit-card-installments", session.token, period.dateTo],
    queryFn: () =>
      getCreditCardInstallments(
        session,
        period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" }),
      ),
  });
  const projection30Installments = useQuery({
    queryKey: ["dashboard-projection-30-credit-card-installments", session.token, projection30Range.dateTo],
    queryFn: () => getCreditCardInstallments(session, withQueryParams(projection30Query, { limit: "100" })),
  });
  const evolutionProjectionInstallments = useQuery({
    enabled: Boolean(evolutionProjectionRange),
    queryKey: ["dashboard-evolution-projection-credit-card-installments", session.token, evolutionProjectionQuery],
    queryFn: () => getCreditCardInstallments(session, withQueryParams(evolutionProjectionQuery, { limit: "100" })),
  });
  const statements = useQuery({
    queryKey: ["dashboard-credit-card-statements", session.token, period.query],
    queryFn: () => getCreditCardStatements(session, period.query),
  });
  const budgets = useQuery({
    queryKey: ["dashboard-budgets", session.token, period.query],
    queryFn: () => getBudgets(session, period.query),
  });
  const categories = useCategories(session);
  const goals = useQuery({
    queryKey: ["dashboard-goals", session.token],
    queryFn: () => getGoals(session),
  });
  const persistedEvents = useQuery({
    queryKey: ["dashboard-calendar-events", session.token, period.query],
    queryFn: () => getCalendarEvents(session, period.query),
  });
  const projection30PersistedEvents = useQuery({
    queryKey: ["dashboard-projection-30-calendar-events", session.token, projection30Query],
    queryFn: () => getCalendarEvents(session, projection30Query),
  });
  const evolutionProjectionPersistedEvents = useQuery({
    enabled: Boolean(evolutionProjectionRange),
    queryKey: ["dashboard-evolution-projection-calendar-events", session.token, evolutionProjectionQuery],
    queryFn: () => getCalendarEvents(session, evolutionProjectionQuery),
  });
  const recentTransactions = useQuery({
    queryKey: ["dashboard-recent-transactions", session.token, period.query],
    queryFn: () => getTransactions(session, withQueryParams(period.query, { limit: "6", sort_by: "transaction_date", sort_dir: "desc" })),
  });
  const balance = Number(summary.data?.balance ?? 0);
  const categoryItems = ranking.data?.items ?? [];
  const calendarEvents = buildCalendarEvents({
    apiEvents: persistedEvents.data?.items,
    installments: installments.data?.items ?? [],
    recurring: recurring.data?.items ?? [],
    transactions: recentTransactions.data?.items ?? [],
  });
  const currentBalance = summary.data?.current_balance;
  const currentBalanceValue = currentBalance === null || currentBalance === undefined ? null : Number(currentBalance);
  const monthlyBurnRate = Number(summary.data?.burn_rate ?? 0);
  const burnRate90Days = Number(summary.data?.burn_rate_90_days ?? 0);
  const runwayBurnRate = burnRate90Days > 0 ? burnRate90Days : monthlyBurnRate;
  const runwayMonths =
    currentBalanceValue !== null && currentBalanceValue > 0 && runwayBurnRate > 0
      ? currentBalanceValue / runwayBurnRate
      : null;
  const safeSpend = summary.data?.safe_spend;
  const safeSpendValue = safeSpend === null || safeSpend === undefined ? null : Number(safeSpend);
  const healthScore = summary.data?.financial_health_score ?? null;
  const projection30Result = useMemo(
    () =>
      buildRollingCashFlowProjection({
        currentBalance: currentBalanceValue ?? balance,
        creditCardInstallments: (projection30Installments.data?.items ?? []).map((item) => ({
          amount: item.amount,
          description: `Parcela cartão: ${item.description}`,
          dueDate: creditCardDueDateInRange(
            projection30Range.dateFrom,
            projection30Range.dateTo,
            projection30Installments.data?.due_day,
          ),
        })),
        horizonDays: 30,
        knownEvents: (projection30PersistedEvents.data?.items ?? []).map((event) => ({
          amount: event.amount ?? 0,
          date: event.due_date,
          description: event.title,
          source: event.event_type === "subscription" ? "subscription" : "calendar",
          type: event.event_type === "income" ? "income" : "expense",
        })),
        recurringItems: [
          ...(recurringIncome.data?.items ?? []).map((item) => ({
            amount: item.average_amount,
            categoryId: item.category_id,
            description: item.description,
            lastDate: item.last_transaction_date,
            monthCount: item.month_count,
            transactionCount: item.transaction_count,
            type: "income" as const,
          })),
          ...(recurring.data?.items ?? []).map((item) => ({
            amount: item.average_amount,
            categoryId: item.category_id,
            description: item.description,
            lastDate: item.last_transaction_date,
            monthCount: item.month_count,
            transactionCount: item.transaction_count,
            type: "expense" as const,
          })),
        ],
        startDate: projection30Range.dateFrom,
        variableCategories: categoryItems.map((item) => {
          const spent = Math.abs(Number(item.amount ?? 0));
          return {
            categoryId: item.category_id,
            categoryName: item.category_name,
            currentMonthSpent: spent,
            monthlyAverage: spent * 1.15,
          };
        }),
      }),
    [
      balance,
      categoryItems,
      currentBalanceValue,
      projection30Installments.data?.due_day,
      projection30Installments.data?.items,
      projection30PersistedEvents.data?.items,
      projection30Range.dateFrom,
      projection30Range.dateTo,
      recurring.data?.items,
      recurringIncome.data?.items,
    ],
  );
  const projection30Cashflow = projection30Result.chartPoints;
  const evolutionProjectionResult = useMemo(
    () =>
      evolutionProjectionRange
        ? buildRollingCashFlowProjection({
            currentBalance: currentBalanceValue ?? balance,
            creditCardInstallments: (evolutionProjectionInstallments.data?.items ?? []).map((item) => ({
              amount: item.amount,
              description: `Parcela cartão: ${item.description}`,
              dueDate: creditCardDueDateInRange(
                evolutionProjectionRange.dateFrom,
                evolutionProjectionRange.dateTo,
                evolutionProjectionInstallments.data?.due_day,
              ),
            })),
            horizonDays: evolutionProjectionRange.horizonDays,
            knownEvents: (evolutionProjectionPersistedEvents.data?.items ?? []).map((event) => ({
              amount: event.amount ?? 0,
              date: event.due_date,
              description: event.title,
              source: event.event_type === "subscription" ? "subscription" : "calendar",
              type: event.event_type === "income" ? "income" : "expense",
            })),
            recurringItems: [
              ...(recurringIncome.data?.items ?? []).map((item) => ({
                amount: item.average_amount,
                categoryId: item.category_id,
                description: item.description,
                lastDate: item.last_transaction_date,
                monthCount: item.month_count,
                transactionCount: item.transaction_count,
                type: "income" as const,
              })),
              ...(recurring.data?.items ?? []).map((item) => ({
                amount: item.average_amount,
                categoryId: item.category_id,
                description: item.description,
                lastDate: item.last_transaction_date,
                monthCount: item.month_count,
                transactionCount: item.transaction_count,
                type: "expense" as const,
              })),
            ],
            startDate: evolutionProjectionRange.dateFrom,
            variableCategories: categoryItems.map((item) => {
              const spent = Math.abs(Number(item.amount ?? 0));
              return {
                categoryId: item.category_id,
                categoryName: item.category_name,
                currentMonthSpent: spent,
                monthlyAverage: spent * 1.15,
              };
            }),
          })
        : null,
    [
      balance,
      categoryItems,
      currentBalanceValue,
      evolutionProjectionInstallments.data?.due_day,
      evolutionProjectionInstallments.data?.items,
      evolutionProjectionPersistedEvents.data?.items,
      evolutionProjectionRange,
      recurring.data?.items,
      recurringIncome.data?.items,
    ],
  );
  const evolutionProjectionCashflow = evolutionProjectionResult?.chartPoints ?? [];
  const dailyCashflow = useMemo(
    () =>
      buildDailyCashflow({
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        items: dailyCashflowQuery.data?.items ?? [],
        projectionPoints: evolutionProjectionCashflow,
      }),
    [dailyCashflowQuery.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow],
  );
  const monthlyCashflow = useMemo(
    () => buildMonthlyCashflow(cashflow.data?.items ?? [], period.dateFrom || period.dateTo, evolutionProjectionCashflow),
    [cashflow.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow],
  );
  const dailyCashflowAxisDomain = useMemo(
    () => moneyAxisDomain(dailyCashflow, ["income", "expenses", "balance", "projectedBalance"], true),
    [dailyCashflow],
  );
  const monthlyCashflowAxisDomain = useMemo(
    () => moneyAxisDomain(monthlyCashflow, ["income", "expenses", "balance", "projectedBalance"], true),
    [monthlyCashflow],
  );
  const hasDailyCashflow = dailyCashflow.some((item) => item.income !== 0 || item.expenses !== 0);
  const showDailyCashflow = cashflowView === "day";
  const statementTotal = (statements.data?.items ?? []).reduce((total, statement) => total + Number(statement.total_amount ?? 0), 0);
  const currentStatementTotal = statementTotal || Number(summary.data?.payments ?? 0);
  const cardCommitment = Number(summary.data?.income ?? 0) > 0 ? currentStatementTotal / Number(summary.data?.income ?? 0) : null;
  const budgetRows = buildPersistedBudgetRows({
    budgets: budgets.data?.items,
    categories: categories.data?.items ?? [],
    ranking: categoryItems,
  });
  const dashboardBudgetRows = budgetRows.length ? budgetRows : buildBudgetRows(categoryItems);
  const dashboardGoalRows = buildGoalRows(summary.data, goals.data?.items);
  const projectionRisk = projection30Result.firstNegativeDay;
  const projection30Loading =
    summary.isLoading ||
    projection30PersistedEvents.isLoading ||
    projection30Installments.isLoading ||
    recurring.isLoading ||
    recurringIncome.isLoading ||
    ranking.isLoading;
  const projection30Points = projection30Result.points;
  const projection30FinalBalance = projection30Points.length
    ? projection30Points[projection30Points.length - 1].projectedBalance
    : null;
  const projection30KnownCommitments = projection30Points.reduce(
    (total, point) =>
      total + point.knownExpenses + point.recurringExpenses + point.creditCardInstallments + point.plannedInvestments,
    0,
  );

  function openDailyTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    onOpenTransactions({
      dateFrom: data.activeLabel,
      dateTo: data.activeLabel,
      label: `Fluxo diário ${dateLabel(data.activeLabel)}`,
      periodPreset: "custom",
    });
  }

  function openMonthlyDashboardTransactions(data: { activeLabel?: string } | null) {
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
      <DashboardFlowStory
        futureCommitments={projection30Loading ? null : projection30KnownCommitments}
        onOpenAnalysis={() => onNavigate("reports")}
        periodLabel={periodSummary(period)}
        projectionLoading={projection30Loading}
        projectedBalance={projection30Loading ? null : projection30FinalBalance}
        summaryLoading={summary.isLoading}
        summary={summary.data}
      />
      <div className="metric-grid executive dashboard-kpis" aria-label="Indicadores principais do Dashboard">
        <MetricCard
          icon={CreditCard}
          label="Saldo atual"
          value={currentBalanceValue === null ? "Sem saldo" : formatCurrencyCompact(currentBalanceValue)}
          title={currentBalanceValue === null ? undefined : money(currentBalanceValue)}
          helper={
            summary.data?.current_balance_date
              ? `Extrato em ${dateInputLabel(summary.data.current_balance_date)}`
              : "Sem saldo importado"
          }
          helpText={
            summary.data?.current_balance_date
              ? `Quanto havia na conta no último saldo importado do extrato: ${summary.data.current_balance_account ?? "Conta corrente"}.`
              : "Mostra quanto há na conta. Para preencher, importe o extrato Excel."
          }
          tone={currentBalanceValue === null ? "info" : currentBalanceValue >= 0 ? "positive" : "negative"}
        />
        <MetricCard
          icon={BarChart3}
          label="Fluxo líquido"
          title={money(summary.data?.balance)}
          value={formatCurrencyCompactSigned(summary.data?.balance)}
          helper="Receitas - despesas"
          helpText="Mostra se entrou mais dinheiro do que saiu no período selecionado."
          tone={balance < 0 ? "negative" : "positive"}
        />
        <MetricCard
          icon={Gauge}
          label="Burn rate"
          title={moneyAbs(summary.data?.burn_rate)}
          value={compactMoneyAbs(summary.data?.burn_rate)}
          helper="Gasto médio mensal"
          helpText={`Quanto você costuma gastar por mês, calculado pela média de ${summary.data?.burn_rate_months ?? 0} mês${summary.data?.burn_rate_months === 1 ? "" : "es"}.`}
          tone="warning"
          onClick={() => openMetricTransactions("debit", "Burn rate")}
        />
        <MetricCard
          icon={PiggyBank}
          label="Saving rate"
          title={percent(summary.data?.savings_rate)}
          value={percentAbs(summary.data?.savings_rate)}
          helper="Sobra / receitas"
          helpText="Mostra qual parte do dinheiro que entrou ainda sobrou no período."
          tone={Number(summary.data?.savings_rate ?? 0) < 0 ? "negative" : "positive"}
        />
        <MetricCard
          icon={Percent}
          label="% comprometimento"
          title={percent(summary.data?.commitment_rate)}
          value={percentAbs(summary.data?.commitment_rate)}
          helper="Despesas / receitas"
          helpText="Mostra quanto da sua renda já foi consumida por despesas no período."
          tone={commitmentTone(summary.data?.commitment_rate)}
          onClick={() => openMetricTransactions("debit", "Comprometimento da receita")}
        />
        <MetricCard
          icon={ArrowUpCircle}
          label="Receitas"
          title={moneyAbs(summary.data?.income)}
          value={compactMoneyAbs(summary.data?.income)}
          helper="Entradas do período"
          helpText="Todo dinheiro que entrou no período selecionado."
          tone="positive"
          onClick={() => openMetricTransactions("credit", "Receitas do período")}
        />
      </div>

      <section className="dashboard-section reserved-indicators" aria-label="Indicadores avançados reservados">
        <DashboardSectionHeader
          eyebrow="Leituras avançadas"
          title="Indicadores em evolução"
          description="Verde indica situação saudável, amarelo pede atenção e vermelho sinaliza risco."
        />
        <div className="metric-grid executive reserved-kpis">
          <MetricCard
            className="reserved"
            icon={ShieldCheck}
            label="Fôlego financeiro"
            value={runwayMonths === null ? "Sem cálculo" : `${formatNumber(runwayMonths)} meses`}
            helper={runwayMonths === null ? "Sem saldo atual" : "Saldo atual / gastos"}
            helpText={`Tempo estimado que seu saldo sustenta seus gastos. Gasto base: ${moneyAbs(runwayBurnRate)}/mês.`}
            tone={runwayMonths === null ? "info" : runwayMonths >= 6 ? "positive" : runwayMonths >= 3 ? "warning" : "negative"}
          />
          <MetricCard
            className="reserved"
            icon={Gauge}
            label="Gasto médio mensal"
            value={burnRate90Days > 0 ? `${compactMoneyAbs(burnRate90Days)}/mês` : "Sem histórico"}
            helper={burnRate90Days > 0 ? "Últimos 90 dias" : "Sem histórico recente"}
            helpText={`Média das saídas dos últimos ${summary.data?.burn_rate_90_days_window ?? 0} dias, dividida por 3 meses.`}
            tone={burnRate90Days > 0 && safeSpendValue !== null && safeSpendValue < 0 ? "negative" : burnRate90Days > 0 ? "warning" : "info"}
          />
          <MetricCard
            className="reserved"
            icon={ShieldCheck}
            label="Pode gastar com segurança"
            value={safeSpendValue === null ? "Sem cálculo" : formatCurrencyCompactSigned(safeSpend)}
            helper={
              safeSpendValue === null
                ? "Configure reserva"
                : "Após compromissos"
            }
            helpText={`Mostra quanto poderia gastar nos próximos 30 dias considerando saldo atual, entradas previstas, compromissos, parcelas e reserva mínima de ${moneyAbs(summary.data?.safe_spend_reserve_minimum)}.`}
            tone={safeSpendValue === null ? "info" : safeSpendValue < 0 ? "negative" : "positive"}
          />
          <MetricCard
            className="reserved"
            icon={Brain}
            label="Saúde financeira"
            value={healthScore === null ? "Sem score" : `${healthScore}/100`}
            helper={healthScore === null ? "Sem base suficiente" : financialHealthLabel(healthScore)}
            helpText="Resume sua saúde financeira em uma nota: saldo, ritmo de gastos, sobra, comprometimento e gasto seguro."
            tone={healthScore === null ? "info" : financialHealthTone(healthScore)}
          />
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Leitura principal"
          title="Fluxo, categorias e alertas"
          description="Acompanhe a evolução do caixa, os maiores gastos e os sinais que pedem revisão."
        />
        <div className="dashboard-grid cockpit-grid">
          <div className="cockpit-left">
            <Panel title="Evolução do fluxo de caixa" description={dashboardCashflowDescription(period, cashflowView)}>
              <div className="chart-view-toggle" aria-label="Alternar visão do gráfico">
                <button className={cashflowView === "day" ? "active" : ""} onClick={() => setCashflowView("day")} type="button">
                  Dia
                </button>
                <button className={cashflowView === "month" ? "active" : ""} onClick={() => setCashflowView("month")} type="button">
                  Mês
                </button>
              </div>
              <ChartBox
                loading={showDailyCashflow ? dailyCashflowQuery.isLoading : cashflow.isLoading}
                empty={showDailyCashflow ? !hasDailyCashflow : !cashflow.data?.items.length}
                size="large"
              >
                <ResponsiveContainer width="100%" height="100%">
                  {showDailyCashflow ? (
                    <ComposedChart
                      barCategoryGap="28%"
                      barGap={0}
                      data={dailyCashflow}
                      margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      onClick={openDailyTransactions}
                      stackOffset="sign"
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <XAxis dataKey="date" tickFormatter={dayTickLabel} tickLine={false} axisLine={false} />
                      <YAxis allowDataOverflow={false} domain={dailyCashflowAxisDomain} tickFormatter={compactMoneyAxis} tickLine={false} axisLine={false} width={64} />
                      <Tooltip formatter={(value, name) => [chartMoneyLabel(String(value), String(name)), chartSeriesLabel(String(name))]} labelFormatter={dateLabel} />
                      <Legend />
                      <Bar name="Receita" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="cashflow" />
                      <Bar name="Despesas" dataKey="expenses" fill="#ef4444" isAnimationActive={false} radius={[0, 0, 4, 4]} stackId="cashflow" />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo acumulado" type="monotone" dataKey="balance" stroke="#312e81" strokeWidth={3} dot={false} isAnimationActive={false} />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo projetado" type="monotone" dataKey="projectedBalance" stroke="#64748b" strokeDasharray="6 5" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  ) : (
                    <ComposedChart
                      barCategoryGap="28%"
                      barGap={0}
                      data={monthlyCashflow}
                      margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      onClick={openMonthlyDashboardTransactions}
                      stackOffset="sign"
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <XAxis dataKey="month" tickFormatter={monthTickLabel} tickLine={false} axisLine={false} />
                      <YAxis allowDataOverflow={false} domain={monthlyCashflowAxisDomain} tickFormatter={compactMoneyAxis} tickLine={false} axisLine={false} width={64} />
                      <Tooltip formatter={(value, name) => [chartMoneyLabel(String(value), String(name)), chartSeriesLabel(String(name))]} labelFormatter={monthTickLabel} />
                      <Legend />
                      <Bar name="Receita" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="cashflow" />
                      <Bar name="Despesas" dataKey="expenses" fill="#ef4444" isAnimationActive={false} radius={[0, 0, 4, 4]} stackId="cashflow" />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo acumulado" type="monotone" dataKey="balance" stroke="#312e81" strokeWidth={3} dot={false} isAnimationActive={false} />
                      <Line activeDot={{ r: 5 }} connectNulls name="Saldo projetado" type="monotone" dataKey="projectedBalance" stroke="#64748b" strokeDasharray="6 5" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </ChartBox>
            </Panel>
            <Panel
              title="Top categorias"
              description="Maiores gastos classificados no período."
              action={<PanelLink label="Ver todas" onClick={() => onNavigate("cashflow")} />}
            >
              <CategoryBarList items={categoryItems} loading={ranking.isLoading} onOpenCategory={openCategoryTransactions} />
            </Panel>
          </div>
          <div className="cockpit-right">
            <Panel
              title="Próximos compromissos"
              description="Eventos, recorrências e parcelas que aparecem no horizonte do filtro."
              action={<PanelLink label="Ver calendário" onClick={() => onNavigate("calendar")} />}
            >
              <CompactTimelineList
                items={calendarEvents.slice(0, 5)}
                total={calendarEvents.length}
                onShowAll={() => onNavigate("calendar")}
                loading={persistedEvents.isLoading || recurring.isLoading || installments.isLoading || recentTransactions.isLoading}
                onOpenTransactions={(event) =>
                  onOpenTransactions({
                    dateFrom: period.dateFrom,
                    dateTo: period.dateTo,
                    direction: event.direction,
                    label: event.label,
                    periodPreset: period.periodPreset,
                    search: event.search,
                  })
                }
              />
            </Panel>
            <Panel title="Distribuição das despesas" description="Participação das categorias no total de gastos do período.">
              <CategoryDonut items={categoryItems} loading={ranking.isLoading} onOpenCategory={openCategoryTransactions} />
            </Panel>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Cartões e projeção"
          title="Caixa projetado, fatura e parcelado"
          description="Veja primeiro o caixa dos próximos dias e depois o impacto dos cartões."
        />
        <div className="dashboard-grid operations-grid">
          <Panel title="Fluxo de caixa projetado — próximos 30 dias" description="Parte do saldo atual e projeta entradas, saídas e saldo dia a dia.">
            <ProjectedCashflowSnapshot
              data={projection30Cashflow}
              loading={projection30Loading}
              lowestProjectedBalance={projection30Result.lowestProjectedBalance}
              onNavigatePlanning={() => onNavigate("planning")}
              risk={projectionRisk}
            />
          </Panel>
          <Panel
            title="Cartões de crédito"
            description="Resumo executivo da fatura e do parcelado futuro."
            action={<PanelLink label="Ver detalhes" onClick={() => onNavigate("cards")} />}
          >
            <CreditCardSnapshot
              commitmentRate={cardCommitment}
              currentStatementTotal={currentStatementTotal}
              futureInstallments={installments.data?.total_future_amount ?? "0"}
              installmentCount={installments.data?.active_count ?? 0}
              loading={statements.isLoading || installments.isLoading || summary.isLoading}
            />
          </Panel>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Planejamento"
          title="Orçamento, metas e alertas"
          description="Blocos compactos para acompanhar o mês sem quebrar a primeira visão."
        />
        <div className="dashboard-grid insight-grid">
          <Panel
            title="Orçamento do mês"
            description="Categorias monitoradas no período."
            action={<PanelLink label="Ver orçamento" onClick={() => onNavigate("budgets")} />}
          >
            <BudgetSnapshot
              loading={ranking.isLoading || budgets.isLoading || categories.isLoading}
              rows={dashboardBudgetRows.slice(0, 4)}
              onOpenCategory={(row) =>
                onOpenTransactions({
                  categoryId: row.categoryId ?? undefined,
                  dateFrom: period.dateFrom,
                  dateTo: period.dateTo,
                  direction: "debit",
                  label: row.categoryName,
                  periodPreset: period.periodPreset,
                })
              }
            />
          </Panel>
          <Panel
            title="Metas em andamento"
            description="Progresso das metas financeiras principais."
            action={<PanelLink label="Ver todas" onClick={() => onNavigate("goals")} />}
          >
          <GoalSnapshot
            loading={goals.isLoading || summary.isLoading}
            rows={(goals.data?.items ?? []).length ? dashboardGoalRows.slice(0, 3) : []}
          />
          </Panel>
          <Panel
            title="Insights e alertas"
            description="Poucos itens, priorizados para não poluir a tela."
            action={<PanelLink label="Ver todos" onClick={() => onNavigate("reports")} />}
          >
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
        </div>
      </section>

      <PersonalizedTip
        balance={currentBalanceValue ?? balance}
        onNavigateReports={() => onNavigate("reports")}
        recurring={recurring.data?.items ?? []}
        savingsRate={summary.data?.savings_rate}
      />
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
  const [cashflowView, setCashflowView] = useState<"day" | "month">("day");
  const [showCashflowCalculation, setShowCashflowCalculation] = useState(false);
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const cashflowYearQuery = yearQueryFromDate(period.dateFrom || period.dateTo);
  const evolutionProjectionRange = useMemo(
    () => projectionRangeFromPeriod(period.dateFrom, period.dateTo),
    [period.dateFrom, period.dateTo],
  );
  const evolutionProjectionQuery = useMemo(
    () =>
      evolutionProjectionRange
        ? withQueryParams("", {
            date_from: evolutionProjectionRange.dateFrom,
            date_to: evolutionProjectionRange.dateTo,
          })
        : "",
    [evolutionProjectionRange],
  );
  const summary = useQuery({
    queryKey: ["cashflow-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const cashflow = useQuery({
    queryKey: ["cashflow-monthly", session.token, cashflowYearQuery],
    queryFn: () => getMonthlyCashflow(session, cashflowYearQuery),
  });
  const dailyCashflowQuery = useQuery({
    queryKey: ["cashflow-daily", session.token, period.query],
    queryFn: () => getDailyCashflow(session, period.query),
  });
  const ranking = useQuery({
    queryKey: ["cashflow-category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const recurring = useQuery({
    queryKey: ["cashflow-recurring-expenses", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
  });
  const recurringIncome = useQuery({
    queryKey: ["cashflow-recurring-incomes", session.token, period.recurringQuery],
    queryFn: () => getRecurringIncomes(session, withQueryParams(period.recurringQuery, { limit: "6", min_months: "3" })),
  });
  const evolutionProjectionInstallments = useQuery({
    enabled: Boolean(evolutionProjectionRange),
    queryKey: ["cashflow-evolution-projection-credit-card-installments", session.token, evolutionProjectionQuery],
    queryFn: () => getCreditCardInstallments(session, withQueryParams(evolutionProjectionQuery, { limit: "100" })),
  });
  const evolutionProjectionPersistedEvents = useQuery({
    enabled: Boolean(evolutionProjectionRange),
    queryKey: ["cashflow-evolution-projection-calendar-events", session.token, evolutionProjectionQuery],
    queryFn: () => getCalendarEvents(session, evolutionProjectionQuery),
  });
  const incomeTransactions = useQuery({
    queryKey: ["cashflow-income-transactions", session.token, period.query],
    queryFn: () => getTransactions(session, withQueryParams(period.query, { direction: "credit", limit: "100", sort_by: "amount", sort_dir: "desc" })),
  });
  const expenseTransactions = useQuery({
    queryKey: ["cashflow-expense-transactions", session.token, period.query],
    queryFn: () => getTransactions(session, withQueryParams(period.query, { direction: "debit", limit: "100", sort_by: "amount", sort_dir: "desc" })),
  });
  const paymentTransactions = useQuery({
    queryKey: ["cashflow-payment-transactions", session.token, period.query],
    queryFn: () => getTransactions(session, withQueryParams(period.query, { direction: "payment", limit: "100", sort_by: "amount", sort_dir: "desc" })),
  });
  const expenseSizeProfileQuery = useQuery({
    queryKey: ["cashflow-expense-size-profile", session.token, period.query],
    queryFn: () => getExpenseSizeProfile(session, period.query),
  });
  const categories = useCategories(session);
  const subcategoryQuery = useMemo(
    () =>
      selectedExpenseCategoryId
        ? withQueryParams(period.query, { category_id: selectedExpenseCategoryId, limit: "10" })
        : withQueryParams(period.query, { limit: "10" }),
    [period.query, selectedExpenseCategoryId],
  );
  const subcategoryRanking = useQuery({
    queryKey: ["cashflow-subcategory-ranking", session.token, subcategoryQuery],
    queryFn: () => getSubcategoryRanking(session, subcategoryQuery),
  });
  const categoryItems = ranking.data?.items ?? [];
  const balance = Number(summary.data?.balance ?? 0);
  const currentBalance = summary.data?.current_balance;
  const currentBalanceValue = currentBalance === null || currentBalance === undefined ? null : Number(currentBalance);
  const evolutionProjectionResult = useMemo(
    () =>
      evolutionProjectionRange
        ? buildRollingCashFlowProjection({
            currentBalance: currentBalanceValue ?? balance,
            creditCardInstallments: (evolutionProjectionInstallments.data?.items ?? []).map((item) => ({
              amount: item.amount,
              description: `Parcela cartão: ${item.description}`,
              dueDate: creditCardDueDateInRange(
                evolutionProjectionRange.dateFrom,
                evolutionProjectionRange.dateTo,
                evolutionProjectionInstallments.data?.due_day,
              ),
            })),
            horizonDays: evolutionProjectionRange.horizonDays,
            knownEvents: (evolutionProjectionPersistedEvents.data?.items ?? []).map((event) => ({
              amount: event.amount ?? 0,
              date: event.due_date,
              description: event.title,
              source: event.event_type === "subscription" ? "subscription" : "calendar",
              type: event.event_type === "income" ? "income" : "expense",
            })),
            recurringItems: [
              ...(recurringIncome.data?.items ?? []).map((item) => ({
                amount: item.average_amount,
                categoryId: item.category_id,
                description: item.description,
                lastDate: item.last_transaction_date,
                monthCount: item.month_count,
                transactionCount: item.transaction_count,
                type: "income" as const,
              })),
              ...(recurring.data?.items ?? []).map((item) => ({
                amount: item.average_amount,
                categoryId: item.category_id,
                description: item.description,
                lastDate: item.last_transaction_date,
                monthCount: item.month_count,
                transactionCount: item.transaction_count,
                type: "expense" as const,
              })),
            ],
            startDate: evolutionProjectionRange.dateFrom,
            variableCategories: categoryItems.map((item) => {
              const spent = Math.abs(Number(item.amount ?? 0));
              return {
                categoryId: item.category_id,
                categoryName: item.category_name,
                currentMonthSpent: spent,
                monthlyAverage: spent * 1.15,
              };
            }),
          })
        : null,
    [
      balance,
      categoryItems,
      currentBalanceValue,
      evolutionProjectionInstallments.data?.due_day,
      evolutionProjectionInstallments.data?.items,
      evolutionProjectionPersistedEvents.data?.items,
      evolutionProjectionRange,
      recurring.data?.items,
      recurringIncome.data?.items,
    ],
  );
  const evolutionProjectionCashflow = evolutionProjectionResult?.chartPoints ?? [];
  const dailyCashflow = useMemo(
    () =>
      buildDailyCashflow({
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        items: dailyCashflowQuery.data?.items ?? [],
        projectionPoints: evolutionProjectionCashflow,
      }),
    [dailyCashflowQuery.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow],
  );
  const monthlyCashflow = useMemo(
    () => buildMonthlyCashflow(cashflow.data?.items ?? [], period.dateFrom || period.dateTo, evolutionProjectionCashflow),
    [cashflow.data?.items, period.dateFrom, period.dateTo, evolutionProjectionCashflow],
  );
  const cashflowAxisDomain = useMemo(
    () => {
      if (cashflowView !== "month") {
        return moneyAxisDomain(dailyCashflow, ["income", "expenses", "balance", "projectedBalance"], true);
      }
      return moneyAxisDomain(monthlyCashflow, ["income", "expenses", "balance", "projectedBalance"], true);
    },
    [cashflowView, dailyCashflow, monthlyCashflow],
  );
  const cashflowRows = cashflowView === "month" ? monthlyCashflow : dailyCashflow;
  const hasCashflowRows = cashflowRows.some((item) => item.income !== 0 || item.expenses !== 0 || item.balance !== null || item.projectedBalance !== null);
  const periodSummaryMetrics = useMemo(
    () => buildCashflowPeriodMetrics(summary.data, dailyCashflowQuery.data?.items ?? []),
    [dailyCashflowQuery.data?.items, summary.data],
  );
  const highlights = useMemo(
    () => buildCashflowHighlights([...(incomeTransactions.data?.items ?? []), ...(expenseTransactions.data?.items ?? []), ...(paymentTransactions.data?.items ?? [])], dailyCashflow),
    [dailyCashflow, expenseTransactions.data?.items, incomeTransactions.data?.items, paymentTransactions.data?.items],
  );
  const incomeCategories = useMemo(
    () => buildIncomeCategoryRows(incomeTransactions.data?.items ?? [], categories.data?.items ?? []),
    [categories.data?.items, incomeTransactions.data?.items],
  );
  const expenseSizeProfile = useMemo(
    () => buildExpenseSizeProfile(expenseSizeProfileQuery.data?.items ?? []),
    [expenseSizeProfileQuery.data?.items],
  );
  const expenseCategoryOptions = useMemo(
    () => buildExpenseCategoryOptions(expenseTransactions.data?.items ?? [], categories.data?.items ?? []),
    [categories.data?.items, expenseTransactions.data?.items],
  );
  const selectedExpenseCategory = expenseCategoryOptions.find((item) => item.id === selectedExpenseCategoryId) ?? null;
  const subcategoryRows = useMemo(
    () => buildSubcategoryRows(subcategoryRanking.data?.items ?? []),
    [subcategoryRanking.data?.items],
  );

  function openCashflowPointTransactions(data: { activeLabel?: string } | null) {
    if (!data?.activeLabel) return;
    const range = cashflowView === "month"
      ? monthRange(data.activeLabel)
      : { dateFrom: data.activeLabel, dateTo: data.activeLabel };
    if (!range) return;
    onOpenTransactions({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      label: cashflowView === "month" ? `Fluxo mensal ${monthTickLabel(data.activeLabel)}` : `Fluxo diário ${dateLabel(data.activeLabel)}`,
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

      <div className="metric-grid executive cashflow-kpis" aria-label="Indicadores principais de fluxo de caixa">
        <MetricCard
          icon={ArrowUpCircle}
          label="Entradas"
          title={moneyAbs(summary.data?.income)}
          value={compactMoneyAbs(summary.data?.income)}
          helper="Receitas no período"
          tone="positive"
          onClick={() => openMetricTransactions("credit", "Entradas do período")}
        />
        <MetricCard
          icon={ArrowDownCircle}
          label="Saídas"
          title={moneyAbs(summary.data?.expenses)}
          value={compactMoneyAbs(summary.data?.expenses)}
          helper="Despesas no período"
          tone="negative"
          onClick={() => openMetricTransactions("debit", "Saídas do período")}
        />
        <MetricCard
          icon={BarChart3}
          label="Fluxo líquido"
          title={money(summary.data?.balance)}
          value={formatCurrencyCompactSigned(summary.data?.balance)}
          helper="Entradas - saídas"
          tone={Number(summary.data?.balance ?? 0) < 0 ? "negative" : "positive"}
        />
        <MetricCard
          icon={Database}
          label="Saldo inicial"
          title={money(periodSummaryMetrics.openingBalance)}
          value={formatCurrencyCompactSigned(periodSummaryMetrics.openingBalance)}
          helper="Início do período"
          tone="info"
        />
        <MetricCard
          icon={Gauge}
          label="Saldo real"
          title={periodSummaryMetrics.realClosingBalance === null ? undefined : money(periodSummaryMetrics.realClosingBalance)}
          value={periodSummaryMetrics.realClosingBalance === null ? "Sem saldo real" : formatCurrencyCompactSigned(periodSummaryMetrics.realClosingBalance)}
          helper={summary.data?.current_balance_date ? `Real em ${dateInputLabel(summary.data.current_balance_date)}` : "Sem saldo importado"}
          tone={periodSummaryMetrics.realClosingBalance === null ? "info" : periodSummaryMetrics.realClosingBalance < 0 ? "negative" : "positive"}
        />
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Análise do período"
          title="Evolução do Fluxo de Caixa"
          description="Entradas, saídas e saldo acumulado ao longo do período."
        />
        <div className="cashflow-main-grid">
          <div className="cashflow-primary">
            <Panel title="Evolução do Fluxo de Caixa" description={cashflowPageDescription(period, cashflowView)}>
              <button className="calculation-note" onClick={() => setShowCashflowCalculation((current) => !current)} type="button">
                <Gauge size={16} />
                <span>Como calculamos?</span>
              </button>
              {showCashflowCalculation ? (
                <div className="calculation-details">
                  <p>A evolução mostra entradas, saídas e saldo acumulado no período selecionado.</p>
                  <p>
                    Quando há projeção, o saldo projetado parte do saldo atual e evolui dia a dia: saldo anterior + entradas
                    previstas - saídas previstas. Receitas futuras entram como barras positivas; saídas futuras entram como barras
                    negativas.
                  </p>
                </div>
              ) : null}
              <div className="chart-view-toggle" aria-label="Alternar visão do fluxo">
                <button className={cashflowView === "day" ? "active" : ""} onClick={() => setCashflowView("day")} type="button">Dia</button>
                <button className={cashflowView === "month" ? "active" : ""} onClick={() => setCashflowView("month")} type="button">Mês</button>
              </div>
              <ChartBox loading={cashflowView === "month" ? cashflow.isLoading : dailyCashflowQuery.isLoading} empty={!hasCashflowRows} size="large">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    barCategoryGap="28%"
                    barGap={0}
                    data={cashflowRows}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                    onClick={openCashflowPointTransactions}
                    stackOffset="sign"
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                    <XAxis dataKey={cashflowView === "month" ? "month" : "date"} tickFormatter={cashflowView === "month" ? monthTickLabel : dayTickLabel} tickLine={false} axisLine={false} />
                    <YAxis allowDataOverflow={false} domain={cashflowAxisDomain} tickFormatter={compactMoneyAxis} tickLine={false} axisLine={false} width={64} />
                    <Tooltip
                      allowEscapeViewBox={{ x: true, y: true }}
                      content={<CashflowEvolutionTooltip view={cashflowView} />}
                      wrapperStyle={{ maxWidth: 220, pointerEvents: "none", zIndex: 30 }}
                    />
                    <Legend align="center" verticalAlign="top" wrapperStyle={{ lineHeight: "20px", paddingBottom: 8 }} />
                    <Bar name="Receita" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="cashflow" />
                    <Bar name="Saídas" dataKey="expenses" fill="#ef4444" isAnimationActive={false} radius={[0, 0, 4, 4]} stackId="cashflow" />
                    <Line activeDot={{ r: 5 }} connectNulls name="Saldo acumulado" type="monotone" dataKey="balance" stroke="#312e81" strokeWidth={3} dot={false} isAnimationActive={false} />
                    <Line activeDot={{ r: 5 }} connectNulls name="Saldo projetado" type="monotone" dataKey="projectedBalance" stroke="#64748b" strokeDasharray="6 5" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartBox>
            </Panel>
            <CashflowHighlights items={highlights} />
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Análises"
          title="Categorias, recorrências e sazonalidade"
          description="Entenda quais entradas, saídas e padrões explicam o fluxo do período."
        />
        <div className="dashboard-grid cashflow-analysis-grid">
          <CashflowIncomeExpenseDonut
            income={Number(summary.data?.income ?? 0)}
            expenses={Number(summary.data?.expenses ?? 0)}
            onOpenDetails={() => openMetricTransactions(undefined, "Entradas e saídas")}
          />
          <Panel title="Entradas por categoria" description="Principais origens de dinheiro no período." action={<PanelLink label="Ver análise completa" onClick={() => openMetricTransactions("credit", "Entradas por categoria")} />}>
            <CashflowCategoryRows items={incomeCategories} loading={incomeTransactions.isLoading || categories.isLoading} emptyMessage="Sem entradas no período." tone="positive" />
          </Panel>
          <Panel title="Sazonalidade" description="Leitura mensal de entradas e saídas.">
            <CashflowSeasonality data={monthlyCashflow} loading={cashflow.isLoading} />
          </Panel>
          <Panel title="Saídas por categoria" description="Principais destinos de dinheiro no período." action={<PanelLink label="Ver análise completa" onClick={() => onNavigate("cashflow")} />}>
            <CategoryBarList items={ranking.data?.items ?? []} loading={ranking.isLoading} onOpenCategory={openCategoryTransactions} />
          </Panel>
          <Panel
            title={selectedExpenseCategory ? `Subcategorias de ${selectedExpenseCategory.label}` : "Subcategorias"}
          >
            <p className="panel-note compact">Detalhe consolidado pela mesma base de Saídas por categoria.</p>
            <label className="inline-filter-label">
              Categoria
              <select value={selectedExpenseCategoryId} onChange={(event) => setSelectedExpenseCategoryId(event.target.value)}>
                <option value="">Todas</option>
                {expenseCategoryOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <SubcategoryBreakdown
              items={subcategoryRows}
              loading={subcategoryRanking.isLoading}
              onOpen={(item) => {
                onOpenTransactions({
                  categoryId: item.categoryId ?? selectedExpenseCategory?.id,
                  dateFrom: period.dateFrom,
                  dateTo: period.dateTo,
                  direction: item.direction,
                  label: selectedExpenseCategory ? `${selectedExpenseCategory.label} / ${item.subcategory}` : item.subcategory,
                  periodPreset: period.periodPreset,
                });
              }}
            />
          </Panel>
          <Panel title="Perfil das saídas" description="Quantidade e volume por tamanho de transação.">
            <ExpenseSizeProfile items={expenseSizeProfile} loading={expenseSizeProfileQuery.isLoading} />
          </Panel>
          <Panel title="Recorrências que mais pesam" description="Gastos que aparecem em mais de um mês." action={<PanelLink label="Ver recorrências" onClick={() => openMetricTransactions("debit", "Recorrências")} />}>
            <RecurringWeightList
              items={recurring.data?.items ?? []}
              loading={recurring.isLoading}
              onOpen={(item) =>
                onOpenTransactions({
                  dateFrom: period.dateFrom,
                  dateTo: period.dateTo,
                  label: item.description,
                  periodPreset: period.periodPreset,
                  search: item.description,
                })
              }
            />
          </Panel>
          <Panel title="Análise comparativa" description="Comparação rápida com a média mensal do período.">
            <CashflowComparison monthlyData={monthlyCashflow} periodDate={period.dateFrom || period.dateTo} summary={summary.data} />
          </Panel>
          <CashflowPeriodSummary metrics={periodSummaryMetrics} />
        </div>
      </section>

      <PersonalizedTip
        balance={Number(summary.data?.current_balance ?? summary.data?.balance ?? 0)}
        onNavigateReports={() => onNavigate("reports")}
        recurring={recurring.data?.items ?? []}
        savingsRate={summary.data?.savings_rate}
      />
    </section>
  );
}

type CashflowPeriodMetrics = {
  calculatedClosingBalance: number;
  reconciliationDifference: number | null;
  expenses: number;
  income: number;
  netFlow: number;
  openingBalance: number;
  realClosingBalance: number | null;
};

type CashflowCategoryRow = {
  amount: number;
  label: string;
  share: number;
};

type CashflowHighlight = {
  description: string;
  label: string;
  tone: "info" | "negative" | "positive" | "warning";
  value: string;
};

type ExpenseSizeSegment = {
  average: number;
  count: number;
  helper: string;
  label: string;
  share: number;
  tone: "info" | "negative" | "warning";
  total: number;
};

type ExpenseCategoryOption = {
  id: string;
  label: string;
};

type SubcategorySummary = {
  averageTicket: number;
  categoryId: string | null;
  direction: string;
  percentageOfCategory: number;
  subcategory: string;
  total: number;
  transactionCount: number;
};

function CashflowPeriodSummary({ metrics }: { metrics: CashflowPeriodMetrics }) {
  const totalMovement = Math.max(metrics.income + metrics.expenses, 1);
  const rows = [
    { label: "Total de entradas", tone: "positive", value: metrics.income, weight: metrics.income / totalMovement },
    { label: "Total de saídas", tone: "negative", value: -metrics.expenses, weight: metrics.expenses / totalMovement },
    { label: "Fluxo líquido", tone: metrics.netFlow < 0 ? "negative" : "positive", value: metrics.netFlow, weight: Math.abs(metrics.netFlow) / totalMovement },
    { label: "Saldo inicial", tone: "info", value: metrics.openingBalance },
    { label: "Saldo final calculado", tone: metrics.calculatedClosingBalance < 0 ? "negative" : "positive", value: metrics.calculatedClosingBalance },
    ...(metrics.realClosingBalance === null
      ? []
      : [{ label: "Saldo real importado", tone: metrics.realClosingBalance < 0 ? "negative" : "positive", value: metrics.realClosingBalance }]),
    ...(metrics.reconciliationDifference === null
      ? []
      : [{ label: "Diferença de conciliação", tone: Math.abs(metrics.reconciliationDifference) >= 1 ? "warning" : "info", value: metrics.reconciliationDifference }]),
  ];
  return (
    <Panel title="Resumo do Período">
      <div className="cashflow-summary-list">
        {rows.map((row) => (
          <div className="cashflow-summary-row" key={row.label}>
            <span>{row.label}</span>
            <strong className={row.tone}>{money(row.value)}</strong>
            {"weight" in row ? <small>{formatPercentNumber((row.weight ?? 0) * 100)}%</small> : null}
          </div>
        ))}
      </div>
      {metrics.reconciliationDifference !== null && Math.abs(metrics.reconciliationDifference) >= 1 ? (
        <p className="cashflow-reconciliation-note">
          Diferença entre saldo calculado e saldo real. Verifique transações ausentes ou conciliação bancária.
        </p>
      ) : null}
    </Panel>
  );
}

function CashflowEvolutionTooltip({
  active,
  payload,
  view,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    name?: string;
    payload?: {
      balance?: number | null;
      date?: string;
      expenses?: number;
      income?: number;
      month?: string;
      projectedBalance?: number | null;
    };
    value?: number;
  }>;
  view: "day" | "month";
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const label = view === "month" ? monthTickLabel(point.month ?? "") : dateLabel(point.date ?? "");
  return (
    <div className="chart-tooltip cashflow-tooltip">
      <strong>{label}</strong>
      <span className="income">Entradas: {moneyAbs(point.income ?? 0)}</span>
      <span className="expense">Saídas: {moneyAbs(point.expenses ?? 0)}</span>
      {point.balance !== null && point.balance !== undefined ? <span>Saldo acumulado: {money(point.balance)}</span> : null}
      {point.projectedBalance !== null && point.projectedBalance !== undefined ? (
        <small>Saldo projetado: {money(point.projectedBalance)}</small>
      ) : null}
    </div>
  );
}

function CashflowIncomeExpenseDonut({
  expenses,
  income,
  onOpenDetails,
}: {
  expenses: number;
  income: number;
  onOpenDetails: () => void;
}) {
  const values = [
    { amount: Math.abs(income), label: "Entradas", tone: "positive" },
    { amount: Math.abs(expenses), label: "Saídas", tone: "negative" },
  ];
  const total = values.reduce((sum, item) => sum + item.amount, 0);
  const netFlow = income - expenses;
  return (
    <Panel title="Entradas vs Saídas" description="Proporção entre dinheiro que entrou e saiu.">
      <div className="cashflow-donut-card">
        <div className="donut-chart compact">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
              <Pie data={values} dataKey="amount" nameKey="label" innerRadius="62%" outerRadius="86%" paddingAngle={2} stroke="none">
                <Cell fill="#22c55e" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip
                allowEscapeViewBox={{ x: true, y: true }}
                formatter={(value, name) => [moneyAbs(String(value)), String(name)]}
                wrapperStyle={{ pointerEvents: "none", zIndex: 30 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <span>Fluxo líquido</span>
            <strong>{formatCurrencyCompactSigned(netFlow)}</strong>
          </div>
        </div>
        <div className="donut-legend">
          {values.map((item) => (
            <div className="cashflow-donut-row" key={item.label}>
              <span>{item.label}</span>
              <strong className={item.tone}>{moneyAbs(item.amount)}</strong>
              <small>{total > 0 ? `${formatPercentNumber((item.amount / total) * 100)}%` : "0%"}</small>
            </div>
          ))}
        </div>
        <button className="panel-link" onClick={onOpenDetails} type="button">
          Ver detalhes das entradas e saídas <ChevronRight size={14} />
        </button>
      </div>
    </Panel>
  );
}

function CashflowHighlights({ items }: { items: CashflowHighlight[] }) {
  return (
    <div className="cashflow-highlight-grid">
      {items.map((item) => (
        <div className={`cashflow-highlight ${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.description}</small>
        </div>
      ))}
    </div>
  );
}

function CashflowCategoryRows({
  emptyMessage,
  items,
  loading,
  tone,
}: {
  emptyMessage: string;
  items: CashflowCategoryRow[];
  loading: boolean;
  tone: "negative" | "positive";
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message={emptyMessage} />;
  const maxAmount = Math.max(...items.map((item) => item.amount), 1);
  return (
    <div className="cashflow-category-list">
      {items.slice(0, 7).map((item, index) => (
        <div className="category-bar-row static" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <div className="category-bar-track">
            <i style={{ background: tone === "positive" ? "#22c55e" : chartPalette[index % chartPalette.length], width: `${Math.max((item.amount / maxAmount) * 100, 4)}%` }} />
          </div>
          <b>
            <strong>{moneyAbs(item.amount)}</strong>
            <small>{percent(String(item.share))}</small>
          </b>
        </div>
      ))}
    </div>
  );
}

function ExpenseSizeProfile({
  items,
  loading,
}: {
  items: ExpenseSizeSegment[];
  loading: boolean;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando perfil" description="Aguarde um momento." spin compact />;
  if (!items.some((item) => item.count > 0)) return <EmptyInline message="Sem saídas no período para analisar." />;
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  return (
    <div className="expense-size-list">
      {items.map((item) => (
        <div className={`expense-size-row ${item.tone}`} key={item.label}>
          <div>
            <strong>{item.label}</strong>
            <small>{item.helper}</small>
          </div>
          <div className="expense-size-track" aria-hidden="true">
            <i style={{ width: `${Math.max((item.total / maxTotal) * 100, item.count > 0 ? 5 : 0)}%` }} />
          </div>
          <b>
            <strong>{moneyAbs(item.total)}</strong>
            <small>
              {item.count} transaç{item.count === 1 ? "ão" : "ões"} · {formatPercentNumber(item.share * 100)}%
            </small>
            <small>Ticket médio {moneyAbs(item.average)}</small>
          </b>
        </div>
      ))}
    </div>
  );
}

function SubcategoryBreakdown({
  items,
  loading,
  onOpen,
}: {
  items: SubcategorySummary[];
  loading: boolean;
  onOpen: (item: SubcategorySummary) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando subcategorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem subcategorias no período." />;
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  const visibleItems = items.slice(0, 5);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);
  return (
    <div className="subcategory-list">
      {visibleItems.map((item) => (
        <button className="subcategory-row" key={`${item.subcategory}-${item.categoryId ?? "none"}`} onClick={() => onOpen(item)} type="button">
          <span>
            <strong>{item.subcategory}</strong>
            <small>
              {formatPercentNumber(item.percentageOfCategory * 100)}% da categoria · {item.transactionCount} transaç{item.transactionCount === 1 ? "ão" : "ões"}
            </small>
          </span>
          <div className="subcategory-track" aria-hidden="true">
            <i style={{ width: `${Math.max((item.total / maxTotal) * 100, 5)}%` }} />
          </div>
          <b>
            <strong>{moneyAbs(item.total)}</strong>
            <small>Ticket médio {moneyAbs(item.averageTicket)}</small>
          </b>
        </button>
      ))}
      {hiddenCount > 0 ? <small className="subcategory-more">+{hiddenCount} subcategoria{hiddenCount === 1 ? "" : "s"} no período</small> : null}
    </div>
  );
}

function RecurringWeightList({
  items,
  loading,
  onOpen,
}: {
  items: RecurringExpenseItem[];
  loading: boolean;
  onOpen: (item: RecurringExpenseItem) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando recorrências" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhum gasto recorrente encontrado." />;
  const sortedItems = [...items].sort((left, right) => Math.abs(Number(right.average_amount ?? 0)) - Math.abs(Number(left.average_amount ?? 0)));
  return (
    <div className="compact-timeline-list">
      {sortedItems.slice(0, 6).map((item) => (
        <button className="compact-timeline-row warning" key={item.description} onClick={() => onOpen(item)} type="button">
          <span>
            <strong>{item.description}</strong>
            <small>{item.category_name ?? "Sem categoria"} · {item.month_count} mês{item.month_count === 1 ? "" : "es"}</small>
          </span>
          <b>{moneyAbs(item.average_amount)}</b>
        </button>
      ))}
    </div>
  );
}

function CashflowComparison({
  monthlyData,
  periodDate,
  summary,
}: {
  monthlyData: Array<{ balance: number | null; expenses: number; income: number; month: string }>;
  periodDate: string;
  summary?: DashboardSummary;
}) {
  const populatedMonths = monthlyData.filter((item) => item.income !== 0 || item.expenses !== 0 || item.balance !== null);
  const selectedMonth = periodDate?.slice(0, 7);
  const selectedIndex = populatedMonths.findIndex((item) => item.month === selectedMonth);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : populatedMonths.length - 1;
  const current = populatedMonths[currentIndex];
  const previous = currentIndex > 0 ? populatedMonths[currentIndex - 1] : null;
  const previousMonths = currentIndex > 0 ? populatedMonths.slice(Math.max(0, currentIndex - 3), currentIndex) : [];
  const currentIncome = current ? Number(current.income ?? 0) : Number(summary?.income ?? 0);
  const currentExpenses = current ? Math.abs(Number(current.expenses ?? 0)) : Number(summary?.expenses ?? 0);
  const currentNetFlow = currentIncome - currentExpenses;
  const currentClosingBalance = current?.balance ?? Number(summary?.current_balance ?? summary?.balance ?? 0);
  const previousIncome = previous ? Number(previous.income ?? 0) : null;
  const previousExpenses = previous ? Math.abs(Number(previous.expenses ?? 0)) : null;
  const previousNetFlow = previousIncome === null || previousExpenses === null ? null : previousIncome - previousExpenses;
  const previousClosingBalance = previous?.balance ?? null;
  const average3 = averageMonthlyCashflow(previousMonths);
  const rows = [
    {
      helper: comparisonHelper(currentNetFlow, previousNetFlow, previous?.month),
      label: "Fluxo líquido",
      tone: currentNetFlow < 0 ? "negative" : "positive",
      value: currentNetFlow,
    },
    {
      helper: comparisonHelper(currentIncome, previousIncome, previous?.month, average3.income),
      label: "Entradas",
      tone: "positive",
      value: currentIncome,
    },
    {
      helper: comparisonHelper(currentExpenses, previousExpenses, previous?.month, average3.expenses, true),
      label: "Saídas",
      tone: "negative",
      value: currentExpenses,
    },
    {
      helper: comparisonHelper(currentClosingBalance, previousClosingBalance, previous?.month),
      label: "Saldo final",
      tone: Number(currentClosingBalance ?? 0) < 0 ? "negative" : "positive",
      value: currentClosingBalance,
    },
  ];
  if (!current && !summary) return <EmptyInline message="Histórico insuficiente para comparação." />;
  return (
    <div className="comparison-mini-grid">
      {rows.map((row) => (
        <div className="comparison-mini-card" key={row.label}>
          <span>{row.label}</span>
          <strong className={row.tone}>{row.label === "Saídas" ? moneyAbs(row.value) : money(row.value)}</strong>
          <small>{row.helper}</small>
        </div>
      ))}
    </div>
  );
}

function averageMonthlyCashflow(items: Array<{ expenses: number; income: number }>) {
  if (!items.length) return { expenses: null, income: null };
  const income = items.reduce((total, item) => total + Number(item.income ?? 0), 0) / items.length;
  const expenses = items.reduce((total, item) => total + Math.abs(Number(item.expenses ?? 0)), 0) / items.length;
  return { expenses, income };
}

function comparisonHelper(
  current: number | null,
  previous: number | null,
  previousMonth?: string,
  average?: number | null,
  lowerIsBetter = false,
) {
  if (previous !== null && previous !== undefined && previous !== 0) {
    const variation = ((Number(current ?? 0) - previous) / Math.abs(previous)) * 100;
    const sign = variation >= 0 ? "+" : "";
    const suffix = lowerIsBetter && variation < 0 ? " melhor" : "";
    return `${sign}${formatPercentNumber(variation)}% vs ${monthTickLabel(previousMonth ?? "")}${suffix}`;
  }
  if (average !== null && average !== undefined && average > 0) {
    const variation = ((Number(current ?? 0) - average) / average) * 100;
    const sign = variation >= 0 ? "+" : "";
    return `${sign}${formatPercentNumber(variation)}% vs média 3 meses`;
  }
  return "Histórico insuficiente";
}

function CashflowSeasonality({
  data,
  loading,
}: {
  data: Array<{ expenses: number; income: number; month: string }>;
  loading: boolean;
}) {
  const seasonalityData = data.map((item) => ({
    entradas: Math.abs(Number(item.income ?? 0)),
    month: item.month,
    saidas: Math.abs(Number(item.expenses ?? 0)),
  }));
  const populated = seasonalityData.filter((item) => item.entradas !== 0 || item.saidas !== 0);
  if (loading) return <PageState icon={Loader2} title="Carregando sazonalidade" description="Aguarde um momento." spin compact />;
  if (populated.length < 3) return <EmptyInline message="Ainda não há histórico suficiente para análise sazonal." />;
  return (
    <ChartBox loading={false} empty={false}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={seasonalityData} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis dataKey="month" tickFormatter={monthTickLabel} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip formatter={(value, name) => [moneyAbs(String(value)), String(name)]} labelFormatter={monthTickLabel} />
          <Legend />
          <Bar name="Entradas" dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar name="Saídas" dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

function buildCashflowPeriodMetrics(summary?: DashboardSummary, dailyItems: DailyCashflowItem[] = []): CashflowPeriodMetrics {
  const income = Number(summary?.income ?? 0);
  const expenses = Number(summary?.expenses ?? 0);
  const netFlow = income - expenses;
  const firstDay = dailyItems[0];
  const lastDay = dailyItems[dailyItems.length - 1];
  const openingBalance = firstDay ? Number(firstDay.opening_balance ?? 0) : Number(summary?.current_balance ?? 0) - netFlow;
  const calculatedClosingBalance = openingBalance + netFlow;
  const realClosingBalance = summary?.current_balance !== null && summary?.current_balance !== undefined
    ? Number(summary.current_balance)
    : lastDay?.closing_balance !== undefined
      ? Number(lastDay.closing_balance)
      : null;
  const reconciliationDifference = realClosingBalance === null ? null : realClosingBalance - calculatedClosingBalance;
  return { calculatedClosingBalance, expenses, income, netFlow, openingBalance, realClosingBalance, reconciliationDifference };
}

function buildCashflowHighlights(
  transactions: TransactionRead[],
  dailyRows: Array<{ balance: number | null; date: string; expenses: number; income: number; projectedBalance: number | null }>,
): CashflowHighlight[] {
  const incomes = transactions.filter((transaction) => transaction.direction === "credit");
  const expenses = transactions.filter(isOutflowTransaction);
  const largestIncome = maxBy(incomes, (transaction) => Math.abs(Number(transaction.amount ?? 0)));
  const largestExpense = maxBy(expenses, (transaction) => Math.abs(Number(transaction.amount ?? 0)));
  const days = dailyRows.map((row) => ({ ...row, flow: row.income + row.expenses }));
  const activeDays = days.filter((row) => row.income !== 0 || row.expenses !== 0);
  const bestDay = maxBy(activeDays, (row) => row.flow);
  const worstDay = minBy(activeDays, (row) => row.flow);
  const lowestBalance = minBy(dailyRows, (row) => Number(row.projectedBalance ?? row.balance ?? 0));
  return [
    {
      description: largestIncome ? `${largestIncome.description} · ${dateInputLabel(largestIncome.transaction_date)}` : "Sem entrada no período",
      label: "Maior entrada",
      tone: "positive",
      value: largestIncome ? moneyAbs(largestIncome.amount) : "R$ 0",
    },
    {
      description: largestExpense ? `${largestExpense.description} · ${dateInputLabel(largestExpense.transaction_date)}` : "Sem saída no período",
      label: "Maior saída",
      tone: "negative",
      value: largestExpense ? money(-Math.abs(Number(largestExpense.amount ?? 0))) : "R$ 0",
    },
    {
      description: bestDay ? dateLabel(bestDay.date) : "Sem dados diários",
      label: "Melhor dia",
      tone: "positive",
      value: bestDay ? money(bestDay.flow) : "R$ 0",
    },
    {
      description: worstDay ? dateLabel(worstDay.date) : "Sem dados diários",
      label: "Pior dia",
      tone: "negative",
      value: worstDay ? money(worstDay.flow) : "R$ 0",
    },
    {
      description: lowestBalance ? dateLabel(lowestBalance.date) : "Sem projeção",
      label: "Saldo mínimo previsto",
      tone: Number(lowestBalance?.projectedBalance ?? lowestBalance?.balance ?? 0) < 0 ? "negative" : "info",
      value: lowestBalance ? money(lowestBalance.projectedBalance ?? lowestBalance.balance ?? 0) : "R$ 0",
    },
  ];
}

function buildIncomeCategoryRows(transactions: TransactionRead[], categories: CategoryRead[]): CashflowCategoryRow[] {
  const categoryNames = new Map(categories.map((category) => [category.id, categoryPath(category, categories)]));
  const grouped = new Map<string, number>();
  transactions
    .filter((transaction) => transaction.direction === "credit")
    .forEach((transaction) => {
      const label = transaction.category?.category_id
        ? categoryNames.get(transaction.category.category_id) ?? "Receita categorizada"
        : "Sem categoria";
      grouped.set(label, (grouped.get(label) ?? 0) + Math.abs(Number(transaction.amount ?? 0)));
    });
  const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(grouped.entries())
    .map(([label, amount]) => ({ amount, label, share: total > 0 ? amount / total : 0 }))
    .sort((left, right) => right.amount - left.amount);
}

function buildExpenseSizeProfile(items: ExpenseSizeProfileItem[]): ExpenseSizeSegment[] {
  const toneByKey = new Map([
    ["small", "info" as const],
    ["medium", "warning" as const],
    ["large", "negative" as const],
  ]);
  return items.map((item) => ({
    average: Number(item.average_amount ?? 0),
    count: item.count,
    helper: item.helper,
    label: item.label,
    share: Number(item.share_ratio ?? 0),
    tone: toneByKey.get(item.key) ?? "info",
    total: Number(item.total ?? 0),
  }));
}

function buildExpenseCategoryOptions(transactions: TransactionRead[], categories: CategoryRead[]): ExpenseCategoryOption[] {
  const grouped = new Map<string, ExpenseCategoryOption>();
  transactions
    .filter(isCategorizedExpenseTransaction)
    .forEach((transaction) => {
      const parts = transactionCategoryParts(transaction, categories);
      grouped.set(parts.categoryId ?? "__uncategorized__", {
        id: parts.categoryId ?? "__uncategorized__",
        label: parts.category,
      });
    });
  return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function buildSubcategoryRows(items: SubcategoryRankingItem[]): SubcategorySummary[] {
  return items.map((item) => ({
    averageTicket: Number(item.average_amount ?? 0),
    categoryId: item.category_id,
    direction: "debit",
    percentageOfCategory: Number(item.share_ratio ?? 0),
    subcategory: item.subcategory_name,
    total: Number(item.amount ?? 0),
    transactionCount: item.count,
  }));
}

function transactionCategoryParts(transaction: TransactionRead, categories: CategoryRead[]) {
  const assignedCategory = transaction.category?.category_id
    ? categories.find((category) => category.id === transaction.category?.category_id)
    : null;
  if (!assignedCategory) {
    return {
      category: "Sem categoria",
      categoryId: null,
      subcategory: "Sem subcategoria",
      subcategoryId: null,
    };
  }
  if (!assignedCategory.parent_category_id) {
    return {
      category: assignedCategory.name,
      categoryId: assignedCategory.id,
      subcategory: "Sem subcategoria",
      subcategoryId: assignedCategory.id,
    };
  }
  const parent = categories.find((category) => category.id === assignedCategory.parent_category_id);
  return {
    category: parent?.name ?? "Outros",
    categoryId: parent?.id ?? assignedCategory.parent_category_id,
    subcategory: assignedCategory.name,
    subcategoryId: assignedCategory.id,
  };
}

function isOutflowTransaction(transaction: TransactionRead) {
  return transaction.direction === "debit" || transaction.direction === "payment" || Number(transaction.amount ?? 0) < 0;
}

function isCategorizedExpenseTransaction(transaction: TransactionRead) {
  return transaction.direction === "debit";
}

function maxBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce<T | null>((best, item) => (best === null || getter(item) > getter(best) ? item : best), null);
}

function minBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce<T | null>((best, item) => (best === null || getter(item) < getter(best) ? item : best), null);
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
  const [cardForm, setCardForm] = useState(() => ({
    brand: "",
    closingDay: "23",
    dueDay: "20",
    issuer: "",
    lastFour: "",
    limitAmount: "",
    name: "",
  }));
  const [editingCardId, setEditingCardId] = useState("");
  const [statementForm, setStatementForm] = useState(() => {
    const today = new Date();
    return {
      cardId: "",
      closingDate: "",
      dueDate: isoDate(today),
      statementMonth: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      status: "open",
      totalAmount: "",
    };
  });
  const period = usePeriod(cardPeriod, setCardPeriod);
  const queryClient = useQueryClient();
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
  const persistedCards = useQuery({
    queryKey: ["credit-cards", session.token],
    queryFn: () => getCreditCards(session),
  });
  const persistedStatements = useQuery({
    queryKey: ["credit-card-statements", session.token, period.query],
    queryFn: () => getCreditCardStatements(session, period.query),
  });
  const createCardMutation = useMutation({
    mutationFn: () =>
      createCreditCard(session, {
        brand: cardForm.brand || null,
        closing_day: Number(cardForm.closingDay || 23),
        due_day: Number(cardForm.dueDay || 20),
        issuer: cardForm.issuer || null,
        last_four: cardForm.lastFour || null,
        limit_amount: cardForm.limitAmount || null,
        name: cardForm.name,
      }),
    onSuccess: (card) => {
      setCardForm((current) => ({ ...current, lastFour: "", limitAmount: "", name: "" }));
      setStatementForm((current) => ({ ...current, cardId: card.id }));
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: () =>
      updateCreditCard(session, editingCardId, {
        brand: cardForm.brand || null,
        closing_day: Number(cardForm.closingDay || 23),
        due_day: Number(cardForm.dueDay || 20),
        issuer: cardForm.issuer || null,
        last_four: cardForm.lastFour || null,
        limit_amount: cardForm.limitAmount || null,
        name: cardForm.name,
      }),
    onSuccess: () => {
      setEditingCardId("");
      setCardForm((current) => ({ ...current, brand: "", issuer: "", lastFour: "", limitAmount: "", name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
    },
  });
  const createStatementMutation = useMutation({
    mutationFn: () =>
      createCreditCardStatement(session, {
        closing_date: statementForm.closingDate || null,
        credit_card_id: statementForm.cardId,
        due_date: statementForm.dueDate,
        statement_month: statementForm.statementMonth,
        status: statementForm.status,
        total_amount: statementForm.totalAmount || null,
      }),
    onSuccess: () => {
      setStatementForm((current) => ({ ...current, closingDate: "", totalAmount: "" }));
      void queryClient.invalidateQueries({ queryKey: ["credit-card-statements"] });
    },
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

  function editCard(card: CreditCardRead) {
    setEditingCardId(card.id);
    setCardForm({
      brand: card.brand ?? "",
      closingDay: String(card.closing_day),
      dueDay: String(card.due_day),
      issuer: card.issuer ?? "",
      lastFour: card.last_four ?? "",
      limitAmount: card.limit_amount ?? "",
      name: card.name,
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
          eyebrow="Importação primeiro"
          title="Cartões e faturas detectados"
          description="O sistema deve aproveitar os arquivos importados para descobrir cartão, vencimento, fechamento e status. Ajuste manual fica como exceção."
        />
        <div className="dashboard-grid operations-grid">
          <Panel title="Cartões detectados" description="Base identificada ou ajustada a partir das faturas importadas.">
            <CreditCardList
              items={persistedCards.data?.items ?? []}
              loading={persistedCards.isLoading}
              onEditCard={editCard}
            />
          </Panel>
          <Panel title="Faturas detectadas" description="Competências, vencimentos e status usados nos indicadores.">
            <CreditCardStatementList
              cards={persistedCards.data?.items ?? []}
              items={persistedStatements.data?.items ?? []}
              loading={persistedStatements.isLoading}
            />
          </Panel>
        </div>

        <div className="dashboard-grid operations-grid">
          <Panel
            title={editingCardId ? "Editar cartão detectado" : "Ajustar cartão manualmente"}
            description="Use apenas quando a importação não conseguiu identificar ou você precisa corrigir dados."
          >
            <form
              className="inline-form form-grid two-columns"
              onSubmit={(event) => {
                event.preventDefault();
                if (editingCardId) {
                  updateCardMutation.mutate();
                } else {
                  createCardMutation.mutate();
                }
              }}
            >
              <label>
                Nome
                <input
                  required
                  value={cardForm.name}
                  onChange={(event) => setCardForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Banco/emissor
                <input
                  value={cardForm.issuer}
                  onChange={(event) => setCardForm((current) => ({ ...current, issuer: event.target.value }))}
                />
              </label>
              <label>
                Bandeira
                <input
                  value={cardForm.brand}
                  onChange={(event) => setCardForm((current) => ({ ...current, brand: event.target.value }))}
                />
              </label>
              <label>
                Final
                <input
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={cardForm.lastFour}
                  onChange={(event) => setCardForm((current) => ({ ...current, lastFour: event.target.value }))}
                />
              </label>
              <label>
                Fechamento
                <input
                  max="31"
                  min="1"
                  required
                  type="number"
                  value={cardForm.closingDay}
                  onChange={(event) => setCardForm((current) => ({ ...current, closingDay: event.target.value }))}
                />
              </label>
              <label>
                Vencimento
                <input
                  max="31"
                  min="1"
                  required
                  type="number"
                  value={cardForm.dueDay}
                  onChange={(event) => setCardForm((current) => ({ ...current, dueDay: event.target.value }))}
                />
              </label>
              <label>
                Limite
                <input
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={cardForm.limitAmount}
                  onChange={(event) => setCardForm((current) => ({ ...current, limitAmount: event.target.value }))}
                />
              </label>
              <button
                className="primary-button"
                disabled={createCardMutation.isPending || updateCardMutation.isPending}
                type="submit"
              >
                {createCardMutation.isPending || updateCardMutation.isPending ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {editingCardId ? "Salvar edição" : "Salvar cartão"}
              </button>
              {editingCardId ? (
                <button
                  className="ghost-button"
                  disabled={updateCardMutation.isPending}
                  onClick={() => {
                    setEditingCardId("");
                    setCardForm((current) => ({
                      ...current,
                      brand: "",
                      issuer: "",
                      lastFour: "",
                      limitAmount: "",
                      name: "",
                    }));
                  }}
                  type="button"
                >
                  Cancelar edição
                </button>
              ) : null}
            </form>
            {createCardMutation.isError ? <InlineError message={apiErrorMessage(createCardMutation.error, "Falha ao salvar cartão.")} /> : null}
            {updateCardMutation.isError ? <InlineError message={apiErrorMessage(updateCardMutation.error, "Falha ao editar cartão.")} /> : null}
          </Panel>

          <Panel title="Ajustar fatura manualmente" description="Use como correção quando vencimento, total ou status não vieram do arquivo.">
            <form
              className="inline-form form-grid two-columns"
              onSubmit={(event) => {
                event.preventDefault();
                createStatementMutation.mutate();
              }}
            >
              <label>
                Cartão
                <select
                  required
                  value={statementForm.cardId}
                  onChange={(event) => setStatementForm((current) => ({ ...current, cardId: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {(persistedCards.data?.items ?? []).map((card) => (
                    <option key={card.id} value={card.id}>{cardLabel(card)}</option>
                  ))}
                </select>
              </label>
              <label>
                Mês
                <input
                  required
                  type="date"
                  value={statementForm.statementMonth}
                  onChange={(event) => setStatementForm((current) => ({ ...current, statementMonth: event.target.value }))}
                />
              </label>
              <label>
                Fechamento
                <input
                  type="date"
                  value={statementForm.closingDate}
                  onChange={(event) => setStatementForm((current) => ({ ...current, closingDate: event.target.value }))}
                />
              </label>
              <label>
                Vencimento
                <input
                  required
                  type="date"
                  value={statementForm.dueDate}
                  onChange={(event) => setStatementForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </label>
              <label>
                Valor total
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={statementForm.totalAmount}
                  onChange={(event) => setStatementForm((current) => ({ ...current, totalAmount: event.target.value }))}
                />
              </label>
              <label>
                Status
                <select
                  value={statementForm.status}
                  onChange={(event) => setStatementForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="open">Aberta</option>
                  <option value="closed">Fechada</option>
                  <option value="partial">Parcial</option>
                  <option value="paid">Paga</option>
                </select>
              </label>
              <button className="primary-button" disabled={createStatementMutation.isPending || !persistedCards.data?.items.length} type="submit">
                {createStatementMutation.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                Salvar fatura
              </button>
            </form>
            {createStatementMutation.isError ? <InlineError message={apiErrorMessage(createStatementMutation.error, "Falha ao salvar fatura.")} /> : null}
          </Panel>
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

type CalendarEvent = {
  amount: string | number;
  date: string;
  detail: string;
  direction?: string;
  kind: string;
  label: string;
  search?: string;
  tone: "info" | "negative" | "positive" | "warning";
};

function buildCalendarEvents({
  apiEvents,
  installments,
  recurring,
  transactions,
}: {
  apiEvents?: CalendarEventRead[];
  installments: CreditCardInstallmentItem[];
  recurring: RecurringExpenseItem[];
  transactions: TransactionRead[];
}): CalendarEvent[] {
  if (apiEvents?.length) {
    return apiEvents
      .map((event) => ({
        amount: event.amount ?? 0,
        date: event.due_date,
        detail: `${calendarEventTypeLabel(event.event_type)} · ${calendarEventStatusLabel(event.status)}`,
        direction: event.event_type === "income" ? "credit" : "debit",
        kind: event.recurrence === "monthly" ? "Recorrente" : "Planejado",
        label: event.title,
        search: event.title,
        tone: calendarEventTone(event),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }
  const recurringEvents: CalendarEvent[] = recurring.slice(0, 5).map((item) => ({
    amount: item.last_amount || item.average_amount,
    date: item.last_transaction_date,
    detail: `${item.transaction_count} ocorrências em ${item.month_count} mês${item.month_count === 1 ? "" : "es"}`,
    direction: "debit",
    kind: item.category_name ?? "Recorrência provável",
    label: item.description,
    search: item.description,
    tone: Number(item.change_ratio ?? 0) >= 0.3 ? "warning" : "info",
  }));
  const installmentEvents: CalendarEvent[] = installments.slice(0, 4).map((item) => ({
    amount: item.amount,
    date: item.last_transaction_date,
    detail: `${item.installment_current}/${item.installment_total} · faltam ${item.remaining_installments}`,
    direction: "debit",
    kind: "Parcela de cartão",
    label: item.description,
    search: item.description,
    tone: item.remaining_installments >= 3 ? "warning" : "info",
  }));
  const transactionEvents: CalendarEvent[] = transactions
    .filter((transaction) => transaction.direction !== "payment")
    .slice(0, 4)
    .map((transaction) => ({
      amount: transaction.amount,
      date: transaction.transaction_date,
      detail: sourceTypeLabel(transaction.source_type),
      direction: transaction.direction,
      kind: transaction.direction === "credit" ? "Entrada recente" : "Saída recente",
      label: transaction.description,
      search: transaction.description,
      tone: transaction.direction === "credit" ? "positive" : "negative",
    }));
  return [...recurringEvents, ...installmentEvents, ...transactionEvents]
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 10);
}

function buildBudgetRows(items: CategoryRankingItem[]) {
  return items.slice(0, 8).map((item, index) => {
    const spent = Number(item.amount ?? 0);
    const multiplier = [1.18, 1.05, 0.92, 1.28, 1.12, 0.88, 1.2, 1.1][index] ?? 1.1;
    const limit = Math.max(100, Math.round((spent * multiplier) / 10) * 10);
    return {
      categoryId: item.category_id,
      categoryName: item.category_name,
      limit,
      ratio: spent / Math.max(limit, 1),
      spent,
    };
  });
}

function buildPersistedBudgetRows({
  budgets,
  categories,
  ranking,
}: {
  budgets?: BudgetRead[];
  categories: CategoryRead[];
  ranking: CategoryRankingItem[];
}) {
  if (!budgets?.length) return [];
  const spentByCategory = new Map(ranking.map((item) => [item.category_id, Number(item.amount ?? 0)]));
  const categoryNames = new Map(categories.map((category) => [category.id, categoryPath(category, categories)]));
  return budgets.map((budget) => {
    const spent = budget.category_id ? spentByCategory.get(budget.category_id) ?? 0 : 0;
    const limit = Number(budget.limit_amount);
    return {
      categoryId: budget.category_id,
      categoryName: budget.category_id ? categoryNames.get(budget.category_id) ?? budget.name : budget.name,
      limit,
      ratio: spent / Math.max(limit, 1),
      spent,
    };
  });
}

function compactCategoryDistribution(items: CategoryRankingItem[]) {
  const sorted = [...items]
    .map((item) => ({ ...item, amountValue: Math.abs(Number(item.amount ?? 0)) }))
    .sort((left, right) => right.amountValue - left.amountValue);
  const total = sorted.reduce((sum, item) => sum + item.amountValue, 0);
  const visible = sorted.filter((item, index) => index < 5 && item.amountValue / Math.max(total, 1) >= 0.04);
  const otherAmount = sorted.slice(visible.length).reduce((sum, item) => sum + item.amountValue, 0);
  if (otherAmount > 0) {
    visible.push({
      amount: String(otherAmount),
      amountValue: otherAmount,
      average_amount: String(otherAmount),
      category_id: null,
      category_name: "Outros",
      count: sorted.slice(visible.length).reduce((sum, item) => sum + item.count, 0),
      share_ratio: String(otherAmount / Math.max(total, 1)),
    });
  }
  return visible;
}

function buildGoalRows(summary?: DashboardSummary, persistedGoals?: GoalRead[]) {
  if (persistedGoals?.length) {
    return persistedGoals.map((goal) => ({
      current: Number(goal.current_amount),
      deadline: goal.target_date ? `Meta para ${dateInputLabel(goal.target_date)}` : "Sem prazo definido",
      description: goal.description ?? "Meta cadastrada no planejamento.",
      name: goal.name,
      ratio: Number(goal.current_amount) / Math.max(Number(goal.target_amount), 1),
      status: goalStatusLabel(goal.status),
      target: Number(goal.target_amount),
    }));
  }
  const balance = Math.max(Number(summary?.balance ?? 0), 0);
  const monthlyBoost = Math.min(balance, 1200);
  const goals = [
    {
      current: 16500 + monthlyBoost,
      deadline: "Meta para 90 dias",
      description: "Cobrir despesas essenciais com mais previsibilidade.",
      name: "Reserva de emergência",
      status: "Em avanço",
      target: 24000,
    },
    {
      current: 4200 + monthlyBoost * 0.3,
      deadline: "Meta para 6 meses",
      description: "Separar recursos para uma viagem familiar planejada.",
      name: "Viagem em família",
      status: "No ritmo",
      target: 12000,
    },
    {
      current: 2800 + monthlyBoost * 0.2,
      deadline: "Meta para 12 meses",
      description: "Construir uma base de investimento recorrente.",
      name: "Carteira de longo prazo",
      status: "Inicial",
      target: 18000,
    },
  ];
  return goals.map((goal) => ({
    ...goal,
    ratio: goal.current / Math.max(goal.target, 1),
  }));
}

function budgetTone(ratio: number): "negative" | "positive" | "warning" {
  if (ratio > 1) return "negative";
  if (ratio >= 0.85) return "warning";
  return "positive";
}

function calendarEventTone(event: CalendarEventRead): "info" | "negative" | "positive" | "warning" {
  if (event.status === "paid") return "positive";
  if (event.event_type === "income") return "positive";
  if (event.event_type === "card_payment" || event.event_type === "subscription") return "warning";
  if (event.event_type === "expense") return "negative";
  return "info";
}

function calendarEventTypeLabel(eventType: string) {
  const labels: Record<string, string> = {
    card_payment: "Fatura",
    expense: "Despesa",
    goal: "Meta",
    income: "Receita",
    other: "Outro",
    subscription: "Assinatura",
  };
  return labels[eventType] ?? eventType;
}

function calendarEventStatusLabel(eventStatus: string) {
  const labels: Record<string, string> = {
    paid: "Pago",
    planned: "Planejado",
    skipped: "Ignorado",
  };
  return labels[eventStatus] ?? eventStatus;
}

function goalStatusLabel(goalStatus: string) {
  const labels: Record<string, string> = {
    active: "Ativa",
    completed: "Concluída",
    paused: "Pausada",
  };
  return labels[goalStatus] ?? goalStatus;
}

function DashboardFlowStory({
  futureCommitments,
  onOpenAnalysis,
  periodLabel,
  projectionLoading = false,
  projectedBalance,
  summary,
  summaryLoading = false,
}: {
  futureCommitments?: number | null;
  onOpenAnalysis?: () => void;
  periodLabel: string;
  projectionLoading?: boolean;
  projectedBalance?: number | null;
  summary?: DashboardSummary;
  summaryLoading?: boolean;
}) {
  const balance = Number(summary?.balance ?? 0);
  const mappedFutureCommitments = futureCommitments ?? Number(summary?.payments ?? 0);
  const expectedBalance = projectedBalance ?? balance - mappedFutureCommitments;
  const steps: Array<{
    helper: string;
    icon: LucideIcon;
    label: string;
    title: string;
    tone: "info" | "negative" | "positive" | "warning";
    value: string;
  }> = [
    {
      helper: summaryLoading ? "dados em atualização" : "receitas no período",
      icon: ArrowUpCircle,
      label: "Entrou",
      title: summaryLoading ? "Carregando receitas" : moneyAbs(summary?.income),
      tone: summaryLoading ? "info" : "positive",
      value: summaryLoading ? "Carregando" : formatCurrencyCompact(summary?.income),
    },
    {
      helper: summaryLoading ? "dados em atualização" : "despesas no período",
      icon: ArrowDownCircle,
      label: "Saiu",
      title: summaryLoading ? "Carregando despesas" : moneyAbs(summary?.expenses),
      tone: summaryLoading ? "info" : "negative",
      value: summaryLoading ? "Carregando" : formatCurrencyCompact(summary?.expenses),
    },
    {
      helper: summaryLoading ? "dados em atualização" : balance < 0 ? "resultado negativo" : "resultado positivo",
      icon: BarChart3,
      label: "Saldo do mês",
      title: summaryLoading ? "Carregando saldo do mês" : moneyAbs(summary?.balance),
      tone: summaryLoading ? "info" : balance < 0 ? "negative" : "positive",
      value: summaryLoading ? "Carregando" : formatCurrencyCompactSigned(summary?.balance),
    },
    {
      helper: projectionLoading
        ? "projeção em atualização"
        : projectedBalance === null || projectedBalance === undefined
          ? "fatura mapeada"
          : "saídas conhecidas em 30 dias",
      icon: CreditCard,
      label: "Compromissos futuros",
      title: projectionLoading ? "Calculando compromissos" : moneyAbs(mappedFutureCommitments),
      tone: "info",
      value: projectionLoading ? "Calculando" : formatCurrencyCompact(mappedFutureCommitments),
    },
    {
      helper: projectionLoading
        ? "projeção em atualização"
        : projectedBalance === null || projectedBalance === undefined
          ? "após compromissos mapeados"
          : "projeção dos próximos 30 dias",
      icon: CalendarDays,
      label: "Saldo previsto",
      title: projectionLoading ? "Calculando saldo previsto" : money(expectedBalance),
      tone: projectionLoading ? "info" : expectedBalance < 0 ? "negative" : "positive",
      value: projectionLoading ? "Calculando" : formatCurrencyCompactSigned(expectedBalance),
    },
  ];

  return (
    <section className="flow-story" aria-label="História do fluxo de caixa">
      <div className="flow-story-header">
        <div>
          <span>A história do seu dinheiro</span>
          <strong>{periodLabel}</strong>
        </div>
        {onOpenAnalysis ? (
          <button className="panel-link" onClick={onOpenAnalysis} type="button">
            Ver análises completas
            <ChevronRight size={14} />
          </button>
        ) : null}
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

function CategoryDonut({
  items,
  loading,
  onOpenCategory,
}: {
  items: CategoryRankingItem[];
  loading: boolean;
  onOpenCategory: (item: CategoryRankingItem) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const chartItems = compactCategoryDistribution(items);
  const total = chartItems.reduce((sum, item) => sum + item.amountValue, 0);
  return (
    <div className="donut-summary">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 28, bottom: 4, left: 28 }}>
            <Pie
              data={chartItems}
              dataKey="amountValue"
              nameKey="category_name"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
            >
              {chartItems.map((item, index) => (
                <Cell key={item.category_id ?? item.category_name} fill={chartPalette[index % chartPalette.length]} />
              ))}
            </Pie>
            <Tooltip
              allowEscapeViewBox={{ x: true, y: true }}
              content={<CategoryDonutTooltip total={total} />}
              wrapperStyle={{ pointerEvents: "none", zIndex: 30 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{compactMoneyAbs(total)}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="donut-legend">
        {chartItems.slice(0, 6).map((item, index) => (
          <button className="donut-legend-row" key={item.category_id ?? item.category_name} onClick={() => onOpenCategory(item)} type="button">
            <i style={{ background: chartPalette[index % chartPalette.length] }} />
            <span>{item.category_name}</span>
            <strong>{percent(item.share_ratio)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryDonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CategoryRankingItem & { amountValue?: number } }>;
  total: number;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  const amount = Number(item.amountValue ?? item.amount ?? 0);
  const ratio = total > 0 ? amount / total : Number(item.share_ratio ?? 0);
  return (
    <div className="chart-tooltip donut-tooltip">
      <strong>{item.category_name}</strong>
      <span>{moneyAbs(String(amount))}</span>
      <small>{percent(String(ratio))} do total</small>
    </div>
  );
}

function CategoryBarList({
  items,
  loading,
  onOpenCategory,
}: {
  items: CategoryRankingItem[];
  loading: boolean;
  onOpenCategory: (item: CategoryRankingItem) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando categorias" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem categorias para o período." />;
  const sortedItems = [...items].sort((left, right) => Math.abs(Number(right.amount ?? 0)) - Math.abs(Number(left.amount ?? 0)));
  const maxAmount = Math.max(...sortedItems.map((item) => Math.abs(Number(item.amount ?? 0))), 1);
  const totalAmount = sortedItems.reduce((total, item) => total + Math.abs(Number(item.amount ?? 0)), 0);
  const visibleItems = sortedItems.slice(0, 5);
  const hiddenCount = Math.max(sortedItems.length - visibleItems.length, 0);
  return (
    <div className="category-bar-list">
      {visibleItems.map((item, index) => {
        const amount = Math.abs(Number(item.amount ?? 0));
        const shareRatio = totalAmount > 0 ? amount / totalAmount : Number(item.share_ratio ?? 0);
        return (
          <button className="category-bar-row" key={item.category_id ?? item.category_name} onClick={() => onOpenCategory(item)} type="button">
            <span>{item.category_name}</span>
            <div className="category-bar-track">
              <i style={{ background: chartPalette[index % chartPalette.length], width: `${Math.max((amount / maxAmount) * 100, 4)}%` }} />
            </div>
            <b>
              <strong>{moneyAbs(amount)}</strong>
              <small>{percent(String(shareRatio))}</small>
            </b>
          </button>
        );
      })}
      {hiddenCount > 0 ? <small className="category-more">+{hiddenCount} categoria{hiddenCount === 1 ? "" : "s"} no período</small> : null}
      <div className="category-total-row">
        <span>Total de saídas</span>
        <strong>{moneyAbs(totalAmount)}</strong>
      </div>
    </div>
  );
}

function CreditCardSnapshot({
  commitmentRate,
  currentStatementTotal,
  futureInstallments,
  installmentCount,
  loading,
}: {
  commitmentRate: number | null;
  currentStatementTotal: number;
  futureInstallments: string | number;
  installmentCount: number;
  loading: boolean;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando cartões" description="Aguarde um momento." spin compact />;
  const status = commitmentStatus(commitmentRate);
  return (
    <div className="snapshot-grid cards">
      <div>
        <span>Fatura atual</span>
        <strong>{moneyAbs(currentStatementTotal)}</strong>
        <small>Detectada/importada no período</small>
      </div>
      <div>
        <span>Parcelado futuro</span>
        <strong>{moneyAbs(futureInstallments)}</strong>
        <small>{installmentCount} parcela{installmentCount === 1 ? "" : "s"} ativa{installmentCount === 1 ? "" : "s"}</small>
      </div>
      <div className="wide">
        <span>Comprometimento com cartão</span>
        <strong>{commitmentRate === null ? "Sem receita" : `${formatPercentNumber(commitmentRate * 100)}%`}</strong>
        <small>{status.label} · % da receita do período</small>
        <span className="progress-track large" aria-label="Comprometimento com cartão">
          <i className={status.tone} style={{ width: `${Math.min((commitmentRate ?? 0) * 100, 100)}%` }} />
        </span>
      </div>
    </div>
  );
}

function ProjectedCashflowSnapshot({
  data,
  loading,
  lowestProjectedBalance,
  onNavigatePlanning,
  risk,
}: {
  data: CashFlowProjectionChartPoint[];
  loading: boolean;
  lowestProjectedBalance: number;
  onNavigatePlanning: () => void;
  risk: CashFlowProjectionPoint | null;
}) {
  const [showCalculation, setShowCalculation] = useState(false);
  if (loading) return <PageState icon={Loader2} title="Carregando projeção" description="Aguarde um momento." spin compact />;
  if (!data.length) return <EmptyInline message="Sem dados para projetar o período." />;
  const riskDays = risk ? daysFromToday(risk.date) : null;
  return (
    <div className="projected-snapshot">
      <button className="calculation-note" onClick={() => setShowCalculation((current) => !current)} type="button">
        <Gauge size={16} />
        <span>Como calculamos?</span>
      </button>
      {showCalculation ? (
        <div className="calculation-details">
          <p>
            A projeção parte do saldo atual e calcula dia a dia: saldo do dia anterior + entradas previstas - saídas previstas.
          </p>
          <p>
            Entradas incluem receitas futuras conhecidas e recorrências. Saídas incluem compromissos, parcelas, contas recorrentes,
            assinaturas e gastos variáveis estimados pelo histórico. Dados conhecidos têm prioridade sobre estimativas.
          </p>
        </div>
      ) : null}
      <ChartBox loading={false} empty={!data.length}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 42, bottom: 0, left: 4 }} stackOffset="sign">
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="#475569" />
            <ReferenceLine x={data[0]?.date} stroke="#94a3b8" strokeDasharray="4 4" />
            <XAxis dataKey="date" tickFormatter={dayTickLabel} tickLine={false} axisLine={false} />
            <YAxis hide domain={moneyAxisDomain(data, ["entradas", "saidas", "saldoProjetado"], true)} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Tooltip
              allowEscapeViewBox={{ x: true, y: true }}
              content={<ProjectionTooltip />}
              wrapperStyle={{ maxWidth: 240, pointerEvents: "none", zIndex: 30 }}
            />
            <Bar name="Entradas previstas" dataKey="entradas" fill="#0f9f6e" radius={[4, 4, 0, 0]} stackId="flow" />
            <Bar name="Saídas previstas" dataKey="saidas" fill="#dc2626" radius={[0, 0, 4, 4]} stackId="flow" />
            <Line
              activeDot={{ r: 5 }}
              name="Saldo projetado"
              type="monotone"
              dataKey="saldoProjetado"
              stroke="#64748b"
              strokeDasharray="6 5"
              strokeWidth={2}
              dot={(props) => {
                const payload = props.payload as CashFlowProjectionChartPoint | undefined;
                if (!payload || payload.saldoProjetado >= 0) return <g />;
                return <circle cx={props.cx} cy={props.cy} fill="#dc2626" r={3} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>
      <div className={risk ? "projection-alert negative" : "projection-alert positive"}>
        {risk ? (
          <>
            <AlertCircle size={16} />
            <span>
              Atenção: seu saldo pode ficar negativo em {riskDays} dia{riskDays === 1 ? "" : "s"}.
              Data prevista: {dateLabel(risk.date)}. Menor saldo projetado: {money(lowestProjectedBalance)}.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 size={16} />
            <span>Nenhum risco de saldo negativo nos próximos 30 dias. Menor saldo projetado: {money(lowestProjectedBalance)}.</span>
          </>
        )}
        <button className="panel-link" onClick={onNavigatePlanning} type="button">Ver projeção completa <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

function ProjectionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CashFlowProjectionChartPoint }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const point = payload[0].payload;
  const confidenceLabel: Record<string, string> = {
    high: "alta",
    low: "baixa",
    medium: "média",
  };
  const visibleEvents = point.events.slice(0, 3);
  const hiddenEvents = Math.max(point.events.length - visibleEvents.length, 0);
  return (
    <div className="chart-tooltip projection-tooltip">
      <strong>{dateLabel(point.date)}</strong>
      <span>Entradas: {moneyAbs(point.entradas)}</span>
      <span>Saídas: {moneyAbs(point.saidas)}</span>
      <span>Saldo: {money(point.saldoProjetado)}</span>
      {point.events.length ? (
        <div>
          <small>Eventos</small>
          {visibleEvents.map((event) => (
            <small className={event.type} key={`${point.date}-${event.description}-${event.source}`}>
              {event.type === "income" ? "Entrada" : "Saída"} · {event.description}: {moneyAbs(event.amount)}
            </small>
          ))}
          {hiddenEvents > 0 ? <small>+{hiddenEvents} evento{hiddenEvents === 1 ? "" : "s"}</small> : null}
        </div>
      ) : null}
      <small>Confiança: {confidenceLabel[point.confidence] ?? point.confidence}</small>
    </div>
  );
}

function CompactTimelineList({
  items,
  loading,
  onOpenTransactions,
  onShowAll,
  total,
}: {
  items: CalendarEvent[];
  loading: boolean;
  onOpenTransactions: (event: CalendarEvent) => void;
  onShowAll: () => void;
  total: number;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando compromissos" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Sem compromissos mapeados para o período." />;
  return (
    <div className="compact-timeline-list">
      {items.map((event) => (
        <button className={`compact-timeline-row ${event.tone}`} key={`${event.kind}-${event.label}-${event.date}`} onClick={() => onOpenTransactions(event)} type="button">
          <span>
            <strong>{event.label}</strong>
            <small>{dateInputLabel(event.date)} · {event.kind} · {event.detail}</small>
          </span>
          <b>{moneyAbs(event.amount)}</b>
        </button>
      ))}
      {total > items.length ? (
        <button className="panel-link timeline-footer-link" onClick={onShowAll} type="button">
          Ver todos ({total})
          <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

function BudgetSnapshot({
  loading,
  onOpenCategory,
  rows,
}: {
  loading: boolean;
  onOpenCategory: (row: ReturnType<typeof buildBudgetRows>[number]) => void;
  rows: ReturnType<typeof buildBudgetRows>;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando orçamento" description="Aguarde um momento." spin compact />;
  if (!rows.length) return <EmptyInline message="Sem categorias para sugerir orçamento." />;
  const planned = rows.reduce((total, row) => total + row.limit, 0);
  const realized = rows.reduce((total, row) => total + row.spent, 0);
  const consumed = realized / Math.max(planned, 1);
  return (
    <div className="budget-list compact">
      <div className="budget-summary-line">
        <span>
          <strong>{moneyAbs(realized)}</strong>
          <small>realizado de {moneyAbs(planned)} planejado</small>
        </span>
        <b className={budgetTone(consumed)}>{formatPercentNumber(consumed * 100)}%</b>
      </div>
      {rows.map((row) => (
        <button className="budget-row compact" key={row.categoryName} onClick={() => onOpenCategory(row)} type="button">
          <div>
            <strong>{row.categoryName}</strong>
            <small>{moneyAbs(row.spent)} de {moneyAbs(row.limit)}</small>
          </div>
          <span className="progress-track" aria-label={`${row.categoryName}: ${formatPercentNumber(row.ratio * 100)}%`}>
            <i className={budgetTone(row.ratio)} style={{ width: `${Math.min(row.ratio * 100, 100)}%` }} />
          </span>
          <b className={budgetTone(row.ratio)}>{formatPercentNumber(row.ratio * 100)}%</b>
        </button>
      ))}
    </div>
  );
}

function GoalSnapshot({ loading, rows }: { loading: boolean; rows: ReturnType<typeof buildGoalRows> }) {
  if (loading) return <PageState icon={Loader2} title="Carregando metas" description="Aguarde um momento." spin compact />;
  if (!rows.length) return <EmptyInline message="Nenhuma meta ativa no período." />;
  return (
    <div className="goal-list compact">
      {rows.map((goal) => (
        <div className="goal-row compact" key={goal.name}>
          <div>
            <strong>{goal.name}</strong>
            <small>{moneyAbs(goal.current)} de {moneyAbs(goal.target)}</small>
          </div>
          <span className="progress-track" aria-label={`${goal.name}: ${formatPercentNumber(goal.ratio * 100)}%`}>
            <i className={goal.ratio >= 0.7 ? "positive" : "info"} style={{ width: `${Math.min(goal.ratio * 100, 100)}%` }} />
          </span>
          <b>{formatPercentNumber(goal.ratio * 100)}%</b>
        </div>
      ))}
    </div>
  );
}

function PersonalizedTip({
  balance,
  onNavigateReports,
  recurring,
  savingsRate,
}: {
  balance: number;
  onNavigateReports: () => void;
  recurring: RecurringExpenseItem[];
  savingsRate?: string | null;
}) {
  const topRecurring = recurring[0];
  const savingValue = Number(savingsRate ?? 0);
  const text = topRecurring
    ? `Revise ${topRecurring.description}: último valor ${moneyAbs(topRecurring.last_amount)} e média ${moneyAbs(topRecurring.average_amount)}.`
    : savingValue > 0
      ? `Seu saving rate está positivo em ${percentAbs(savingsRate)}. Vale direcionar parte da sobra para uma meta.`
      : balance < 0
        ? "Seu saldo está negativo. Priorize revisar categorias com maior crescimento e compromissos próximos."
        : "Continue categorizando as transações para melhorar as recomendações automáticas.";
  return (
    <section className="personalized-tip">
      <span><Sparkles size={18} /></span>
      <div>
        <strong>Dica personalizada</strong>
        <p>{text}</p>
      </div>
      <button className="secondary-button" onClick={onNavigateReports} type="button">Ver análises</button>
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
  const alerts = dashboardAlerts({ categoryGrowth, period, quality, recurring, summary }).slice(0, 3);
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
              <strong>
                {alert.title}
                <em>{alertSeverityLabel(alert.tone)}</em>
              </strong>
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

function CalendarPage({
  onOpenTransactions,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [calendarPeriod, setCalendarPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [eventForm, setEventForm] = useState(() => ({
    amount: "",
    dueDate: isoDate(new Date()),
    eventType: "expense",
    recurrence: "none",
    title: "",
  }));
  const queryClient = useQueryClient();
  const period = usePeriod(calendarPeriod, setCalendarPeriod);
  const createEvent = useMutation({
    mutationFn: () =>
      createCalendarEvent(session, {
        amount: eventForm.amount || null,
        due_date: eventForm.dueDate,
        event_type: eventForm.eventType,
        recurrence: eventForm.recurrence,
        title: eventForm.title,
      }),
    onSuccess: () => {
      setEventForm((current) => ({ ...current, amount: "", title: "" }));
      void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
  const summary = useQuery({
    queryKey: ["calendar-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedEvents = useQuery({
    queryKey: ["calendar-events", session.token, period.query],
    queryFn: () => getCalendarEvents(session, period.query),
  });
  const recurring = useQuery({
    queryKey: ["calendar-recurring", session.token, period.recurringQuery],
    queryFn: () => getRecurringExpenses(session, withQueryParams(period.recurringQuery, { limit: "8", min_months: "2" })),
  });
  const installments = useQuery({
    queryKey: ["calendar-installments", session.token, period.dateTo],
    queryFn: () =>
      getCreditCardInstallments(
        session,
        period.dateTo ? withQueryParams("", { date_to: period.dateTo, limit: "8" }) : withQueryParams("", { limit: "8" }),
      ),
  });
  const recentTransactions = useQuery({
    queryKey: ["calendar-recent-transactions", session.token, period.query],
    queryFn: () => getTransactions(session, withQueryParams(period.query, { limit: "6", sort_by: "transaction_date", sort_dir: "desc" })),
  });
  const calendarEvents = buildCalendarEvents({
    apiEvents: persistedEvents.data?.items,
    installments: installments.data?.items ?? [],
    recurring: recurring.data?.items ?? [],
    transactions: recentTransactions.data?.items ?? [],
  });
  const totalPlannedOutflow = calendarEvents.reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const riskEvents = calendarEvents.filter((item) => item.tone === "warning" || item.tone === "negative").length;

  return (
    <section className="page-stack">
      <PeriodFilter period={period} />
      <div className="metric-grid executive">
        <MetricCard icon={CalendarDays} label="Eventos mapeados" value={String(calendarEvents.length)} helper="Recorrências, parcelas e últimos lançamentos" tone="info" />
        <MetricCard icon={ArrowDownCircle} label="Saídas previstas" value={moneyAbs(totalPlannedOutflow)} helper="Estimativa derivada do histórico" tone="negative" />
        <MetricCard icon={CreditCard} label="Parcelas ativas" value={String(installments.data?.active_count ?? 0)} helper={moneyAbs(installments.data?.total_future_amount)} tone="warning" />
        <MetricCard icon={ShieldCheck} label="Pontos de atenção" value={String(riskEvents)} helper="Itens que merecem revisão" tone={riskEvents ? "warning" : "positive"} />
        <MetricCard icon={Gauge} label="Saldo do período" value={money(summary.data?.balance)} helper="Calculado pelo dashboard atual" tone={Number(summary.data?.balance ?? 0) >= 0 ? "positive" : "negative"} />
      </div>
      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Calendário"
          title="Próximos compromissos financeiros"
          description="Primeira visão baseada nos dados já importados. A API dedicada de calendário entra na próxima etapa."
        />
        <div className="dashboard-grid analysis-grid">
          <Panel title="Linha do tempo" description="Eventos estimados a partir de recorrências, parcelas e lançamentos recentes.">
            <div className="timeline-list">
              {persistedEvents.isLoading || recurring.isLoading || installments.isLoading || recentTransactions.isLoading ? (
                <PageState icon={Loader2} title="Carregando calendário" description="Organizando compromissos do período." spin compact />
              ) : null}
              {!persistedEvents.isLoading && !recurring.isLoading && !installments.isLoading && !recentTransactions.isLoading && !calendarEvents.length ? (
                <EmptyInline message="Ainda não há eventos suficientes para montar o calendário." />
              ) : null}
              {calendarEvents.map((event) => (
                <button
                  className={`timeline-item ${event.tone}`}
                  key={`${event.kind}-${event.label}-${event.date}`}
                  onClick={() =>
                    onOpenTransactions({
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      direction: event.direction,
                      label: event.label,
                      periodPreset: period.periodPreset,
                      search: event.search,
                    })
                  }
                  type="button"
                >
                  <span>
                    <strong>{dateInputLabel(event.date)}</strong>
                    <small>{event.kind}</small>
                  </span>
                  <div>
                    <strong>{event.label}</strong>
                    <small>{event.detail}</small>
                  </div>
                  <b>{moneyAbs(event.amount)}</b>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Resumo operacional" description="Leitura inicial enquanto o módulo Planning não tem backend próprio.">
            <div className="settings-list">
              <QualityRow label="Fonte dos dados" value={persistedEvents.data?.items.length ? "Planning API" : "Transações importadas"} />
              <QualityRow label="Recorrências prováveis" value={recurring.data?.items.length ?? 0} />
              <QualityRow label="Parcelado futuro" value={moneyAbs(installments.data?.total_future_amount)} />
              <QualityRow label="Qualidade da previsão" value={calendarEvents.length >= 5 ? "Boa" : "Inicial"} />
            </div>
          </Panel>
        </div>
      </section>
      <Panel title="Novo evento" description="Cadastre compromissos que ainda não aparecem nos extratos importados.">
        <form
          className="inline-form form-grid two-columns"
          onSubmit={(event) => {
            event.preventDefault();
            createEvent.mutate();
          }}
        >
          <label>
            Título
            <input
              required
              value={eventForm.title}
              onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label>
            Data
            <input
              required
              type="date"
              value={eventForm.dueDate}
              onChange={(event) => setEventForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </label>
          <label>
            Tipo
            <select
              value={eventForm.eventType}
              onChange={(event) => setEventForm((current) => ({ ...current, eventType: event.target.value }))}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
              <option value="card_payment">Fatura</option>
              <option value="subscription">Assinatura</option>
              <option value="goal">Meta</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label>
            Valor
            <input
              min="0"
              step="0.01"
              type="number"
              value={eventForm.amount}
              onChange={(event) => setEventForm((current) => ({ ...current, amount: event.target.value }))}
            />
          </label>
          <label>
            Recorrência
            <select
              value={eventForm.recurrence}
              onChange={(event) => setEventForm((current) => ({ ...current, recurrence: event.target.value }))}
            >
              <option value="none">Sem recorrência</option>
              <option value="monthly">Mensal</option>
            </select>
          </label>
          <button className="primary-button" disabled={createEvent.isPending} type="submit">
            {createEvent.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Adicionar evento
          </button>
        </form>
        {createEvent.isError ? <InlineError message={apiErrorMessage(createEvent.error, "Falha ao criar evento.")} /> : null}
      </Panel>
    </section>
  );
}

function BudgetsPage({
  onOpenTransactions,
  session,
}: {
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const [budgetPeriod, setBudgetPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [budgetForm, setBudgetForm] = useState(() => {
    const range = periodRange("current_month");
    return {
      categoryId: "",
      limitAmount: "",
      name: "",
      periodEnd: range.dateTo,
      periodStart: range.dateFrom,
    };
  });
  const queryClient = useQueryClient();
  const period = usePeriod(budgetPeriod, setBudgetPeriod);
  const ranking = useQuery({
    queryKey: ["budgets-category-ranking", session.token, period.query],
    queryFn: () => getCategoryRanking(session, withQueryParams(period.query, { limit: "8" })),
  });
  const persistedBudgets = useQuery({
    queryKey: ["budgets", session.token, period.query],
    queryFn: () => getBudgets(session, period.query),
  });
  const categories = useCategories(session);
  const createBudgetMutation = useMutation({
    mutationFn: () =>
      createBudget(session, {
        category_id: budgetForm.categoryId || null,
        limit_amount: budgetForm.limitAmount,
        name: budgetForm.name,
        period_end: budgetForm.periodEnd,
        period_start: budgetForm.periodStart,
      }),
    onSuccess: () => {
      setBudgetForm((current) => ({ ...current, categoryId: "", limitAmount: "", name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
  const summary = useQuery({
    queryKey: ["budgets-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedRows = buildPersistedBudgetRows({
    budgets: persistedBudgets.data?.items,
    categories: categories.data?.items ?? [],
    ranking: ranking.data?.items ?? [],
  });
  const rows = persistedRows.length ? persistedRows : buildBudgetRows(ranking.data?.items ?? []);
  const overBudget = rows.filter((row) => row.ratio > 1).length;
  const nearLimit = rows.filter((row) => row.ratio >= 0.85 && row.ratio <= 1).length;
  const totalBudget = rows.reduce((total, row) => total + row.limit, 0);
  const totalSpent = rows.reduce((total, row) => total + row.spent, 0);

  return (
    <section className="page-stack">
      <PeriodFilter period={period} />
      <div className="metric-grid executive">
        <MetricCard icon={PiggyBank} label="Orçado" value={moneyAbs(totalBudget)} helper="Limites iniciais sugeridos" tone="info" />
        <MetricCard icon={ArrowDownCircle} label="Realizado" value={moneyAbs(totalSpent)} helper="Despesas categorizadas do período" tone="negative" />
        <MetricCard icon={Percent} label="Uso geral" value={`${formatPercentNumber((totalSpent / Math.max(totalBudget, 1)) * 100)}%`} helper="Realizado sobre limite" tone={totalSpent > totalBudget ? "negative" : "positive"} />
        <MetricCard icon={AlertCircle} label="Acima do limite" value={String(overBudget)} helper={`${nearLimit} perto do limite`} tone={overBudget ? "negative" : "positive"} />
        <MetricCard icon={Gauge} label="Comprometimento" value={percent(summary.data?.commitment_rate)} helper="Indicador do dashboard" tone={commitmentTone(summary.data?.commitment_rate)} />
      </div>
      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Orçamentos"
          title="Controle por categoria"
          description="Primeira versão com limites sugeridos a partir do histórico. O CRUD real entra com o backend de Planning."
        />
        <div className="dashboard-grid analysis-grid">
          <Panel title="Categorias monitoradas" description="Clique em uma categoria para revisar os lançamentos que consumiram o orçamento.">
            <div className="budget-list">
              {ranking.isLoading || persistedBudgets.isLoading || categories.isLoading ? <PageState icon={Loader2} title="Carregando orçamentos" description="Buscando categorias do período." spin compact /> : null}
              {!ranking.isLoading && !persistedBudgets.isLoading && !categories.isLoading && !rows.length ? <EmptyInline message="Cadastre orçamentos ou categorize transações para sugerir limites." /> : null}
              {rows.map((row) => (
                <button
                  className="budget-row"
                  key={row.categoryName}
                  onClick={() =>
                    onOpenTransactions({
                      categoryId: row.categoryId ?? undefined,
                      dateFrom: period.dateFrom,
                      dateTo: period.dateTo,
                      direction: "debit",
                      label: row.categoryName,
                      periodPreset: period.periodPreset,
                    })
                  }
                  type="button"
                >
                  <div>
                    <strong>{row.categoryName}</strong>
                    <small>{moneyAbs(row.spent)} de {moneyAbs(row.limit)}</small>
                  </div>
                  <span className="progress-track" aria-label={`${row.categoryName}: ${formatPercentNumber(row.ratio * 100)}%`}>
                    <i className={budgetTone(row.ratio)} style={{ width: `${Math.min(row.ratio * 100, 100)}%` }} />
                  </span>
                  <b className={budgetTone(row.ratio)}>{formatPercentNumber(row.ratio * 100)}%</b>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Política inicial" description="Faixas usadas nesta primeira versão visual.">
            <div className="settings-list">
              <QualityRow label="Dentro do orçamento" value="até 85%" />
              <QualityRow label="Atenção" value="85% a 100%" />
              <QualityRow label="Acima do limite" value="acima de 100%" />
              <QualityRow label="Fonte dos limites" value={persistedRows.length ? "Planning API" : "Sugestão histórica"} />
            </div>
          </Panel>
        </div>
      </section>
      <Panel title="Novo orçamento" description="Defina limites mensais por categoria ou por um agrupamento livre.">
        <form
          className="inline-form form-grid two-columns"
          onSubmit={(event) => {
            event.preventDefault();
            createBudgetMutation.mutate();
          }}
        >
          <label>
            Nome
            <input
              required
              value={budgetForm.name}
              onChange={(event) => setBudgetForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            Categoria
            <select
              value={budgetForm.categoryId}
              onChange={(event) => setBudgetForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">Sem categoria vinculada</option>
              {orderedCategoryOptions(categories.data?.items ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início
            <input
              required
              type="date"
              value={budgetForm.periodStart}
              onChange={(event) => setBudgetForm((current) => ({ ...current, periodStart: event.target.value }))}
            />
          </label>
          <label>
            Fim
            <input
              required
              type="date"
              value={budgetForm.periodEnd}
              onChange={(event) => setBudgetForm((current) => ({ ...current, periodEnd: event.target.value }))}
            />
          </label>
          <label>
            Limite
            <input
              min="0.01"
              required
              step="0.01"
              type="number"
              value={budgetForm.limitAmount}
              onChange={(event) => setBudgetForm((current) => ({ ...current, limitAmount: event.target.value }))}
            />
          </label>
          <button className="primary-button" disabled={createBudgetMutation.isPending} type="submit">
            {createBudgetMutation.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Criar orçamento
          </button>
        </form>
        {createBudgetMutation.isError ? <InlineError message={apiErrorMessage(createBudgetMutation.error, "Falha ao criar orçamento.")} /> : null}
      </Panel>
    </section>
  );
}

function GoalsPage({ session }: { session: ApiSession }) {
  const [goalPeriod, setGoalPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const [goalForm, setGoalForm] = useState(() => ({
    currentAmount: "0",
    description: "",
    name: "",
    targetAmount: "",
    targetDate: "",
  }));
  const queryClient = useQueryClient();
  const period = usePeriod(goalPeriod, setGoalPeriod);
  const summary = useQuery({
    queryKey: ["goals-summary", session.token, period.query],
    queryFn: () => getDashboardSummary(session, period.query),
  });
  const persistedGoals = useQuery({
    queryKey: ["goals", session.token],
    queryFn: () => getGoals(session),
  });
  const createGoalMutation = useMutation({
    mutationFn: () =>
      createGoal(session, {
        current_amount: goalForm.currentAmount || "0",
        description: goalForm.description || null,
        name: goalForm.name,
        target_amount: goalForm.targetAmount,
        target_date: goalForm.targetDate || null,
      }),
    onSuccess: () => {
      setGoalForm((current) => ({
        ...current,
        currentAmount: "0",
        description: "",
        name: "",
        targetAmount: "",
        targetDate: "",
      }));
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
  const goals = buildGoalRows(summary.data, persistedGoals.data?.items);
  const monthlyCapacity = Math.max(Number(summary.data?.balance ?? 0), 0);
  const averageProgress = goals.reduce((total, goal) => total + goal.ratio, 0) / Math.max(goals.length, 1);

  return (
    <section className="page-stack">
      <PeriodFilter period={period} />
      <div className="metric-grid executive">
        <MetricCard icon={Target} label="Metas ativas" value={String(goals.length)} helper="Planejamento inicial" tone="info" />
        <MetricCard icon={PiggyBank} label="Capacidade mensal" value={moneyAbs(monthlyCapacity)} helper="Fluxo líquido positivo do período" tone={monthlyCapacity > 0 ? "positive" : "warning"} />
        <MetricCard icon={Gauge} label="Progresso médio" value={`${formatPercentNumber(averageProgress * 100)}%`} helper="Sobre metas simuladas" tone="positive" />
        <MetricCard icon={CalendarDays} label="Próximo marco" value="90 dias" helper="Reserva de emergência" tone="warning" />
        <MetricCard icon={Sparkles} label="Sugestão" value={monthlyCapacity > 0 ? "Aportar" : "Revisar"} helper="Derivada do saldo do mês" tone={monthlyCapacity > 0 ? "positive" : "warning"} />
      </div>
      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Metas"
          title="Objetivos financeiros da família"
          description={persistedGoals.data?.items.length ? "Metas persistidas pelo backend de Planning." : "Primeira tela visual com metas simuladas enquanto nenhuma meta foi cadastrada."}
        />
        <div className="goal-grid">
          {goals.map((goal) => (
            <Panel key={goal.name} title={goal.name} description={goal.description}>
              <div className="goal-card-body">
                <div>
                  <strong>{moneyAbs(goal.current)} de {moneyAbs(goal.target)}</strong>
                  <small>{goal.deadline}</small>
                </div>
                <span className="progress-track large" aria-label={`${goal.name}: ${formatPercentNumber(goal.ratio * 100)}%`}>
                  <i className={goal.ratio >= 0.7 ? "positive" : "info"} style={{ width: `${Math.min(goal.ratio * 100, 100)}%` }} />
                </span>
                <div className="goal-footer">
                  <StatusBadge status={goal.ratio >= 0.7 ? "completed" : "pending"} label={goal.status} />
                  <b>{formatPercentNumber(goal.ratio * 100)}%</b>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>
      <Panel title="Nova meta" description="Cadastre objetivos financeiros para acompanhar progresso real.">
        <form
          className="inline-form form-grid two-columns"
          onSubmit={(event) => {
            event.preventDefault();
            createGoalMutation.mutate();
          }}
        >
          <label>
            Nome
            <input
              required
              value={goalForm.name}
              onChange={(event) => setGoalForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            Valor alvo
            <input
              min="0.01"
              required
              step="0.01"
              type="number"
              value={goalForm.targetAmount}
              onChange={(event) => setGoalForm((current) => ({ ...current, targetAmount: event.target.value }))}
            />
          </label>
          <label>
            Valor atual
            <input
              min="0"
              required
              step="0.01"
              type="number"
              value={goalForm.currentAmount}
              onChange={(event) => setGoalForm((current) => ({ ...current, currentAmount: event.target.value }))}
            />
          </label>
          <label>
            Prazo
            <input
              type="date"
              value={goalForm.targetDate}
              onChange={(event) => setGoalForm((current) => ({ ...current, targetDate: event.target.value }))}
            />
          </label>
          <label className="wide-field">
            Descrição
            <input
              value={goalForm.description}
              onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <button className="primary-button" disabled={createGoalMutation.isPending} type="submit">
            {createGoalMutation.isPending ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Criar meta
          </button>
        </form>
        {createGoalMutation.isError ? <InlineError message={apiErrorMessage(createGoalMutation.error, "Falha ao criar meta.")} /> : null}
      </Panel>
    </section>
  );
}

function PlanningPage({ session }: { session: ApiSession }) {
  const today = isoDate(new Date());
  const projection = useQuery({
    queryKey: ["planning-projection", session.token, today],
    queryFn: () => getPlanningProjection(session, `?date_from=${today}&horizons=30,60,90`),
  });
  const horizons = projection.data?.horizons ?? [];
  const firstHorizon = horizons[0];
  const finalHorizon = horizons[horizons.length - 1];
  const riskCount = horizons.filter((item) => item.risk_level === "risk").length;
  const eventCount = horizons.reduce((total, item) => Math.max(total, item.event_count), 0);

  if (projection.isLoading) {
    return <PageState icon={Loader2} title="Calculando projeção" description="Lendo eventos, metas e premissas." spin />;
  }

  if (projection.isError) {
    return (
      <PageState
        icon={AlertCircle}
        title="Não foi possível calcular a projeção"
        description="Confira a API local e tente novamente."
      />
    );
  }

  const data = projection.data;
  if (!data) {
    return <PageState icon={AlertCircle} title="Projeção indisponível" description="A API não retornou dados." />;
  }

  return (
    <section className="page-stack">
      <div className="metric-grid executive">
        <MetricCard
          icon={Presentation}
          label="Horizonte principal"
          value={finalHorizon ? `${finalHorizon.days} dias` : "90 dias"}
          helper={finalHorizon ? `Até ${dateLabel(finalHorizon.date_to)}` : "Projeção inicial"}
          tone="info"
        />
        <MetricCard
          icon={ArrowUpCircle}
          label="Entradas previstas"
          value={moneyAbs(finalHorizon?.projected_income)}
          helper="Eventos de receita planejados"
          tone="positive"
        />
        <MetricCard
          icon={ArrowDownCircle}
          label="Saídas previstas"
          value={moneyAbs(finalHorizon?.projected_expenses)}
          helper="Eventos de despesa planejados"
          tone={Number(finalHorizon?.projected_expenses ?? 0) > 0 ? "warning" : "info"}
        />
        <MetricCard
          icon={Gauge}
          label="Saldo projetado"
          value={money(finalHorizon?.projected_balance)}
          helper={finalHorizon?.risk_reason ?? "Sem eventos suficientes"}
          tone={projectionRiskTone(finalHorizon?.risk_level)}
        />
        <MetricCard
          icon={AlertCircle}
          label="Riscos"
          value={String(riskCount)}
          helper={`${eventCount} evento${eventCount === 1 ? "" : "s"} no cálculo`}
          tone={riskCount > 0 ? "negative" : "positive"}
        />
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Planejamento"
          title="Projeção dos próximos horizontes"
          description="Leitura operacional baseada nos eventos planejados, sem IA ou simulador avançado neste recorte."
        />
        <div className="projection-grid">
          {horizons.map((horizon) => (
            <Panel
              key={horizon.days}
              title={`${horizon.days} dias`}
              description={`Até ${dateLabel(horizon.date_to)}`}
            >
              <div className="projection-card-body">
                <strong className={projectionRiskTone(horizon.risk_level)}>
                  {money(horizon.projected_balance)}
                </strong>
                <span>
                  {moneyAbs(horizon.projected_income)} entrando · {moneyAbs(horizon.projected_expenses)} saindo
                </span>
                <StatusBadge label={projectionRiskLabel(horizon.risk_level)} status={projectionRiskStatus(horizon.risk_level)} />
                <small>{horizon.risk_reason}</small>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="dashboard-section two-columns">
        <Panel title="Eventos usados na projeção" description="Compromissos futuros vindos do Calendário Financeiro.">
          <div className="timeline-list compact">
            {data.upcoming_events.length ? data.upcoming_events.map((event) => (
              <div className={`timeline-item ${event.event_type === "income" ? "positive" : "warning"}`} key={`${event.title}-${event.due_date}`}>
                <span>{dateLabel(event.due_date)}</span>
                <div>
                  <b>{event.title}</b>
                  <small>{planningEventLabel(event.event_type)} · {event.recurrence === "monthly" ? "mensal" : "pontual"}</small>
                </div>
                <strong>{moneyAbs(event.amount)}</strong>
              </div>
            )) : (
              <p className="muted">Nenhum evento planejado encontrado para os próximos horizontes.</p>
            )}
          </div>
        </Panel>

        <Panel title="Metas no horizonte" description="Metas ativas com prazo dentro da janela projetada.">
          <div className="settings-list">
            {data.goals_due.length ? data.goals_due.map((goal) => (
              <QualityRow
                key={`${goal.name}-${goal.target_date ?? "sem-prazo"}`}
                label={goal.name}
                value={`${moneyAbs(goal.remaining_amount)} restantes`}
              />
            )) : (
              <QualityRow label="Metas com prazo" value="Nenhuma nos próximos 90 dias" />
            )}
            <QualityRow label="Primeiro horizonte" value={firstHorizon ? dateLabel(firstHorizon.date_to) : "30 dias"} />
          </div>
        </Panel>
      </section>

      <Panel title="Premissas da projeção" description="O que esta leitura considera neste primeiro recorte.">
        <div className="assumption-list">
          {data.assumptions.map((assumption) => (
            <span key={assumption}>
              <CheckCircle2 size={16} />
              {assumption}
            </span>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ReportsPage({
  onNavigate,
  session,
}: {
  onNavigate: (page: Page) => void;
  session: ApiSession;
}) {
  const [reportPeriod, setReportPeriod] = useState<PeriodState>(() => {
    const range = periodRange("current_month");
    return { ...range, periodPreset: "current_month" };
  });
  const period = usePeriod(reportPeriod, setReportPeriod);
  const reports = useQuery({
    queryKey: ["reports", session.token, period.query],
    queryFn: () => getReports(session, period.query),
  });
  const items = reports.data?.items ?? [];
  const readyCount = items.filter((item) => item.status === "ready").length;
  const partialCount = items.filter((item) => item.status === "partial").length;

  if (reports.isLoading) {
    return <PageState icon={Loader2} title="Carregando relatórios" description="Consolidando leituras do período." spin />;
  }

  if (reports.isError) {
    return (
      <PageState
        icon={AlertCircle}
        title="Não foi possível carregar relatórios"
        description="Confira a API local e tente novamente."
      />
    );
  }

  return (
    <section className="page-stack">
      <PeriodFilter period={period} />
      <div className="metric-grid executive">
        <MetricCard icon={ReceiptText} label="Relatórios" value={String(items.length)} helper="Disponíveis no MVP" tone="info" />
        <MetricCard icon={CheckCircle2} label="Com dados" value={String(readyCount)} helper="Prontos para leitura" tone="positive" />
        <MetricCard icon={AlertCircle} label="Parciais" value={String(partialCount)} helper="Consolidação em evolução" tone={partialCount > 0 ? "warning" : "positive"} />
        <MetricCard icon={FileUp} label="Exportação" value="Em breve" helper={reports.data?.export_status === "coming_soon" ? "PDF, CSV e XLSX planejados" : "Disponível"} tone="info" />
        <MetricCard icon={CalendarDays} label="Período" value={periodSummary(period) || "Todos"} helper="Filtro aplicado aos relatórios" tone="info" />
      </div>

      <section className="dashboard-section">
        <DashboardSectionHeader
          eyebrow="Relatórios"
          title="Leituras consolidadas"
          description="Primeira visão real de relatórios, usando dados e agregados já disponíveis no produto."
        />
        <div className="report-grid">
          {items.map((report) => (
            <button
              className="report-card"
              key={report.id}
              onClick={() => onNavigate(report.target_page as Page)}
              type="button"
            >
              <div>
                <StatusBadge label={reportStatusLabel(report.status)} status={reportStatusBadge(report.status)} />
                <h3>{report.title}</h3>
                <p>{report.description}</p>
              </div>
              <strong>{reportMetricLabel(report)}</strong>
              <small>{report.secondary_metric}</small>
            </button>
          ))}
        </div>
      </section>

      <Panel title="Exportação" description="Os formatos exportáveis ficam planejados para o próximo recorte.">
        <div className="settings-list">
          <QualityRow label="PDF" value="Em breve" />
          <QualityRow label="CSV" value="Em breve" />
          <QualityRow label="XLSX" value="Em breve" />
          <QualityRow label="Escopo atual" value="Leitura consolidada no app" />
        </div>
      </Panel>
    </section>
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
  const [sourceKindFilter, setSourceKindFilter] = useState("");
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);
  const [importActionMessage, setImportActionMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<BatchUploadProgress | null>(null);
  const [previewResults, setPreviewResults] = useState<BatchPreviewResult[]>([]);
  const [uploadSourceKind, setUploadSourceKind] = useState("auto");
  const [linkCardId, setLinkCardId] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (issueFilter === "with_errors") params.set("has_errors", "true");
    if (sourceKindFilter) params.set("source_kind", sourceKindFilter);
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return `?${params.toString()}`;
  }, [issueFilter, page, search, sourceKindFilter, statusFilter]);
  const imports = useQuery({
    queryKey: ["imports", session.token, query],
    queryFn: () => getImports(session, query),
  });
  const importCards = useQuery({
    queryKey: ["credit-cards", session.token, "import-link"],
    queryFn: () => getCreditCards(session),
  });
  const importStatements = useQuery({
    queryKey: ["credit-card-statements", session.token, "import-link"],
    queryFn: () => getCreditCardStatements(session, ""),
  });
  const importCardsById = useMemo(
    () => new Map((importCards.data?.items ?? []).map((card) => [card.id, card])),
    [importCards.data?.items],
  );
  const selectedImportJob = (imports.data?.items ?? []).find((item) => item.id === selectedImport);
  const selectedLinkedStatement = useMemo(
    () =>
      (importStatements.data?.items ?? []).find(
        (statement) => statement.source_file_id === selectedImportJob?.source_file_id,
      ),
    [importStatements.data?.items, selectedImportJob?.source_file_id],
  );
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
  const linkImportCard = useMutation({
    mutationFn: () => {
      if (!selectedImportJob?.source_file_id || !linkCardId) {
        throw new Error("Selecione um cartão para associar.");
      }
      return associateCreditCardSourceFile(session, linkCardId, selectedImportJob.source_file_id);
    },
    onSuccess: () => {
      setImportActionMessage("Importação associada ao cartão selecionado. A fatura foi criada ou atualizada pelo arquivo.");
      setLinkCardId("");
      void queryClient.invalidateQueries({ queryKey: ["credit-card-statements"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
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
          const result = await uploadImport(
            session,
            file,
            uploadSourceKind,
          );
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
      void queryClient.invalidateQueries({ queryKey: ["credit-card-statements"] });
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
      <Panel title="Upload" description="MVP aceita extrato TXT/Excel e fatura CSV. PDF fica para fase posterior.">
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
              <option value="bank_statement_excel">Extrato Excel</option>
              <option value="credit_card_csv">Fatura CSV</option>
            </select>
          </label>
        </div>
        <label className="upload-zone">
          <UploadCloud size={28} />
          <strong>
            {preview.isPending ? "Gerando prévia..." : upload.isPending ? "Importando lote..." : "Selecionar arquivos"}
          </strong>
          <span>Selecione um ou mais TXT/CSV/XLS, revise a prévia e confirme para gravar.</span>
          <span>Para dezenas de arquivos, prefira blocos de até {RECOMMENDED_BATCH_FILE_LIMIT}; o MVP processa um arquivo por vez.</span>
          <input
            accept=".txt,.csv,.xls,text/plain,text/csv,application/vnd.ms-excel"
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
          <label>
            <FileUp size={16} />
            <select
              value={sourceKindFilter}
              onChange={(event) => {
                setSourceKindFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos os tipos</option>
              <option value="bank_statement_txt">Extrato TXT</option>
              <option value="bank_statement_excel">Extrato Excel</option>
              <option value="credit_card_csv">Fatura CSV</option>
              <option value="unknown">Desconhecido</option>
            </select>
          </label>
          <button
            className="ghost-button filter-clear"
            disabled={!search && !statusFilter && !issueFilter && !sourceKindFilter}
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setIssueFilter("");
              setSourceKindFilter("");
              setPage(0);
            }}
            type="button"
          >
            Limpar filtros
          </button>
        </div>
        <div className="filter-summary">
          <span>{importFilterSummary({ issueFilter, search, sourceKindFilter, statusFilter })}</span>
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
          {selectedImportJob?.source_file_id ? (
            <div className="form-card">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Detecção</p>
                  <h3>Associar importação ao cartão</h3>
                </div>
                <StatusBadge status={selectedLinkedStatement ? "completed" : "pending"} />
              </div>
              <div className="settings-list">
                <QualityRow
                  label="Cartão atual"
                  value={
                    selectedLinkedStatement
                      ? statementImportLabel(
                          selectedLinkedStatement,
                          importCardsById.get(selectedLinkedStatement.credit_card_id),
                        )
                      : "Sem cartão associado"
                  }
                />
              </div>
              <div className="inline-form">
                <label>
                  Cartão
                  <select
                    disabled={linkImportCard.isPending || importCards.isLoading}
                    value={linkCardId}
                    onChange={(event) => setLinkCardId(event.target.value)}
                  >
                    <option value="">Selecionar cartão</option>
                    {(importCards.data?.items ?? []).map((card) => (
                      <option key={card.id} value={card.id}>
                        {cardLabel(card)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary-button"
                  disabled={!linkCardId || linkImportCard.isPending}
                  onClick={() => linkImportCard.mutate()}
                  type="button"
                >
                  {linkImportCard.isPending ? <Loader2 className="spin" size={16} /> : <LinkIcon size={16} />}
                  Associar
                </button>
              </div>
              {linkImportCard.isError ? (
                <InlineError message={apiErrorMessage(linkImportCard.error, "Falha ao associar cartão.")} />
              ) : null}
            </div>
          ) : null}
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
      void queryClient.invalidateQueries({ queryKey: ["credit-card-statements"] });
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

function CreditCardList({
  items,
  loading,
  onEditCard,
}: {
  items: CreditCardRead[];
  loading: boolean;
  onEditCard: (card: CreditCardRead) => void;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando cartões" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhum cartão detectado ainda. Importe uma fatura para começar." />;
  return (
    <div className="quality-list">
      {items.map((card) => (
        <div className="payment-match-row" key={card.id}>
          <div>
            <strong>{cardLabel(card)}</strong>
            <small>
              Fecha {card.closing_day} · vence {card.due_day}
              {card.issuer ? ` · ${card.issuer}` : ""}
              {card.brand ? ` · ${card.brand}` : ""}
            </small>
          </div>
          <button className="ghost-button compact" onClick={() => onEditCard(card)} type="button">
            Editar
          </button>
        </div>
      ))}
    </div>
  );
}

function CreditCardStatementList({
  cards,
  items,
  loading,
}: {
  cards: CreditCardRead[];
  items: CreditCardStatementRead[];
  loading: boolean;
}) {
  if (loading) return <PageState icon={Loader2} title="Carregando faturas" description="Aguarde um momento." spin compact />;
  if (!items.length) return <EmptyInline message="Nenhuma fatura detectada ainda. Importe uma fatura ou ajuste manualmente se precisar." />;
  const cardById = new Map(cards.map((card) => [card.id, card]));
  return (
    <div className="quality-list">
      {items.map((statement) => (
        <QualityRow
          key={statement.id}
          label={`${cardById.get(statement.credit_card_id)?.name ?? "Cartão"} · ${monthYearLabel(statement.statement_month)}`}
          value={`${dateLabel(statement.due_date)} · ${moneyAbs(statement.total_amount ?? 0)} · ${statementStatusLabel(statement.status)}`}
        />
      ))}
    </div>
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
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="panel-link" onClick={onClick} type="button">
      {label}
      <ChevronRight size={14} />
    </button>
  );
}

function MetricCard({
  className,
  icon: Icon,
  label,
  value,
  helper,
  helpText,
  onClick,
  title,
  tone,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  helpText?: string;
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

  const tooltipText = helpText ?? helper;

  return (
    <div
      className={["metric-card", onClick ? "clickable" : "", tone ? `tone-${tone}` : "", className ?? ""].filter(Boolean).join(" ")}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="metric-top">
        <span>{label}</span>
        <HelpIcon icon={Icon} label={label} text={tooltipText} />
      </div>
      <strong className={tone} title={title}>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function HelpIcon({
  icon: Icon,
  label,
  text,
}: {
  icon: LucideIcon;
  label: string;
  text?: string;
}) {
  if (!text) {
    return <Icon aria-hidden="true" size={20} />;
  }
  return (
    <span className="help-tooltip">
      <button aria-label={`Explicação: ${label}`} onClick={(event) => event.stopPropagation()} type="button">
        <Icon aria-hidden="true" size={20} />
      </button>
      <span role="tooltip">{text}</span>
    </span>
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

function PeriodFilter({
  period,
  variant,
}: {
  period: ReturnType<typeof usePeriod>;
  variant?: "compact";
}) {
  return (
    <div className={`period-filter${variant ? ` ${variant}` : ""}`}>
      <label className="period-filter-label">
        Período analisado
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
      </label>
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

function nextDaysRange(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(days - 1, 0));
  return {
    dateFrom: isoDate(start),
    dateTo: isoDate(end),
  };
}

function projectionRangeFromPeriod(dateFrom: string, dateTo: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedStart = parseIsoDate(dateFrom);
  const parsedEnd = parseIsoDate(dateTo);
  const end = parsedEnd ?? new Date(today.getTime() + 29 * 86_400_000);
  end.setHours(0, 0, 0, 0);
  if (end < today) return null;
  const start = parsedStart && parsedStart > today ? parsedStart : today;
  start.setHours(0, 0, 0, 0);
  if (start > end) return null;
  return {
    dateFrom: isoDate(start),
    dateTo: isoDate(end),
    horizonDays: Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
  };
}

function creditCardDueDateInRange(dateFrom: string, dateTo: string, dueDay?: number) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  if (!start || !end || !dueDay) return dateFrom;
  const candidates = [
    new Date(start.getFullYear(), start.getMonth(), dueDay),
    new Date(start.getFullYear(), start.getMonth() + 1, dueDay),
  ];
  const match = candidates.find((candidate) => candidate >= start && candidate <= end);
  return isoDate(match ?? start);
}

function daysFromToday(value: string) {
  const target = parseIsoDate(value);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

function pageMeta(page: Page) {
  const pages: Record<Page, { description: string; title: string }> = {
    cashflow: {
      description: "Entenda entradas, saídas, faturas e tendência mensal do dinheiro.",
      title: "Fluxo de caixa",
    },
    calendar: {
      description: "Veja compromissos, recorrências e parcelas que impactam os próximos dias.",
      title: "Calendário financeiro",
    },
    cards: {
      description: "Acompanhe fatura, parcelas, compras no cartão e conciliação com a conta.",
      title: "Cartões",
    },
    budgets: {
      description: "Monitore limites por categoria e identifique onde ajustar o mês.",
      title: "Orçamentos",
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
    goals: {
      description: "Acompanhe objetivos financeiros e a capacidade mensal para avançar.",
      title: "Metas",
    },
    planning: {
      description: "Veja horizontes de caixa, riscos e premissas para os próximos passos.",
      title: "Planejamento",
    },
    reports: {
      description: "Consolide leituras financeiras e prepare exportações futuras.",
      title: "Relatórios",
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
  sourceKindFilter,
  statusFilter,
}: {
  issueFilter: string;
  search: string;
  sourceKindFilter: string;
  statusFilter: string;
}) {
  const parts: string[] = [];
  if (search) parts.push(`arquivo "${search}"`);
  if (statusFilter) parts.push(statusLabel(statusFilter));
  if (issueFilter === "with_errors") parts.push("somente com erros");
  if (sourceKindFilter) parts.push(sourceKindLabel(sourceKindFilter));
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

function cashflowPageDescription(period: ReturnType<typeof usePeriod>, view: "day" | "month") {
  if (view === "day") {
    return "Receitas e despesas por dia, com saldo acumulado partindo do saldo inicial.";
  }
  return cashflowDescription(period);
}

function dashboardCashflowDescription(period: ReturnType<typeof usePeriod>, view: "day" | "month") {
  if (view === "day") {
    return "Receitas e despesas por dia do caixa; cartão usa vencimento da fatura quando identificado.";
  }
  return cashflowDescription(period);
}

function monthTickLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${labels[month - 1]}/${String(year).slice(-2)}`;
}

function dayTickLabel(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${date.getDate()} ${labels[date.getMonth()]}`;
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

function projectionRiskTone(
  riskLevel?: PlanningProjection["horizons"][number]["risk_level"],
): "positive" | "negative" | "warning" | "info" {
  if (riskLevel === "risk") return "negative";
  if (riskLevel === "attention") return "warning";
  if (riskLevel === "healthy") return "positive";
  return "info";
}

function projectionRiskStatus(riskLevel?: string) {
  if (riskLevel === "risk") return "failed";
  if (riskLevel === "attention") return "completed_with_errors";
  return "completed";
}

function projectionRiskLabel(riskLevel?: string) {
  const labels: Record<string, string> = {
    attention: "Atenção",
    healthy: "Saudável",
    risk: "Risco",
  };
  return riskLevel ? labels[riskLevel] ?? riskLevel : "Sem leitura";
}

function planningEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    card_payment: "Fatura",
    expense: "Despesa",
    goal: "Meta",
    income: "Receita",
    other: "Outro",
    subscription: "Assinatura",
  };
  return labels[eventType] ?? eventType;
}

function cardLabel(card: CreditCardRead) {
  const suffix = card.last_four ? ` final ${card.last_four}` : "";
  return `${card.name}${suffix}`;
}

function statementImportLabel(statement: CreditCardStatementRead, card?: CreditCardRead) {
  const cardName = card ? cardLabel(card) : "Cartão";
  return `${cardName} · ${monthYearLabel(statement.statement_month)} · vence ${statement.due_date} · ${statementStatusLabel(statement.status)}`;
}

function statementStatusLabel(status: string) {
  const labels: Record<string, string> = {
    closed: "Fechada",
    open: "Aberta",
    paid: "Paga",
    partial: "Parcial",
  };
  return labels[status] ?? status;
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    empty: "Sem dados",
    partial: "Parcial",
    ready: "Com dados",
  };
  return labels[status] ?? status;
}

function reportStatusBadge(status: string) {
  if (status === "ready") return "completed";
  if (status === "partial") return "completed_with_errors";
  return "pending";
}

function reportMetricLabel(report: ReportCardRead) {
  if (["budgets", "goals", "planning-events"].includes(report.id)) return report.primary_metric;
  if (report.id === "data-quality") return report.primary_metric;
  return money(report.primary_metric);
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

function formatCurrencyCompactSigned(value?: string | number | null) {
  const numeric = Number(value ?? 0);
  const sign = numeric < 0 ? "-" : "";
  return `${sign}${formatCurrencyCompact(numeric)}`;
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
  tone: "info" | "negative" | "warning";
  transactionDrilldown?: TransactionDrilldown;
}> {
  const alerts: Array<{
    description: string;
    icon: LucideIcon;
    importDrilldown?: ImportDrilldown;
    target?: Page;
    title: string;
    tone: "info" | "negative" | "warning";
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

function alertSeverityLabel(tone: "info" | "negative" | "warning") {
  if (tone === "negative") return "Crítico";
  if (tone === "warning") return "Atenção";
  return "Informação";
}

function chartSeriesLabel(name: string) {
  const labels: Record<string, string> = {
    amount: "Valor",
    balance: "Saldo",
    expenses: "Despesas",
    income: "Receita",
    payments: "Pgto. fatura",
    projectedBalance: "Saldo projetado",
  };
  return labels[name] ?? name;
}

function chartMoneyLabel(value: string, name: string) {
  if (["expenses", "Despesas"].includes(name)) return money(value);
  return ["balance", "projectedBalance", "Saldo", "Saldo acumulado", "Saldo previsto", "Saldo projetado"].includes(name)
    ? money(value)
    : moneyAbs(value);
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function commitmentTone(value?: string | null): "positive" | "negative" | "warning" {
  if (!value) return "warning";
  const ratio = Number(value);
  if (ratio < 0.7) return "positive";
  if (ratio < 0.85) return "warning";
  return "negative";
}

function commitmentStatus(value: number | null): { label: string; tone: "positive" | "negative" | "warning" | "info" } {
  if (value === null) return { label: "Sem receita no período", tone: "info" };
  if (value < 0.5) return { label: "Excelente", tone: "positive" };
  if (value < 0.8) return { label: "Atenção", tone: "warning" };
  return { label: "Risco", tone: "negative" };
}

function financialHealthLabel(score: number) {
  if (score >= 80) return "Saudável";
  if (score >= 60) return "Atenção leve";
  if (score >= 40) return "Atenção";
  return "Risco";
}

function financialHealthTone(score: number): "positive" | "negative" | "warning" | "info" {
  if (score >= 80) return "positive";
  if (score >= 40) return "warning";
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
    bank_statement_excel: "Extrato Excel",
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
