# aws-smart-cash-flow Backend

Python backend for the aws-smart-cash-flow MVP.

Target runtime:

- AWS Lambda
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
