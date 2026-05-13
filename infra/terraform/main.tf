data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  deploy_branch_subjects = [
    for branch in var.github_deploy_branches :
    "repo:${var.github_repository}:ref:refs/heads/${branch}"
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = var.github_oidc_thumbprints
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

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_iam_policy_document" "amplify_deploy" {
  count = var.amplify_app_arn == "" ? 0 : 1

  statement {
    effect = "Allow"
    actions = [
      "amplify:StartJob",
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

