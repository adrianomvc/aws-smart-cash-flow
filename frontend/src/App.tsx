import { FormEvent, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  Pencil,
  FileUp,
  Loader2,
  RefreshCw,
  Save,
  Tags,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Category,
  CategorizationRule,
  Transaction,
  applyRules,
  assignTransactionCategory,
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
  listCategories,
  listImports,
  listRules,
  listTransactions,
  updateCategory,
  updateRule,
  uploadImport,
} from "./lib/api";

const LOCAL_TOKEN = "local";
const TRANSACTION_PAGE_SIZE = 100;
const EMPTY_RULE_FORM = {
  name: "",
  field: "description",
  match_type: "contains",
  pattern: "",
  category_id: "",
  priority: 100,
  active: true,
};

function App() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [uploadFileCount, setUploadFileCount] = useState(0);
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryEditForm, setCategoryEditForm] = useState({
    name: "",
    parent_category_id: "",
  });
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleEditForm, setRuleEditForm] = useState(EMPTY_RULE_FORM);

  const importsQuery = useQuery({
    queryKey: ["imports"],
    queryFn: () => listImports(LOCAL_TOKEN),
  });
  const transactionsQuery = useInfiniteQuery({
    queryKey: ["transactions"],
    queryFn: ({ pageParam = 0 }) =>
      listTransactions(LOCAL_TOKEN, {
        limit: TRANSACTION_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    initialPageParam: 0,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(LOCAL_TOKEN),
  });
  const rulesQuery = useQuery({
    queryKey: ["rules"],
    queryFn: () => listRules(LOCAL_TOKEN),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) =>
      Promise.all(files.map((file) => uploadImport(LOCAL_TOKEN, file))),
    onMutate: (files) => {
      setUploadFileCount(files.length);
      setMessage(
        `Importacao em andamento: processando ${formatCount(
          files.length,
          "arquivo",
          "arquivos",
        )}. Aguarde a conclusao.`,
      );
    },
    onSuccess: (results) => {
      const duplicateFiles = results.filter((result) => result.status === "duplicate_file").length;
      const importedFiles = results.length - duplicateFiles;
      const validRows = results.reduce((total, result) => total + result.valid_rows, 0);
      const errorRows = results.reduce((total, result) => total + result.error_rows, 0);
      const duplicateRows = results.reduce((total, result) => total + result.duplicate_rows, 0);
      if (
        duplicateFiles === results.length ||
        (validRows === 0 && duplicateRows > 0 && errorRows === 0)
      ) {
        setMessage("Arquivo duplicado: nenhum dado novo foi importado.");
      } else {
        const fileSummary =
          duplicateFiles > 0
            ? `${formatCount(importedFiles, "arquivo importado", "arquivos importados")}, ${formatCount(
                duplicateFiles,
                "arquivo duplicado",
                "arquivos duplicados",
              )}`
            : formatCount(importedFiles, "arquivo importado", "arquivos importados");
        setMessage(
          `${fileSummary}: ${formatCount(
            validRows,
            "transacao nova",
            "transacoes novas",
          )}, ${formatCount(
            duplicateRows,
            "transacao duplicada",
            "transacoes duplicadas",
          )}, ${formatCount(errorRows, "erro", "erros")}.`,
        );
      }
      refreshAll();
    },
    onError: (error) => setMessage(`Falha na importacao: ${error.message}`),
    onSettled: () => setUploadFileCount(0),
  });

  const categoryMutation = useMutation({
    mutationFn: (payload: { name: string; parentCategoryId: string | null }) =>
      createCategory(LOCAL_TOKEN, payload.name, payload.parentCategoryId),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setCategoryName("");
      setCategoryParentId("");
      setMessage("Categoria criada.");
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (payload: { categoryId: string; name: string; parentCategoryId: string | null }) =>
      updateCategory(LOCAL_TOKEN, payload.categoryId, {
        name: payload.name,
        parent_category_id: payload.parentCategoryId,
      }),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setEditingCategoryId(null);
      setCategoryEditForm({ name: "", parent_category_id: "" });
      setMessage("Categoria atualizada.");
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(LOCAL_TOKEN, categoryId),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setEditingCategoryId(null);
      setCategoryEditForm({ name: "", parent_category_id: "" });
      setMessage("Categoria excluida.");
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: ({ transactionId, categoryId }: { transactionId: string; categoryId: string }) =>
      assignTransactionCategory(LOCAL_TOKEN, transactionId, categoryId),
    onMutate: () => setMessage(null),
    onSuccess: () => refreshAll(),
    onError: (error) => setMessage(error.message),
  });

  const ruleMutation = useMutation({
    mutationFn: () =>
      createRule(LOCAL_TOKEN, {
        ...ruleForm,
        priority: Number(ruleForm.priority),
      }),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setRuleForm(EMPTY_RULE_FORM);
      setMessage("Regra criada.");
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const updateRuleMutation = useMutation({
    mutationFn: (payload: { ruleId: string; form: typeof EMPTY_RULE_FORM }) =>
      updateRule(LOCAL_TOKEN, payload.ruleId, {
        ...payload.form,
        priority: Number(payload.form.priority),
      }),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setEditingRuleId(null);
      setRuleEditForm(EMPTY_RULE_FORM);
      setMessage("Regra atualizada.");
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => deleteRule(LOCAL_TOKEN, ruleId),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setEditingRuleId(null);
      setRuleEditForm(EMPTY_RULE_FORM);
      setMessage("Regra excluida.");
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const applyMutation = useMutation({
    mutationFn: () => applyRules(LOCAL_TOKEN),
    onMutate: () => setMessage(null),
    onSuccess: (result) => {
      setMessage(
        result.applied_count === 0
          ? "Nenhuma nova transacao foi categorizada por regras."
          : `${result.applied_count} transacoes categorizadas por regras.`,
      );
      refreshAll();
    },
    onError: (error) => setMessage(error.message),
  });

  const categories = categoriesQuery.data?.items ?? [];
  const transactions = transactionsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const transactionTotal = transactionsQuery.data?.pages[0]?.total ?? 0;
  const imports = importsQuery.data?.items ?? [];
  const rules = rulesQuery.data?.items ?? [];
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const chartData = useMemo(() => buildChartData(transactions, categoryById), [
    transactions,
    categoryById,
  ]);
  const isLoading =
    importsQuery.isLoading ||
    transactionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    rulesQuery.isLoading;
  const isRefreshing =
    importsQuery.isFetching ||
    transactionsQuery.isFetching ||
    categoriesQuery.isFetching ||
    rulesQuery.isFetching;
  const isImporting = uploadMutation.isPending;

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      uploadMutation.mutate(files);
      event.target.value = "";
    }
  };

  const handleCreateCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (categoryName.trim()) {
      categoryMutation.mutate({
        name: categoryName,
        parentCategoryId: categoryParentId || null,
      });
    }
  };

  const startEditingCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryEditForm({
      name: category.name,
      parent_category_id: category.parent_category_id ?? "",
    });
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setCategoryEditForm({ name: "", parent_category_id: "" });
  };

  const handleUpdateCategory = (categoryId: string) => {
    if (!categoryEditForm.name.trim()) {
      return;
    }
    updateCategoryMutation.mutate({
      categoryId,
      name: categoryEditForm.name,
      parentCategoryId: categoryEditForm.parent_category_id || null,
    });
  };

  const handleDeleteCategory = (category: Category) => {
    if (window.confirm(`Excluir a categoria "${category.name}"?`)) {
      deleteCategoryMutation.mutate(category.id);
    }
  };

  const handleCreateRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validateRuleForm(ruleForm);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    ruleMutation.mutate();
  };

  const startEditingRule = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id);
    setRuleEditForm({
      name: rule.name,
      field: rule.field,
      match_type: rule.match_type,
      pattern: rule.pattern,
      category_id: rule.category_id,
      priority: rule.priority,
      active: rule.active,
    });
  };

  const cancelEditingRule = () => {
    setEditingRuleId(null);
    setRuleEditForm(EMPTY_RULE_FORM);
  };

  const handleUpdateRule = (ruleId: string) => {
    const validationMessage = validateRuleForm(ruleEditForm);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    updateRuleMutation.mutate({
      ruleId,
      form: ruleEditForm,
    });
  };

  const handleDeleteRule = (rule: CategorizationRule) => {
    if (window.confirm(`Excluir a regra "${rule.name}"?`)) {
      deleteRuleMutation.mutate(rule.id);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">aws-smart-cash-flow</p>
            <h1 className="text-2xl font-semibold tracking-normal">Operacao financeira</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium"
              disabled={isRefreshing}
              onClick={refreshAll}
              type="button"
            >
              <RefreshCw className={isRefreshing ? "animate-spin" : undefined} size={16} />
              {isRefreshing ? "Atualizando" : "Atualizar"}
            </button>
            <label
              className={`inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white ${
                isImporting ? "cursor-wait opacity-80" : "cursor-pointer"
              }`}
            >
              {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
              {isImporting
                ? `Importando ${formatCount(uploadFileCount, "arquivo", "arquivos")}`
                : "Importar TXT/CSV"}
              <input
                accept=".txt,.csv"
                className="hidden"
                disabled={isImporting}
                multiple
                type="file"
                onChange={handleUpload}
              />
            </label>
          </div>
        </header>

        {message ? (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              isImporting
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {isImporting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {message}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={<WalletCards size={20} />} label="Transacoes" value={transactionTotal} />
          <MetricCard icon={<FileUp size={20} />} label="Importacoes" value={imports.length} />
          <MetricCard icon={<Tags size={20} />} label="Categorias" value={categories.length} />
          <MetricCard icon={<BarChart3 size={20} />} label="Regras" value={rules.length} />
        </section>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={18} />
            Carregando dados locais
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-4">
              <Panel title="Transacoes">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th className="py-2 pr-3 font-medium">Data</th>
                        <th className="py-2 pr-3 font-medium">Descricao</th>
                        <th className="py-2 pr-3 text-right font-medium">Valor</th>
                        <th className="py-2 pl-3 font-medium">Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-500">{transaction.transaction_date}</td>
                          <td className="py-2 pr-3">{transaction.description}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="py-2 pl-3">
                            <select
                              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                              value={transaction.category_id ?? ""}
                              onChange={(event) =>
                                assignMutation.mutate({
                                  transactionId: transaction.id,
                                  categoryId: event.target.value,
                                })
                              }
                            >
                              <option value="" disabled>
                                Sem categoria
                              </option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {formatCategoryOption(category, categoryById)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {transactions.length === 0 ? <EmptyState text="Nenhuma transacao importada." /> : null}
                </div>
                {transactionTotal > 0 ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
                    <span>
                      {transactions.length} de {transactionTotal} transacoes carregadas
                    </span>
                    {transactionsQuery.hasNextPage ? (
                      <button
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-950"
                        disabled={transactionsQuery.isFetchingNextPage}
                        onClick={() => transactionsQuery.fetchNextPage()}
                        type="button"
                      >
                        {transactionsQuery.isFetchingNextPage ? "Carregando" : "Carregar mais"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </Panel>

              <Panel title="Gastos por categoria">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(String(value))} />
                      <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Importacoes recentes">
                <div className="grid gap-2">
                  {imports.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm md:grid-cols-[1fr_auto]"
                    >
                      <span className="font-medium">
                        {item.source_file?.original_filename ?? item.source_file_id}
                      </span>
                      <span className="text-slate-500">
                        {item.status} · {item.valid_rows}/{item.total_rows} novas
                        {item.duplicate_rows > 0 ? ` · ${item.duplicate_rows} duplicadas` : ""}
                      </span>
                    </div>
                  ))}
                  {imports.length === 0 ? <EmptyState text="Nenhuma importacao realizada." /> : null}
                </div>
              </Panel>
            </div>

            <aside className="flex flex-col gap-4">
              <Panel title="Categorias">
                <form className="grid gap-2" onSubmit={handleCreateCategory}>
                  <input
                    className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm"
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Nova categoria"
                    value={categoryName}
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      onChange={(event) => setCategoryParentId(event.target.value)}
                      value={categoryParentId}
                    >
                      <option value="">Categoria raiz</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {formatCategoryOption(category, categoryById)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
                      disabled={categoryMutation.isPending}
                    >
                      {categoryMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                      Criar
                    </button>
                  </div>
                </form>
                <div className="mt-3 grid gap-2">
                  {categories.map((category) => (
                    <div key={category.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      {editingCategoryId === category.id ? (
                        <div className="grid gap-2">
                          <input
                            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                            onChange={(event) =>
                              setCategoryEditForm((value) => ({ ...value, name: event.target.value }))
                            }
                            value={categoryEditForm.name}
                          />
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                            <select
                              className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm"
                              onChange={(event) =>
                                setCategoryEditForm((value) => ({
                                  ...value,
                                  parent_category_id: event.target.value,
                                }))
                              }
                              value={categoryEditForm.parent_category_id}
                            >
                              <option value="">Categoria raiz</option>
                              {categories
                                .filter((option) => option.id !== category.id)
                                .map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {formatCategoryOption(option, categoryById)}
                                  </option>
                                ))}
                            </select>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white"
                              disabled={updateCategoryMutation.isPending}
                              onClick={() => handleUpdateCategory(category.id)}
                              title="Salvar categoria"
                              type="button"
                            >
                              {updateCategoryMutation.isPending ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Save size={16} />
                              )}
                            </button>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white"
                              onClick={cancelEditingCategory}
                              title="Cancelar edicao"
                              type="button"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{category.name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {category.parent_category_id
                                ? `Subcategoria de ${categoryById.get(category.parent_category_id)?.name ?? "categoria"}`
                                : "Categoria raiz"}
                            </div>
                          </div>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white"
                            onClick={() => startEditingCategory(category)}
                            title="Editar categoria"
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-700"
                            disabled={deleteCategoryMutation.isPending}
                            onClick={() => handleDeleteCategory(category)}
                            title="Excluir categoria"
                            type="button"
                          >
                            {deleteCategoryMutation.isPending ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {categories.length === 0 ? <EmptyState text="Nenhuma categoria criada." /> : null}
                </div>
              </Panel>

              <Panel title="Regra deterministica">
                <form className="grid gap-2" onSubmit={handleCreateRule}>
                  <input
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    onChange={(event) => setRuleForm((value) => ({ ...value, name: event.target.value }))}
                    placeholder="Nome da regra"
                    value={ruleForm.name}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      onChange={(event) => setRuleForm((value) => ({ ...value, field: event.target.value }))}
                      value={ruleForm.field}
                    >
                      <option value="description">Descricao</option>
                      <option value="raw_description">Descricao bruta</option>
                      <option value="source_name">Origem</option>
                    </select>
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      onChange={(event) =>
                        setRuleForm((value) => ({ ...value, match_type: event.target.value }))
                      }
                      value={ruleForm.match_type}
                    >
                      <option value="contains">Contem</option>
                      <option value="starts_with">Comeca com</option>
                      <option value="equals">Igual</option>
                    </select>
                  </div>
                  <input
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    onChange={(event) => setRuleForm((value) => ({ ...value, pattern: event.target.value }))}
                    placeholder="Padrao"
                    value={ruleForm.pattern}
                  />
                  <div className="grid grid-cols-[1fr_88px] gap-2">
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      onChange={(event) =>
                        setRuleForm((value) => ({ ...value, category_id: event.target.value }))
                      }
                      value={ruleForm.category_id}
                    >
                      <option value="">Categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {formatCategoryOption(category, categoryById)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 rounded-md border border-slate-300 px-2 text-sm"
                      aria-label="Prioridade da regra"
                      min={1}
                      onChange={(event) =>
                        setRuleForm((value) => ({ ...value, priority: Number(event.target.value) }))
                      }
                      type="number"
                      value={ruleForm.priority}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Prioridade: menor numero vence em sobreposicoes. Use 10 para regras especificas e 100
                    para regras gerais.
                  </p>
                  <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
                    <input
                      checked={ruleForm.active}
                      onChange={(event) =>
                        setRuleForm((value) => ({ ...value, active: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    Ativa
                  </label>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
                    disabled={ruleMutation.isPending}
                  >
                    {ruleMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                    Criar regra
                  </button>
                </form>
                <button
                  className="mt-3 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium"
                  disabled={applyMutation.isPending}
                  onClick={() => applyMutation.mutate()}
                  type="button"
                >
                  {applyMutation.isPending ? "Aplicando" : "Aplicar regras"}
                </button>
                <div className="mt-3 grid gap-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      {editingRuleId === rule.id ? (
                        <div className="grid gap-2">
                          <input
                            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                            onChange={(event) =>
                              setRuleEditForm((value) => ({ ...value, name: event.target.value }))
                            }
                            value={ruleEditForm.name}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                              onChange={(event) =>
                                setRuleEditForm((value) => ({ ...value, field: event.target.value }))
                              }
                              value={ruleEditForm.field}
                            >
                              <option value="description">Descricao</option>
                              <option value="raw_description">Descricao bruta</option>
                              <option value="source_name">Origem</option>
                            </select>
                            <select
                              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                              onChange={(event) =>
                                setRuleEditForm((value) => ({
                                  ...value,
                                  match_type: event.target.value,
                                }))
                              }
                              value={ruleEditForm.match_type}
                            >
                              <option value="contains">Contem</option>
                              <option value="starts_with">Comeca com</option>
                              <option value="equals">Igual</option>
                            </select>
                          </div>
                          <input
                            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                            onChange={(event) =>
                              setRuleEditForm((value) => ({ ...value, pattern: event.target.value }))
                            }
                            value={ruleEditForm.pattern}
                          />
                          <div className="grid grid-cols-[1fr_76px] gap-2">
                            <select
                              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                              onChange={(event) =>
                                setRuleEditForm((value) => ({
                                  ...value,
                                  category_id: event.target.value,
                                }))
                              }
                              value={ruleEditForm.category_id}
                            >
                              <option value="">Categoria</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {formatCategoryOption(category, categoryById)}
                                </option>
                              ))}
                            </select>
                            <input
                              className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                              aria-label="Prioridade da regra"
                              min={1}
                              onChange={(event) =>
                                setRuleEditForm((value) => ({
                                  ...value,
                                  priority: Number(event.target.value),
                                }))
                              }
                              type="number"
                              value={ruleEditForm.priority}
                            />
                          </div>
                          <p className="text-xs text-slate-500">
                            Menor numero vence em sobreposicoes.
                          </p>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                            <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-2 text-sm">
                              <input
                                checked={ruleEditForm.active}
                                onChange={(event) =>
                                  setRuleEditForm((value) => ({
                                    ...value,
                                    active: event.target.checked,
                                  }))
                                }
                                type="checkbox"
                              />
                              Ativa
                            </label>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white"
                              disabled={updateRuleMutation.isPending}
                              onClick={() => handleUpdateRule(rule.id)}
                              title="Salvar regra"
                              type="button"
                            >
                              {updateRuleMutation.isPending ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Save size={16} />
                              )}
                            </button>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white"
                              onClick={cancelEditingRule}
                              title="Cancelar edicao"
                              type="button"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">{rule.name}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs ${
                                  rule.active
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {rule.active ? "Ativa" : "Inativa"}
                              </span>
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {rule.field} {rule.match_type} "{rule.pattern}"
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              Categoria: {formatRuleCategory(rule, categoryById)}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              Prioridade {rule.priority}
                            </div>
                          </div>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white"
                            onClick={() => startEditingRule(rule)}
                            title="Editar regra"
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-700"
                            disabled={deleteRuleMutation.isPending}
                            onClick={() => handleDeleteRule(rule)}
                            title="Excluir regra"
                            type="button"
                          >
                            {deleteRuleMutation.isPending ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {rules.length === 0 ? <EmptyState text="Nenhuma regra criada." /> : null}
                </div>
              </Panel>
            </aside>
          </section>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-medium">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">{text}</div>;
}

function formatCurrency(amount: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(amount));
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function validateRuleForm(form: typeof EMPTY_RULE_FORM) {
  if (!form.name.trim()) {
    return "Informe o nome da regra.";
  }
  if (!form.pattern.trim()) {
    return "Informe o padrao da regra.";
  }
  if (!form.category_id) {
    return "Selecione a categoria da regra.";
  }
  if (!Number.isFinite(Number(form.priority)) || Number(form.priority) < 1) {
    return "Informe uma prioridade maior ou igual a 1.";
  }
  return null;
}

function formatCategoryOption(category: Category, categoryById: Map<string, Category>) {
  const names = [category.name];
  let parentId = category.parent_category_id;
  const visited = new Set([category.id]);

  while (parentId && !visited.has(parentId)) {
    const parent = categoryById.get(parentId);
    if (!parent) {
      break;
    }
    names.unshift(parent.name);
    visited.add(parent.id);
    parentId = parent.parent_category_id;
  }

  return names.join(" / ");
}

function formatRuleCategory(rule: CategorizationRule, categoryById: Map<string, Category>) {
  return formatTransactionCategory(rule.category_id, categoryById);
}

function formatTransactionCategory(categoryId: string, categoryById: Map<string, Category>) {
  const category = categoryById.get(categoryId);
  if (!category) {
    return "Categoria removida";
  }
  return formatCategoryOption(category, categoryById);
}

function buildChartData(transactions: Transaction[], categoryById: Map<string, Category>) {
  const totals = new Map<string, number>();
  transactions.forEach((transaction) => {
    if (transaction.direction !== "debit") {
      return;
    }
    const amount = Math.abs(Number(transaction.amount));
    const category = transaction.category_id
      ? formatTransactionCategory(transaction.category_id, categoryById)
      : "Sem categoria";
    totals.set(category, (totals.get(category) ?? 0) + amount);
  });
  return Array.from(totals.entries()).map(([category, amount]) => ({ category, amount }));
}

export default App;
