# Current Endpoint Domain Map

## Objetivo

Mapear os endpoints atuais do backend por dominio de produto para orientar:

- contratos iniciais;
- futura modularizacao interna;
- futura separacao multirepo;
- ordem segura de extracao de servicos.

Este documento descreve o estado atual. Ele nao cria microservicos ainda.

## Dominios Atuais

| Dominio | Responsabilidade | Status |
| --- | --- | --- |
| Health | Disponibilidade da API | Atual |
| Identity | Cadastro, login, refresh e reset de senha | Atual |
| Workspaces | Workspace ativo e papel do usuario | Atual |
| Imports | Upload, preview, jobs, erros e exclusao de importacao | Atual |
| Ledger | Transacoes, categorias, regras, revisao e normalizacao | Atual |
| Dashboard | Leituras agregadas e indicadores derivados | Atual |
| Planning | Calendario, orcamentos e metas | Atual minimo |
| Insights | IA, insights, Copilot e simulacoes inteligentes | Planejado |
| Billing | Assinaturas, planos e invoices | Planejado |
| Wealth | Investimentos, ativos, passivos e patrimonio | Planejado |

## Endpoints Atuais

### Health

| Metodo | Path | Dono atual | Dono alvo |
| --- | --- | --- | --- |
| GET | `/health` | API | API |

### Identity

| Metodo | Path | Dono atual | Dono alvo |
| --- | --- | --- | --- |
| POST | `/v1/auth/signup` | API/Auth | identity-service |
| POST | `/v1/auth/login` | API/Auth | identity-service |
| POST | `/v1/auth/refresh` | API/Auth | identity-service |
| POST | `/v1/auth/reset-password` | API/Auth | identity-service |

Observacao:

- a extracao de identity so deve acontecer quando familia, membros e permissoes
  avancadas amadurecerem;
- ate la, o BFF/API atual deve preservar compatibilidade com o frontend.

### Workspaces

| Metodo | Path | Dono atual | Dono alvo |
| --- | --- | --- | --- |
| GET | `/v1/workspaces/current` | API/WorkspaceService | identity-service |

Observacao:

- workspace continua sendo o limite de isolamento de dados;
- todo dominio financeiro deve filtrar por `workspace_id`.

### Imports

| Metodo | Path | Dono atual | Dono alvo |
| --- | --- | --- | --- |
| GET | `/v1/imports` | API/ImportService | import-service |
| POST | `/v1/imports` | API/ImportService | import-service |
| POST | `/v1/imports/preview` | API/ImportService | import-service |
| GET | `/v1/imports/{import_job_id}` | API/ImportService | import-service |
| DELETE | `/v1/imports/{import_job_id}` | API/ImportService | import-service |
| GET | `/v1/imports/{import_job_id}/errors` | API/ImportService | import-service |

Eventos planejados:

- `import.started`;
- `import.completed`;
- `import.failed`;
- `import.duplicate_detected`.

Observacao:

- este e o primeiro candidato real para extracao futura;
- upload, parsing e PDF futuro podem exigir runtime e escala diferentes.

### Ledger

| Metodo | Path | Dono atual | Dono alvo |
| --- | --- | --- | --- |
| GET | `/v1/transactions` | API/Transactions | ledger-service |
| POST | `/v1/transactions` | API/Transactions | ledger-service |
| GET | `/v1/transactions/duplicates` | API/Transactions | ledger-service |
| POST | `/v1/transactions/normalize-descriptions` | API/Transactions | ledger-service |
| PATCH | `/v1/transactions/{transaction_id}/category` | API/Transactions | ledger-service |
| PATCH | `/v1/transactions/{transaction_id}/direction` | API/Transactions | ledger-service |
| DELETE | `/v1/transactions/{transaction_id}` | API/Transactions | ledger-service |
| GET | `/v1/categories` | API/Categories | ledger-service |
| POST | `/v1/categories` | API/Categories | ledger-service |
| PATCH | `/v1/categories/{category_id}` | API/Categories | ledger-service |
| DELETE | `/v1/categories/{category_id}` | API/Categories | ledger-service |
| GET | `/v1/categorization-rules` | API/Categories | ledger-service |
| POST | `/v1/categorization-rules` | API/Categories | ledger-service |
| PATCH | `/v1/categorization-rules/{rule_id}` | API/Categories | ledger-service |
| DELETE | `/v1/categorization-rules/{rule_id}` | API/Categories | ledger-service |
| GET | `/v1/categorization-rules/{rule_id}/preview` | API/Categories | ledger-service |
| POST | `/v1/categorization-rules/apply` | API/Categories | ledger-service |

