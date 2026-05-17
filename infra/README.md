# Infrastructure

Deployment target for MVP 1:

- Frontend: AWS Amplify Hosting
- API: API Gateway HTTP API
- Backend: AWS Lambda Python
- Database: Neon PostgreSQL pooled connection
- Auth/storage: prepared for Supabase-compatible adapters, not required for the
  initial backend deploy

Cost guardrails:

- Do not create RDS for MVP 1.
- Do not create NAT Gateway for MVP 1.
- Do not enable WAF unless explicitly approved.
- Keep CloudWatch logs concise and without financial details.
- Every AWS resource managed by Terraform must carry the standard cost
  allocation tags documented in `deployment.md`.

Next infrastructure artifact:

- Terraform is the infrastructure source of truth.
- Current Terraform bootstrap and backend API resources live in `terraform/`.
- Backend deploy packages FastAPI/Mangum into Lambda and exposes it through API
  Gateway HTTP API.
