output "github_actions_deploy_role_arn" {
  description = "IAM role ARN to set as the GitHub repository variable AWS_ROLE_TO_ASSUME."
  value       = aws_iam_role.github_actions_deploy.arn
}

output "aws_account_id" {
  description = "AWS account id used by this Terraform state."
  value       = data.aws_caller_identity.current.account_id
}

output "backend_lambda_function_name" {
  description = "Backend Lambda function name to set as BACKEND_LAMBDA_FUNCTION_NAME."
  value       = aws_lambda_function.backend.function_name
}

output "backend_api_url" {
  description = "Base URL for the backend HTTP API."
  value       = aws_apigatewayv2_stage.backend_default.invoke_url
}

output "backend_api_base_url" {
  description = "Frontend VITE_API_BASE_URL value for the backend HTTP API."
  value       = "${trimsuffix(aws_apigatewayv2_stage.backend_default.invoke_url, "/")}/v1"
}
