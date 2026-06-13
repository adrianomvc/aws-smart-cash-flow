import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useRef, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Loader2,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Tags,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  login as apiLogin,
  signup as apiSignup,
  resetPassword as apiResetPassword,
  type ApiSession,
  getCurrentWorkspace,
  getTransactionDuplicates,
} from "./lib/api";
import { pageMeta, periodRange } from "./lib/utils";
import smartCashFlowLogo from "./assets/logo-smartcash-flow-main.png";
import type { ImportDrilldown, PeriodState, TransactionDrilldown, TransactionPeriodPreset } from "./types";
import type { Page } from "./types";
import { PageState } from "./components/ui";

// Pages
import { DashboardPage } from "./pages/DashboardPage";
import { CashflowPage } from "./pages/CashflowPage";
import { CalendarPage } from "./pages/CalendarPage";
import { CardsPage } from "./pages/CardsPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { GoalsPage } from "./pages/GoalsPage";
import { PlanningPage } from "./pages/PlanningPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ImportsPage, TransactionsPage } from "./pages/ImportsPage";
import { CategoriesPage, ReviewPage, RulesPage } from "./pages/CategoriesPage";
import { SettingsPage } from "./pages/SettingsPage";

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes("replace-me")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ---------------------------------------------------------------------------
// Proto icons — caminhos SVG idênticos ao protótipo (icons.jsx)
// ---------------------------------------------------------------------------

const ICON_PATHS: Record<string, string> = {
  chevL:    "M15 18l-6-6 6-6",
  chevR:    "M9 18l6-6-6-6",
  chevD:    "M6 9l6 6 6-6",
  chevU:    "M18 15l-6-6-6 6",
  gauge:    "M12 14l4-4 M3.5 12a8.5 8.5 0 0 1 17 0 M12 14a2 2 0 1 0 0-4",
  flow:     "M4 6h10 M4 6l3-3 M4 6l3 3 M20 18H10 M20 18l-3-3 M20 18l-3 3 M4 12h16",
  list:     "M8 6h12 M8 12h12 M8 18h12 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01",
  calendar: "M3 9h18 M7 3v3 M17 3v3 M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M9 13h2v2H9z",
  card:     "M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M2 11h20 M6 15h3",
  target:   "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  flag:     "M5 21V4 M5 4h11l-2 3 2 3H5",
  trend:    "M3 17l6-6 4 4 8-8 M21 7v5 M21 7h-5",
  sliders:  "M4 8h10 M18 8h2 M4 16h2 M10 16h10 M14 6v4 M6 14v4",
  coins:    "M9 9m-6 0a6 3 0 1 0 12 0a6 3 0 1 0-12 0 M3 9v5c0 1.66 2.7 3 6 3 M3 11.5c0 1.66 2.7 3 6 3 M15 6c3.3 0 6 1.34 6 3v6c0 1.66-2.7 3-6 3-1.1 0-2.13-.15-3-.41",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M15 9h4a1 1 0 0 1 1 1v11 M4 21h17 M8 8h3 M8 12h3 M8 16h3",
  report:   "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M8 13l2 2 3-4 M8 18h6",
  spark:    "M12 4l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z M18 16l.7 2 .3.7 2 .3-2 .8-.7 2-.8-2-2-.3 2-.8z",
  users:    "M16 19v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2 M9.5 7.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M21 19v-2a3 3 0 0 0-2.2-2.9 M16 4.2a3 3 0 0 1 0 5.8",
  receipt:  "M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z M9 8h6 M9 12h6 M9 16h3",
  cog:      "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.3-2.5H10.7l-.3 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.3 2.5h2.6l.3-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.07-.4.1-.8.1-1.2z",
  upload:   "M12 16V4 M8 8l4-4 4 4 M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  tag:      "M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z M7 7h.01",
  edit:     "M16 4l4 4-11 11H5v-4z M13.5 6.5l4 4",
  shield:   "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4",
  search:   "M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M21 21l-4.3-4.3",
  bell:     "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  moon:     "M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10z",
  sun:      "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41",
  plus:     "M12 5v14 M5 12h14",
  repeat:   "M4 9l3-3 3 3 M7 6v9a2 2 0 0 0 2 2h11 M20 15l-3 3-3-3 M17 18V9a2 2 0 0 0-2-2H4",
};

