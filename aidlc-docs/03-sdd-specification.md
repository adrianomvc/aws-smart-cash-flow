# SDD Specification

## Fonte de Verdade Funcional

Esta especificacao governa o comportamento inicial do sistema. Mudancas de comportamento devem ser descritas aqui antes da implementacao.

## Modelo Canonico

Transaction:

- `id`: identificador interno.
- `workspace_id`: conta/espaco de dados ao qual a transacao pertence.
- `source_file_id`: arquivo de origem.
- `import_job_id`: execucao de importacao.
- `source_type`: `bank_statement`, `credit_card_statement` ou `unknown`.
- `source_name`: nome inferido da origem, quando disponivel.
- `account_or_card`: conta/cartao inferido, quando disponivel.
- `transaction_date`: data do lancamento.
- `description`: descricao normalizada.
- `raw_description`: descricao original.
- A normalizacao deve preservar `raw_description` sem alteracao e produzir uma
  `description` operacional para busca, regras e indicadores.
- A normalizacao deve remover acentos, converter para maiusculas, tratar
  separadores comuns de cartao como espaco, remover tokens duplicados
  adjacentes e descartar codigos numericos longos de autorizacao/referencia
  quando vierem como tokens isolados.
- A normalizacao nao deve remover palavras relevantes do estabelecimento,
  categoria, canal ou descricao da compra.
- Quando descricoes de cartao vierem no padrao `CANAL*ESTABELECIMENTO`, a
  normalizacao deve preservar os dois lados quando forem semanticamente uteis
  para classificacao, por exemplo delivery, marketplace, posto de combustivel
  ou intermediador de pagamento.
- Para marketplaces, como Mercado Livre, Shopee e Amazon Marketplace, a
  normalizacao deve preservar o complemento apos `*` quando ele diferenciar loja,
  produto ou vendedor; o complemento so deve ser removido quando for repeticao
  ou variacao truncada do proprio marketplace.
- Aliases conhecidos de marcas/canais podem ser expandidos para melhorar busca
  e regras, por exemplo `MERCADOLIVRE` para `MERCADO LIVRE`.
- Quando a expansao de aliases ou o separador do cartao gerar sequencias
  repetidas, a normalizacao deve manter uma unica ocorrencia da sequencia sem
  perder o estabelecimento complementar.
- Quando intermediadores de pagamento trouxerem o proprio intermediador repetido
  e um complemento curto truncado, como `PAYPAL*PAYPAL *SH`, a normalizacao pode
  expandir a sigla apenas em contexto seguro do intermediador, preservando o
  estabelecimento provavel sem aplicar a sigla globalmente.
- Canais numericos conhecidos podem ser unidos apenas quando o complemento
  tornar o significado seguro, por exemplo `99 FOOD` para `99FOOD` e `99 APP`
  para `99APP`; descricoes genericas como `99` nao devem ser enriquecidas por
  suposicao deterministica.
- Abreviacoes seguras no inicio da descricao podem ser expandidas quando houver
  complemento, por exemplo `MP*LOJA` para `MERCADO PAGO LOJA`; a abreviacao
  isolada deve ser preservada.
- Sequencias truncadas recorrentes de adquirente ou descricao podem ser
  consolidadas por contexto, como `UBER DO BRASI` para `UBER BR`, sem aplicar
  tokens truncados globalmente a outros estabelecimentos.
- Quando a descricao terminar com dois tokens numericos curtos que representem
  parcela atual e total de parcelas, como `ANGLO 03 10`, a normalizacao deve
  remover esses tokens de parcela para agrupar a compra pelo estabelecimento,
  preservando `raw_description`.
- O sistema deve permitir reprocessar as descricoes normalizadas das transacoes
  existentes do workspace quando a estrategia de normalizacao evoluir.
- O reprocessamento de descricoes existentes deve informar quantas transacoes
  foram avaliadas e quantas foram alteradas, preservando `raw_description`.
- O reprocessamento deve recalcular tambem metadados derivados da descricao
  bruta, incluindo `installment_current` e `installment_total`, para atualizar
  transacoes antigas quando a regra de parcelas evoluir.
