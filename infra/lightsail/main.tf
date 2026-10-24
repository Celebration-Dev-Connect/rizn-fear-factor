# The event server: one Lightsail instance, a static IP, firewall rules, and the DNS record.
# Applied by .github/workflows/infra.yml (or locally; see infra/README.md).
# Nothing here is secret: the SSH key is public, and app secrets are written by the deploy workflow.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  # bucket, key, and region are passed with -backend-config so the repo stays account-neutral.
  backend "s3" {
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { project = var.name }
  }
}

resource "aws_lightsail_key_pair" "deploy" {
  name       = "${var.name}-deploy"
  public_key = var.ssh_public_key
}

# Automatic snapshots stay off: a snapshot would keep a copy of student photos (Constitution I).
# Changing user_data or the blueprint replaces the instance and loses its photos and database.
resource "aws_lightsail_instance" "app" {
  name              = var.name
  availability_zone = "${var.region}a"
  blueprint_id      = "ubuntu_24_04"
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.deploy.name
  user_data         = file("${path.module}/user-data.sh")
}

resource "aws_lightsail_static_ip" "app" {
  name = "${var.name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.name
  instance_name  = aws_lightsail_instance.app.name
}

resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"]
  }

  # Key-only SSH (passwords are disabled in user-data.sh). GitHub-hosted runners have no fixed
  # IPs, so the default is open; narrow ssh_cidrs if deploys run from somewhere fixed.
  # "lightsail-connect" keeps the browser SSH button in the Lightsail console working.
  port_info {
    protocol          = "tcp"
    from_port         = 22
    to_port           = 22
    cidrs             = var.ssh_cidrs
    cidr_list_aliases = ["lightsail-connect"]
  }
}

# DNS is optional: with no zone_name, use the sslip.io hostname from the default_domain output.
data "aws_route53_zone" "main" {
  count = var.zone_name == "" ? 0 : 1
  name  = var.zone_name
}

resource "aws_route53_record" "app" {
  count   = var.zone_name == "" ? 0 : 1
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain
  type    = "A"
  ttl     = 300
  records = [aws_lightsail_static_ip.app.ip_address]
}
