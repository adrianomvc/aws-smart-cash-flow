variable "project_name" {
  description = "Project name used for AWS resource names."
  type        = string
  default     = "aws-smart-cash-flow"
}

variable "application_name" {
  description = "Human-readable application name used for cost allocation tags."
  type        = string
  default     = "smart-cash-flow"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "shared"
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "github_repository" {
  description = "GitHub repository in owner/name format."
  type        = string
}

variable "owner" {
  description = "Business or technical owner used for AWS cost allocation tags."
  type        = string
  default     = "adrianomvc"
}

variable "cost_center" {
  description = "Cost center used for AWS cost allocation tags."
  type        = string
  default     = "personal"
}

variable "additional_tags" {
  description = "Additional tags merged into the standard AWS tag set."
  type        = map(string)
  default     = {}
}

variable "github_deploy_branches" {
  description = "Branches allowed to assume the deploy role."
  type        = list(string)
  default     = ["develop", "main"]
}

variable "github_oidc_thumbprints" {
  description = "Thumbprints for token.actions.githubusercontent.com."
  type        = list(string)
  default     = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

variable "amplify_app_arn" {
  description = "Optional Amplify app ARN. When set, the deploy role can trigger Amplify jobs for this app."
  type        = string
  default     = ""
}

variable "backend_lambda_package_path" {
  description = "Local path to the backend Lambda zip package used for the initial Terraform create."
  type        = string
  default     = "../../backend/build/backend-lambda.zip"
}

variable "backend_lambda_memory_size" {
  description = "Memory size for the backend Lambda function."
  type        = number
  default     = 512
}

variable "backend_lambda_timeout_seconds" {
  description = "Timeout in seconds for the backend Lambda function. HTTP requests are capped at ~30s by API Gateway regardless; the higher value is the budget for async import-worker self-invokes."
  type        = number
  default     = 120
}

variable "backend_log_retention_days" {
  description = "CloudWatch log retention for the backend Lambda function."
  type        = number
  default     = 14
}

variable "api_gateway_log_retention_days" {
  description = "CloudWatch log retention for API Gateway access logs."
  type        = number
  default     = 14
}

variable "backend_cors_origins" {
  description = "Allowed browser origins for API Gateway and FastAPI CORS."
  type        = list(string)
  default     = ["http://localhost:5173", "http://127.0.0.1:5173"]
}

variable "backend_allow_local_auth" {
  description = "Allow the MVP demo/local token outside local development. Keep enabled for MVP validation; disable before real production use."
  type        = bool
  default     = true
}
