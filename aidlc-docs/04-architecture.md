# Architecture

## Estilo

Aplicacao online modular com separacao clara entre:

- Interface de usuario/API.
- Servico de importacao.
- Detectores de layout.
- Parsers por origem/layout.
- Validadores.
- Repositorios de persistencia.
- Banco relacional.

## Componentes

Frontend:

- React + TypeScript + Vite.
- Mobile-first, publicado como app estatico no AWS Amplify Hosting.
- Tailwind CSS para estilos.
- shadcn/ui para componentes de interface.
- Recharts para paineis e graficos.
- TanStack Query para chamadas e cache de API.
- Upload ou selecao de arquivos.
- Lista de importacoes.
- Detalhe de importacao com contadores e erros.
- Lista de transacoes importadas.
- Categorizacao manual.
- Dashboards financeiros.
- Conciliacao entre extrato e cartao.

Backend API:

- Autenticacao por usuario/senha e suporte planejado a Google.
- Endpoints para criar importacao, listar importacoes, consultar erros e transacoes.
- Endpoints para categorias, regras e dashboards.
- Orquestracao do processamento.
- Deve estar online desde o MVP para permitir uso via mobile.

Deployment inicial:

- Frontend publicado no AWS Amplify Hosting.
- Backend Python publicado em AWS Lambda.
- API HTTP acessivel pelo frontend web/mobile.
- Supabase Free como banco/Auth inicial.
- Arquivos enviados pelo usuario devem ser armazenados no Supabase Storage inicialmente.
- O deploy deve evitar custo fixo sempre que possivel.
- A carga historica inicial deve ser processada em lotes para evitar timeout de funcoes serverless gratuitas.

Arquitetura de deploy do MVP:

```text
Browser mobile/web
  -> AWS Amplify Hosting
  -> API Gateway HTTP API
  -> AWS Lambda Python API
  -> Supabase Auth/PostgreSQL/Storage
```

API Gateway:

- Usar API Gateway HTTP API no MVP.
- Nao usar API Gateway REST API no MVP.
- Autenticacao continua sendo validada no backend com token Supabase.
- CORS deve permitir o dominio do Amplify e ambiente local de desenvolvimento.

Restricoes de custo:

- Nao usar RDS no MVP.
- Nao usar NAT Gateway no MVP.
- Nao ativar WAF no Amplify sem decisao explicita.
- Controlar logs no CloudWatch.
- Monitorar storage do Supabase, especialmente PDFs.

Ingestion Core:

- `FileClassifier`: detecta layout.
- `ParserRegistry`: seleciona parser.
- `BankStatementTxtParser`: parser do TXT de conta.
- `CreditCardCsvParser`: parser dos CSVs de fatura.
- `ImportValidator`: valida modelo canonico.
- `DedupeService`: calcula hash e chaves de unicidade.
- `CategorizationService`: aplica regras e registra categorias.
- `ReconciliationService`: relaciona pagamentos e faturas.

AI Categorization:

- `RuleCategorizer`: aplica regras deterministicas.
- `EmbeddingCategorizer`: usa `sentence-transformers/all-MiniLM-L6-v2` para similaridade.
- `LLMCategorizer`: usa Groq API com `llama3-8b-8192` para casos ambiguos.
- `CategorizationOrchestrator`: executa Regra -> Embedding -> LLM -> Revisao.
- Providers devem ficar atras de interfaces para facilitar troca futura.
- `EmbeddingCategorizer` deve ser executado fora da Lambda sincrona de upload/importacao no MVP.
- Se embedding local for usado em AWS Lambda, preferir Lambda separada e avaliar container image, memoria, cold start e timeout.

Database:

- `users`
- `workspaces`
- `workspace_members`
- `source_files`
- `import_jobs`
- `raw_transaction_lines`
- `transactions`
- `import_errors`
- `categories`
- `transaction_category_assignments`
- `categorization_rules`
- `reconciliations`

## Stack Definida

Backend:

- Python com FastAPI para API e servicos de ingestao.
- SQLAlchemy para persistencia.
- Alembic para migracoes.
- Pydantic para contratos e validacao.

Frontend:

- React + TypeScript.
- Interface operacional enxuta com telas de importacao, status e consulta.

Banco:

- Supabase Free sera usado inicialmente por oferecer PostgreSQL e Auth com baixo custo operacional.
- A aplicacao deve tratar Supabase como provider inicial, nao como dependencia de dominio.
- O acesso ao banco no backend deve usar SQLAlchemy e migracoes Alembic para facilitar migracao futura para outro PostgreSQL.
- SQLite pode ser usado apenas para prototipagem local, se necessario.
- DynamoDB e alternativa se a prioridade absoluta for serverless/custo, mas complica consultas relacionais, dashboards e conciliacao.

Autenticacao:

- Supabase Auth pode ser usado inicialmente para email/senha e Google.
- O backend deve encapsular verificacao de usuario/sessao em uma camada propria para permitir troca futura de provedor de Auth.

Portabilidade:

- Evitar regras de negocio em triggers/funcoes especificas do Supabase.
- Usar SQL padrao e migracoes versionadas sempre que possivel.
- Manter storage de arquivos atras de uma interface de repositorio.
- Nao consultar Supabase diretamente pelo frontend para dados financeiros sensiveis; passar pelo backend quando houver regra de negocio.

Testes:

- Pytest para backend.
- Testes unitarios de parsers.
- Testes de integracao com banco temporario.
- Playwright ou Vitest para frontend conforme stack final.

## Contratos de API Iniciais

`POST /imports`

- Recebe upload de arquivo.
- Retorna `import_job_id` e status inicial.

`GET /imports`

- Lista importacoes.

`GET /imports/{id}`

- Detalha contadores, status e arquivo.

`GET /imports/{id}/errors`

- Lista erros de parsing/validacao.

`GET /transactions`

- Lista transacoes com filtros por periodo, origem e descricao.

`PATCH /transactions/{id}/category`

- Atualiza categoria manualmente.

`GET /dashboards/summary`

- Retorna indicadores por periodo, categoria e origem.

`POST /reconciliations/suggest`

- Sugere conciliacoes entre pagamentos de fatura e faturas de cartao.

## Observabilidade

- Logar apenas metadados: id da importacao, nome de arquivo, hash parcial, status e contadores.
- Nao logar descricao completa, valores ou dados sensiveis quando nao necessario.
- Medir tempo de parsing, linhas processadas e erros por layout.
