output "validation_records" {
  description = "Add these at the riznyouth.com DNS host and leave them there (automatic renewal)."
  value = [for o in aws_acm_certificate.site.domain_validation_options : {
    name  = o.resource_record_name
    type  = o.resource_record_type
    value = o.resource_record_value
  }]
}

output "bucket" {
  description = "GitHub variable SITE_BUCKET."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "GitHub variable SITE_DISTRIBUTION_ID (empty until step 2)."
  value       = try(aws_cloudfront_distribution.site[0].id, "")
}

output "distribution_domain" {
  description = "Point the DNS record for the domain here (CNAME) once the site is checked (empty until step 2)."
  value       = try(aws_cloudfront_distribution.site[0].domain_name, "")
}