- O reprocessamento deve recalcular a `natural_dedupe_key` com a regra atual
  para transacoes antigas. Quando a chave recalculada ja pertencer a outra
  transacao do workspace, o sistema nao deve sobrescrever a chave por causa da
  restricao unica; deve reportar o conflito para revisao de duplicidade
  historica.
- O sistema deve disponibilizar uma consulta de possiveis duplicados historicos,
  agrupando transacoes pela chave natural recalculada com a regra atual. A
  consulta deve respeitar `workspace_id`, retornar arquivo/importacao/linha de
  origem e nao deve excluir nem ocultar transacoes automaticamente.
- A interface deve permitir navegar de um grupo de possiveis duplicados para a
  lista de transacoes filtrada por periodo, descricao e tipo financeiro do grupo,
  facilitando revisao manual antes de qualquer exclusao.
- Quando nenhum item do grupo possuir a chave natural atual gravada, a interface
  deve indicar o primeiro lancamento carregado como principal sugerido, mantendo
  os demais para revisao manual.
- A interface pode oferecer uma acao de limpeza do grupo para manter o principal
  real ou sugerido e excluir os demais lancamentos revisados somente apos
  confirmacao explicita do usuario.
- A linguagem da interface deve evitar termos tecnicos como `dedupe` na jornada
  do usuario final, preferindo termos como duplicidade, principal, principal
  sugerido e revisar.
- A limpeza de duplicidades historicas geradas por estrategia antiga de
  normalizacao deve ser tratada como fluxo separado com auditoria antes de
  alterar ou ocultar transacoes ja persistidas.
- `amount`: valor decimal.
- `currency`: `BRL` no MVP.
- `direction`: `debit`, `credit` ou `payment`.
- `installment_current`: parcela atual, quando identificada.
- `installment_total`: total de parcelas, quando identificado.
- Em faturas de cartao, quando a descricao bruta indicar parcelamento no fim do
  texto, como `03/10` ou `03 10`, o parser deve gravar
  `installment_current` e `installment_total`, mantendo `raw_description`
  original e usando a descricao normalizada sem os tokens de parcela para
  agrupar a compra.
- Em extratos bancarios, sufixos como `01/04` em descricoes de PIX,
  transferencia, TED, DOC ou TBI devem ser tratados como parte da descricao
  original ou referencia operacional, nao como parcelamento.
- Quando houver dados de parcela, a interface deve exibir a parcela atual,
  total de parcelas e quantas parcelas ainda faltam quando aplicavel.
- `source_line`: linha do arquivo, quando aplicavel.
- `dedupe_key`: chave deterministica de deduplicacao.
- `natural_dedupe_key`: chave de deduplicacao por assinatura natural entre
  arquivos diferentes ou quase iguais.
- A `natural_dedupe_key` deve usar uma descricao canonica propria para
  deduplicacao derivada de `raw_description`, sem depender apenas da
  `description` exibida na tela. Essa descricao canonica deve remover ruidos
  como codigos numericos longos, mas preservar diferenciadores financeiros
  relevantes, como parcela atual/total, para nao agrupar parcelas distintas da
  mesma compra como duplicadas.
- `created_at`: data de criacao.

SourceFile:

- `id`
- `workspace_id`
- `original_filename`
- `content_hash`
- `mime_type`
- `size_bytes`
- `received_at`

ImportJob:

- `id`
- `workspace_id`
- `source_file_id`
- `status`: `pending`, `processing`, `completed`, `completed_with_errors`, `failed`
- `started_at`
- `finished_at`
- `total_rows`
- `valid_rows`
- `error_rows`
- `duplicate_rows`

ImportError:

- `id`
- `workspace_id`
- `import_job_id`
- `source_line`
- `field_name`
- `raw_value`
- `error_code`
- `message`

RawTransactionLine:

- `id`
- `workspace_id`
- `source_file_id`
- `import_job_id`
- `source_line`
- `raw_payload`
- `parse_status`
- `created_at`

Category:

- `id`
- `workspace_id`
- `name`
- `parent_category_id`
- `created_at`
- Nomes de categoria/subcategoria devem ser unicos dentro do mesmo pai, permitindo
  a mesma subcategoria em categorias diferentes.

TransactionCategoryAssignment:

- `id`
- `workspace_id`
- `transaction_id`
- `category_id`
- `source`: `manual`, `rule` ou `ai`
- `confidence`
- `created_at`

CategorizationRule:

- `id`
- `workspace_id`
- `name`
- `match_type`
- `pattern`
- `category_id`: categoria alvo opcional.
- `target_direction`: direcao financeira alvo opcional: `debit`, `credit` ou
  `payment`.
- `priority`
- `active`

User:

- `id`
- `email`
- `password_hash`
- `display_name`
- `auth_provider`
- `created_at`

Workspace:

- `id`
- `name`
- `created_at`

WorkspaceMember:

- `id`
- `workspace_id`
- `user_id`
- `role`: `owner`, `admin` ou `member`
- `created_at`

## Layouts Suportados no MVP

### Conta Corrente TXT

Exemplo observado:

```text
01/07/2025;PIX TRANSF DANIELL01/07;-10,00
```

Contrato:

- Separador: `;`.
- Coluna 1: data em `dd/MM/yyyy`.
- Coluna 2: descricao.
- Coluna 3: valor em formato brasileiro, com virgula decimal.
- Valor negativo representa debito.
- Valor positivo representa credito.
- Valor negativo com descricao normalizada de pagamento de fatura deve ser
  classificado como `payment`, para nao duplicar despesas ja detalhadas na fatura
  do cartao.

### Fatura CSV

Exemplo observado:

```csv
data,lançamento,valor
2026-05-08,99APP       *99App,26.06
```

Contrato:

- Separador: `,`.
- Header obrigatorio: `data`, `lançamento`, `valor`.
- `data`: `yyyy-MM-dd`.
- `valor`: decimal com ponto.
- Lancamento `PAGAMENTO EFETUADO` com valor negativo deve ser classificado como `payment`.
- Valores positivos em fatura representam despesas do cartao.
- Valores negativos em fatura que nao sejam pagamento representam credito,
  devolucao ou estorno do cartao.
- O valor numerico da fatura deve ser preservado como veio no arquivo; a direcao
  canonica (`debit`, `credit`, `payment`) define como o dashboard interpreta o
  lancamento.

### PDF

PDFs ficam fora do MVP inicial. A arquitetura deve permitir adicionar parser de PDF posteriormente, sem acoplar a implementacao atual a OCR ou bibliotecas pesadas.

## Regras de Dedupe

Arquivo:

- `content_hash` deve ser unico para evitar reimportacao identica.
- Se o usuario excluir manualmente todas as transacoes persistidas de um arquivo,
  uma nova importacao do mesmo arquivo deve ser permitida, reutilizando a origem
  auditavel existente e criando novo `ImportJob`.

Transacao:

- `dedupe_key` deve ser derivada de `source_file_id`, `source_line`, `transaction_date`, `raw_description` e `amount`.
- Se o mesmo arquivo for reprocessado, transacoes existentes devem ser reaproveitadas ou ignoradas, nao duplicadas.
- Arquivos diferentes com conteudo quase igual devem passar por dedupe adicional
  por assinatura natural da transacao, usando ao menos workspace, tipo de origem,
  data, descricao normalizada, valor e direcao.
- O MVP deve preservar auditoria de duplicidade: linhas ignoradas ou marcadas como
  possiveis duplicadas precisam aparecer no resumo da importacao, sem inflar os
  indicadores financeiros.

## Fluxo de Importacao

1. Receber ou selecionar arquivo.
2. Gerar previa sem persistir `SourceFile`, `ImportJob`, linhas brutas ou
   transacoes.
3. Na previa, calcular hash, detectar ou respeitar layout manual, executar parser
   especifico, validar campos obrigatorios e indicar duplicidade de arquivo/linha.
4. Aguardar confirmacao explicita do usuario para gravar.
5. Calcular hash.
6. Registrar `SourceFile`.
7. Criar `ImportJob`.
8. Detectar layout ou respeitar layout manual confirmado.
9. Persistir linhas brutas quando aplicavel.
10. Executar parser especifico.
11. Validar campos obrigatorios.
12. Persistir transacoes validas.
13. Persistir erros por linha.
14. Executar categorizacao automatica disponivel.
15. Atualizar status final da importacao.

## Upload em Lote

