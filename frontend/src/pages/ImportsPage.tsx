import { useRef, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  associateCreditCardSourceFile,
  createManualTransaction,
  deleteImport,
  getCreditCardStatements,
  getCreditCards,
  getDataQuality,
  getImportErrors,
  getImports,
  previewImport,
  uploadImport,
} from "../lib/api";
import { apiErrorMessage, cardLabel, dateLabel, monthYearLabel } from "../lib/utils";
import { ArrowLeftRight } from "lucide-react";
import { useHasTransactions } from "../hooks";
import { InlineError, InlineSuccess, NoDataOnboarding } from "../components/ui";
import { TransactionExplorer } from "./TransactionExplorer";
import type { ApiSession, CreditCardRead, CreditCardStatementRead, ImportJobRead, TransactionRead } from "../lib/api";
import type { BatchPreviewResult, BatchUploadProgress, BatchUploadResult, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECOMMENDED_BATCH_FILE_LIMIT = 20;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const I_ICONS: Record<string, string> = {
  plus:    "M12 5v14 M5 12h14",
  upload:  "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2 M7 9l5-5 5 5 M12 4v12",
  folder:  "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z",
  file:    "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z M14 3v5h5",
  clock:   "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2",
  check:   "M5 12l5 5 9-10",
  alert:   "M12 9v4 M12 17h.01 M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z",
  refresh: "M4 12a8 8 0 0 1 14.93-4 M20 12a8 8 0 0 1-14.93 4 M3 3v5h5 M21 21v-5h-5",
  xCircle: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M15 9l-6 6 M9 9l6 6",
  trash:   "M4 7h16 M10 11v6 M14 11v6 M5 7l1 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-12 M9 7V4h6v3",
  chevR:   "M9 18l6-6-6-6",
  link:    "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  filter:  "M4 4h16v2l-6 6v7l-4-2V12L4 6V4z",
  search:  "M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M16 16l4 4",
  info:    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 11v5 M12 8h.01",
  loader:  "M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83",
};

function IIcon({ name, size = 15 }: { name: string; size?: number }) {
  const d = I_ICONS[name];
  if (!d) return null;
  const segs = d.split(" M");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }}>
      {segs.map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: string) {
  const labels: Record<string, string> = { completed: "Completo", completed_with_errors: "Com erros", duplicate_file: "Duplicado", failed: "Falhou", pending: "Pendente", processing: "Processando", active: "Ativa", inactive: "Inativa", manual: "Manual" };
  return labels[status] ?? status;
}

function sourceKindLabel(sourceKind?: string) {
  const labels: Record<string, string> = { bank_statement_excel: "Extrato Excel", bank_statement_txt: "Extrato TXT", credit_card_csv: "Fatura CSV", unknown: "Desconhecido" };
  return sourceKind ? labels[sourceKind] ?? sourceKind : "-";
}

