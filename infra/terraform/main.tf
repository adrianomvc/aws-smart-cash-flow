data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(
    {
      Project            = var.project_name
      Application        = var.application_name
      Environment        = var.environment
      ManagedBy          = "terraform"
      Owner              = var.owner
      CostCenter         = var.cost_center
      Repository         = var.github_repository
      DataClassification = "sensitive-financial"
    },
    var.additional_tags,
  )

  deploy_branch_subjects = [
    for branch in var.github_deploy_branches :
    "repo:${var.github_repository}:ref:refs/heads/${branch}"
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = var.github_oidc_thumbprints
  tags            = local.common_tags
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.deploy_branch_subjects
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${local.name_prefix}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json

  tags = local.common_tags
}

data "aws_iam_policy_document" "amplify_deploy" {
  count = var.amplify_app_arn == "" ? 0 : 1

  statement {
    effect = "Allow"
    actions = [
      "amplify:StartJob",
      "amplify:ListJobs",
      "amplify:GetJob",
      "amplify:GetApp",
      "amplify:GetBranch",
    ]
    resources = [
      var.amplify_app_arn,
      "${var.amplify_app_arn}/branches/*",
      "${var.amplify_app_arn}/branches/*/jobs/*",
    ]
  }
}

resource "aws_iam_role_policy" "amplify_deploy" {
  count = var.amplify_app_arn == "" ? 0 : 1

  name   = "${local.name_prefix}-amplify-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.amplify_deploy[0].json
}

data "aws_iam_policy_document" "backend_lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backend_lambda_execution" {
  name               = "${local.name_prefix}-backend-lambda"
  assume_role_policy = data.aws_iam_policy_document.backend_lambda_assume_role.json

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "backend_lambda" {
  name              = "/aws/lambda/${local.name_prefix}-backend"
  retention_in_days = var.backend_log_retention_days
}

data "aws_iam_policy_document" "backend_lambda_logs" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.backend_lambda.arn}:*"]
  }
}

resource "aws_iam_role_policy" "backend_lambda_logs" {
  name   = "${local.name_prefix}-backend-logs"
  role   = aws_iam_role.backend_lambda_execution.id
  policy = data.aws_iam_policy_document.backend_lambda_logs.json
}

resource "aws_lambda_function" "backend" {
  function_name = "${local.name_prefix}-backend"
  description   = "FastAPI backend for aws-smart-cash-flow"
  role          = aws_iam_role.backend_lambda_execution.arn
  handler       = "app.main.handler"
  runtime       = "python3.12"
  architectures = ["x86_64"]
  filename      = var.backend_lambda_package_path
  memory_size   = var.backend_lambda_memory_size
  timeout       = var.backend_lambda_timeout_seconds

  environment {
    variables = {
      APP_ENV                       = var.environment
      ALLOW_LOCAL_AUTH              = tostring(var.backend_allow_local_auth)
      CORS_ORIGINS                  = join(",", var.backend_cors_origins)
      DATABASE_MAX_OVERFLOW         = "2"
      DATABASE_POOL_RECYCLE_SECONDS = "300"
      DATABASE_POOL_SIZE            = "1"
      DATABASE_URL                  = "configured-by-github-actions"
      LOG_LEVEL                     = "INFO"
      SUPABASE_JWT_SECRET           = ""
      SUPABASE_STORAGE_BUCKET       = "financial-files"
      SUPABASE_URL                  = ""
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.backend_lambda,
    aws_iam_role_policy.backend_lambda_logs,
  ]

  lifecycle {
    ignore_changes = [
      environment,
      filename,
      source_code_hash,
    ]
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_api" "backend" {
  name          = "${local.name_prefix}-backend"
  protocol_type = "HTTP"

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "backend" {
  api_id                 = aws_apigatewayv2_api.backend.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "backend_root" {
  api_id    = aws_apigatewayv2_api.backend.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_apigatewayv2_route" "backend_proxy" {
  api_id    = aws_apigatewayv2_api.backend.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_apigatewayv2_stage" "backend_default" {
  api_id      = aws_apigatewayv2_api.backend.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "backend_api_gateway" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.backend.execution_arn}/*/*"
}

data "aws_iam_policy_document" "backend_deploy" {
  statement {
    effect = "Allow"
    actions = [
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
    ]
    resources = [aws_lambda_function.backend.arn]
  }
}

resource "aws_iam_role_policy" "backend_deploy" {
  name   = "${local.name_prefix}-backend-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.backend_deploy.json
}