- A interface deve permitir selecionar multiplos arquivos TXT/CSV em um unico
  gesto operacional.
- A interface deve permitir escolher o layout/parser suportado no upload
  (`auto`, extrato TXT ou fatura CSV) quando a deteccao automatica for ambigua.
- No MVP, cada arquivo do lote deve ser enviado individualmente para o endpoint
  de importacao existente, preservando uma importacao independente por arquivo.
- Falha em um arquivo nao deve bloquear os demais arquivos do lote.
- A interface deve mostrar resultado por arquivo, incluindo status, linhas novas,
  duplicadas e com erro.
- Quando o usuario escolher manualmente o layout, o backend deve usar esse parser
  e registrar o `source_kind` resultante nos metadados do arquivo.
- Antes de confirmar a gravacao, a interface deve mostrar uma previa por arquivo
  com parser detectado/escolhido, linhas validas, erros e duplicidades. Arquivos
  duplicados ou sem linhas validas nao devem ser enviados na confirmacao.
- Quando todos os arquivos da previa forem duplicados, com erro ou sem linhas
  validas, a interface deve mostrar uma mensagem explicita de que nao ha arquivo
  novo para importar, em vez de deixar uma acao de confirmacao sem efeito.
- Em lotes com muitos arquivos, a acao principal da previa deve continuar
  visivel sem exigir rolagem ate o fim da lista completa de arquivos.
- Para lotes com muitos arquivos, a interface deve mostrar progresso durante a
  geracao da previa e durante a importacao, mantendo um resumo final por arquivo
  depois que o processamento terminar.
- Para lotes grandes, a interface deve avisar que o MVP processa os arquivos um
  a um, recomendar divisao em blocos menores quando houver dezenas de arquivos e
  permitir que o usuario prossiga conscientemente. Esse aviso nao substitui o
  caminho futuro de processamento assincrono.

## Consulta de Importacoes

- A listagem de importacoes deve ser paginada para permitir navegar pelo
  historico sem carregar todos os jobs de uma vez.
- A listagem de importacoes deve permitir filtrar por status e buscar pelo nome
  do arquivo original.
- A listagem de importacoes deve permitir filtrar apenas importacoes com erros
  de linha para suportar drill-down do dashboard.
- A resposta da API deve informar `total`, `limit` e `offset` para suportar
  paginacao confiavel na interface.
- O detalhe da importacao deve exibir metadados operacionais do arquivo, parser
  utilizado, status, contadores de linhas e erros por linha sem expor payload
  bruto desnecessario.
- O MVP deve permitir excluir uma importacao operacionalmente quando o usuario
  precisar limpar um arquivo e reimportar. A exclusao deve remover o `ImportJob`,
  suas linhas brutas, erros, transacoes persistidas e classificacoes vinculadas,
  sempre escopada por `workspace_id`.
- A exclusao operacional de importacao deve manter o `SourceFile` como origem
  auditavel; se nao houver transacoes restantes para esse arquivo, uma nova
  importacao do mesmo conteudo deve ser permitida.

## Multiusuario

- Todo dado financeiro deve pertencer a um `workspace_id`.
- O uso inicial pode ter um unico workspace compartilhado pelo casal.
- APIs e consultas devem sempre filtrar por workspace.
- O design deve permitir multiplos usuarios no mesmo workspace no futuro.

## Autenticacao

- O sistema deve permitir login por email e senha.
- Senhas devem ser armazenadas apenas como hash seguro.
- Login com Google deve ser suportado ou mantido como evolucao compativel com o modelo de usuario.
- Um usuario pode pertencer a um ou mais workspaces.
- O workspace ativo deve ser usado como escopo obrigatorio para consultas e importacoes.

## Categorizacao

- O MVP deve permitir categoria manual.
- O usuario deve conseguir remover uma categoria manual ou automatica de uma
  transacao, voltando-a para o estado sem classificacao.
- A interface deve informar o resultado de uma alteracao de categoria; quando a
  alteracao remover a transacao da fila de revisao, a mensagem deve explicar que
  ela saiu da lista por nao estar mais pendente.
- O usuario deve conseguir corrigir manualmente o tipo financeiro de uma
  transacao entre `debit`, `credit` e `payment`, especialmente para ajustes
  pontuais de pagamento de fatura.