function fileSizeLabel(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(sizeBytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function statementStatusLabel(status: string) {
  const labels: Record<string, string> = { closed: "Fechada", open: "Aberta", paid: "Paga", partial: "Parcial" };
  return labels[status] ?? status;
}

function statementImportLabel(statement: CreditCardStatementRead, card?: CreditCardRead) {
  return `${card ? cardLabel(card) : "Cartão"} · ${monthYearLabel(statement.statement_month)} · vence ${statement.due_date} · ${statementStatusLabel(statement.status)}`;
}

function importFilterSummary({ issueFilter, search, sourceKindFilter, statusFilter }: { issueFilter: string; search: string; sourceKindFilter: string; statusFilter: string }) {
  const parts: string[] = [];
  if (search) parts.push(`arquivo "${search}"`);
  if (statusFilter) parts.push(statusLabel(statusFilter));
  if (issueFilter === "with_errors") parts.push("somente com erros");
  if (sourceKindFilter) parts.push(sourceKindLabel(sourceKindFilter));
  return parts.length ? `Filtros ativos: ${parts.join(" · ")}` : "Mostrando todas as importações.";
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function ImportStatusBadge({ status }: { status: string }) {
  if (status === "completed") return <span className="badge b-real"><IIcon name="check" size={11} />Concluída</span>;
  if (status === "completed_with_errors") return <span className="badge b-warn"><IIcon name="alert" size={11} />Com erros</span>;
  if (status === "duplicate_file") return <span className="badge b-info"><IIcon name="refresh" size={11} />Duplicada</span>;
  if (status === "failed") return <span className="badge b-neg"><IIcon name="xCircle" size={11} />Falhou</span>;
  if (status === "processing") return <span className="badge b-low"><IIcon name="clock" size={11} />Processando</span>;
  if (status === "success") return <span className="badge b-real"><IIcon name="check" size={11} />Concluída</span>;
  return <span className="badge b-low"><IIcon name="clock" size={11} />Pendente</span>;
}

// ---------------------------------------------------------------------------
// ImpStat
// ---------------------------------------------------------------------------

function ImpStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flex: "none" }} />
      <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "var(--line)", margin: "8px 0" }}>
      <div style={{ height: "100%", borderRadius: 3, background: "var(--acc)", width: `${pct}%`, transition: "width 0.3s" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BatchUploadSummary({ results }: { results: BatchUploadResult[] }) {
  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.length - successCount;
  return (
    <div className="card card-pad" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{successCount} arquivo{successCount === 1 ? "" : "s"} importado{successCount === 1 ? "" : "s"}</span>
        {errorCount > 0
          ? <span className="badge b-neg">{errorCount} falha{errorCount === 1 ? "" : "s"}</span>
          : <span className="badge b-real"><IIcon name="check" size={11} />Lote concluído</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {results.map((item) => (
          <div key={item.fileName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-desc" style={{ fontSize: 12.5 }}>{item.fileName}</div>
              <div className="t-sub">
                {item.status === "success"
                  ? `${item.result.valid_rows} novas · ${item.result.duplicate_rows} duplicadas · ${item.result.error_rows} erros`
                  : item.errorMessage}
              </div>
            </div>
            <ImportStatusBadge status={item.status === "success" ? item.result.status : "failed"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchUploadProgressSummary({ progress }: { progress: BatchUploadProgress }) {
  const percentDone = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="card card-pad" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{progress.label}</span>
        <span className="mono" style={{ fontSize: 12.5 }}>{percentDone}%</span>
      </div>
      <ProgressBar pct={percentDone} />
      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
        {progress.done} de {progress.total} arquivos processados{progress.currentFileName ? ` · ${progress.currentFileName}` : ""}
      </div>
      <div className="alert info" style={{ marginTop: 10 }}>
        <div className="alert-ic"><IIcon name="info" size={15} /></div>
        <div>
          <div className="a-ttl">Mantenha esta tela aberta</div>
          <div className="a-txt">Cada arquivo é enviado separadamente para reduzir risco de timeout.</div>
        </div>
      </div>
    </div>
  );
}

function BatchPreviewSummary({ disabled, onConfirm, recommendedLimit, results, selectedBatchIsLarge }: { disabled: boolean; onConfirm: () => void; recommendedLimit: number; results: BatchPreviewResult[]; selectedBatchIsLarge: boolean }) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState<Set<string>>(new Set());
  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.length - successCount;
  const duplicateCount = results.filter((item) => item.status === "success" && item.preview.duplicate_file).length;
  const importableCount = results.filter((item) => item.status === "success" && !item.preview.duplicate_file && item.preview.valid_rows > 0).length;
  return (
    <div className="card card-pad" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Prévia de {successCount} arquivo{successCount === 1 ? "" : "s"}</div>
          <div className={`t-sub ${errorCount || duplicateCount ? "" : ""}`} style={{ marginTop: 2, color: importableCount > 0 ? "var(--acc)" : "var(--warn)" }}>
            {importableCount} pronto{importableCount === 1 ? "" : "s"} para importar
          </div>
        </div>
        {importableCount > 0 && (
          <button className="btn btn-primary btn-sm" disabled={disabled} onClick={onConfirm} type="button">
            Confirmar importação
          </button>
        )}
      </div>
      {selectedBatchIsLarge && (
        <div className="alert warn" style={{ marginBottom: 10 }}>
          <div className="alert-ic"><IIcon name="alert" size={15} /></div>
          <div>
            <div className="a-ttl">Lote grande detectado</div>
            <div className="a-txt">O MVP vai processar arquivo por arquivo; para produção, blocos de até {recommendedLimit} arquivos tendem a ser mais estáveis.</div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {results.map((item) => {
          const isExpanded = expandedFile === item.fileName;
          const badge = item.status === "error" ? "failed" : item.preview?.duplicate_file ? "duplicate_file" : item.preview?.error_rows ? "completed_with_errors" : "completed";
          const firstError = item.status === "success" && item.preview.errors?.length ? item.preview.errors[0].message : null;
          const subtitle = item.status === "success"
            ? `${sourceKindLabel(item.preview.source_kind)} · ${item.preview.valid_rows} válidas · ${item.preview.duplicate_rows} duplicadas · ${item.preview.error_rows} erro${item.preview.error_rows === 1 ? "" : "s"}${firstError ? ` — ${firstError}` : ""}`
            : item.errorMessage;
          return (
            <div key={item.fileName} style={{ borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-desc" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.fileName}>{item.fileName}</div>
                  <div className="t-sub">{subtitle}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {item.status === "success" && item.preview.items.length > 0 && (
                    <button className="btn btn-quiet btn-sm" type="button" onClick={() => {
                      if (isExpanded) {
                        setExpandedFile(null);
                        setShowAllItems((prev) => { const s = new Set(prev); s.delete(item.fileName); return s; });
                      } else {
                        setExpandedFile(item.fileName);
                      }
                    }}>
                      {isExpanded ? "Ocultar" : "Ver transações"}
                    </button>
                  )}
                  <ImportStatusBadge status={badge} />
                </div>
              </div>
              {isExpanded && item.status === "success" && (
                <div style={{ overflowX: "auto", marginBottom: 8 }}>
                  <table className="tbl" style={{ fontSize: 12 }}>
                    <thead><tr><th>Data</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th><th>Tipo</th><th></th></tr></thead>
                    <tbody>
                      {(showAllItems.has(item.fileName) ? item.preview.items : item.preview.items.slice(0, 30)).map((tx, idx) => (
                        <tr key={idx} style={{ opacity: tx.duplicate ? 0.5 : 1 }}>
                          <td className="mono t-sub" style={{ whiteSpace: "nowrap" }}>{String(tx.transaction_date)}</td>
                          <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</td>
                          <td className="num mono" style={{ color: tx.direction === "credit" ? "var(--acc)" : "var(--neg)" }}>
                            {tx.direction === "credit" ? "+" : "-"}{Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="t-sub">{tx.direction === "credit" ? "Crédito" : tx.direction === "debit" ? "Débito" : "Pgto"}</td>
                          <td>{tx.duplicate && <span className="badge warn" style={{ fontSize: 10 }}>Duplicada</span>}</td>
                        </tr>
                      ))}
                      {item.preview.items.length > 30 && !showAllItems.has(item.fileName) && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "6px 0" }}>
                            <button
                              className="btn btn-quiet btn-sm"
                              type="button"
                              onClick={() => setShowAllItems((prev) => new Set([...prev, item.fileName]))}
                            >
                              + {item.preview.items.length - 30} transações não exibidas — clique para ver todas
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {importableCount === 0 && (
        <div className="alert warn" style={{ marginTop: 10 }}>
          <div className="alert-ic"><IIcon name="alert" size={15} /></div>
          <div>
            <div className="a-ttl">Nenhum arquivo novo</div>
            <div className="a-txt">Nenhum arquivo novo pronto para importar. Revise duplicados, erros ou arquivos sem linhas válidas.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportDetailDrawer({
  item,
  errors,
  importCards,
  importCardsById,
  linkCardId,
  setLinkCardId,
  linkImportCard,
  removeImport,
  selectedLinkedStatement,
  session,
  onClose,
}: {
  item: ImportJobRead;
  session: ApiSession;
  errors: { data?: { items: { id: string; source_line: number | null; field_name: string | null; error_code: string; message: string }[] }; isLoading: boolean };
  importCards: { data?: { items: CreditCardRead[] }; isLoading: boolean };
  importCardsById: Map<string, CreditCardRead>;
  linkCardId: string;
  setLinkCardId: (v: string) => void;
  linkImportCard: { mutate: () => void; isPending: boolean; isError: boolean; error: unknown };
  removeImport: { mutate: (id: string) => void; isPending: boolean; isError: boolean; error: unknown };
  selectedLinkedStatement: CreditCardStatementRead | undefined;
  onClose: () => void;
}) {
  const file = item.source_file;
  const queryClient = useQueryClient();
  // Manual entry for the reconciliation gap (charges that couldn't be parsed, e.g.
  // rotated text). We can't enumerate the missing lines, but we can let the user add
  // a lançamento for the difference so the data balances.
  const [addForm, setAddForm] = useState<
    null | { date: string; description: string; amount: string; direction: string }
  >(null);
  const addMissing = useMutation({
    mutationFn: () =>
      createManualTransaction(session, {
        transaction_date: addForm!.date,
        description: addForm!.description,
        amount: addForm!.amount,
        direction: addForm!.direction,
        category_id: null,
      }),
    onSuccess: () => {
      setAddForm(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
  function mismatchDiff(message: string): number | null {
    const match = /diferenca R\$\s*(-?[\d.]+)/i.exec(message);
    return match ? Number(match[1]) : null;
  }
  function openAddForm(diff: number) {
    setAddForm({
      date: new Date().toISOString().slice(0, 10),
      description: "Lançamento não importado (ajuste de fatura)",
      amount: Math.abs(diff).toFixed(2),
      direction: diff >= 0 ? "debit" : "credit",
    });
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
      {/* Backdrop */}
      <div style={{ flex: 1, background: "rgba(0,0,0,.35)" }} onClick={onClose} />
      {/* Panel */}
      <div style={{ width: 420, maxWidth: "100vw", background: "var(--card)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Importação</div>
            <div className="section-title" style={{ fontSize: 14.5 }}>{file?.original_filename ?? "Arquivo sem metadados"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ImportStatusBadge status={item.status} />
            <button className="btn btn-ghost btn-sm" onClick={onClose} type="button" style={{ padding: "6px 8px" }}>
              <IIcon name="xCircle" size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {/* Detail grid */}
          <div className="card card-pad" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {[
              { label: "Status", value: statusLabel(item.status) },
              { label: "Parser", value: sourceKindLabel(file?.source_kind) },
              { label: "Tipo MIME", value: file?.mime_type ?? "-" },
              { label: "Tamanho", value: file ? fileSizeLabel(file.size_bytes) : "-" },
              { label: "Linhas totais", value: item.total_rows },
              { label: "Novas", value: item.valid_rows },
              { label: "Duplicadas", value: item.duplicate_rows },
              { label: "Erros", value: item.error_rows },
              { label: "Recebido em", value: file ? dateLabel(file.received_at) : "-" },
              { label: "Processado em", value: item.finished_at ? dateLabel(item.finished_at) : "-" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="t-sub">{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{String(value)}</div>
              </div>
            ))}
          </div>

          {/* Associate card */}
          {item.source_file_id && (
            <div className="card card-pad">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Detecção</div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Associar ao cartão</div>
                </div>
                <ImportStatusBadge status={selectedLinkedStatement ? "completed" : "pending"} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10 }}>
                {selectedLinkedStatement
                  ? statementImportLabel(selectedLinkedStatement, importCardsById.get(selectedLinkedStatement.credit_card_id))
                  : "Sem cartão associado"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  disabled={linkImportCard.isPending || importCards.isLoading}
                  value={linkCardId}
                  onChange={(e) => setLinkCardId(e.target.value)}
                  style={{ flex: 1, fontSize: 13 }}
                >
                  <option value="">Selecionar cartão</option>
                  {(importCards.data?.items ?? []).map((card) => (
                    <option key={card.id} value={card.id}>{cardLabel(card)}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!linkCardId || linkImportCard.isPending}
                  onClick={() => linkImportCard.mutate()}
                  type="button"
                >
                  <IIcon name="link" size={14} /> Associar
                </button>
              </div>
              {linkImportCard.isError && (
                <div className="alert neg" style={{ marginTop: 10 }}>
                  <div className="alert-ic"><IIcon name="xCircle" size={15} /></div>
                  <div className="a-txt">{apiErrorMessage(linkImportCard.error, "Falha ao associar cartão.")}</div>
                </div>
              )}
            </div>
          )}

          {/* Errors table */}
          <div className="card">
            <div className="card-head">
              <IIcon name="alert" size={15} />
              <div>
                <div className="ttl">Erros por linha</div>
                <div className="sub">Linhas que não puderam ser processadas</div>
              </div>
            </div>
            {errors.isLoading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}>
                <IIcon name="loader" size={16} /> Carregando...
              </div>
            ) : !errors.data?.items.length ? (
              <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-3)" }}>Esta importação não possui erros.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Campo</th>
                      <th>Código</th>
                      <th>Mensagem</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(errors.data?.items ?? []).map((error) => {
                      const diff =
                        error.error_code === "statement_total_mismatch"
                          ? mismatchDiff(error.message)
                          : null;
                      return (
                        <tr key={error.id}>
                          <td>{error.source_line ?? "-"}</td>
                          <td>{error.field_name ?? "-"}</td>
                          <td>{error.error_code}</td>
                          <td>{error.message}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {diff !== null && diff !== 0 ? (
                              <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAddForm(diff)}>
                                <IIcon name="plus" size={12} /> Adicionar manualmente
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {addForm ? (
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Lançamento faltante</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  As cobranças que não foram lidas não podem ser listadas individualmente, mas você pode
                  adicionar o valor da diferença como um lançamento para os totais baterem.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label className="fld" style={{ margin: 0 }}>
                    <span className="fld-label">Data</span>
                    <input className="fld-input" type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
                  </label>
                  <label className="fld" style={{ margin: 0 }}>
                    <span className="fld-label">Valor (R$)</span>
                    <input className="fld-input" inputMode="decimal" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} />
                  </label>
                </div>
                <label className="fld" style={{ margin: 0 }}>
                  <span className="fld-label">Descrição</span>
                  <input className="fld-input" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
                </label>
                <label className="fld" style={{ margin: 0 }}>
                  <span className="fld-label">Tipo</span>
                  <select className="fld-select" value={addForm.direction} onChange={(e) => setAddForm({ ...addForm, direction: e.target.value })}>
                    <option value="debit">Despesa</option>
                    <option value="credit">Receita/Crédito</option>
                    <option value="payment">Pagamento de fatura</option>
                  </select>
                </label>
                {addMissing.isError ? <InlineError message={apiErrorMessage(addMissing.error, "Falha ao criar o lançamento.")} /> : null}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn btn-quiet btn-sm" type="button" onClick={() => setAddForm(null)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" type="button" disabled={addMissing.isPending || !addForm.amount.trim() || !addForm.description.trim()} onClick={() => addMissing.mutate()}>
                    {addMissing.isPending ? "Adicionando…" : "Adicionar lançamento"}
                  </button>
                </div>
              </div>
            ) : null}
            {addMissing.isSuccess ? (
              <div style={{ padding: "0 20px 12px" }}><InlineSuccess message="Lançamento adicionado. Os totais foram recalculados." /></div>
            ) : null}
          </div>

          {/* Danger zone */}
          <div className="card card-pad" style={{ border: "1px solid color-mix(in oklab, var(--neg) 35%, transparent)", background: "var(--neg-soft)" }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--neg)" }}>Excluir importação</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.5 }}>
                Remove os lançamentos, linhas e erros deste processamento para permitir nova importação limpa.
              </div>
            </div>
            <button
              className="btn btn-sm"
              disabled={removeImport.isPending}
              onClick={() => {
                const filename = item.source_file?.original_filename ?? "esta importação";
                if (window.confirm(`Excluir "${filename}" e seus lançamentos? Esta ação não pode ser desfeita no MVP.`)) {
                  removeImport.mutate(item.id);
                }
              }}
              style={{ background: "var(--neg)", color: "#fff", border: "none" }}
              type="button"
            >
              <IIcon name="trash" size={14} />
              {removeImport.isPending ? "Excluindo…" : "Excluir"}
            </button>
            {removeImport.isError && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--neg)" }}>
                {apiErrorMessage(removeImport.error, "Falha ao excluir importação.")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function ImportsPage({
  drilldown,
  onOpenTransactions,
  session,
}: {
  drilldown: import("../types").ImportDrilldown;
  onOpenTransactions: (drilldown?: TransactionDrilldown) => void;
  session: ApiSession;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const imports = useQuery({ queryKey: ["imports", session.token, query], queryFn: () => getImports(session, query) });
  const importCards = useQuery({ queryKey: ["credit-cards", session.token, "import-link"], queryFn: () => getCreditCards(session) });
  const importStatements = useQuery({ queryKey: ["credit-card-statements", session.token, "import-link"], queryFn: () => getCreditCardStatements(session, "") });
  const dataQuality = useQuery({ queryKey: ["data-quality", session.token], queryFn: () => getDataQuality(session, "") });
  const importCardsById = useMemo(() => new Map((importCards.data?.items ?? []).map((card) => [card.id, card])), [importCards.data?.items]);
  const selectedImportJob = (imports.data?.items ?? []).find((item) => item.id === selectedImport);
  const selectedLinkedStatement = useMemo(() => (importStatements.data?.items ?? []).find((s) => s.source_file_id === selectedImportJob?.source_file_id), [importStatements.data?.items, selectedImportJob?.source_file_id]);

  const totalImports = imports.data?.total ?? 0;
  const visibleImports = imports.data?.items ?? [];
  const nextPageDisabled = imports.isLoading || (page + 1) * pageSize >= totalImports;

  // Today's summary
  const today = new Date().toISOString().slice(0, 10);
  const todayImports = visibleImports.filter((imp) => imp.created_at?.slice(0, 10) === today);
  const todayNewRows = todayImports.reduce((s, i) => s + (i.valid_rows ?? 0), 0);
  const todayDupRows = todayImports.reduce((s, i) => s + (i.duplicate_rows ?? 0), 0);
  const todayErrRows = todayImports.reduce((s, i) => s + (i.error_rows ?? 0), 0);
  const todayFileCount = todayImports.length;

  // Categorization ratio
  const catRatio = dataQuality.data?.categorized_ratio;
  const catPct = catRatio ? `${Math.round(parseFloat(catRatio) * 100)}%` : "—";

  const errors = useQuery({ queryKey: ["import-errors", session.token, selectedImport], queryFn: () => getImportErrors(session, selectedImport ?? ""), enabled: Boolean(selectedImport) });
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
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
  });
  const linkImportCard = useMutation({
    mutationFn: () => {
      if (!selectedImportJob?.source_file_id || !linkCardId) throw new Error("Selecione um cartão para associar.");
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
          const result = await uploadImport(session, file, uploadSourceKind);
          results.push({ fileName: file.name, result, status: "success" });
        } catch (error) {
          results.push({ errorMessage: apiErrorMessage(error, "Falha ao importar arquivo."), fileName: file.name, status: "error" });
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
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-cashflow"] });
      void queryClient.invalidateQueries({ queryKey: ["category-ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["data-quality"] });
    },
    onError: () => setUploadProgress(null),
  });
  const previewMutation = useMutation({
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
          results.push({ errorMessage: apiErrorMessage(error, "Falha ao pré-visualizar arquivo."), file, fileName: file.name, status: "error" });
        }
        setUploadProgress({ currentFileName: file.name, done: results.length, label: "Gerando prévia", total: files.length });
        setPreviewResults([...results]);
      }
      return results;
    },
    onSettled: () => setUploadProgress(null),
  });

  const importablePreviewFiles = previewResults
    .filter((item): item is Extract<BatchPreviewResult, { status: "success" }> => item.status === "success")
    .filter((item) => !item.preview.duplicate_file && item.preview.valid_rows > 0)
    .map((item) => item.file);
  const selectedBatchIsLarge = previewResults.length > RECOMMENDED_BATCH_FILE_LIMIT;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > RECOMMENDED_BATCH_FILE_LIMIT) {
      setImportActionMessage(`Lote grande com ${files.length} arquivos. Vamos processar um por vez; se ficar lento em produção, divida em blocos de até ${RECOMMENDED_BATCH_FILE_LIMIT}.`);
    } else {
      setImportActionMessage("");
    }
    if (files.length) previewMutation.mutate(files);
    e.currentTarget.value = "";
  }

  return (
    <div className="canvas stg">
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Visão</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--acc-soft)", color: "var(--acc)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IIcon name="upload" size={18} />
          </div>
          <div>
            <h2 className="section-title">Importações</h2>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 1 }}>
              Traga seus extratos e faturas. Suportamos OFX, CSV, TXT e Excel. Preservamos o arquivo original e cada linha bruta.
            </div>
          </div>
        </div>
      </div>

      {/* Action message */}
      {importActionMessage && (
        <div className="alert pos" style={{ marginBottom: 16 }}>
          <div className="alert-ic"><IIcon name="check" size={15} /></div>
          <div className="a-txt">{importActionMessage}</div>
        </div>
      )}
      {removeImport.isError && (
        <div className="alert neg" style={{ marginBottom: 16 }}>
          <div className="alert-ic"><IIcon name="xCircle" size={15} /></div>
          <div className="a-txt">{apiErrorMessage(removeImport.error, "Falha ao excluir importação.")}</div>
        </div>
      )}

      {/* Main 2-col layout */}
      <div className="dash-main" style={{ marginBottom: 20 }}>
        {/* Left: dropzone + layout selector + preview/progress */}
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Layout selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: "none" }}>Layout</span>
            <select
              disabled={upload.isPending || previewMutation.isPending}
              value={uploadSourceKind}
              onChange={(e) => setUploadSourceKind(e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            >
              <option value="auto">Detectar automaticamente</option>
              <option value="bank_statement_txt">Extrato TXT</option>
              <option value="bank_statement_excel">Extrato Excel</option>
              <option value="credit_card_csv">Fatura CSV</option>
            </select>
          </div>

          {/* Dropzone */}
          <div
            className="dropzone"
            style={{ textAlign: "center", padding: "32px 24px", cursor: "pointer" }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              if (files.length) {
                if (files.length > RECOMMENDED_BATCH_FILE_LIMIT) {
                  setImportActionMessage(`Lote grande com ${files.length} arquivos. Vamos processar um por vez.`);
                } else {
                  setImportActionMessage("");
                }
                previewMutation.mutate(files);
              }
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--acc-soft)", color: "var(--acc)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <IIcon name="upload" size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {previewMutation.isPending ? "Gerando prévia…" : upload.isPending ? "Importando lote…" : "Arraste arquivos aqui"}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14 }}>
              ou clique para selecionar · OFX, CSV, TXT, XLSX
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ margin: "0 auto" }}
              type="button"
              disabled={upload.isPending || previewMutation.isPending}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              <IIcon name="folder" size={14} /> Selecionar arquivos
            </button>
            <input
              ref={fileInputRef}
              accept=".txt,.csv,.xls,.pdf,text/plain,text/csv,application/vnd.ms-excel,application/pdf"
              disabled={upload.isPending || previewMutation.isPending}
              multiple
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {/* Alert: large batches */}
          <div className="alert info">
            <div className="alert-ic"><IIcon name="info" size={15} /></div>
            <div>
              <div className="a-ttl">Lotes grandes</div>
              <div className="a-txt">Para arquivos com mais de 5.000 linhas, o processamento é assíncrono. Você pode sair desta tela — avisaremos quando concluir.</div>
            </div>
          </div>

          {/* Preview / Progress / Results */}
          {previewResults.length > 0 && !uploadProgress ? (
            <BatchPreviewSummary
              disabled={!importablePreviewFiles.length || upload.isPending}
              onConfirm={() => upload.mutate(importablePreviewFiles)}
              recommendedLimit={RECOMMENDED_BATCH_FILE_LIMIT}
              results={previewResults}
              selectedBatchIsLarge={selectedBatchIsLarge}
            />
          ) : null}
          {uploadProgress ? <BatchUploadProgressSummary progress={uploadProgress} /> : null}
          {batchResults.length > 0 && !uploadProgress ? <BatchUploadSummary results={batchResults} /> : null}
        </div>

        {/* Right: summary + categorization */}
        <div className="vstack" style={{ gap: 16 }}>
          {/* Today's summary */}
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Resumo de hoje</div>
            <div style={{ display: "grid", gap: 10 }}>
              <ImpStat label="Linhas novas" value={todayNewRows} color="var(--acc)" />
              <ImpStat label="Duplicadas (ignoradas)" value={todayDupRows} color="var(--info)" />
              <ImpStat label="Com erro" value={todayErrRows} color="var(--neg)" />
              <ImpStat label="Arquivos processados" value={todayFileCount} color="var(--ink-3)" />
            </div>
          </div>

          {/* Automatic categorization */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Categorização automática</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>{catPct}</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>das novas linhas</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
              Regras determinísticas aplicadas. O restante aguarda revisão manual em Transações.
            </p>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="card">
        <div className="card-head">
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bg-sunken)", color: "var(--ink-3)", display: "grid", placeItems: "center", flex: "none" }}>
            <IIcon name="clock" size={16} />
          </div>
          <div className="spacer">
            <div className="ttl">Histórico de importações</div>
            <div className="sub">Arquivos enviados e seu processamento</div>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{totalImports} importações</span>
        </div>

        {/* Filters */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 160px", minWidth: 0, background: "var(--bg-sunken)", borderRadius: 8, padding: "6px 10px", border: "1px solid var(--line)" }}>
            <IIcon name="search" size={14} />
            <input
              placeholder="Buscar arquivo"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ background: "none", border: "none", outline: "none", fontSize: 13, width: "100%", color: "var(--ink)" }}
            />
          </label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} style={{ fontSize: 13 }}>
            <option value="">Todos os status</option>
            <option value="completed">Concluído</option>
            <option value="completed_with_errors">Com erros</option>
            <option value="duplicate_file">Arquivo duplicado</option>
            <option value="failed">Falhou</option>
          </select>
          <select value={issueFilter} onChange={(e) => { setIssueFilter(e.target.value); setPage(0); }} style={{ fontSize: 13 }}>
            <option value="">Todas as ocorrências</option>
            <option value="with_errors">Somente com erros</option>
          </select>
          <select value={sourceKindFilter} onChange={(e) => { setSourceKindFilter(e.target.value); setPage(0); }} style={{ fontSize: 13 }}>
            <option value="">Todos os tipos</option>
            <option value="bank_statement_txt">Extrato TXT</option>
            <option value="bank_statement_excel">Extrato Excel</option>
            <option value="credit_card_csv">Fatura CSV</option>
            <option value="unknown">Desconhecido</option>
          </select>
          {(search || statusFilter || issueFilter || sourceKindFilter) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(""); setStatusFilter(""); setIssueFilter(""); setSourceKindFilter(""); setPage(0); }}
              type="button"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Filter summary bar */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 8 }}>
          <span style={{ flex: 1 }}>{importFilterSummary({ issueFilter, search, sourceKindFilter, statusFilter })}</span>
        </div>

        {/* Table */}
        {imports.isLoading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-3)" }}>Carregando importações…</div>
        ) : !visibleImports.length ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-3)" }}>Nenhuma importação encontrada.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Enviado</th>
                  <th className="num">Linhas</th>
                  <th className="num">Novas</th>
                  <th className="num">Erros</th>
                  <th className="num">Dup.</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleImports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span className="goal-ic" style={{ background: "var(--bg-sunken)", color: "var(--ink-3)" }}>
                          <IIcon name="file" size={14} />
                        </span>
                        <div>
                          <div className="t-desc mono" style={{ fontSize: 12.5, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.source_file?.original_filename}>
                            {item.source_file?.original_filename ?? "Arquivo"}
                          </div>
                          <div className="t-sub">
                            {item.source_file ? fileSizeLabel(item.source_file.size_bytes) : "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="mono t-sub" style={{ whiteSpace: "nowrap" }}>{dateLabel(item.created_at)}</td>
                    <td className="num">{item.status === "processing" ? "—" : item.total_rows}</td>
                    <td className="num" style={{ color: item.valid_rows ? "var(--acc)" : "var(--ink-faint)", fontWeight: item.valid_rows ? 700 : 400 }}>
                      {item.valid_rows || "—"}
                    </td>
                    <td className="num" style={{ color: item.error_rows ? "var(--neg)" : "var(--ink-faint)", fontWeight: item.error_rows ? 700 : 400 }}>
                      {item.error_rows || "—"}
                    </td>
                    <td className="num t-sub">{item.duplicate_rows || "—"}</td>
                    <td><ImportStatusBadge status={item.status} /></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          className="btn btn-quiet btn-sm"
                          disabled={item.valid_rows === 0}
                          onClick={() => onOpenTransactions({ importJobId: item.id, label: item.source_file?.original_filename ?? "Importação" })}
                          type="button"
                        >
                          {item.status === "failed" ? "Ver erros" : item.status === "processing" ? "…" : "Ver linhas"}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedImport(item.id)}
                          type="button"
                          style={{ padding: "6px 7px" }}
                        >
                          <IIcon name="chevR" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0 || imports.isLoading}
            onClick={() => setPage((c) => Math.max(c - 1, 0))}
            type="button"
          >
            Anterior
          </button>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            Página {page + 1} · {visibleImports.length} de {totalImports} importações
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={nextPageDisabled}
            onClick={() => setPage((c) => c + 1)}
            type="button"
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedImport && selectedImportJob ? (
        <ImportDetailDrawer
          item={selectedImportJob}
          errors={errors}
          importCards={importCards}
          importCardsById={importCardsById}
          linkCardId={linkCardId}
          setLinkCardId={setLinkCardId}
          linkImportCard={linkImportCard}
          removeImport={removeImport}
          selectedLinkedStatement={selectedLinkedStatement}
          session={session}
          onClose={() => setSelectedImport(null)}
        />
      ) : null}
    </div>
  );
}

export function TransactionsPage({
  drilldown,
  onOpenImports,
  session,
}: {
  drilldown: import("../types").TransactionDrilldown;
  onOpenImports?: () => void;
  session: ApiSession;
}) {
  const hasTransactions = useHasTransactions(session);
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  const drilldownKey = [
    drilldown?.categoryId ?? "all",
    drilldown?.dateFrom ?? "",
    drilldown?.dateTo ?? "",
    drilldown?.direction ?? "",
    drilldown?.fixedQuery ?? "",
    drilldown?.importJobId ?? "",
    drilldown?.sourceFileId ?? "",
    drilldown?.search ?? "",
    drilldown?.sourceType ?? "",
    drilldown?.weekday ?? "",
  ].join("-");
  if (hasTransactions === false) {
    return (
      <NoDataOnboarding
        icon={ArrowLeftRight}
        eyebrow="Transações"
        title="Importe extratos para ver suas transações"
        description="Aqui ficam todos os seus lançamentos, com busca, filtros e categorização. Importe um extrato (OFX, CSV ou Excel) e suas transações aparecem prontas para revisar."
        onImport={onOpenImports}
      />
    );
  }
  return (
    <TransactionExplorer
      key={drilldownKey}
      initialCategoryId={drilldown?.categoryId ?? ""}
      initialDateFrom={drilldown?.dateFrom ?? ""}
      initialDateTo={drilldown?.dateTo ?? ""}
      initialDirection={drilldown?.direction ?? ""}
      fixedQuery={drilldown?.fixedQuery}
      initialImportJobId={drilldown?.importJobId ?? ""}
      initialSourceFileId={drilldown?.sourceFileId ?? ""}
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
