# SmartCashFlow Contracts

This directory contains public API contracts, planned event contracts, and
anonymized examples used to coordinate future multirepo evolution.

Current status:

- `openapi/public-api.yaml`: initial public API map for the current FastAPI app.
- `events/*.schema.json`: planned event contracts; these events are not yet
  implemented as a queue or event bus.
- `examples/`: anonymized payload examples for docs, tests, and future client
  generation.

Contract rules:

- Keep examples anonymous.
- Do not include real financial descriptions, account numbers, or filenames.
- Version breaking changes explicitly.
- Treat event schemas as planned until the backend publishes them.
- Keep frontend types aligned with OpenAPI before splitting repos.
