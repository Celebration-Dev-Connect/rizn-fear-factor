output "server_ip" {
  description = "GitHub variable SERVER_IP."
  value       = aws_lightsail_static_ip.app.ip_address
}

output "url" {
  value = "https://${var.domain}"
}

output "ssh" {
  value = "ssh ubuntu@${aws_lightsail_static_ip.app.ip_address}"
}
