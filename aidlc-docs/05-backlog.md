# Backlog

## Epic 1: Fundacao do Projeto

US-001: Como Tech Lead, quero uma estrutura de projeto com backend, frontend, testes e migracoes para permitir evolucao segura.

Aceite:

- Estrutura criada.
- Comando de teste documentado.
- Ambiente local documentado.

US-002: Como DBA, quero o schema inicial versionado para armazenar arquivos, importacoes, transacoes e erros.

Aceite:

- Migracao inicial criada.
- Constraints de unicidade definidas.
- Tipos monetarios usam decimal.
- Todas as tabelas financeiras possuem isolamento por workspace.

## Epic 1.5: Autenticacao e Workspace

US-015: Como usuario, quero fazer login por email e senha para acessar meus dados financeiros com seguranca.

Aceite:

- Login usa Supabase Auth.
- Frontend envia `Authorization: Bearer <access_token>` para a API.
- Backend valida token antes de rotas protegidas.
- Rotas protegidas resolvem `user_id` e `workspace_id`.
- Dados financeiros nunca sao retornados sem filtro por `workspace_id`.

US-016: Como usuario, quero ter um workspace inicial criado automaticamente no primeiro acesso para começar a usar sem configuracao manual.

Aceite:

- Primeiro acesso cria usuario espelhado no banco da aplicacao.
- Primeiro acesso cria workspace inicial se o usuario ainda nao tiver workspace.
- Usuario inicial recebe role `owner`.
- Fluxo permite adicionar outro usuario ao mesmo workspace em etapa posterior.

## Epic 2: Ingestao TXT

US-003: Como operador, quero importar extrato TXT para carregar lancamentos de conta corrente.

Aceite:

- Parser le formato `dd/MM/yyyy;descricao;valor`.
- Valor brasileiro com virgula e convertido corretamente.
- Linhas invalidas geram `ImportError`.

## Epic 3: Ingestao CSV

US-004: Como operador, quero importar CSVs de fatura para carregar lancamentos de cartao.

Aceite:

- Parser exige header `data,lançamento,valor`.
- Data ISO e valor decimal sao validados.
- Pagamentos sao identificados por descricao e valor negativo.

## Epic 4: Idempotencia e Auditoria

US-005: Como administrador, quero reprocessar arquivos sem duplicar transacoes.

Aceite:

- Hash do arquivo evita reimportacao identica.
- Chave de dedupe evita duplicidade por linha.
- Importacoes repetidas ficam rastreaveis.

## Epic 5: Interface Operacional

Nota de entrega frontend:

- Mudancas de frontend devem ser agrupadas em uma fatia unica de subida sempre que
  fizerem parte do mesmo fluxo operacional.
- Para o MVP operacional, juntar upload, lista de importacoes, detalhe de erros,
  lista de transacoes, categorias manuais e regras deterministicas em uma entrega
  coesa de frontend, evitando subidas pequenas e fragmentadas.

US-006: Como operador, quero ver status de importacao e erros para agir rapidamente.

Aceite:

- Lista importacoes com status e contadores.
- Detalhe mostra erros por linha.
- Tela nao expõe dados desnecessarios.

US-017: Como operador, quero importar multiplos arquivos em lote pequeno para carregar historico sem repetir a operacao arquivo por arquivo.

Aceite:

- Frontend permite selecionar multiplos arquivos TXT/CSV.
- Cada arquivo gera uma importacao independente.
- Falha em um arquivo nao bloqueia os demais.
- Tela mostra resumo por arquivo com status, linhas validas e erros.

US-018: Como operador, quero visualizar um preview antes de confirmar a importacao para evitar salvar dados incorretos.

Aceite:

- Preview mostra linhas parseadas, erros e duplicidades detectadas.
- Usuario pode cancelar antes de persistir transacoes.
- Usuario pode confirmar a importacao apos revisar o resumo.
- Dados sensiveis do preview nao devem ir para logs.

US-019: Como operador, quero escolher manualmente o parser quando a deteccao automatica for ambigua.

Aceite:

- Sistema informa quando a confianca de deteccao for baixa ou ambigua.
- Tela permite selecionar parser/layout suportado.
- Escolha manual fica registrada nos metadados da importacao.