- Regras deterministicas podem categorizar transacoes e/ou ajustar a direcao
  financeira para separar pagamentos de fatura dos gastos reais.
- Uma regra deve ter ao menos uma acao: `category_id` ou `target_direction`.
- Antes de aplicar uma regra, a API deve permitir preview das transacoes afetadas
  e das mudancas de categoria/direcao.
- A estrategia oficial de categorizacao e: Regra -> Embedding -> LLM -> Revisao.
- A implementacao deve ser faseada para controlar custo e complexidade.
- Regra deterministica roda primeiro e deve ter prioridade quando houver alta confianca.
- Embedding deve ser usado para encontrar similaridade com transacoes ja classificadas.
- LLM deve ser usado apenas quando regra e embedding nao tiverem confianca suficiente.
- Revisao manual deve validar sugestoes incertas.
- Categoria manual sempre prevalece sobre classificacoes automaticas.
- Categoria manual nao deve ser sobrescrita por regra automatica; ajustes de
  direcao financeira por regra continuam permitidos enquanto nao houver historico
  manual especifico de direcao.
- Cada classificacao deve preservar fonte, confianca, justificativa e status de revisao.

Providers iniciais de IA:

- Embeddings: `sentence-transformers` com modelo `all-MiniLM-L6-v2`, preferencialmente local.
- LLM: Groq API com `llama3-8b-8192`.
- O codigo deve usar interfaces/adaptadores para permitir troca futura de provider/modelo.
- Como o backend roda em Lambda, embeddings locais precisam ser avaliados quanto a tamanho do pacote, cold start e limites de deploy.
- Embeddings locais nao devem rodar no caminho sincrono principal de upload/importacao no MVP.
- Quando implementados, embeddings devem rodar em job separado, lote pequeno ou Lambda separada, preferencialmente com container image se o pacote exceder limites de zip/layers.
- Importacao TXT/CSV deve terminar independentemente da categorizacao por embedding/LLM.

## Conciliacao

- O sistema deve conseguir identificar pagamentos de fatura no extrato.
- A conciliacao inicial pode comparar descricao, data aproximada e valor.
- A API deve sugerir pares provaveis entre pagamento da conta corrente e
  pagamento registrado na fatura quando ambos estiverem marcados como
  `payment`, tiverem mesmo valor absoluto e datas dentro de uma janela
  configuravel.
- O dashboard deve exibir as sugestoes de conciliacao do periodo e permitir abrir
  os lancamentos correspondentes para auditoria.
- Conciliacoes devem ser rastreadas, reversiveis e visiveis ao usuario.

## Consulta de Transacoes

- A evolucao deve permitir cadastro manual de transacao quando o lancamento nao
  vier de arquivo importado. A transacao manual deve registrar origem `manual`,
  data, descricao, valor, tipo financeiro, categoria opcional e workspace.
- Transacoes manuais devem entrar nos dashboards normalmente, mas precisam ficar
  diferenciadas de transacoes importadas para auditoria e deduplicacao.
- A listagem de transacoes deve ser paginada para permitir navegar pelo historico
  sem carregar todos os lancamentos de uma vez.
- A interface deve permitir filtrar por periodo com atalhos de uso recorrente:
  todos, mes atual, mes anterior, ano atual e ano anterior.
- A interface deve permitir informar data inicial e data final manualmente.
- A API e a interface devem permitir filtrar transacoes por `import_job_id` para
  auditar os lancamentos gerados por um arquivo importado.
- Ao filtrar por categoria pai, a listagem deve incluir transacoes classificadas
  na categoria pai e em todas as suas subcategorias diretas.
- Ao filtrar por subcategoria, a listagem deve incluir somente transacoes daquela
  subcategoria.
- A listagem de transacoes deve vir por padrao ordenada por `transaction_date`
  decrescente, exibindo os lancamentos mais recentes primeiro.
- A API deve permitir ordenacao por `transaction_date`, `amount`, `description`,
  `direction` e `source_type`.
- Direcoes de ordenacao validas: `asc` e `desc`.
- Ordenacoes invalidas devem retornar erro claro, sem cair silenciosamente em um
  comportamento inesperado.
