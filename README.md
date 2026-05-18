# aws-smart-cash-flow

SmartCashFlow e um sistema para importar arquivos financeiros, normalizar
lancamentos e gravar os dados em banco de dados para consulta, categorizacao,
conciliacao e analise.

Este repositorio e um monorepo do MVP. Backend, frontend, infraestrutura e
documentacao AI-DLC/SDD evoluem juntos para facilitar fatias verticais completas:
ingestao, validacao, persistencia, API, interface e testes.

Os artefatos de especificacao ficam em `aidlc-docs/`. Antes de mudar
comportamento, atualize a especificacao aplicavel, principalmente
`aidlc-docs/03-sdd-specification.md` e `aidlc-docs/09-mvp-technical-contract.md`.

## Estrutura

```text
aws-smart-cash-flow/
  aidlc-docs/  # charter, requisitos, SDD, backlog, decisoes e contrato MVP
  backend/     # API Python/FastAPI planejada para AWS Lambda
  frontend/    # React + TypeScript + Vite planejado para AWS Amplify Hosting
  infra/       # infraestrutura e deploy
```

## Git e Deploy

Fluxo de branches:

- `feature/*`: desenvolvimento de funcionalidades.
- `develop`: integracao e deploy de desenvolvimento.
- `main`: producao.

GitHub Actions:

- CI roda em `feature/*`, `develop`, `main` e pull requests para `develop`/`main`.
- CI tambem roda em tags `v*` para validar releases versionados.
- Deploy roda em push para `develop` e `main`.
- Frontend: deploy via AWS Amplify quando `AWS_ROLE_TO_ASSUME`, `AWS_REGION` e
  `AMPLIFY_APP_ID` estiverem configurados como repository variables.
- Backend: deploy automatico fica bloqueado ate existir template de
  Lambda/API Gateway em `infra/`.

Changelog e releases:

- Changelogs sao baseados em Git tags anotadas no formato `vX.Y.Z`.
- Release notes devem ser geradas a partir dos commits entre tags.
- Detalhes em `CHANGELOG.md`.

Detalhes em `infra/deployment.md`.

## Inputs iniciais

- `input/Extrato Conta Corrente-202601-04.txt`: extrato de conta corrente em linhas `data;descricao;valor`.
- `input/*.csv`: faturas ja convertidas para colunas `data,lançamento,valor`.
- `input/*.pdf`: faturas originais em PDF, fora do MVP inicial e previstas para fase posterior.

## Estado atual

- Documentacao AI-DLC/SDD criada.
- Backend Python/FastAPI iniciado.
- Parsers TXT/CSV iniciais implementados.
- Rotas de API e frontend ainda estao em scaffold.
- Persistencia, dedupe real, Supabase Auth/Storage e telas operacionais ainda
  precisam ser implementados.

## Proximo passo recomendado

Implementar a primeira fatia vertical real de importacao TXT/CSV no backend:
schema/migrations, persistencia de arquivo/importacao/linhas/transacoes/erros,
dedupe por arquivo e transacao, e testes automatizados de parsing, validacao e
persistencia.

## Decisao tecnica

- Backend: Python.
- Autenticacao: usuario e senha, com suporte ou evolucao para Google.
- Volume inicial estimado: cerca de 300 arquivos e 10.000 linhas/transacoes, com volume recorrente menor depois.
- Banco/Auth inicial: Supabase Free, mantendo portabilidade para outro PostgreSQL/Auth provider.
- Frontend: AWS Amplify Hosting.
- Stack frontend: React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Recharts e TanStack Query.
- Backend: AWS Lambda Python online desde o MVP, exposto por API Gateway HTTP API.
- Storage inicial: Supabase Storage.
- Categorizacao: Regra -> Embedding -> LLM -> Revisao, implementada em fases.
- IA inicial planejada: `sentence-transformers/all-MiniLM-L6-v2` para embeddings locais e Groq `llama3-8b-8192` para LLM.
- MVP 1 inclui categorias manuais e regras deterministicas simples.