function NavIcon({ name, size = 16 }: { name: string; size?: number }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }}
    >
      {segs.map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type NavItem = { id?: Page; label: string; iconName: string; status?: string };

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Visão",
    items: [
      { id: "dashboard",    label: "Dashboard",       iconName: "gauge" },
      { id: "cashflow",     label: "Fluxo de Caixa",  iconName: "flow" },
      { id: "transactions", label: "Transações",       iconName: "list" },
      { id: "categories",   label: "Categorias",       iconName: "tag" },
      { id: "calendar",     label: "Calendário",       iconName: "calendar" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { id: "cards",    label: "Cartões",         iconName: "card" },
      { id: "budgets",  label: "Orçamentos",      iconName: "target" },
      { id: "goals",    label: "Metas",           iconName: "flag" },
      { id: "planning", label: "Planejamento",    iconName: "trend" },
      { label: "Cenários",         iconName: "sliders",  status: "em breve" },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { id: "reports",  label: "Relatórios",      iconName: "report" },
      { label: "Insights IA",      iconName: "spark",    status: "em breve" },
      { label: "Investimentos",    iconName: "coins",    status: "em breve" },
      { label: "Patrimônio",       iconName: "building", status: "em breve" },
    ],
  },
  {
    label: "Conta",
    items: [
      { id: "review",   label: "Revisão",         iconName: "shield" },
      { label: "Família / Membros", iconName: "users", status: "em breve" },
      { id: "settings", label: "Configurações",   iconName: "cog" },
    ],
  },
];

