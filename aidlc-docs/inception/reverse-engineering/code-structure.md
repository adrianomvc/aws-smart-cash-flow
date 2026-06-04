# Code Structure

## Estrutura Principal

```text
backend/
  app/
    api/routes/
    core/
    db/
    services/
  tests/
  alembic/
frontend/
  src/
    App.tsx
    lib/api.ts
    styles.css
contracts/
  openapi/
  events/
  examples/
infra/
  terraform/
```

## Observacoes

- Codigo de aplicacao permanece fora de `aidlc-docs/`.
- Documentacao do workflow fica em `aidlc-docs/`.
- O backend ja recebeu o modulo Planning minimo e o servico de projecao.

