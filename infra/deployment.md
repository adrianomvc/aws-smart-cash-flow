# Deployment Plan

## Branches

- `feature/*`: development branches. Run CI on push and pull request.
- `main`: single deploy branch. Run CI and trigger deploy after pull requests are merged.

The MVP currently has one deployed environment. Use pull requests from
`feature/*` directly to `main`; keep `develop` unused unless a real development
environment is introduced later.

## GitHub Actions

Workflows:

- `.github/workflows/ci.yml`: runs backend lint/tests and frontend lint/build.
  On push to `main`, deploy jobs are triggered only after these checks pass.

Cost rule:

- Feature branches and pull requests run CI only.
- Amplify deploy is not triggered for feature branches.
- Amplify deploy is triggered for `main` only after backend and frontend checks
  pass.

## Terraform

Terraform lives in `infra/terraform`.

Decision:

- AWS infrastructure is managed by Terraform.
- This includes IAM/OIDC, Amplify-related AWS permissions, future Lambda/API
  Gateway, CloudWatch logs, budgets, and environment-specific AWS settings.
- Supabase is an external platform dependency and is documented/configured by
  environment, not created as AWS infrastructure.

Initial scope:

- GitHub Actions OIDC provider.
- GitHub Actions deploy role scoped to `main`.
- Optional Amplify deploy permission when `amplify_app_arn` is set.
- Backend Lambda, API Gateway HTTP API, CloudWatch log group, and least-privilege
  deploy permission for updating Lambda code/configuration.
- Backend Lambda uses Python 3.12 so native wheels such as `cryptography` run on
  the Amazon Linux 2023 Lambda runtime. Do not downgrade the Lambda runtime to
  Python 3.11 without also changing the package build strategy to Amazon Linux 2
  compatible wheels.
- MVP validation allows the demo/local token through `ALLOW_LOCAL_AUTH=true`.
  Disable this flag before handling real production users and require Supabase
  JWT authentication instead.
- While `ALLOW_LOCAL_AUTH=true`, original file storage uses metadata-only paths
  and does not require Supabase Storage. Before real production use, configure
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` so uploaded originals are stored
  in the configured bucket.

## AWS Cost Tags

All AWS resources managed by Terraform must use the provider-level
`default_tags` block. The standard tags are:

```text
Project=aws-smart-cash-flow
Application=smart-cash-flow
Environment=shared|develop|production
ManagedBy=terraform
Owner=adrianomvc
CostCenter=personal
Repository=adrianomvc/aws-smart-cash-flow
DataClassification=sensitive-financial
```

Optional extra tags can be set with `additional_tags`, for example:

```hcl
additional_tags = {
  Workload = "mvp"
}
```

Cost tracking rule:

- Use `Project` to separate this project from other AWS projects.
- Use `Environment` to split development and production cost.
- Use `CostCenter` for personal, client, or business allocation.
- Use `Application` for dashboards across resources that belong to the same app.

After the first tagged resources exist, activate these user-defined cost
allocation tags in AWS Billing:

```text
Billing and Cost Management -> Cost allocation tags
```

Then use Cost Explorer grouped by `Project`, `Application`, `Environment`, or
`CostCenter`.

Bootstrap:

1. Copy `infra/terraform/terraform.tfvars.example` to a local `terraform.tfvars`.
2. Fill `github_repository` with `owner/aws-smart-cash-flow`.
3. Run `terraform init` and `terraform apply` with AWS credentials that can
   create IAM resources.
4. Add the output `github_actions_deploy_role_arn` to GitHub repository
   variables as `AWS_ROLE_TO_ASSUME`.

Keep `TERRAFORM_DEPLOY_ENABLED=false` until Terraform state is split into a
bootstrap state and an application-infra state. The current economical deploy
path uses GitHub Actions only to run checks and trigger Amplify after checks
pass.

## Required GitHub Variables

Repository variables:

- `AWS_ROLE_TO_ASSUME`: IAM role ARN for GitHub OIDC.
- `AWS_REGION`: AWS region used by Amplify/Lambda.
- `AMPLIFY_APP_ID`: AWS Amplify app id.
- `AMPLIFY_APP_ARN`: AWS Amplify app ARN used by Terraform IAM policy.
- `BACKEND_LAMBDA_FUNCTION_NAME`: Lambda function name from Terraform output
  `backend_lambda_function_name`.
- `BACKEND_CORS_ORIGINS`: comma-separated browser origins allowed to call the
  backend, including the Amplify domain and any local URLs needed for testing.
- `TERRAFORM_DEPLOY_ENABLED`: keep `false` until application Terraform state is
  separated from bootstrap IAM/OIDC state.

Repository secrets:

- `BACKEND_DATABASE_URL`: Neon pooled PostgreSQL URL used by the Lambda backend.
  Do not commit it to the repo or store it in Terraform variables.

## AWS OIDC

Use GitHub OIDC instead of long-lived AWS access keys. The IAM role should trust
the repository and allow only the required actions.

Minimum actions for the current deploy workflows:

```text
amplify:StartJob
lambda:UpdateFunctionCode
lambda:UpdateFunctionConfiguration
```

Scope Amplify permissions to the project app and Lambda permissions to the
project backend function.

## Backend Deploy

Backend deploy uses Lambda plus API Gateway HTTP API:

```text
API Gateway HTTP API -> AWS Lambda Python -> Neon PostgreSQL
```

CORS:

- FastAPI owns CORS response headers through `CORS_ORIGINS`.
- API Gateway HTTP API CORS remains disabled to avoid stripping or conflicting
  with application-level CORS headers.

Cost guardrails:

- No RDS.
- No NAT Gateway.
- No VPC attachment unless a future private networking requirement is approved.
- Lambda connects to Neon over public TLS using the pooled connection string.
- CloudWatch log retention defaults to 14 days.

Initial Terraform apply:

1. Build an initial Lambda package on Linux or a compatible environment:

   ```bash
   cd backend
   python -m pip install --target build/lambda .
   cd build/lambda
   zip -r ../backend-lambda.zip .
   ```

2. Set `backend_cors_origins` in `infra/terraform/terraform.tfvars` with the
   Amplify domain.
3. Run `terraform apply`.
4. Add Terraform output `backend_lambda_function_name` to GitHub variable
   `BACKEND_LAMBDA_FUNCTION_NAME`.
5. Add Terraform output `backend_api_base_url` to Amplify environment variable
   `VITE_API_BASE_URL`.
6. Add Neon pooled URL to GitHub secret `BACKEND_DATABASE_URL`.

After these are configured, pushes to `main` that change backend or infra files
package the backend and update the Lambda automatically.

Manual backend refresh:

- If the Lambda was created from the initial Terraform package before GitHub
  deploy variables/secrets were configured, run the `CI` workflow manually on
  `main` with `deploy_backend=true`. This rebuilds the Lambda package on Linux
  and updates the function code/configuration from GitHub Actions.
