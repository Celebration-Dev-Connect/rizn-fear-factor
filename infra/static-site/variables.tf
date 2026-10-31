variable "region" {
  description = "Region for the site bucket (keep it with the rest of the project)."
  type        = string
  default     = "ca-central-1"
}

variable "name" {
  description = "Prefix for resource names."
  type        = string
  default     = "rizn-fear-factor"
}

variable "domain" {
  description = "The public address, e.g. fearfactor.riznyouth.com. Its DNS is managed by hand."
  type        = string
  default     = "fearfactor.riznyouth.com"
}

variable "cert_validated" {
  description = <<-EOT
    Step 1 (false): create the bucket and certificate, and output the validation CNAME to add at
    the DNS host. Step 2 (true): wait for validation, then create CloudFront and the bucket policy.
  EOT
  type        = bool
  default     = false
}
