# Reverse Engineering Architecture

## Estado Atual

O projeto e um brownfield modular monorepo com:

- `frontend/`: React, TypeScript, Vite, TanStack Query, Recharts e Lucide.
- `backend/`: FastAPI, SQLAlchemy, Alembic, pytest, ruff e Hypothesis.
- `infra/`: Terraform e documentacao de deploy.
- `contracts/`: OpenAPI, schemas de eventos e exemplos.
- `aidlc-docs/`: documentacao AI-DLC e prototipos.

## Arquitetura Alvo

A arquitetura recomendada e modular monolith preparado para multirepo, sem
extrair microservicos prematuramente.

Referencias:

- `aidlc-docs/04-architecture.md`
- `aidlc-docs/11-target-architecture-multirepo.md`
- `aidlc-docs/13-current-endpoint-domain-map.md`