Eventos planejados:

- `transaction.created`;
- `transaction.updated`;
- `transaction.deleted`;
- `transaction.categorized`;
- `category.created`;
- `categorization_rule.applied`.

Observacao:

- ledger e o core financeiro;
- ele deve ser extraido somente depois de contratos e ownership claros.

### Dashboard

| Metodo | Path | Dono atual | Dono alvo |
| --- | --- | --- | --- |
| GET | `/v1/dashboard/summary` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/monthly-cashflow` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/category-ranking` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/merchant-ranking` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/recurring-expenses` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/category-growth-alerts` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/weekday-spending` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/data-quality` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/credit-card-payment-matches` | API/DashboardService | API ou dashboard read model |
| GET | `/v1/dashboard/credit-card-installments` | API/DashboardService | API ou dashboard read model |

Observacao:

- dashboard nao precisa virar microservico agora;
- no produto final, pode ser read model derivado de ledger, planning, wealth e
  billing;
- regras de negocio devem continuar nos dominios donos.

## Endpoints Planning Entregues Na Phase 1

### Planning

| Metodo | Path | Dono inicial | Dono alvo |
| --- | --- | --- | --- |
| GET | `/v1/calendar/events` | API/Planning | planning-service |
| POST | `/v1/calendar/events` | API/Planning | planning-service |
| PATCH | `/v1/calendar/events/{event_id}` | API/Planning | planning-service |
| DELETE | `/v1/calendar/events/{event_id}` | API/Planning | planning-service |
| GET | `/v1/budgets` | API/Planning | planning-service |
| POST | `/v1/budgets` | API/Planning | planning-service |
| PATCH | `/v1/budgets/{budget_id}` | API/Planning | planning-service |
| DELETE | `/v1/budgets/{budget_id}` | API/Planning | planning-service |
| GET | `/v1/goals` | API/Planning | planning-service |
| POST | `/v1/goals` | API/Planning | planning-service |
| PATCH | `/v1/goals/{goal_id}` | API/Planning | planning-service |
| DELETE | `/v1/goals/{goal_id}` | API/Planning | planning-service |

Status:

- endpoints implementados no backend atual;
- persistencia criada em tabelas dedicadas;
- frontend consome a API quando houver dados persistidos;
- eventos continuam planejados, ainda sem fila/event bus.

Eventos planejados:

- `budget.created`;
- `budget.threshold_reached`;
- `goal.created`;
- `goal.progress_updated`;
- `calendar_event.due_soon`.

## Regras Para Novos Endpoints

- Todo endpoint protegido deve resolver `workspace_id`.
- Todo dado financeiro deve ser filtrado por `workspace_id`.
- Erros externos nao devem expor payload financeiro sensivel.
- Endpoints de planejamento devem nascer em modulo separado, mesmo ainda no
  monolito.
- Contratos devem ser atualizados antes do frontend depender de campos novos.
- Dados mockados no frontend devem ter plano explicito de substituicao por API.

## Proxima Acao

Com este mapa pronto, o proximo passo de Construction pode ser:

1. criar formularios de cadastro/edicao para Calendario, Orcamentos e Metas; ou
2. iniciar validacao local do fluxo visual e leitura dos dados persistidos.

Recomendacao:

- validar localmente as telas;
- depois adicionar formularios de criacao/edicao para tornar o fluxo completo.
