output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "github_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