- A interface deve expor controles de ordenacao e paginacao na tela de transacoes.
- O MVP deve permitir excluir manualmente uma transacao importada quando o usuario
  identificar um lancamento incorreto. A exclusao deve ser escopada por
  `workspace_id`, remover a classificacao vinculada e atualizar indicadores.
- A evolucao posterior deve trocar exclusao fisica por exclusao logica auditavel,
  reversivel e com historico de quem removeu.

## Dashboard e Indicadores

- Dashboard deve manter os indicadores principais primeiro, apresentar o fluxo
  mensal como grafico de contexto, agrupar paineis operacionais por finalidade e
  fechar a pagina com storytelling financeiro.
- O topo do dashboard pode exibir uma trilha executiva curta no formato
  `entrou -> saiu -> saldo -> compromissos`, inspirada no prototipo, usando
  dados reais ja disponiveis e sem substituir o storytelling de fechamento.
- O storytelling financeiro deve sintetizar resultado do periodo, saude do
  fluxo, principal pressao de gasto, confianca dos dados e uma proxima acao
  sugerida com base nos indicadores disponiveis.
- A evolucao de UX deve prever uma suite de telas financeiras conectadas:
  visao geral, fluxo de caixa, transacoes, cartoes, orcamentos, investimentos,
  metas, relatorios, insights e configuracoes.
- A visao geral deve ser um resumo executivo; telas dedicadas devem aprofundar o
  tema sem duplicar todos os controles do dashboard.
- Indicadores devem sempre respeitar `workspace_id` e filtros de periodo.
- Despesas consideram transacoes com `direction = debit`.
- Receitas consideram transacoes com `direction = credit`.
- Pagamentos de fatura com `direction = payment` devem ficar separados de despesas
  e receitas nos indicadores principais.
- Saldo do periodo deve ser calculado como `receitas - despesas`.
- Taxa de poupanca deve ser calculada como `(receitas - despesas) / receitas`
  quando houver receita positiva; caso contrario deve ser nula.
- Comprometimento da receita deve ser calculado como `despesas / receitas`
  quando houver receita positiva; caso contrario deve ser nulo.
- Ranking por categoria deve considerar despesas e agrupar transacoes sem categoria
  como `Sem categoria`.
- Resumo de categorias no dashboard deve exibir valor total, quantidade de
  transacoes, participacao percentual no total de despesas e ticket medio.
- Dashboard deve exibir gastos por dia da semana no periodo filtrado, calculando
  valor total, quantidade de transacoes, ticket medio e participacao percentual.
- O grafico de gastos por dia da semana deve permitir drill-down para transacoes
  daquele dia dentro do periodo atual, excluindo pagamentos de fatura.
- Quando a transacao estiver classificada em subcategoria, o ranking principal do
  dashboard deve agrupar pelo pai da categoria.
- Transacoes marcadas como pagamento de fatura (`direction = payment`) devem ficar
  fora do ranking de despesas por categoria.
- Dashboard deve oferecer os mesmos atalhos de periodo da consulta de transacoes:
  todos, mes atual, mes anterior, ano atual, ano anterior e personalizado.
- Quando o dashboard estiver filtrado por mes atual ou mes anterior, o grafico de
  fluxo mensal deve usar o ano do mes selecionado para preservar a leitura de
  tendencia anual, enquanto os demais indicadores continuam no periodo filtrado.
- Graficos financeiros devem calcular o eixo Y automaticamente a partir dos dados
  visiveis, incluindo valores maiores que faixas anteriores e saldos negativos.
- Ao clicar em um mes do grafico de fluxo mensal, a interface deve abrir a lista
  de transacoes filtrada pelo mes clicado.
- Ao clicar em indicadores principais do dashboard, a interface deve abrir a
  lista de transacoes preservando o periodo do dashboard e aplicando o tipo
  financeiro correspondente quando existir, como receitas, despesas ou pagamento
  de fatura.
- Ao clicar em uma descricao normalizada relevante no dashboard, a interface deve
  abrir a lista de transacoes preservando o periodo do dashboard e filtrando pela
  descricao selecionada.
- Ao clicar em uma transacao recente no dashboard, a interface deve abrir a lista
  de transacoes filtrando pela data, tipo financeiro e descricao daquele
  lancamento.
