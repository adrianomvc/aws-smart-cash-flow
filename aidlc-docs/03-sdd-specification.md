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
- Para marketplaces configurados como agregadores, como Mercado Livre, Shopee e
  Amazon Marketplace no MVP, a normalizacao pode descartar o vendedor apos `*`
  para agrupar o gasto pelo canal principal.
- Aliases conhecidos de marcas/canais podem ser expandidos para melhorar busca
  e regras, por exemplo `MERCADOLIVRE` para `MERCADO LIVRE`.
- Quando a expansao de aliases ou o separador do cartao gerar sequencias
  repetidas, a normalizacao deve manter uma unica ocorrencia da sequencia sem
  perder o estabelecimento complementar.
- O sistema deve permitir reprocessar as descricoes normalizadas das transacoes
  existentes do workspace quando a estrategia de normalizacao evoluir.
- O reprocessamento de descricoes existentes deve informar quantas transacoes
  foram avaliadas e quantas foram alteradas, preservando `raw_description`.
- A limpeza de duplicidades historicas geradas por estrategia antiga de
  normalizacao deve ser tratada como fluxo separado com auditoria antes de
  alterar ou ocultar transacoes ja persistidas.
- `amount`: valor decimal.
- `currency`: `BRL` no MVP.
- `direction`: `debit`, `credit` ou `payment`.
- `installment_current`: parcela atual, quando identificada.
- `installment_total`: total de parcelas, quando identificado.
- `source_line`: linha do arquivo, quando aplicavel.
- `dedupe_key`: chave deterministica de deduplicacao.
- `natural_dedupe_key`: chave de deduplicacao por assinatura natural entre
  arquivos diferentes ou quase iguais.
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
  mensal como grafico de contexto e exibir o storytelling logo abaixo desse
  grafico, antes dos paineis operacionais de detalhe.
- Indicadores devem sempre respeitar `workspace_id` e filtros de periodo.
- Despesas consideram transacoes com `direction = debit`.
- Receitas consideram transacoes com `direction = credit`.
- Pagamentos de fatura com `direction = payment` devem ficar separados de despesas
  e receitas nos indicadores principais.
- Saldo do periodo deve ser calculado como `receitas - despesas`.
- Taxa de poupanca deve ser calculada como `(receitas - despesas) / receitas`
  quando houver receita positiva; caso contrario deve ser nula.
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
- Alerta de crescimento por categoria deve comparar o periodo atual contra o
  periodo anterior de mesmo tamanho, ignorando categorias com volume insuficiente
  e exibindo variacao absoluta e percentual.
- Qualidade de dados deve indicar transacoes categorizadas, pendentes de categoria,
  importacoes com erro e importacoes duplicadas.
- Indicadores acionaveis de qualidade de dados devem permitir navegar diretamente
  para a tela operacional relacionada quando houver pendencia, como revisao ou
  importacoes.
- Ao navegar do dashboard para importacoes a partir de indicadores de erro ou
  duplicidade, a tela de importacoes deve abrir com o filtro correspondente ja
  aplicado.
- Alertas acionaveis do dashboard devem permitir clique no proprio alerta,
  evitando botoes redundantes quando o destino for evidente.
- Indicadores nao devem expor descricoes completas ou valores sensiveis em logs.

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
