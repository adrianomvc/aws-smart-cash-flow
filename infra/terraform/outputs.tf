output "github_actions_deploy_role_arn" {
  description = "IAM role ARN to set as the GitHub repository variable AWS_ROLE_TO_ASSUME."
  value       = aws_iam_role.github_actions_deploy.arn
}

output "aws_account_id" {
  description = "AWS account id used by this Terraform state."
  value       = data.aws_caller_identity.current.account_id
}

