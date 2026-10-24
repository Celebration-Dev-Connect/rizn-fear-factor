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

variable "zone_name" {
  description = "Route 53 hosted zone created when the domain was registered, e.g. riznfearfactor.ca."
  type        = string
}

variable "github_repo" {
  description = "owner/repo allowed to assume the deploy role."
  type        = string
  default     = "Celebration-Dev-Connect/rizn-fear-factor"
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if the AWS account already has one."
  type        = bool
  default     = true
}