- Dashboard deve exibir alertas acionaveis derivados dos dados ja disponiveis,
  como saldo negativo, qualidade baixa, pendencias de categorizacao e
  importacoes com erro.
- Evolucao dos alertas deve incluir crescimento relevante de gastos por categoria
  e aumento percentual expressivo em gastos recorrentes quando houver historico
  suficiente.
- No MVP, uma recorrencia em alta deve aparecer como alerta quando tiver pelo
  menos 3 meses de historico, ultimo valor acima de R$ 50 e aumento igual ou
  superior a 30% contra a media detectada.
- Alerta de crescimento por categoria deve comparar o periodo atual contra o
  periodo anterior de mesmo tamanho, ignorando categorias com volume insuficiente
  e exibindo variacao absoluta e percentual.
- Qualidade de dados deve indicar transacoes categorizadas, pendentes de categoria,
  importacoes com erro e importacoes duplicadas.
- Indicadores acionaveis de qualidade de dados devem permitir navegar diretamente
  para a tela operacional relacionada quando houver pendencia, como revisao ou
  importacoes.
- Evolucao do dashboard deve incluir indicadores de saude financeira: saldo
  atual, fluxo liquido, burn rate, runway, saving rate, comprometimento da
  receita, fatura atual, parcelado futuro, recorrencias, saldo projetado e risco
  de deficit futuro.
- A leitura de fluxo de caixa deve ser organizada em camadas: saude imediata,
  controle operacional, cartao de credito, inteligencia de produto,
  previsibilidade e patrimonio.
- Os KPIs obrigatorios da experiencia principal sao fluxo liquido, saldo
  projetado, parcelado futuro, burn rate e saving rate.
- Burn rate deve representar gasto medio mensal e deixar claro se foi calculado
  por recorrencias, por media historica ou por periodo filtrado.
- No MVP, enquanto recorrencias confirmadas e saldo real ainda nao existirem, o
  burn rate exibido no dashboard deve ser uma estimativa pela media mensal de
  despesas dos ultimos 12 meses ate a data final do filtro. Quando ainda nao
  houver 12 meses de historico, deve usar os meses disponiveis e informar a
  quantidade de meses considerada.
- Runway deve ser calculado como `saldo disponivel / burn rate`, apenas quando
  houver saldo disponivel confiavel e burn rate positivo.
- Comprometimento da receita deve comparar despesas totais contra receitas totais
  do periodo, excluindo pagamentos de fatura para evitar dupla contagem.
- O comprometimento da receita deve ser classificado visualmente em faixas de
  leitura: saudavel abaixo de 70%, atencao entre 70% e 85%, risco acima de 85%.
- Receita deve permitir leitura por fonte e despesa deve permitir leitura por
  tipo operacional, como fixa, variavel ou extraordinaria.
- Indicadores de cartao devem separar gasto do cartao, fatura, pagamento de
  fatura, parcelado futuro e recorrencias do cartao.
- Parcelas identificadas no mes filtrado devem ser projetadas pela diferenca de
  mes/ano entre o mes alvo e a primeira fatura da compra. A primeira fatura deve
  ser o mes da compra quando `dia_compra <= closing_day`; se `dia_compra >
  closing_day`, deve ser o mes seguinte. A parcela so deve aparecer quando o
  numero projetado estiver entre `1` e o total de parcelas, evitando off-by-one
  e parcelas ja vencidas.
- Enquanto nao houver cadastro completo de cartoes, o MVP pode usar
  `default_credit_card_closing_day` e `default_credit_card_due_day`
  configuraveis; a evolucao deve persistir `closing_day` e `due_day` por cartao.
- Parcelado futuro de cartao deve considerar a proxima competencia a partir da
  data final do filtro e somar apenas a parcela prevista para esse proximo mes
  quando a compra ainda estiver dentro do prazo do parcelamento.
- Projecao de fluxo deve explicitar premissas, horizonte e dados usados, como
  receitas recorrentes, despesas recorrentes, parcelas e faturas conhecidas.
- Score de saude financeira deve ser explicavel e deve indicar quando a baixa
  qualidade dos dados torna a leitura preliminar.
