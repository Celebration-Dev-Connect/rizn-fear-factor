variable "region" {
  description = "AWS region. ca-central-1 keeps student photos in Canada."
  type        = string
  default     = "ca-central-1"
}

variable "name" {
  description = "Instance name and resource prefix."
  type        = string
  default     = "rizn-fear-factor"
}

variable "bundle_id" {
  description = "Lightsail plan. small_3_0 is 2 GB / 2 vCPU; medium_3_0 is 4 GB. List: aws lightsail get-bundles."
  type        = string
  default     = "small_3_0"
}

variable "zone_name" {
  description = "Route 53 hosted zone, e.g. riznyouth.com. Leave empty to skip DNS and use default_domain."
  type        = string
  default     = ""
}

variable "domain" {
  description = "Hostname for the app, e.g. fearfactor.riznyouth.com. Required when zone_name is set."
  type        = string
  default     = ""

  validation {
    condition     = var.zone_name == "" || var.domain != ""
    error_message = "Set domain when zone_name is set."
  }
}

variable "ssh_public_key" {
  description = "OpenSSH public key for the deploy user (the private half is the SSH_PRIVATE_KEY secret)."
  type        = string
}

variable "ssh_cidrs" {
  description = "IPv4 ranges allowed to SSH, besides the Lightsail browser console."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
