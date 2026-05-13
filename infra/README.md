# Infrastructure

Deployment target for MVP 1:

- Frontend: AWS Amplify Hosting
- API: API Gateway HTTP API
- Backend: AWS Lambda Python
- Auth/database/storage: Supabase Free

Cost guardrails:

- Do not create RDS for MVP 1.
- Do not create NAT Gateway for MVP 1.
- Do not enable WAF unless explicitly approved.
- Keep CloudWatch logs concise and without financial details.
- Every AWS resource managed by Terraform must carry the standard cost
  allocation tags documented in `deployment.md`.

Next infrastructure artifact:

- Terraform is the infrastructure source of truth.
- Current Terraform bootstrap lives in `terraform/`.
- Add Lambda/API Gateway Terraform after backend routes and environment
  variables are stable.
