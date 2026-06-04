import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileUp, FileWarning, Filter, Link as LinkIcon, Loader2, Search, Trash2, UploadCloud } from "lucide-react";

import {
  associateCreditCardSourceFile,
  deleteImport,
  getCreditCardStatements,
  getCreditCards,
  getImportErrors,
  getImports,
  previewImport,
  uploadImport,
} from "../lib/api";
import { apiErrorMessage, dateLabel, monthYearLabel } from "../lib/utils";
import {
  Drawer,
  InlineError,
  InlineSuccess,
  QualityRow,
  ResponsiveTable,
  StatusBadge,
} from "../components/ui";
import { TransactionExplorer } from "./TransactionExplorer";
import type { ApiSession, CreditCardRead, CreditCardStatementRead, ImportJobRead, TransactionRead } from "../lib/api";
import type { BatchPreviewResult, BatchUploadProgress, BatchUploadResult, TransactionDrilldown } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECOMMENDED_BATCH_FILE_LIMIT = 20;

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

function cardLabel(card: CreditCardRead) {
  return `${card.name}${card.last_four ? ` final ${card.last_four}` : ""}`;
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
// Sub-components
// ---------------------------------------------------------------------------

function BatchUploadSummary({ results }: { results: BatchUploadResult[] }) {
  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.length - successCount;
  return (
    <div className="batch-upload-summary">
      <div className="batch-upload-head">
        <strong>{successCount} arquivo{successCount === 1 ? "" : "s"} importado{successCount === 1 ? "" : "s"}</strong>
        {errorCount > 0 ? <span className="negative">{errorCount} falha{errorCount === 1 ? "" : "s"}</span> : <span className="positive">Lote concluído</span>}
      </div>
      <div className="batch-upload-list">
        {results.map((item) => (
          <div className="batch-upload-row" key={item.fileName}>
            <span>
              <strong>{item.fileName}</strong>
              {item.status === "success" ? <small>{item.result.valid_rows} novas · {item.result.duplicate_rows} duplicadas · {item.result.error_rows} erros</small> : <small>{item.errorMessage}</small>}
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
      <div className="batch-upload-head"><strong>{progress.label}</strong><span>{percentDone}%</span></div>
      <div className="upload-progress" aria-label="Progresso da importação em lote"><div style={{ width: `${percentDone}%` }} /></div>
      <div className="filter-summary compact"><span>{progress.done} de {progress.total} arquivos processados{progress.currentFileName ? ` · ${progress.currentFileName}` : ""}</span></div>
      <p className="batch-note">Mantenha esta tela aberta. Cada arquivo é enviado separadamente para reduzir risco de timeout.</p>
    </div>
  );
}

function BatchPreviewSummary({ disabled, onConfirm, recommendedLimit, results, selectedBatchIsLarge }: { disabled: boolean; onConfirm: () => void; recommendedLimit: number; results: BatchPreviewResult[]; selectedBatchIsLarge: boolean }) {
  const successCount = results.filter((item) => item.status === "success").length;
  const errorCount = results.length - successCount;
  const duplicateCount = results.filter((item) => item.status === "success" && item.preview.duplicate_file).length;
  const importableCount = results.filter((item) => item.status === "success" && !item.preview.duplicate_file && item.preview.valid_rows > 0).length;
  return (
    <div className="batch-upload-summary">
      <div className="batch-upload-head">
        <span>
          <strong>Prévia de {successCount} arquivo{successCount === 1 ? "" : "s"}</strong>
          <small className={errorCount || duplicateCount ? "warning" : "positive"}>{importableCount} pronto{importableCount === 1 ? "" : "s"} para importar</small>
        </span>
        {importableCount > 0 ? <button className="primary-button compact-button" disabled={disabled} onClick={onConfirm} type="button">Confirmar importação</button> : null}
      </div>
      {selectedBatchIsLarge ? <p className="batch-note warning">Lote grande detectado. O MVP vai processar arquivo por arquivo; para produção, blocos de até {recommendedLimit} arquivos tendem a ser mais estáveis.</p> : null}
      <div className="batch-upload-list scrollable-list">
        {results.map((item) => (
          <div className="batch-upload-row" key={item.fileName}>
            <span>
              <strong>{item.fileName}</strong>
              {item.status === "success" ? <small>{sourceKindLabel(item.preview.source_kind)} · {item.preview.valid_rows} válidas · {item.preview.duplicate_rows} duplicadas · {item.preview.error_rows} erros{item.preview.items.length ? ` · ${item.preview.items[0].description}` : ""}</small> : <small>{item.errorMessage}</small>}
            </span>
            <StatusBadge status={item.status === "error" ? "failed" : item.preview.duplicate_file ? "duplicate_file" : item.preview.error_rows ? "completed_with_errors" : "completed"} />
          </div>
        ))}
      </div>
      {importableCount === 0 ? <p className="batch-note warning">Nenhum arquivo novo pronto para importar. Revise duplicados, erros ou arquivos sem linhas válidas.</p> : null}
    </div>
  );
}

function ImportDetailSummary({ item }: { item: ImportJobRead }) {
  const file = item.source_file;
  return (
    <div className="import-detail">
      <div className="import-detail-header"><div><p className="eyebrow">Arquivo</p><h3>{file?.original_filename ?? "Arquivo sem metadados"}</h3></div><StatusBadge status={item.status} /></div>
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
  const importCardsById = useMemo(() => new Map((importCards.data?.items ?? []).map((card) => [card.id, card])), [importCards.data?.items]);
  const selectedImportJob = (imports.data?.items ?? []).find((item) => item.id === selectedImport);
  const selectedLinkedStatement = useMemo(() => (importStatements.data?.items ?? []).find((s) => s.source_file_id === selectedImportJob?.source_file_id), [importStatements.data?.items, selectedImportJob?.source_file_id]);

  const totalImports = imports.data?.total ?? 0;
  const visibleImports = imports.data?.items ?? [];
  const pageValidRows = visibleImports.reduce((total, item) => total + item.valid_rows, 0);
  const pageDuplicateRows = visibleImports.reduce((total, item) => total + item.duplicate_rows, 0);
  const pageErrorRows = visibleImports.reduce((total, item) => total + item.error_rows, 0);
  const pageFailedImports = visibleImports.filter((item) => item.status === "failed").length;
  const nextPageDisabled = imports.isLoading || (page + 1) * pageSize >= totalImports;

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

  const importablePreviewFiles = previewResults.filter((item): item is Extract<BatchPreviewResult, { status: "success" }> => item.status === "success").filter((item) => !item.preview.duplicate_file && item.preview.valid_rows > 0).map((item) => item.file);
  const selectedBatchIsLarge = previewResults.length > RECOMMENDED_BATCH_FILE_LIMIT;

  return (
    <section className="page-stack">
      <div className="transaction-summary-grid" aria-label="Resumo das importações da página atual">
        <div className="transaction-summary-card"><span>Arquivos</span><strong>{visibleImports.length}</strong><small>Nesta página</small></div>
        <div className="transaction-summary-card positive"><span>Novas</span><strong>{pageValidRows}</strong><small>Linhas importadas</small></div>
        <div className="transaction-summary-card info"><span>Duplicadas</span><strong>{pageDuplicateRows}</strong><small>Ignoradas no lote</small></div>
        <div className="transaction-summary-card warning"><span>Erros</span><strong>{pageErrorRows}</strong><small>Linhas para revisar</small></div>
        <div className="transaction-summary-card negative"><span>Falhas</span><strong>{pageFailedImports}</strong><small>Arquivos com problema</small></div>
      </div>
      <div className="panel" role="region">
        <div className="panel-header"><h2>Upload</h2><p>MVP aceita extrato TXT/Excel e fatura CSV. PDF fica para fase posterior.</p></div>
        <div className="panel-body">
          <div className="upload-options">
            <label>
              Layout
              <select disabled={upload.isPending || previewMutation.isPending} value={uploadSourceKind} onChange={(e) => setUploadSourceKind(e.target.value)}>
                <option value="auto">Detectar automaticamente</option>
                <option value="bank_statement_txt">Extrato TXT</option>
                <option value="bank_statement_excel">Extrato Excel</option>
                <option value="credit_card_csv">Fatura CSV</option>
              </select>
            </label>
          </div>
          <label className="upload-zone">
            <UploadCloud size={28} />
            <strong>{previewMutation.isPending ? "Gerando prévia..." : upload.isPending ? "Importando lote..." : "Selecionar arquivos"}</strong>
            <span>Selecione um ou mais TXT/CSV/XLS, revise a prévia e confirme para gravar.</span>
            <span>Para dezenas de arquivos, prefira blocos de até {RECOMMENDED_BATCH_FILE_LIMIT}; o MVP processa um arquivo por vez.</span>
            <input accept=".txt,.csv,.xls,text/plain,text/csv,application/vnd.ms-excel" disabled={upload.isPending || previewMutation.isPending} multiple type="file" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length > RECOMMENDED_BATCH_FILE_LIMIT) setImportActionMessage(`Lote grande com ${files.length} arquivos. Vamos processar um por vez; se ficar lento em produção, divida em blocos de até ${RECOMMENDED_BATCH_FILE_LIMIT}.`); else setImportActionMessage(""); if (files.length) previewMutation.mutate(files); e.currentTarget.value = ""; }} />
          </label>
          {previewResults.length ? <BatchPreviewSummary disabled={!importablePreviewFiles.length || upload.isPending} onConfirm={() => upload.mutate(importablePreviewFiles)} recommendedLimit={RECOMMENDED_BATCH_FILE_LIMIT} results={previewResults} selectedBatchIsLarge={selectedBatchIsLarge} /> : null}
          {uploadProgress ? <BatchUploadProgressSummary progress={uploadProgress} /> : null}
          {batchResults.length && !uploadProgress ? <BatchUploadSummary results={batchResults} /> : null}
        </div>
      </div>
      {importActionMessage ? <InlineSuccess message={importActionMessage} /> : null}
      {removeImport.isError ? <InlineError message={apiErrorMessage(removeImport.error, "Falha ao excluir importação.")} /> : null}
      <div className="panel" role="region">
        <div className="panel-header"><h2>Histórico</h2><p>Status operacional de cada arquivo processado.</p></div>
        <div className="panel-body">
          <div className="filters">
            <label><Search size={16} /><input placeholder="Buscar arquivo" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
            <label><Filter size={16} /><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}><option value="">Todos os status</option><option value="completed">Concluído</option><option value="completed_with_errors">Concluído com erros</option><option value="duplicate_file">Arquivo duplicado</option><option value="failed">Falhou</option></select></label>
            <label><FileWarning size={16} /><select value={issueFilter} onChange={(e) => { setIssueFilter(e.target.value); setPage(0); }}><option value="">Todas as ocorrências</option><option value="with_errors">Somente com erros</option></select></label>
            <label><FileUp size={16} /><select value={sourceKindFilter} onChange={(e) => { setSourceKindFilter(e.target.value); setPage(0); }}><option value="">Todos os tipos</option><option value="bank_statement_txt">Extrato TXT</option><option value="bank_statement_excel">Extrato Excel</option><option value="credit_card_csv">Fatura CSV</option><option value="unknown">Desconhecido</option></select></label>
            <button className="ghost-button filter-clear" disabled={!search && !statusFilter && !issueFilter && !sourceKindFilter} onClick={() => { setSearch(""); setStatusFilter(""); setIssueFilter(""); setSourceKindFilter(""); setPage(0); }} type="button">Limpar filtros</button>
          </div>
          <div className="filter-summary">
            <span>{importFilterSummary({ issueFilter, search, sourceKindFilter, statusFilter })}</span>
            <strong>{totalImports} importações</strong>
          </div>
          <ResponsiveTable empty={!imports.data?.items.length} loading={imports.isLoading} emptyMessage="Nenhuma importação encontrada.">
            <thead><tr><th>Arquivo</th><th>Status</th><th>Novas</th><th>Duplicadas</th><th>Erros</th><th>Data</th><th /></tr></thead>
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
                    <button className="ghost-button compact" disabled={item.valid_rows === 0} onClick={() => onOpenTransactions({ importJobId: item.id, label: item.source_file?.original_filename ?? "Importação" })} type="button">Transações</button>
                    <button className="icon-button" onClick={() => setSelectedImport(item.id)}><ChevronRight size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          <div className="pagination-bar">
            <button className="ghost-button" disabled={page === 0 || imports.isLoading} onClick={() => setPage((c) => Math.max(c - 1, 0))}>Anterior</button>
            <span>Página {page + 1} · {(imports.data?.items ?? []).length} de {totalImports} importações</span>
            <button className="ghost-button" disabled={nextPageDisabled} onClick={() => setPage((c) => c + 1)}>Próxima</button>
          </div>
        </div>
      </div>

      {selectedImport ? (
        <Drawer title="Detalhe da importação" onClose={() => setSelectedImport(null)}>
          {selectedImportJob ? <ImportDetailSummary item={selectedImportJob} /> : null}
          {selectedImportJob?.source_file_id ? (
            <div className="form-card">
              <div className="section-heading compact">
                <div><p className="eyebrow">Detecção</p><h3>Associar importação ao cartão</h3></div>
                <StatusBadge status={selectedLinkedStatement ? "completed" : "pending"} />
              </div>
              <div className="settings-list">
                <QualityRow label="Cartão atual" value={selectedLinkedStatement ? statementImportLabel(selectedLinkedStatement, importCardsById.get(selectedLinkedStatement.credit_card_id)) : "Sem cartão associado"} />
              </div>
              <div className="inline-form">
                <label>
                  Cartão
                  <select disabled={linkImportCard.isPending || importCards.isLoading} value={linkCardId} onChange={(e) => setLinkCardId(e.target.value)}>
                    <option value="">Selecionar cartão</option>
                    {(importCards.data?.items ?? []).map((card) => <option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
                  </select>
                </label>
                <button className="primary-button" disabled={!linkCardId || linkImportCard.isPending} onClick={() => linkImportCard.mutate()} type="button">
                  {linkImportCard.isPending ? <Loader2 className="spin" size={16} /> : <LinkIcon size={16} />}
                  Associar
                </button>
              </div>
              {linkImportCard.isError ? <InlineError message={apiErrorMessage(linkImportCard.error, "Falha ao associar cartão.")} /> : null}
            </div>
          ) : null}
          {selectedImportJob ? (
            <div className="danger-zone">
              <div><strong>Excluir importação</strong><p>Remove os lançamentos, linhas e erros deste processamento para permitir nova importação limpa.</p></div>
              <button className="danger-button" disabled={removeImport.isPending} onClick={() => { const filename = selectedImportJob.source_file?.original_filename ?? "esta importação"; if (window.confirm(`Excluir "${filename}" e seus lançamentos? Esta ação não pode ser desfeita no MVP.`)) removeImport.mutate(selectedImportJob.id); }} type="button">
                {removeImport.isPending ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          ) : null}
          <h3 className="drawer-section-title">Erros por linha</h3>
          <ResponsiveTable empty={!errors.data?.items.length} loading={errors.isLoading} emptyMessage="Esta importação não possui erros.">
            <thead><tr><th>Linha</th><th>Campo</th><th>Código</th><th>Mensagem</th></tr></thead>
            <tbody>{(errors.data?.items ?? []).map((error) => <tr key={error.id}><td>{error.source_line ?? "-"}</td><td>{error.field_name ?? "-"}</td><td>{error.error_code}</td><td>{error.message}</td></tr>)}</tbody>
          </ResponsiveTable>
        </Drawer>
      ) : null}
    </section>
  );
}

export function TransactionsPage({
  drilldown,
  session,
}: {
  drilldown: import("../types").TransactionDrilldown;
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
