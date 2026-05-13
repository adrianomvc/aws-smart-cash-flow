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