US-020: Como operador, quero consultar metadados do lote de importacao para auditar origem, parser e linhas ignoradas.

Aceite:

- Importacao registra parser/layout usado, origem inferida, total de linhas e linhas ignoradas.
- Linhas ignoradas possuem motivo quando identificavel.
- Detalhe da importacao exibe metadados sem expor dados financeiros desnecessarios.

## Epic 6: Consulta e Categorizacao de Transacoes

US-007: Como analista, quero consultar transacoes importadas por periodo, origem e descricao.

Aceite:

- Filtros basicos disponiveis.
- Resultado paginado.
- Valores formatados em BRL na interface.

US-008: Como usuario, quero categorizar transacoes manualmente para organizar meus gastos.

Aceite:

- Categorias podem ser criadas por workspace.
- Uma transacao pode receber categoria manual.
- Alteracoes ficam persistidas.

US-009: Como usuario, quero regras automaticas de categorizacao para reduzir trabalho manual.

Aceite:

- Regras por texto da descricao podem ser cadastradas.
- Regras sao aplicadas apos importacao.
- Categoria manual prevalece sobre regra automatica.
- Regras deterministicas fazem parte do MVP 1.

US-021: Como usuario, quero subcategorias para organizar despesas com maior granularidade.

Aceite:

- Categoria pode ter subcategorias.
- Transacao pode ser classificada em categoria e subcategoria.
- Filtros e dashboards consideram categoria e subcategoria.
- Migracao preserva categorias existentes.

US-022: Como usuario, quero configurar cor, ordem e tipo da categoria para melhorar leitura dos dashboards.

Aceite:

- Categoria possui cor de exibicao.
- Categoria possui ordem de exibicao.
- Categoria indica se representa despesa, receita ou tipo neutro.
- Interface usa essas configuracoes em listas e dashboards.

US-023: Como usuario, quero corrigir categorias manualmente e ensinar o sistema para futuras transacoes parecidas.

Aceite:

- Correcao manual marca a classificacao como `manual` com confianca `1.0`.
- Sistema pode criar ou atualizar regra deterministica de alta prioridade a partir da correcao.
- Regras aprendidas manualmente ficam visiveis e editaveis.
- Regra aprendida nao deve vazar dados sensiveis em logs.

US-024: Como usuario, quero revisar transacoes pendentes ou incertas para melhorar a qualidade da base.

Aceite:

- Filtro `revisao recomendada` inclui pendentes, baixa confianca, erro de IA e categoria generica.
- Usuario pode editar categoria/subcategoria individualmente.
- Usuario pode salvar alteracoes pendentes.
- Predicado de revisao recomendada existe fora da UI e possui teste automatizado.

US-025: Como usuario, quero aplicar categoria em lote sobre transacoes filtradas ou selecionadas para acelerar revisoes.

Aceite:

- Usuario escolhe entre aplicar no filtro atual ou nas linhas selecionadas.
- Tela mostra previa do total afetado antes de aplicar.
- Alteracao em lote nao sobrescreve categorias manuais sem confirmacao explicita.
- Resultado informa quantas transacoes foram alteradas.

US-026: Como usuario, quero ver quais transacoes casam com uma regra antes de alterar sua prioridade ou padrao.

Aceite:

- Tela de regras permite previsualizar transacoes afetadas.
- Preview respeita filtros de workspace.
- Alteracoes relevantes em regras exigem confirmacao quando afetarem muitas transacoes.

US-027: Como administrador, quero historico de categorizacao para auditar mudancas importantes.

Aceite:

- Alteracoes de categoria registram origem anterior e nova origem.
- Historico registra usuario, data e fonte da mudanca quando disponivel.
- Historico pode ser consultado por transacao.

US-010: Como usuario, quero categorizacao por similaridade para reaproveitar classificacoes anteriores.

Aceite:

- Sistema compara novas transacoes com exemplos ja classificados.
- Sugestoes por similaridade registram fonte `embedding`.
- Sugestoes com baixa confianca ficam pendentes de revisao.

US-011: Como usuario, quero sugestoes por LLM apenas para casos ambiguos para melhorar classificacao sem aumentar custo desnecessariamente.

Aceite:

- LLM so e chamado quando regra e embedding nao resolvem com confianca suficiente.
- Resultado registra fonte `llm`, confianca e justificativa.
- Usuario pode aceitar ou corrigir a sugestao.

US-028: Como administrador, quero que categorizacao e recategorizacao em lote processem transacoes em pequenos lotes para evitar timeouts.

Aceite:

- Processamento usa lotes configuraveis.
- Resultado registra processadas, alteradas, ignoradas e erros.
- Importacao TXT/CSV nao depende de embedding/LLM para concluir.
- Processo pode ser retomado ou reexecutado sem duplicar classificacoes manuais.

US-029: Como usuario, quero regras por regex em fase futura para classificar descricoes mais complexas.

Aceite:

- Regex invalidas sao rejeitadas com mensagem clara.
- Regras regex possuem prioridade e podem ser ativadas/desativadas.
- Motor de regras continua avaliando regras simples antes de regex quando configurado.

## Epic 7: Dashboards

US-012: Como usuario, quero dashboards financeiros para entender meus gastos e tendencias.

Aceite:

- Dashboard mostra gastos por mes.
- Dashboard mostra gastos por categoria.
- Dashboard permite filtrar periodo.

US-030: Como usuario, quero ver qualidade da categorizacao no dashboard para saber se os indicadores sao confiaveis.

Aceite:

- Dashboard mostra percentual categorizado manualmente, por regra, por IA e pendente.
- Dashboard destaca meses com muitas transacoes pendentes.
- Indicadores deixam claro quando ha baixa qualidade de classificacao.

US-031: Como usuario, quero drill-down dos graficos para chegar nas transacoes que explicam um valor.

Aceite:

- Clique em categoria, mes ou indicador abre lista filtrada de transacoes.
- Filtros aplicados ficam visiveis.
- Usuario pode voltar ao dashboard mantendo contexto.

US-032: Como usuario, quero alertas de aumento relevante por categoria para identificar mudancas de gasto.

Aceite:

- Sistema compara gasto da categoria com mes anterior.
- Alerta mostra categoria, variacao absoluta e percentual.
- Alerta ignora categorias com volume insuficiente conforme regra definida.

US-033: Como usuario, quero orcamento por categoria para acompanhar limites de gasto.

Aceite:

- Usuario define limite mensal por categoria.
- Dashboard mostra realizado versus orcado.
- Alertas indicam categorias proximas ou acima do limite.

US-034: Como usuario, quero identificar custos recorrentes para entender comprometimento mensal.

Aceite:

- Sistema sugere recorrencias por descricao, valor e periodicidade.
- Usuario pode recalcular recorrencias sob demanda.
- Dashboard mostra comprometimento recorrente estimado.
- Marcacao de recorrencia deve ser reversivel.

## Epic 7.1: Indicadores de Controle Financeiro

US-037: Como usuario, quero ver um resumo executivo mensal para entender rapidamente minha situacao financeira.

Aceite:

- Dashboard exibe receitas, despesas, saldo do periodo e taxa de poupanca.
- Indicadores mostram comparacao com mes anterior.
- Valores usam formato BRL e deixam claro o periodo analisado.
- Indicadores ignoram transacoes duplicadas e respeitam filtros ativos.

US-038: Como usuario, quero acompanhar fluxo de caixa por mes para identificar tendencia de sobra ou deficit.

Aceite:

- Grafico mensal mostra receitas, despesas e saldo.
- Usuario consegue alternar entre visao de competencia e caixa quando os dados permitirem.
- Mes atual mostra projecao de fechamento apenas quando houver base suficiente.
- Drill-down leva para as transacoes que compoem cada valor.

US-039: Como usuario, quero separar gastos fixos, variaveis e eventuais para controlar o que posso ajustar.

Aceite:

- Categorias ou regras podem marcar gasto como fixo, variavel ou eventual.
- Dashboard mostra participacao percentual de cada tipo no total de despesas.
- Indicador destaca aumento de gastos variaveis frente ao mes anterior.

US-040: Como usuario, quero acompanhar comprometimento de renda com gastos recorrentes para saber quanto ja esta comprometido no mes.

Aceite:

- Dashboard calcula total recorrente estimado.
- Indicador compara recorrencias com receitas do periodo.
- Sistema mostra lista das principais recorrencias e ultima ocorrencia detectada.
- Usuario pode revisar ou desfazer marcacao de recorrencia.

