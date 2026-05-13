# AI-DLC Execution Plan

## Fase Inception

Status: iniciado.

Artefatos:

- Project Charter.
- Squad Operating Model.
- Requirements.
- SDD Specification.
- Architecture.
- Backlog.
- Decisions and Risks.

Saida esperada:

- Aprovacao do MVP.
- Decisoes sobre stack, banco e modo de entrada dos arquivos.

## Fase Construction

Status: pendente.

Slices recomendados:

1. Criar estrutura backend, testes e migracoes.
2. Implementar schema inicial com workspace/multiusuario.
3. Implementar parser TXT com testes.
4. Implementar parser CSV com testes.
5. Implementar servico de importacao e idempotencia.
6. Implementar processamento em lotes pequenos para carga historica.
7. Implementar endpoints de importacao e consulta.
8. Implementar upload manual no frontend.
9. Implementar categorizacao manual.
10. Implementar regras deterministicas de categorizacao.
11. Implementar categorizacao por embedding.
12. Implementar categorizacao por LLM para casos ambiguos.
13. Implementar revisao de sugestoes.
14. Implementar dashboards iniciais.
15. Implementar conciliacao inicial.
16. Adicionar CI local ou GitHub Actions.

## Fase Operations

Status: futura.

Itens:

- Deploy.
- Backups.
- Observabilidade.
- Controle de acesso.
- Politica de retencao.
- Monitoramento de falhas de importacao.

## Gate de Aprovacao Antes do Codigo

Antes de iniciar implementacao, validar:

- Banco gratuito inicial: Supabase Free confirmado, com portabilidade para outro PostgreSQL.
- Stack frontend: React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Recharts e TanStack Query.
- Formato de entrada: upload manual confirmado para o produto.
- Escopo de autenticacao: usuario/senha confirmado; Google precisa ser decidido entre MVP ou fase seguinte.
- Provider de deploy online: AWS Amplify Hosting para frontend, AWS Lambda Python para backend, Supabase Free para banco/auth/storage.
- Exposicao HTTP da Lambda: API Gateway HTTP API.
- PDF fora do MVP inicial; entra em fase posterior.
- Regras de acesso a dados sensiveis.
