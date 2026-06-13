import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  FileUp,
  Filter,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

import { associateCreditCardSourceFile, autoAssociateCreditCardFiles, deleteImport, getCreditCards, getCreditCardSourceFiles, getImports, getPreferences, normalizeTransactionDescriptions, unlinkCreditCardSourceFile, updatePreferences, uploadImport } from "../lib/api";
import { apiErrorMessage, dateLabel, moneyAbs } from "../lib/utils";
import { InlineError, InlineSuccess } from "../components/ui";
import { RulesPage } from "./CategoriesPage";
import type { ApiSession, CreditCardRead, CreditCardSourceFileItem, ImportJobRead, PreferencesPayload } from "../lib/api";
import type { Page, TransactionDrilldown } from "../types";

type TabId = "prefs" | "cats" | "rules" | "accounts" | "import" | "notif" | "profile" | "security" | "backup" | "about";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Perfil", icon: Users },
  { id: "security", label: "Segurança", icon: Lock },
  { id: "prefs", label: "Preferências Financeiras", icon: SlidersHorizontal },
  { id: "cats", label: "Categorias", icon: Tags },
  { id: "rules", label: "Regras e Normalização", icon: Filter },
  { id: "accounts", label: "Contas e Bancos", icon: Building2 },
  { id: "import", label: "Importação de Dados", icon: FileUp },
  { id: "notif", label: "Notificações", icon: Bell },
  { id: "backup", label: "Backup e Sincronização", icon: Database },
  { id: "about", label: "Sobre o App", icon: Info },
];

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pref-row">
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        {hint && <div className="t-sub" style={{ marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flex: "none" }}>{children}</div>
    </div>
  );
}

