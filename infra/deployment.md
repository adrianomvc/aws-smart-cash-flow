# Deployment Plan

## Branches

- `feature/*`: development branches. Run CI on push and pull request.
- `develop`: integration branch. Run CI and trigger the development deploy.
- `main`: production branch. Run CI and trigger the production deploy.

## GitHub Actions

Workflows:

- `.github/workflows/ci.yml`: runs backend lint/tests and frontend lint/build.
  On push to `develop` or `main`, the frontend deploy is triggered only after
  these checks pass.
- Tags in the format `v*` run CI so release candidates are validated before
  release notes are published.

Cost rule:

- Feature branches and pull requests run CI only.
- Amplify deploy is not triggered for feature branches.
- Amplify deploy is triggered for `develop` and `main` only after backend and
  frontend checks pass.

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
- GitHub Actions deploy role scoped to `develop` and `main`.
- Optional Amplify deploy permission when `amplify_app_arn` is set.

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
- `TERRAFORM_DEPLOY_ENABLED`: keep `false` until application Terraform state is
  separated from bootstrap IAM/OIDC state.

## AWS OIDC

Use GitHub OIDC instead of long-lived AWS access keys. The IAM role should trust
the repository and allow only the required actions.

Minimum action for the current frontend deploy workflow:

```text
amplify:StartJob
```

Scope the permission to the Amplify app used by this project.

## Backend Deploy

Backend deploy is intentionally gated until the Lambda/API Gateway infrastructure
template is created. The target remains:

```text
API Gateway HTTP API -> AWS Lambda Python -> Supabase
```

The next infra artifact should define the Lambda package, API Gateway routes,
environment variables, and log retention before automatic backend deploy is
enabled.

## Tags and Changelog

Changelogs are based on annotated Git tags in the format `vX.Y.Z`.

Rules:

- Create a tag only after CI is green on the commit being released.
- Use annotated tags, not lightweight tags.
- Generate release notes from commits between the previous tag and the new tag.
- Do not include sensitive financial data, real filenames, or production values
  in tag messages or release notes.

Useful commands:

```powershell
git describe --tags --abbrev=0
git log --oneline <previous-tag>..<new-tag>
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```