US-041: Como usuario, quero acompanhar gastos por categoria e subcategoria para descobrir onde o dinheiro esta indo.

Aceite:

- Dashboard mostra ranking de categorias por valor.
- Categoria pode expandir para subcategorias quando existirem.
- Indicador mostra variacao absoluta e percentual contra mes anterior.
- Usuario consegue abrir transacoes daquela categoria/subcategoria.

US-042: Como usuario, quero identificar estabelecimentos ou descricoes que mais impactam meus gastos.

Aceite:

- Dashboard mostra top descricoes/estabelecimentos por valor e quantidade.
- Nomes devem ser normalizados para reduzir duplicidade visual.
- Usuario consegue filtrar por categoria, periodo e origem.

US-043: Como usuario, quero acompanhar cartao de credito para prever fatura e evitar surpresa no fechamento.

Aceite:

- Dashboard mostra despesas de cartao por periodo.
- Quando houver data de fatura/vencimento, indicador mostra previsao por fatura.
- Pagamentos de fatura aparecem separados de despesas do cartao.
- Indicador sinaliza possiveis faturas sem pagamento conciliado quando a conciliacao existir.

US-044: Como usuario, quero comparar gasto real contra orcamento para agir antes de estourar limites.

Aceite:

- Usuario define orcamento mensal por categoria.
- Dashboard mostra realizado, orcado, saldo e percentual consumido.
- Categorias proximas do limite e acima do limite ficam destacadas.
- Drill-down mostra transacoes responsaveis pelo consumo do orcamento.

US-045: Como usuario, quero alertas financeiros acionaveis para focar no que precisa de atencao.

Aceite:

- Alertas cobrem aumento relevante por categoria, gasto acima do orcamento, queda de receita e excesso de pendencias de categorizacao.
- Cada alerta mostra motivo, valor envolvido e atalho para revisar transacoes.
- Alertas devem evitar ruído quando o volume de dados for insuficiente.

US-046: Como usuario, quero medir qualidade dos dados para confiar nos indicadores.

Aceite:

- Dashboard mostra percentual de transacoes categorizadas, pendentes, com baixa confianca e com erro de importacao.
- Dashboard mostra importacoes recentes com erro ou duplicidade.
- Indicadores financeiros sinalizam quando a qualidade dos dados pode distorcer a leitura.

US-047: Como usuario, quero uma visao de evolucao patrimonial simples para acompanhar saldo acumulado ao longo do tempo.

Aceite:

- Dashboard calcula saldo acumulado a partir de receitas e despesas importadas.
- Indicador deixa claro que nao substitui saldo bancario real enquanto nao houver integracao bancaria.
- Usuario pode filtrar por conta/origem quando essa informacao estiver disponivel.

## Epic 8: Conciliacao

US-013: Como usuario, quero conciliar pagamentos de fatura no extrato com cartoes para entender se as faturas foram pagas corretamente.

Aceite:

- Sistema sugere conciliacoes por valor e periodo.
- Usuario pode aceitar ou rejeitar sugestoes.
- Conciliacao aceita fica registrada.

US-035: Como usuario, quero separar data da compra e data de vencimento/pagamento quando aplicavel para analisar competencia e caixa.

Aceite:

- Transacoes de cartao podem guardar data de compra e data de fatura/vencimento.
- Consultas deixam claro qual data esta sendo filtrada.
- Dashboards podem usar competencia ou caixa conforme decisao de produto.

## Epic 9: PDF

US-014: Como usuario, quero importar PDFs de fatura em uma fase futura para reduzir conversao manual.

Aceite:

- PDF e enviado e armazenado.
- Sistema identifica emissor/layout quando possivel.
- Transacoes sao extraidas com validacao.
- Falhas ficam disponiveis para revisao.

US-036: Como usuario, quero importar PDF de fatura Itau em uma fase futura com extracao validada.

Aceite:

- Parser identifica fatura Itau quando layout for suportado.
- Transacoes extraidas preservam linha/texto de origem quando possivel.
- Parser diferencia data da compra e data da fatura quando disponivel.
- Fixtures usadas em testes devem ser anonimizadas.
