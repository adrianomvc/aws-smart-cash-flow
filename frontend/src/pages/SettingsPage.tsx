import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CreditCard,
  Database,
  FileUp,
  Gauge,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { normalizeTransactionDescriptions } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { InlineError, InlineSuccess, Panel, QualityRow } from "../components/ui";
import type { ApiSession } from "../lib/api";
import type { Page } from "../types";

// ---------------------------------------------------------------------------
// Private sub-components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SettingsPage({
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
          <SettingsHubCard description="Categorias e subcategorias usadas nos indicadores." icon={Tags} onClick={() => onNavigate("categories")} status="Disponível" title="Categorias" />
          <SettingsHubCard description="Regras de categoria, tipo financeiro e normalização." icon={Wand2} onClick={() => onNavigate("rules")} status="Disponível" title="Regras e normalização" />
          <SettingsHubCard description="Arquivos, parser, histórico e reprocessamento." icon={FileUp} onClick={() => onNavigate("imports")} status="Disponível" title="Importação de dados" />
          <SettingsHubCard description="Dados pessoais, família, preferências e avatar." icon={Users} status="Em breve" title="Perfil" />
          <SettingsHubCard description="Senha, sessões, MFA e dispositivos confiáveis." icon={ShieldCheck} status="Em breve" title="Segurança" />
          <SettingsHubCard description="Moeda, idioma, burn rate, runway e limites pessoais." icon={Gauge} status="Em breve" title="Preferências financeiras" />
          <SettingsHubCard description="Contas, bancos, cartões e fontes conectadas." icon={CreditCard} status="Em breve" title="Contas e bancos" />
          <SettingsHubCard description="Alertas, canais, lembretes e limites de comunicação." icon={Bell} status="Em breve" title="Notificações" />
          <SettingsHubCard description="Exportação, backup, sincronização e retenção." icon={Database} status="Em breve" title="Backup e sincronização" />
          <SettingsHubCard description="Plano, cobrança, notas fiscais e cancelamento." icon={ReceiptText} status="Em breve" title="Assinatura e plano" />
          <SettingsHubCard description="Versão, termos, privacidade e suporte." icon={Sparkles} status="Em breve" title="Sobre o app" />
        </div>
      </Panel>

      <Panel title="Preferências financeiras" description="Campos previstos no v3 para personalizar indicadores, alertas e recomendações.">
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
          <InfoTile icon={ShieldCheck} title="Privacidade" description="Dados financeiros ficam restritos ao workspace ativo e não devem aparecer em logs ou documentos gerados." />
          <InfoTile icon={Database} title="Backup" description="Backup e sincronização entram em etapa futura; por enquanto, mantenha os arquivos originais guardados." />
          <InfoTile icon={Sparkles} title="Versão" description="MVP em evolução, com foco atual em importação, categorização, indicadores e revisão visual." />
        </div>
      </Panel>

      <Panel title="Manutenção dos dados" description="Ações controladas para alinhar dados já importados com regras atuais.">
        <div className="maintenance-action">
          <div>
            <strong>Reprocessar descrições normalizadas</strong>
            <p>Atualiza a descrição operacional das transações existentes preservando a descrição original.</p>
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
