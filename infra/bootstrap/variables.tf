variable "region" {
  description = "AWS region for the state bucket (keep it with the server)."
  type        = string
  default     = "ca-central-1"
}

variable "name" {
  description = "Prefix for resource names."
  type        = string
  default     = "rizn-fear-factor"
}

variable "github_repo" {
  description = "owner/repo allowed to assume the deploy role."
  type        = string
  default     = "Celebration-Dev-Connect/rizn-fear-factor"
}

variable "github_sub_prefix" {
  description = <<-EOT
    OIDC subject prefix when the repo uses GitHub's immutable subject format, e.g.
    repo:Owner@123/repo@456. Find it with:
    gh api repos/OWNER/REPO/actions/oidc/customization/sub --jq .sub_claim_prefix
  EOT
  type        = string
  default     = ""
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if the AWS account already has one."
  type        = bool
  default     = true
}
