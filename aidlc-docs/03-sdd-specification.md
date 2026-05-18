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
- `category_id`
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
2. Calcular hash.
3. Registrar `SourceFile`.
4. Criar `ImportJob`.
5. Detectar layout.
6. Persistir linhas brutas quando aplicavel.
7. Executar parser especifico.
8. Validar campos obrigatorios.
9. Persistir transacoes validas.
10. Persistir erros por linha.
11. Executar categorizacao automatica disponivel.
12. Atualizar status final da importacao.

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
- A estrategia oficial de categorizacao e: Regra -> Embedding -> LLM -> Revisao.
- A implementacao deve ser faseada para controlar custo e complexidade.
- Regra deterministica roda primeiro e deve ter prioridade quando houver alta confianca.
- Embedding deve ser usado para encontrar similaridade com transacoes ja classificadas.
- LLM deve ser usado apenas quando regra e embedding nao tiverem confianca suficiente.
- Revisao manual deve validar sugestoes incertas.
- Categoria manual sempre prevalece sobre classificacoes automaticas.
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
- Conciliacoes devem ser rastreadas, reversiveis e visiveis ao usuario.

## Consulta de Transacoes

- A listagem de transacoes deve ser paginada para permitir navegar pelo historico
  sem carregar todos os lancamentos de uma vez.
- A listagem de transacoes deve vir por padrao ordenada por `transaction_date`
  decrescente, exibindo os lancamentos mais recentes primeiro.
- A API deve permitir ordenacao por `transaction_date`, `amount`, `description`,
  `direction` e `source_type`.
- Direcoes de ordenacao validas: `asc` e `desc`.
- Ordenacoes invalidas devem retornar erro claro, sem cair silenciosamente em um
  comportamento inesperado.
- A interface deve expor controles de ordenacao e paginacao na tela de transacoes.

## Dashboard e Indicadores

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
- Quando a transacao estiver classificada em subcategoria, o ranking principal do
  dashboard deve agrupar pelo pai da categoria.
- Transacoes marcadas como pagamento de fatura (`direction = payment`) devem ficar
  fora do ranking de despesas por categoria.
- Qualidade de dados deve indicar transacoes categorizadas, pendentes de categoria,
  importacoes com erro e importacoes duplicadas.
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