function PrefSelect({ opts }: { opts: string[] }) {
  return (
    <select className="cat-select" defaultValue={opts[0]} style={{ minWidth: 150 }}>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      style={{
        width: 42, height: 24, borderRadius: 20, padding: 2, border: "none", cursor: "pointer",
        background: on ? "var(--acc)" : "var(--line-strong)", transition: "background .15s",
        display: "flex", justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />
    </button>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="card card-pad">
      <div className="state">
        <div className="state-ic"><SettingsIcon size={20} /></div>
        <h4>{title}</h4>
        <p>Em breve.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bodies
// ---------------------------------------------------------------------------

const SELECT_STYLE: React.CSSProperties = { minWidth: 160, padding: "7px 10px", borderRadius: 9, border: "1px solid var(--line)", fontSize: 13, background: "var(--card-2)", color: "var(--ink)" };
const pctToRatio = (pct: string) => (Number(pct) / 100).toFixed(4);
const ratioToPct = (ratio?: string) => String(Math.round(Number(ratio ?? 0) * 100));

function FinPrefsBody({ session }: { session: ApiSession }) {
  const queryClient = useQueryClient();
  const prefsQuery = useQuery({ queryKey: ["preferences", session.token], queryFn: () => getPreferences(session) });
  const prefs = prefsQuery.data;
  const [form, setForm] = useState<PreferencesPayload>({});

  useEffect(() => {
    if (prefs) setForm({
      currency: prefs.currency,
      savings_target_pct: prefs.savings_target_pct,
      commitment_limit_pct: prefs.commitment_limit_pct,
      risk_profile: prefs.risk_profile,
      burn_rate_window_months: prefs.burn_rate_window_months,
      protected_reserve: prefs.protected_reserve,
    });
  }, [prefs]);

  const save = useMutation({
    mutationFn: () => updatePreferences(session, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preferences"] });
      void queryClient.invalidateQueries({ queryKey: ["dash-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["goals-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["projection-feed"] });
    },
  });

  function set<K extends keyof PreferencesPayload>(key: K, value: PreferencesPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><SlidersHorizontal size={15} /></div>
        <div>
          <div className="ttl">Preferências Financeiras</div>
          <div className="sub">Estes valores alimentam seus indicadores e projeções</div>
        </div>
      </div>
      <div style={{ padding: "4px 18px 16px" }}>
        <PrefRow label="Moeda" hint="Código usado nas integrações">
          <select style={SELECT_STYLE} value={form.currency ?? "BRL"} onChange={(e) => set("currency", e.target.value)}>
            <option value="BRL">Real (R$)</option>
            <option value="USD">Dólar (US$)</option>
            <option value="EUR">Euro (€)</option>
          </select>
        </PrefRow>
        <PrefRow label="Meta de poupança" hint="Percentual da renda que você quer guardar. Usada na taxa de poupança.">
          <select style={SELECT_STYLE} value={ratioToPct(form.savings_target_pct)} onChange={(e) => set("savings_target_pct", pctToRatio(e.target.value))}>
            {["10", "15", "20", "25", "30", "35"].map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
        </PrefRow>
        <PrefRow label="Limite de comprometimento" hint="Acima disso o comprometimento é sinalizado como alto.">
          <select style={SELECT_STYLE} value={ratioToPct(form.commitment_limit_pct)} onChange={(e) => set("commitment_limit_pct", pctToRatio(e.target.value))}>
            {["30", "35", "40", "50"].map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
        </PrefRow>
        <PrefRow label="Perfil de risco" hint="Influencia sugestões (em evolução)">
          <select style={SELECT_STYLE} value={form.risk_profile ?? "moderate"} onChange={(e) => set("risk_profile", e.target.value)}>
            <option value="conservative">Conservador</option>
            <option value="moderate">Moderado</option>
            <option value="aggressive">Arrojado</option>
          </select>
        </PrefRow>
        <PrefRow label="Janela de burn rate" hint="Período da média de saídas usada no burn rate e no gasto seguro.">
          <select style={SELECT_STYLE} value={String(form.burn_rate_window_months ?? 12)} onChange={(e) => set("burn_rate_window_months", Number(e.target.value))}>
            <option value="1">1 mês</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
          </select>
        </PrefRow>
        <PrefRow label="Reserva protegida (R$)" hint="Valor que o gasto seguro nunca consome (0 = usa o burn rate de 90 dias).">
          <input type="number" min="0" step="100" style={SELECT_STYLE} value={form.protected_reserve ?? "0"} onChange={(e) => set("protected_reserve", e.target.value)} placeholder="0,00" />
        </PrefRow>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
        {save.isError && <span style={{ flex: 1 }}><InlineError message={apiErrorMessage(save.error, "Falha ao salvar.")} /></span>}
        {save.isSuccess && <span style={{ flex: 1, fontSize: 12, color: "var(--pos)" }}>Preferências salvas ✓</span>}
        <button className="btn btn-quiet btn-sm" type="button" onClick={() => prefs && setForm({ currency: prefs.currency, savings_target_pct: prefs.savings_target_pct, commitment_limit_pct: prefs.commitment_limit_pct, risk_profile: prefs.risk_profile, burn_rate_window_months: prefs.burn_rate_window_months, protected_reserve: prefs.protected_reserve })} disabled={save.isPending}>Cancelar</button>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => save.mutate()} disabled={save.isPending || prefsQuery.isLoading}>
          {save.isPending ? "Salvando…" : "Salvar preferências"}
        </button>
      </div>
    </div>
  );
}

function LinkBody({ title, sub, icon: Icon, buttonLabel, onClick }: { title: string; sub: string; icon: LucideIcon; buttonLabel: string; onClick: () => void }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><Icon size={15} /></div>
        <div>
          <div className="ttl">{title}</div>
          <div className="sub">{sub}</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" type="button" onClick={onClick}>
          <ArrowUpRight size={14} /> {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function NotifBody() {
  const items = [
    { label: "Risco de saldo negativo", hint: "Alerta quando a projeção indicar saldo baixo", on: true },
    { label: "Vencimentos próximos", hint: "Lembrete 2 dias antes de contas e faturas", on: true },
    { label: "Orçamento perto do limite", hint: "Quando uma categoria passar de 90%", on: true },
    { label: "Resumo semanal", hint: "Um e-mail com o panorama da semana", on: false },
  ];
  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><Bell size={15} /></div>
        <div>
          <div className="ttl">Notificações</div>
          <div className="sub">Quando e como avisamos você</div>
        </div>
      </div>
      <div style={{ padding: "4px 18px 16px" }}>
        {items.map((it) => (
          <PrefRow key={it.label} label={it.label} hint={it.hint}><Toggle defaultOn={it.on} /></PrefRow>
        ))}
      </div>
    </div>
  );
}

const IMPORT_FORMATS: { ext: string; color: string; desc: string }[] = [
  { ext: "OFX", color: "#3567b8", desc: "Extrato bancário padrão" },
  { ext: "CSV", color: "#1f8a5b", desc: "Cartão / planilha exportada" },
  { ext: "XLSX", color: "#6a52c9", desc: "Excel / Google Sheets" },
  { ext: "PDF", color: "#cf4d43", desc: "Fatura com leitura OCR" },
  { ext: "QIF", color: "#7c8696", desc: "Software legado" },
  { ext: "API", color: "#2a9d8f", desc: "Open Finance" },
];

const EXT_COLOR: Record<string, string> = { OFX: "#3567b8", CSV: "#1f8a5b", XLSX: "#6a52c9", PDF: "#cf4d43", QIF: "#7c8696" };

function fileExt(name: string): string {
  const e = name.split(".").pop();
  return (e || "csv").toUpperCase();
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function importStatusBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case "completed": case "succeeded": case "done": return { cls: "b-pos", label: "Importado" };
    case "completed_with_errors": case "partial": case "warning": return { cls: "b-warn", label: "Avisos" };
    case "failed": case "error": return { cls: "b-neg", label: "Erro" };
    case "running": case "processing": return { cls: "b-info", label: "Processando" };
    default: return { cls: "b-neutral", label: status };
  }
}

function statementStatusBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case "paid": case "reconciled": return { cls: "b-pos", label: status === "paid" ? "Paga" : "Conciliada" };
    case "open": return { cls: "b-info", label: "Aberta" };
    case "closed": return { cls: "b-neutral", label: "Fechada" };
    case "overdue": return { cls: "b-neg", label: "Vencida" };
    default: return { cls: "b-neutral", label: status };
  }
}

function CollapsibleCard({ icon, iconBg, iconColor, title, sub, right, defaultOpen = false, children }: {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <div
        className="card-head"
        style={{ flexWrap: "wrap", gap: 8, cursor: "pointer", userSelect: "none" }}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
      >
        <div className="kpi-ic" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <div>
          <div className="ttl">{title}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <span style={{ flex: 1 }} />
        {open && right && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{right}</div>
        )}
        <ChevronDown size={17} style={{ flex: "none", color: "var(--ink-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
      </div>
      {open && children}
    </div>
  );
}

function ImportBody({ session, onOpenTransactions }: { session: ApiSession; onOpenTransactions: (drilldown?: TransactionDrilldown) => void }) {
  const queryClient = useQueryClient();
  const normalize = useMutation({
    mutationFn: () => normalizeTransactionDescriptions(session),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
    },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let ok = 0, fail = 0, newRows = 0, dup = 0;
      for (const file of files) {
        try {
          const r = await uploadImport(session, file, "auto");
          ok += 1; newRows += r.valid_rows ?? 0; dup += r.duplicate_rows ?? 0;
        } catch {
          fail += 1;
        }
      }
      return { ok, fail, newRows, dup, count: files.length };
    },
    onSuccess: (s) => {
      setUploadMsg(`${s.ok} de ${s.count} arquivo(s) importado(s) · ${s.newRows} novos · ${s.dup} duplicados${s.fail ? ` · ${s.fail} com erro` : ""}.`);
      void queryClient.invalidateQueries({ queryKey: ["import-history"] });
      void queryClient.invalidateQueries({ queryKey: ["cc-source-files"] });
      void queryClient.invalidateQueries({ queryKey: ["statement-report"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality-rules"] });
    },
  });

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploadMsg("");
    upload.mutate(Array.from(list));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Importar arquivos (área de upload funcional) */}
      <div className="card">
        <div className="card-head">
          <div className="kpi-ic" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><FileUp size={15} /></div>
          <div>
            <div className="ttl">Importar arquivos</div>
            <div className="sub">OFX, CSV, XLSX ou PDF · suas regras são aplicadas automaticamente</div>
          </div>
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".ofx,.csv,.xlsx,.xls,.pdf,.qif"
            style={{ display: "none" }}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <div
            role="button"
            tabIndex={0}
            className={"import-drop" + (dragActive ? " on" : "")}
            onClick={() => { if (!upload.isPending) fileInputRef.current?.click(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (!upload.isPending) handleFiles(e.dataTransfer.files); }}
          >
            <div className="import-drop-ic">{upload.isPending ? <Loader2 className="spin" size={22} /> : <FileUp size={22} />}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {upload.isPending ? "Importando…" : dragActive ? "Solte os arquivos para importar" : "Arraste arquivos ou clique para selecionar"}
            </div>
            <div className="t-sub">Vários arquivos suportados · OFX, CSV, XLSX, PDF, QIF · até 25 MB cada</div>
            <div style={{ display: "inline-flex", gap: 8, marginTop: 14 }}>
              <span className="btn btn-primary btn-sm"><FileUp size={14} /> Selecionar arquivos</span>
            </div>
          </div>
          {upload.isSuccess && uploadMsg && <div style={{ marginTop: 12 }}><InlineSuccess message={uploadMsg} /></div>}
          {upload.isError && <div style={{ marginTop: 12 }}><InlineError message={apiErrorMessage(upload.error, "Falha ao importar.")} /></div>}
          <div className="import-fmt-grid">
            {IMPORT_FORMATS.map((f) => (
              <div key={f.ext} className="import-fmt">
                <span className="import-fmt-badge" style={{ background: f.color }}>{f.ext}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{f.ext}</div>
                  <div className="t-sub" style={{ fontSize: 11, lineHeight: 1.35 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preferências de importação (protótipo) */}
      <div className="card">
        <div className="card-head">
          <div className="kpi-ic"><SlidersHorizontal size={15} /></div>
          <div>
            <div className="ttl">Preferências de importação</div>
            <div className="sub">Como o SmartCashFlow trata cada arquivo importado</div>
          </div>
        </div>
        <div style={{ padding: "4px 18px 14px" }}>
          <PrefRow label="Detectar duplicatas" hint="Compara data + valor + descrição para evitar registros repetidos."><Toggle defaultOn /></PrefRow>
          <PrefRow label="Aplicar regras automaticamente" hint="Classifica usando suas regras e padrões aprendidos."><Toggle defaultOn /></PrefRow>
          <PrefRow label="Normalizar descrição (merchants)" hint="Substitui “PG*UBER TRIP HELP” por “Uber”."><Toggle defaultOn /></PrefRow>
          <PrefRow label="Conciliar faturas com pagamento" hint="Casa faturas de cartão com o pagamento no extrato."><Toggle defaultOn /></PrefRow>
          <PrefRow label="Codificação padrão" hint="UTF-8 para arquivos novos · Windows-1252 para arquivos antigos."><PrefSelect opts={["UTF-8", "ISO-8859-1", "Windows-1252"]} /></PrefRow>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="kpi-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}><RefreshCw size={15} /></div>
          <div>
            <div className="ttl">Manutenção dos dados</div>
            <div className="sub">Ações controladas para alinhar dados já importados</div>
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Reprocessar descrições */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 13.5 }}>Reprocessar descrições normalizadas</strong>
              <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "2px 0 0", lineHeight: 1.45 }}>
                Atualiza a descrição operacional das transações existentes preservando a original.
              </p>
            </div>
            <button className="btn btn-quiet btn-sm" disabled={normalize.isPending} onClick={() => normalize.mutate()} type="button">
              {normalize.isPending ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Reprocessar
            </button>
          </div>
          {normalize.isSuccess && <InlineSuccess message={`${normalize.data.changed_count} de ${normalize.data.scanned_count} transações atualizadas.`} />}
          {normalize.isError && <InlineError message={apiErrorMessage(normalize.error, "Falha ao reprocessar.")} />}
        </div>
      </div>

      {/* Faturas de cartão: vínculo + conciliação (mesclado) */}
      <ManualLinkCard session={session} onOpenTransactions={onOpenTransactions} />

      {/* Histórico de importações (dados reais) */}
      <ImportHistoryCard session={session} onOpenTransactions={onOpenTransactions} />

      {/* Como funciona (protótipo) */}
      <div className="alert info">
        <span className="alert-ic"><Info size={17} /></span>
        <div>
          <div className="a-ttl">Como o SmartCashFlow processa seus arquivos</div>
          <div className="a-txt">
            1) Detecta o formato e a instituição · 2) Normaliza a descrição (merchants) · 3) Aplica regras + padrões aprendidos ·
            4) Checa duplicatas pela combinação data + valor + descrição · 5) Concilia faturas de cartão com o pagamento no extrato.
          </div>
        </div>
      </div>
    </div>
  );
}

const SOURCE_KIND_LABEL: Record<string, string> = {
  bank_statement_txt: "TXT",
  bank_statement_excel: "Excel",
  credit_card_csv: "CSV",
  unknown: "Desconhecido",
};
function sourceKindLabel(kind: string | undefined): string {
  if (!kind) return "—";
  return SOURCE_KIND_LABEL[kind] ?? kind;
}

function ImportHistoryCard({ session, onOpenTransactions }: { session: ApiSession; onOpenTransactions: (drilldown?: TransactionDrilldown) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const query = (() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (kind) p.set("source_kind", kind);
    if (onlyErrors) p.set("has_errors", "true");
    p.set("limit", String(pageSize));
    p.set("offset", String(page * pageSize));
    return `?${p.toString()}`;
  })();

  const history = useQuery({ queryKey: ["import-history", session.token, query], queryFn: () => getImports(session, query) });
  const remove = useMutation({
    mutationFn: (id: string) => deleteImport(session, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["import-history"] });
      void queryClient.invalidateQueries({ queryKey: ["cc-source-files"] });
      void queryClient.invalidateQueries({ queryKey: ["statement-report"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const items = history.data?.items ?? [];
  const total = history.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = page * pageSize + items.length;

  return (
    <CollapsibleCard
      icon={<FileUp size={15} />}
      iconBg="var(--bg-sunken)"
      iconColor="var(--ink-2)"
      title="Histórico de importações"
      sub={`${total} arquivo(s) processado(s)`}
      right={<>
        <input
          placeholder="Buscar arquivo…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ width: 170, padding: "7px 10px", borderRadius: 9, border: "1px solid var(--line)", fontSize: 12.5, background: "var(--card-2)", color: "var(--ink)" }}
        />
        <select className="cat-select" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }} style={{ padding: "6px 8px" }}>
          <option value="">Todos os tipos</option>
          <option value="bank_statement_txt">TXT</option>
          <option value="bank_statement_excel">Excel</option>
          <option value="credit_card_csv">CSV</option>
          <option value="unknown">Desconhecido</option>
        </select>
        <button
          type="button"
          className={"btn btn-sm " + (onlyErrors ? "btn-primary" : "btn-quiet")}
          onClick={() => { setOnlyErrors((v) => !v); setPage(0); }}
        >
          Só com erros
        </button>
      </>}
    >
      <div className="card-body">
        {history.isLoading ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Carregando…</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhum arquivo {search || kind || onlyErrors ? "para esse filtro" : "importado ainda"}.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl tbl-link">
                <thead>
                  <tr>
                    <th>Arquivo</th><th>Tipo</th><th>Importado em</th>
                    <th className="num">Linhas</th><th className="num">Novos</th><th className="num">Duplicados</th><th className="num">Erros</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((job: ImportJobRead) => {
                    const name = job.source_file?.original_filename ?? "(arquivo)";
                    const ext = fileExt(name);
                    const st = importStatusBadge(job.status);
                    return (
                      <tr key={job.id}>
                        <td data-label="Arquivo">
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="import-ext-badge" style={{ background: EXT_COLOR[ext] ?? "#7c8696" }}>{ext}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13 }}>{name}</div>
                              <div className="t-sub mono">{job.source_file ? formatBytes(job.source_file.size_bytes) : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="t-sub" data-label="Tipo">{sourceKindLabel(job.source_file?.source_kind)}</td>
                        <td className="mono t-sub" data-label="Importado em">{dateLabel(job.created_at)}</td>
                        <td className="num" data-label="Linhas">{job.total_rows}</td>
                        <td className="num" style={{ fontWeight: 700, color: "var(--pos)" }} data-label="Novos">{job.valid_rows}</td>
                        <td className="num t-sub" data-label="Duplicados">{job.duplicate_rows}</td>
                        <td className="num" style={{ color: job.error_rows > 0 ? "var(--neg)" : "var(--ink-3)" }} data-label="Erros">{job.error_rows}</td>
                        <td data-label="Status"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td data-label="Ações">
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              className="btn btn-quiet btn-sm"
                              title="Ver as transações deste arquivo"
                              onClick={() => onOpenTransactions({ importJobId: job.id, label: name, periodPreset: "all" })}
                              type="button"
                            >
                              Ver transações
                            </button>
                            <button
                              className="btn btn-quiet btn-sm"
                              style={{ color: "var(--neg)" }}
                              disabled={remove.isPending}
                              title="Excluir importação (remove os lançamentos vinculados)"
                              onClick={() => {
                                if (window.confirm(`Excluir a importação "${name}"? Os lançamentos vinculados serão removidos dos indicadores.`)) {
                                  remove.mutate(job.id);
                                }
                              }}
                              type="button"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {remove.isError && <div style={{ marginTop: 8 }}><InlineError message={apiErrorMessage(remove.error, "Falha ao excluir importação.")} /></div>}
            <div className="tbl-pager">
              Mostrando <b>{from}–{to}</b> de {total} arquivo{total === 1 ? "" : "s"}
              <div className="tbl-pager-ctrls">
                <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((c) => Math.max(c - 1, 0))} type="button">‹</button>
                <span>Página {page + 1} de {pageCount}</span>
                <button className="btn btn-ghost btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage((c) => c + 1)} type="button">›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthRefLabel(ym: string | null): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  return `${MONTH_ABBR[m - 1]}/${y}`;
}

function ManualLinkCard({ session, onOpenTransactions }: { session: ApiSession; onOpenTransactions: (drilldown?: TransactionDrilldown) => void }) {
  const queryClient = useQueryClient();
  const files = useQuery({
    queryKey: ["cc-source-files", session.token],
    queryFn: () => getCreditCardSourceFiles(session),
  });
  const cards = useQuery({
    queryKey: ["credit-cards", session.token],
    queryFn: () => getCreditCards(session),
  });
  const autoAssociate = useMutation({
    mutationFn: () => autoAssociateCreditCardFiles(session),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cc-source-files"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["card-transactions"] });
    },
  });

  const allItems = files.data?.items ?? [];
  const cardItems = cards.data?.items ?? [];

  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const items = onlyUnlinked ? allItems.filter((i) => i.linked_credit_card_id == null) : allItems;
  const unlinkedCount = allItems.filter((i) => i.linked_credit_card_id == null).length;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = items.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const from = items.length === 0 ? 0 : safePage * pageSize + 1;
  const to = safePage * pageSize + paged.length;

  return (
    <CollapsibleCard
      icon={<CreditCard size={15} />}
      iconBg="var(--acc-soft)"
      iconColor="var(--acc)"
      title="Faturas de cartão"
      sub="Vincule cada arquivo ao cartão e acompanhe a conciliação com o pagamento"
      right={<>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={autoAssociate.isPending}
          title="Vincula faturas (CSV) ao cartão correto cruzando total, pagamento e nome"
          onClick={() => autoAssociate.mutate()}
        >
          {autoAssociate.isPending ? <Loader2 className="spin" size={14} /> : <CreditCard size={14} />} Auto-associar
        </button>
        <button
          type="button"
          className={"btn btn-sm " + (onlyUnlinked ? "btn-primary" : "btn-quiet")}
          onClick={() => { setOnlyUnlinked((v) => !v); setPage(0); }}
        >
          Só não vinculados{unlinkedCount ? ` (${unlinkedCount})` : ""}
        </button>
      </>}
    >
      <div className="card-body">
        {autoAssociate.isSuccess && (
          <div style={{ marginBottom: 10 }}>
            <InlineSuccess message={autoAssociate.data.linked > 0 ? `${autoAssociate.data.linked} fatura(s) associada(s) automaticamente.` : "Nenhuma fatura nova para associar (ou cartão não identificado)."} />
          </div>
        )}
        {autoAssociate.isError && <div style={{ marginBottom: 10 }}><InlineError message={apiErrorMessage(autoAssociate.error, "Falha ao auto-associar.")} /></div>}
        {files.isLoading ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Carregando arquivos…</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhum arquivo de fatura (CSV de cartão) importado ainda.</p>
        ) : cardItems.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Cadastre um cartão de crédito antes de vincular arquivos.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl tbl-link">
                <thead>
                  <tr>
                    <th>Arquivo</th><th>Mês ref.</th><th className="num">Total</th>
                    <th style={{ minWidth: 230 }}>Cartão</th>
                    <th>Vencimento</th><th className="num">Valor pago</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item) => (
                    <FileLinkRow key={item.source_file_id} session={session} item={item} cards={cardItems} onOpenTransactions={onOpenTransactions} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tbl-pager">
              Mostrando <b>{from}–{to}</b> de {items.length} arquivo{items.length === 1 ? "" : "s"}
              <div className="tbl-pager-ctrls">
                <button className="btn btn-ghost btn-sm" disabled={safePage === 0} onClick={() => setPage((c) => Math.max(c - 1, 0))} type="button">‹</button>
                <span>Página {safePage + 1} de {pageCount}</span>
                <button className="btn btn-ghost btn-sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((c) => Math.min(c + 1, pageCount - 1))} type="button">›</button>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="cat-select" style={{ padding: "4px 8px" }}>
                  <option value={8}>8 / pág</option>
                  <option value={15}>15 / pág</option>
                  <option value={30}>30 / pág</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}

function FileLinkRow({ session, item, cards, onOpenTransactions }: {
  session: ApiSession;
  item: CreditCardSourceFileItem;
  cards: CreditCardRead[];
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
}) {
  const queryClient = useQueryClient();
  const [cardId, setCardId] = useState(item.linked_credit_card_id ?? "");

  const link = useMutation({
    mutationFn: () => associateCreditCardSourceFile(session, cardId, item.source_file_id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cc-source-files"] });
      void queryClient.invalidateQueries({ queryKey: ["statement-report"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["card-transactions"] });
    },
  });
  const unlink = useMutation({
    mutationFn: () => unlinkCreditCardSourceFile(session, item.source_file_id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cc-source-files"] });
      void queryClient.invalidateQueries({ queryKey: ["statement-report"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["card-transactions"] });
    },
  });

  const alreadyLinkedHere = item.linked_credit_card_id != null && item.linked_credit_card_id === cardId;

  return (
    <tr>
      <td className="mono t-sub" data-label="Arquivo">{item.original_filename}</td>
      <td className="mono t-sub" data-label="Mês ref.">{monthRefLabel(item.reference_month)}</td>
      <td className="num" style={{ fontWeight: 700 }} data-label="Total">{item.total != null ? moneyAbs(item.total) : "—"}</td>
      <td data-label="Cartão">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            className="cat-select"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            disabled={link.isPending}
            style={{ flex: 1, minWidth: 140 }}
          >
            <option value="">Não vinculado…</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` ····${c.last_four}` : ""}</option>
            ))}
          </select>
          <button
            className="btn btn-quiet btn-sm"
            disabled={!cardId || alreadyLinkedHere || link.isPending}
            onClick={() => link.mutate()}
            type="button"
          >
            {link.isPending ? <Loader2 className="spin" size={14} /> : item.linked_credit_card_id ? "Revincular" : "Vincular"}
          </button>
        </div>
        {link.isError && <div style={{ marginTop: 4 }}><InlineError message={apiErrorMessage(link.error, "Falha ao vincular.")} /></div>}
        {link.isSuccess && <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--pos)" }}>Vinculado ✓</div>}
      </td>
      <td className="mono t-sub" data-label="Vencimento">{item.due_date ? dateLabel(item.due_date) : "—"}</td>
      <td className="num" style={{ fontWeight: 700, color: item.paid_amount != null ? "var(--pos)" : "var(--ink-faint)" }} data-label="Valor pago">
        {item.paid_amount != null ? moneyAbs(item.paid_amount) : item.linked_credit_card_id ? "— não pago" : "—"}
      </td>
      <td data-label="Status">
        {item.status ? (() => { const s = statementStatusBadge(item.status); return <span className={`badge ${s.cls}`}>{s.label}</span>; })() : "—"}
      </td>
      <td data-label="Ações">
        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            className="btn btn-quiet btn-sm"
            title="Ver as transações deste arquivo"
            onClick={() => onOpenTransactions({ sourceFileId: item.source_file_id, label: item.original_filename, periodPreset: "all" })}
            type="button"
          >
            Ver transações
          </button>
          {item.linked_credit_card_id && (
            <button
              className="btn btn-quiet btn-sm"
              style={{ color: "var(--neg)" }}
              disabled={unlink.isPending}
              title="Desvincular este arquivo do cartão"
              onClick={() => {
                if (window.confirm(`Desvincular “${item.original_filename}” do cartão? A fatura vinculada será removida (as transações são mantidas).`)) {
                  unlink.mutate();
                }
              }}
              type="button"
            >
              {unlink.isPending ? <Loader2 className="spin" size={14} /> : "Desvincular"}
            </button>
          )}
        </div>
        {unlink.isError && <div style={{ marginTop: 4 }}><InlineError message={apiErrorMessage(unlink.error, "Falha ao desvincular.")} /></div>}
      </td>
    </tr>
  );
}

function AboutBody({ workspaceName, session }: { workspaceName: string; session: ApiSession }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="kpi-ic"><Info size={15} /></div>
        <div>
          <div className="ttl">Sobre o App</div>
          <div className="sub">Versão, ambiente e privacidade</div>
        </div>
      </div>
      <div style={{ padding: "4px 18px 16px" }}>
        <PrefRow label="Workspace"><span style={{ fontWeight: 700 }}>{workspaceName}</span></PrefRow>
        <PrefRow label="Modo de sessão"><span style={{ fontWeight: 700 }}>{session.mode === "local" ? "Local" : "Supabase"}</span></PrefRow>
        <PrefRow label="API"><span className="badge b-pos">Conectada</span></PrefRow>
        <PrefRow label="Versão" hint="MVP em evolução"><span className="mono">v0.1</span></PrefRow>
        <PrefRow label="Privacidade" hint="Dados financeiros ficam restritos ao workspace ativo"><ShieldCheck size={16} /></PrefRow>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SettingsPage({ onNavigate, onOpenTransactions, workspaceName, session }: {
  onNavigate: (page: Page) => void;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  workspaceName: string;
  session: ApiSession;
}) {
  const [tab, setTab] = useState<TabId>("prefs");

  function body() {
    switch (tab) {
      case "prefs": return <FinPrefsBody session={session} />;
      case "cats": return <LinkBody title="Categorias e Subcategorias" sub="O cadastro completo é feito na tela dedicada." icon={Tags} buttonLabel="Abrir tela completa" onClick={() => onNavigate("categories")} />;
      case "rules": return <RulesPage session={session} embedded />;
      case "import": return <ImportBody session={session} onOpenTransactions={onOpenTransactions} />;
      case "notif": return <NotifBody />;
      case "about": return <AboutBody workspaceName={workspaceName} session={session} />;
      case "accounts": return <ComingSoon title="Contas e Bancos" />;
      case "profile": return <ComingSoon title="Perfil" />;
      case "security": return <ComingSoon title="Segurança" />;
      case "backup": return <ComingSoon title="Backup e Sincronização" />;
      default: return <ComingSoon title="Configurações" />;
    }
  }

  return (
    <div className="canvas stg">
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Conta</div>
        <h2 className="section-title"><SettingsIcon size={18} /> Configurações</h2>
        <p className="section-sub">Central administrativa e de preferências do workspace.</p>
      </div>

      <div className="stg-layout">
        <div className="card card-pad stg-sidebar">
          <div className="list-select">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                  <Icon size={16} /><span style={{ flex: 1 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>{body()}</div>
      </div>
    </div>
  );
}
