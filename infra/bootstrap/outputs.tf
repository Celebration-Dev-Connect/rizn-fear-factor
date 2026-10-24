# Neither value is secret; both go into GitHub environment variables (not secrets).
output "aws_role_arn" {
  description = "GitHub variable AWS_ROLE_ARN."
  value       = aws_iam_role.github_actions.arn
}

output "tf_state_bucket" {
  description = "GitHub variable TF_STATE_BUCKET."
  value       = aws_s3_bucket.state.bucket
}
