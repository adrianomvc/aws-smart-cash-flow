import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useRef, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Brain,
  CalendarDays,
  CreditCard,
  Database,
  FileUp,
  Gem,
  Loader2,
  LayoutDashboard,
  LogOut,
  Menu,
  Percent,
  PiggyBank,
  Presentation,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Users,
  Wand2,
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
import smartCashFlowIcon from "./assets/smartcashflow-icon.png";
import smartCashFlowLogo from "./assets/smartcashflow-logo.png";
import type { ImportDrilldown, PeriodState, TransactionDrilldown, TransactionPeriodPreset } from "./types";
import type { Page } from "./types";
import { PageState, PeriodFilter } from "./components/ui";

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
// Constants
// ---------------------------------------------------------------------------

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
        {!supabase && (
          <button className="ghost-button full" onClick={() => onLogin({ token: "local-dev", mode: "local" })}>
            Acessar demonstração MVP
          </button>
        )}
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
                    onClick={() => { if (!item.id) return; setPage(item.id); }}
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
        onOpenTransactions={onOpenTransactions}
        page={page}
        workspaceName={workspace.workspace_name}
      />
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
      {page === "cashflow" ? <CashflowPage onNavigate={onNavigate} onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "calendar" ? <CalendarPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "cards" ? <CardsPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "budgets" ? <BudgetsPage onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "goals" ? <GoalsPage session={session} /> : null}
      {page === "planning" ? <PlanningPage session={session} /> : null}
      {page === "reports" ? <ReportsPage onNavigate={onNavigate} session={session} /> : null}
      {page === "imports" ? <ImportsPage drilldown={importDrilldown} onOpenTransactions={onOpenTransactions} session={session} /> : null}
      {page === "transactions" ? <TransactionsPage drilldown={transactionDrilldown} session={session} /> : null}
      {page === "categories" ? <CategoriesPage session={session} /> : null}
      {page === "rules" ? <RulesPage session={session} /> : null}
      {page === "review" ? <ReviewPage session={session} /> : null}
      {page === "settings" ? <SettingsPage onNavigate={onNavigate} workspaceName={workspace.workspace_name} session={session} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// DashboardPeriodPicker
// ---------------------------------------------------------------------------

function DashboardPeriodPicker({ period, onChange }: { period: PeriodState; onChange: (p: PeriodState) => void }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(period.dateFrom);
  const [tempTo, setTempTo] = useState(period.dateTo);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    setTempFrom(period.dateFrom);
    setTempTo(period.dateTo);
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setPopoverOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popoverOpen, period.dateFrom, period.dateTo]);

  function applyPreset(preset: TransactionPeriodPreset) {
    const range = periodRange(preset);
    onChange({ ...range, periodPreset: preset });
    setPopoverOpen(false);
  }

  function applyCustom() {
    if (!tempFrom || !tempTo) return;
    onChange({ dateFrom: tempFrom, dateTo: tempTo, periodPreset: "custom" });
    setPopoverOpen(false);
  }

  function apply3Months() {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    onChange({ dateFrom: fmt(from), dateTo: fmt(to), periodPreset: "custom" });
    setPopoverOpen(false);
  }

  const isM0 = period.periodPreset === "current_month";
  const isM1 = period.periodPreset === "previous_month";
  const is3M = period.periodPreset === "custom" && (() => {
    const diff = Math.round((new Date(period.dateTo).getTime() - new Date(period.dateFrom).getTime()) / 86400000);
    return diff >= 88 && diff <= 93;
  })();
  const isCustom = period.periodPreset === "custom" && !is3M;

  return (
    <div className="dash-period-picker" ref={wrapperRef}>
      <div className="dash-period-segments">
        <button className={`dash-seg-btn${isM0 ? " active" : ""}`} onClick={() => applyPreset("current_month")} type="button" title="Mês atual">M0</button>
        <button className={`dash-seg-btn${isM1 ? " active" : ""}`} onClick={() => applyPreset("previous_month")} type="button" title="Mês anterior">M-1</button>
        <button className={`dash-seg-btn${is3M ? " active" : ""}`} onClick={apply3Months} type="button" title="Últimos 3 meses">3M</button>
        <button className={`dash-seg-btn${period.periodPreset === "current_year" ? " active" : ""}`} onClick={() => applyPreset("current_year")} type="button" title="Este ano">1A</button>
        <button className={`dash-seg-btn dash-seg-cal${isCustom ? " active" : ""}`} onClick={() => setPopoverOpen(v => !v)} type="button" title="Período personalizado">
          <CalendarDays size={14} />
          {isCustom ? <span>{period.dateFrom.slice(5).replace("-", "/")} → {period.dateTo.slice(5).replace("-", "/")}</span> : null}
        </button>
      </div>

      {popoverOpen && (
        <div className="dash-period-popover">
          <p className="dash-period-popover-title">Período personalizado</p>
          <div className="dash-period-presets">
            <button className="dash-period-preset-btn" onClick={() => applyPreset("current_month")} type="button">Mês atual</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("previous_month")} type="button">Mês anterior</button>
            <button className="dash-period-preset-btn" onClick={apply3Months} type="button">Últimos 3 meses</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("current_year")} type="button">Este ano</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("previous_year")} type="button">Ano anterior</button>
            <button className="dash-period-preset-btn" onClick={() => applyPreset("all")} type="button">Tudo</button>
          </div>
          <div className="dash-period-divider" />
          <p className="dash-period-popover-label">Intervalo customizado</p>
          <div className="dash-period-inputs">
            <div className="dash-period-input-group">
              <label>De</label>
              <input type="date" value={tempFrom} onChange={e => setTempFrom(e.target.value)} />
            </div>
            <span className="dash-period-arrow">→</span>
            <div className="dash-period-input-group">
              <label>Até</label>
              <input type="date" value={tempTo} onChange={e => setTempTo(e.target.value)} />
            </div>
          </div>
          <div className="dash-period-popover-actions">
            <button className="dash-period-cancel" onClick={() => setPopoverOpen(false)} type="button">Cancelar</button>
            <button className="dash-period-apply" onClick={applyCustom} type="button" disabled={!tempFrom || !tempTo}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topbar
// ---------------------------------------------------------------------------

function Topbar({
  dashboardPeriod,
  setDashboardPeriod,
  duplicateCount = 0,
  onOpenTransactions,
  page,
  workspaceName,
}: {
  dashboardPeriod: PeriodState;
  setDashboardPeriod: Dispatch<SetStateAction<PeriodState>>;
  duplicateCount?: number;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  page: Page;
  workspaceName: string;
}) {
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const meta = pageMeta(page);

  function topbarSetPreset(preset: TransactionPeriodPreset) {
    const range = periodRange(preset);
    setDashboardPeriod({ ...range, periodPreset: preset });
  }

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{workspaceName}</p>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <div className="topbar-actions">
        {page === "dashboard" ? (
          <DashboardPeriodPicker period={dashboardPeriod} onChange={setDashboardPeriod} />
        ) : null}

        <div className="notif-wrapper">
          <button
            aria-label={duplicateCount > 0 ? `${duplicateCount} grupo(s) de duplicados pendentes` : "Sem alertas"}
            className={`icon-button notif-btn ${duplicateCount > 0 ? "has-alerts" : ""}`}
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
                  <button className="icon-button" onClick={() => setShowNotifPopover(false)} type="button"><X size={14} /></button>
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

        <div className="topbar-pill">
          <ShieldCheck size={16} />
          Workspace seguro
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------

export default App;
