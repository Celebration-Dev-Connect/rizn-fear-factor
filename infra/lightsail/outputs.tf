output "server_ip" {
  description = "GitHub variable SERVER_IP."
  value       = aws_lightsail_static_ip.app.ip_address
}

output "default_domain" {
  description = "Hostname that works before a real domain exists (sslip.io resolves it to the static IP)."
  value       = "${replace(aws_lightsail_static_ip.app.ip_address, ".", "-")}.sslip.io"
}

output "url" {
  value = "https://${var.domain != "" ? var.domain : "${replace(aws_lightsail_static_ip.app.ip_address, ".", "-")}.sslip.io"}"
}

output "ssh" {
  value = "ssh ubuntu@${aws_lightsail_static_ip.app.ip_address}"
}