// ---------------------------------------------------------------------------
// ThemeToggle — persiste em localStorage, aplica data-theme no <html>
// ---------------------------------------------------------------------------

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("scf-theme") as "light" | "dark") || "light"; }
    catch { return "light"; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("scf-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
      type="button"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BottomNav — mobile (≤880px)
// ---------------------------------------------------------------------------

function BottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const items: Array<{ id: Page; label: string; Icon: LucideIcon; fab?: boolean }> = [
    { id: "dashboard",    label: "Início",      Icon: LayoutDashboard },
    { id: "cashflow",     label: "Fluxo",       Icon: BarChart3 },
    { id: "transactions", label: "Nova",         Icon: Upload, fab: true },
    { id: "categories",   label: "Categorias",  Icon: Tags },
    { id: "settings",     label: "Mais",        Icon: Settings },
  ];
  return (
    <nav className="bottom-nav">
      {items.map(({ id, label, Icon, fab }) => (
        <button
          key={id}
          className={`${fab ? "fab" : ""}${!fab && page === id ? " active" : ""}`}
          onClick={() => setPage(id)}
          type="button"
        >
          <Icon size={fab ? 24 : 21} />
          {!fab && <span>{label}</span>}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

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

  const duplicateCountQuery = useQuery({
    queryKey: ["duplicate-count-badge", session?.token],
    queryFn: () => getTransactionDuplicates(session!, "?limit=1&offset=0"),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
  const duplicateCount = duplicateCountQuery.data?.total_groups ?? 0;

  const workspaceQuery = useQuery({
    queryKey: ["workspace", session?.token],
    queryFn: () => getCurrentWorkspace(session!),
    enabled: Boolean(session),
    staleTime: 10 * 60 * 1000,
  });
  const workspaceName = workspaceQuery.data?.workspace_name;

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
      workspaceName={workspaceName}
      duplicateCount={duplicateCount}
    >
      <ProtectedApp
        dashboardPeriod={dashboardPeriod}
        duplicateCount={duplicateCount}
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

// ---------------------------------------------------------------------------
// LoginScreen
// ---------------------------------------------------------------------------

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
        const response = await apiLogin({ email, password });
        onLogin({ token: response.access_token, mode: "supabase" });
      } else {
        await apiSignup({ email, password, display_name: displayName || undefined });
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
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} />
          </label>
          {!isLogin && (
            <label>
              Nome (opcional)
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} type="text" />
            </label>
          )}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={16} /> : null}
            {isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <div className="login-actions">
          {supabase ? (
            <button className="ghost-button" onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }} type="button">
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
        <button className="ghost-button full" onClick={() => onLogin({ token: "local-dev", mode: "local" })}>
          {supabase ? "Entrar em modo local (MVP)" : "Acessar demonstração MVP"}
        </button>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

function AppShell({
  children,
  page,
  setPage,
  onLogout,
  workspaceName,
  duplicateCount = 0,
}: {
  children: ReactNode;
  page: Page;
  setPage: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onLogout: () => void;
  workspaceName?: string;
  duplicateCount?: number;
}) {
  const initials = (workspaceName ?? "Local workspace")
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "WS";

  return (
    <div className="app">
      <aside className="side">
        {/* Brand / logo */}
        <div className="side-brand">
          <img src={smartCashFlowLogo} alt="SmartCashFlow" className="brand-logo" style={{ maxWidth: 180 }} />
        </div>

        {/* Nav */}
        <div className="side-scroll">
          {navSections.map((section) => (
            <div className="nav-group" key={section.label}>
              <div className="nav-label">{section.label}</div>
              {section.items.map((item) => {
                const isActive = item.id === page;
                const isDisabled = !item.id;
                const showDupBadge = item.id === "transactions" && duplicateCount > 0;
                return (
                  <button
                    className={`nav-item${isActive ? " active" : ""}`}
                    disabled={isDisabled}
                    key={`${item.label}-${item.id ?? "future"}`}
                    onClick={() => { if (!item.id) return; setPage(item.id); }}
                    title={isDisabled ? `${item.label} — em breve` : item.label}
                  >
                    <NavIcon name={item.iconName} size={17} />
                    <span>{item.label}</span>
                    {item.status ? <span className="nav-badge soon">{item.status}</span> : null}
                    {showDupBadge ? (
                      <span className="nav-badge count">{duplicateCount > 99 ? "99+" : duplicateCount}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer — workspace + logout */}
        <div className="side-foot">
          <button className="ws-switch" onClick={onLogout} title="Clique para sair">
            <div className="ws-avatar" style={{ background: "var(--grad-brand)" }}>
              {initials}
            </div>
            <div className="ws-meta">
              <div className="ws-name">{workspaceName ?? "Local workspace"}</div>
              <div className="ws-role">Owner · sair</div>
            </div>
            <LogOut size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />
          </button>
        </div>
      </aside>

      <div className="main">
        {children}
      </div>

      <BottomNav page={page} setPage={setPage} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProtectedApp
// ---------------------------------------------------------------------------

function ProtectedApp({
  dashboardPeriod,
  duplicateCount = 0,
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
  duplicateCount?: number;
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
      <Topbar
        dashboardPeriod={dashboardPeriod}
        setDashboardPeriod={setDashboardPeriod}
        duplicateCount={duplicateCount}
        onNavigate={onNavigate}
        onOpenTransactions={onOpenTransactions}
        page={page}
      />
      {page === "dashboard" ? (
        <DashboardPage
          dashboardPeriod={dashboardPeriod}
          onNavigate={onNavigate}
          onOpenImports={onOpenImports}
          onOpenTransactions={onOpenTransactions}
          session={session}
          setDashboardPeriod={setDashboardPeriod}
          workspaceName={workspace.workspace_name}
        />
      ) : null}
      {page === "cashflow" ? <CashflowPage onNavigate={onNavigate} onOpenTransactions={onOpenTransactions} session={session} period={dashboardPeriod} setPeriod={setDashboardPeriod} /> : null}
      {page === "calendar" ? <CalendarPage onOpenTransactions={onOpenTransactions} period={dashboardPeriod} session={session} setPeriod={setDashboardPeriod} /> : null}
      {page === "cards" ? <CardsPage onOpenTransactions={onOpenTransactions} period={dashboardPeriod} session={session} setPeriod={setDashboardPeriod} /> : null}
      {page === "budgets" ? <BudgetsPage onOpenTransactions={onOpenTransactions} period={dashboardPeriod} setPeriod={setDashboardPeriod} session={session} /> : null}
      {page === "goals" ? <GoalsPage session={session} period={dashboardPeriod} setPeriod={setDashboardPeriod} /> : null}
      {page === "planning" ? <PlanningPage session={session} onNavigate={onNavigate} /> : null}
      {page === "reports" ? <ReportsPage onNavigate={onNavigate} session={session} /> : null}
      {page === "imports" ? <ImportsPage drilldown={importDrilldown} onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "transactions" ? <TransactionsPage drilldown={transactionDrilldown} session={session} /> : null}
      {page === "categories" ? <CategoriesPage session={session} period={dashboardPeriod} onOpenTransactions={onOpenTransactions} /> : null}
      {page === "rules" ? <RulesPage session={session} /> : null}
      {page === "review" ? <ReviewPage session={session} /> : null}
      {page === "settings" ? <SettingsPage onNavigate={onNavigate} onOpenTransactions={onOpenTransactions} workspaceName={workspace.workspace_name} session={session} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// DashboardPeriodPicker
// ---------------------------------------------------------------------------

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const MONTHS_SHORT_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Returns the {year, month} when the period represents a single month, else null.
function monthOf(p: PeriodState): { y: number; m: number } | null {
  if (p.periodPreset === "current_year" || p.periodPreset === "previous_year" || p.periodPreset === "all") return null;
  if (!p.dateFrom) return null;
  const from = new Date(p.dateFrom + "T12:00:00");
  if (from.getDate() !== 1) return null;
  if (!p.dateTo) return { y: from.getFullYear(), m: from.getMonth() };
  const to = new Date(p.dateTo + "T12:00:00");
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return { y: from.getFullYear(), m: from.getMonth() };
  }
  return null;
}

function isLast3Months(p: PeriodState): boolean {
  if (p.periodPreset !== "custom" || !p.dateFrom || !p.dateTo || monthOf(p)) return false;
  const diff = Math.round((new Date(p.dateTo).getTime() - new Date(p.dateFrom).getTime()) / 86400000);
  return diff >= 80 && diff <= 100;
}

function periodLabel(period: PeriodState): string {
  const mo = monthOf(period);
  if (mo) return MONTHS_PT[mo.m] + " " + mo.y;
  if (period.periodPreset === "current_year") return "Este ano";
  if (period.periodPreset === "previous_year") return "Ano anterior";
  if (period.periodPreset === "all") return "Todo período";
  if (isLast3Months(period)) return "Últimos 3 meses";
  if (period.dateFrom && period.dateTo) {
    return period.dateFrom.slice(5).replace("-", "/") + " → " + period.dateTo.slice(5).replace("-", "/");
  }
  return "Período";
}

function DashboardPeriodPicker({ period, onChange }: { period: PeriodState; onChange: (p: PeriodState) => void }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const selMonth = monthOf(period);
  const [viewYear, setViewYear] = useState(selMonth?.y ?? now.getFullYear());

  useEffect(() => {
    if (!open) return;
    setViewYear(selMonth?.y ?? now.getFullYear());
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, period.dateFrom]);

  // Set the period to a whole month (month0 is 0-based).
  function applyMonth(year: number, month0: number) {
    const from = new Date(year, month0, 1);
    const to = new Date(year, month0 + 1, 0);
    const isCurrent = year === now.getFullYear() && month0 === now.getMonth();
    onChange({ dateFrom: fmtDate(from), dateTo: fmtDate(to), periodPreset: isCurrent ? "current_month" : "custom" });
    setOpen(false);
  }

  // Arrows always navigate by month. From a range, they "land" on a month
  // (anchored on the current selection's month, or today's month).
  function shiftMonth(dir: -1 | 1) {
    const anchor = selMonth ?? { y: now.getFullYear(), m: now.getMonth() };
    const d = new Date(anchor.y, anchor.m + dir, 1);
    applyMonth(d.getFullYear(), d.getMonth());
  }

  function applyPreset(preset: TransactionPeriodPreset) {
    onChange({ ...periodRange(preset), periodPreset: preset });
    setOpen(false);
  }
  function apply3Months() {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    onChange({ dateFrom: fmtDate(from), dateTo: fmtDate(to), periodPreset: "custom" });
    setOpen(false);
  }

  const quick: [string, boolean, () => void][] = [
    ["Mês atual", Boolean(selMonth && selMonth.y === now.getFullYear() && selMonth.m === now.getMonth()), () => applyMonth(now.getFullYear(), now.getMonth())],
    ["Últimos 3 meses", isLast3Months(period), apply3Months],
    ["Este ano", period.periodPreset === "current_year", () => applyPreset("current_year")],
    ["Tudo", period.periodPreset === "all", () => applyPreset("all")],
  ];

  return (
    <div style={{ position: "relative" }} ref={wrapperRef}>
      <div className="period">
        <button className="period-arrow" onClick={() => shiftMonth(-1)} type="button" title="Mês anterior">
          <NavIcon name="chevL" size={15} />
        </button>
        <button
          className="period-current"
          onClick={() => setOpen(v => !v)}
          type="button"
          style={{ cursor: "pointer", background: "none", border: "none", gap: 6, color: "inherit" }}
        >
          <NavIcon name="calendar" size={14} />
          <span>{periodLabel(period)}</span>
          <NavIcon name="chevD" size={12} />
        </button>
        <button className="period-arrow" onClick={() => shiftMonth(1)} type="button" title="Próximo mês">
          <NavIcon name="chevR" size={15} />
        </button>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: "var(--card)", border: "1px solid var(--line)",
          borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.12)",
          padding: 14, zIndex: 200, width: 256,
        }}>
          {/* Quick ranges */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {quick.map(([label, active, action]) => (
              <button
                key={label}
                type="button"
                onClick={action}
                style={{
                  padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", textAlign: "left", transition: "all .12s",
                  border: "1px solid " + (active ? "var(--acc)" : "var(--line)"),
                  background: active ? "var(--acc-soft)" : "var(--bg)",
                  color: active ? "var(--acc)" : "var(--ink-2)",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: "var(--line)", margin: "0 0 12px" }} />

          {/* Year stepper */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button className="period-arrow" onClick={() => setViewYear(y => y - 1)} type="button" title="Ano anterior">
              <NavIcon name="chevL" size={15} />
            </button>
            <strong style={{ fontSize: 14, fontFamily: "var(--font-mono)" }}>{viewYear}</strong>
            <button className="period-arrow" onClick={() => setViewYear(y => y + 1)} type="button" title="Próximo ano">
              <NavIcon name="chevR" size={15} />
            </button>
          </div>
          {/* Month grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {MONTHS_SHORT_PT.map((m, i) => {
              const isSel = Boolean(selMonth && viewYear === selMonth.y && i === selMonth.m);
              const isThis = viewYear === now.getFullYear() && i === now.getMonth();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => applyMonth(viewYear, i)}
                  style={{
                    padding: "8px 6px", borderRadius: 8, fontSize: 12.5, cursor: "pointer",
                    fontWeight: isSel ? 700 : 500, transition: "all .12s",
                    border: "1px solid " + (isSel ? "var(--acc)" : "var(--line)"),
                    background: isSel ? "var(--acc)" : "var(--bg)",
                    color: isSel ? "#fff" : isThis ? "var(--acc)" : "var(--ink-2)",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topbar
// ---------------------------------------------------------------------------

function getPageSection(page: Page): string {
  for (const section of navSections) {
    if (section.items.some((item) => item.id === page)) return section.label;
  }
  return "";
}

function Topbar({
  dashboardPeriod,
  setDashboardPeriod,
  duplicateCount = 0,
  onNavigate,
  onOpenTransactions,
  page,
}: {
  dashboardPeriod: PeriodState;
  setDashboardPeriod: Dispatch<SetStateAction<PeriodState>>;
  duplicateCount?: number;
  onNavigate: (page: Page) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  page: Page;
}) {
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const meta = pageMeta(page);
  const sectionLabel = getPageSection(page);

  return (
    <header className="header">
      <div className="h-title">
        {sectionLabel ? (
          <div className="h-crumb">{sectionLabel} / {meta.title}</div>
        ) : null}
        <div className="h-name">{meta.title}</div>
      </div>
      <div className="h-spacer" />
      <div className="h-tools">
        {!(["settings", "rules", "review", "transactions"] as Page[]).includes(page) ? (
          <DashboardPeriodPicker period={dashboardPeriod} onChange={setDashboardPeriod} />
        ) : null}

        <div className="notif-wrapper">
          <button
            aria-label={duplicateCount > 0 ? `${duplicateCount} grupo(s) de duplicados pendentes` : "Sem alertas"}
            className={`icon-btn notif-btn${duplicateCount > 0 ? " has-alerts" : ""}`}
            onClick={() => setShowNotifPopover((v) => !v)}
            type="button"
          >
            <Bell size={18} />
            {duplicateCount > 0 ? <span className="notif-badge">{duplicateCount > 99 ? "99+" : duplicateCount}</span> : null}
          </button>
          {showNotifPopover ? (
            <>
              <div className="notif-overlay" onClick={() => setShowNotifPopover(false)} />
              <div className="notif-popover">
                <div className="notif-popover-header">
                  <strong>Alertas</strong>
                  <button className="icon-btn" onClick={() => setShowNotifPopover(false)} type="button"><X size={14} /></button>
                </div>
                {duplicateCount > 0 ? (
                  <button className="notif-item" onClick={() => { setShowNotifPopover(false); onOpenTransactions(); }} type="button">
                    <span className="notif-item-icon warning"><AlertCircle size={16} /></span>
                    <span className="notif-item-body">
                      <strong>{duplicateCount} grupo(s) de lançamentos duplicados</strong>
                      <small>Clique para revisar na tela de Transações</small>
                    </span>
                  </button>
                ) : (
                  <p className="notif-empty">Nenhum alerta no momento.</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        <ThemeToggle />

        {page !== "imports" ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate("imports")}
            style={{ marginLeft: 4 }}
            type="button"
          >
            <NavIcon name="upload" size={14} />
            Importar
          </button>
        ) : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------

export default App;