- Evolucao patrimonial e net worth devem ficar separados do fluxo operacional,
  com ativos, passivos, data de referencia e origem do saldo.
- Ao navegar do dashboard para importacoes a partir de indicadores de erro ou
  duplicidade, a tela de importacoes deve abrir com o filtro correspondente ja
  aplicado.
- Alertas acionaveis do dashboard devem permitir clique no proprio alerta,
  evitando botoes redundantes quando o destino for evidente.
- Indicadores nao devem expor descricoes completas ou valores sensiveis em logs.

## AI Copilot / Chat Financeiro

- O AI Copilot deve ser tratado como uma tela/conversa propria, conectada aos
  indicadores financeiros, e nao apenas como uma lista estatica de insights.
- A tela deve permitir conversas recentes, novo chat, perguntas sugeridas,
  mensagens do usuario/assistente e um resumo financeiro lateral com saude
  financeira, saldo, receitas, despesas, risco, metas e cartao quando esses
  dados existirem.
- O Copilot deve responder perguntas como saude financeira, possibilidade de
  gasto, onde economizar, quanto sobra e simulacao de compra.
- Respostas devem se apoiar em ferramentas internas rastreaveis, por exemplo
  resumo de fluxo de caixa, projecao, cartoes, orcamentos, metas, investimentos,
  assinaturas, simulacao de compra, simulacao de cenario e calculo de gasto
  seguro.
- O backend deve separar entidades de conversa, mensagens e snapshot de saude
  financeira para permitir auditoria e continuidade sem armazenar dados
  sensiveis desnecessarios.
- O Copilot deve informar premissas, periodo considerado, principais numeros e
  limites da recomendacao; nao deve prometer retorno financeiro nem substituir
  consultoria profissional.
- Antes de usar LLM em producao, devem existir limites de custo, timeout,
  minimizacao de prompt, logs sem payload financeiro sensivel e fallback quando
  o provider estiver indisponivel.

## Tela Publica / Logout

A experiencia fora da sessao deve evoluir para uma tela publica inspirada em
`aidlc-docs/prototipo de telas/tela logout.png`, separada do app autenticado.

- Mostrar proposta de valor do SmartCashFlow para controle financeiro familiar.
- Ter CTAs claros para entrar e criar conta.
- Reforcar seguranca, privacidade e LGPD sem expor dados reais.
- Exibir preview visual do produto, usando dados demonstrativos.
- Conectar com os fluxos futuros de login, cadastro, onboarding e recuperacao
  de sessao.

## Configuracoes e Preferencias

A area de configuracoes deve evoluir conforme
`aidlc-docs/prototipo de telas/smartcashflow_full_product_spec_v3.md`, tratando
Configuracoes como hub de subtelas e nao apenas como tela operacional.

Subareas previstas:

- Perfil.
- Seguranca.
- Preferencias.
- Categorias.
- Contas e Bancos.
- Importacao de Dados.
- Notificacoes.
- Backup e Sincronizacao.
- Assinatura e Plano.
- Sobre o App.

Preferencias financeiras devem permitir configurar moeda, idioma/regiao, meta de
poupanca, limite de comprometimento, perfil de risco, categorias prioritarias e
canais de alerta. Esses dados devem alimentar indicadores, alertas, simulacoes e
futuras respostas do Copilot.

## Internacionalizacao

- A interface deve suportar portugues do Brasil e ingles.
- Portugues do Brasil deve ser o idioma padrao do MVP.
- O usuario deve conseguir alterar o idioma pela interface.
- A preferencia deve ser persistida por usuario quando houver perfil; antes disso,
  pode ser persistida localmente no navegador.
- Datas, numeros e moeda devem respeitar o locale selecionado, mantendo BRL como
  moeda padrao do produto no MVP.

## Casos de Erro

- Arquivo sem layout reconhecido.
- Linha com quantidade incorreta de colunas.
- Data invalida.
- Valor invalido.
- Header CSV ausente ou diferente.
- Violacao de unicidade.
- Falha de banco.

## Testes Obrigatorios por Parser

- Arquivo valido.
- Linha invalida.
- Data invalida.
- Valor invalido.
- Duplicidade.
- Caracteres acentuados em descricao.
