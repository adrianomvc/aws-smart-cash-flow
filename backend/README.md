# aws-smart-cash-flow Backend

Python backend for the aws-smart-cash-flow MVP.

Target runtime:

- AWS Lambda Python 3.12
- API Gateway HTTP API
- FastAPI
- Mangum
- Supabase Auth/PostgreSQL/Storage

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
```

## Run locally

```powershell
uvicorn app.main:app --reload
```

## Environment

Copy `.env.example` to `.env` and fill values when the Supabase project exists.

## Database migrations

Alembic is configured in `alembic.ini` and reads `DATABASE_URL` from the
environment when present.

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic downgrade -1
```

For local development without `DATABASE_URL`, Alembic uses
`sqlite:///./smart_cash_flow.db`.
