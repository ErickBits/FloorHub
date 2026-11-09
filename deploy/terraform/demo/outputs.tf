output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "region" {
  value = var.region
}

output "database_url" {
  value     = "postgres://floorhub_app:${random_password.db_app.result}@${aws_db_instance.main.address}:5432/floorhub"
  sensitive = true
}

output "migration_database_url" {
  value     = "postgres://floorhub_owner:${random_password.db_master.result}@${aws_db_instance.main.address}:5432/floorhub"
  sensitive = true
}

output "jwt_secret" {
  value     = random_password.jwt_secret.result
  sensitive = true
}

output "seed_password" {
  value     = random_password.seed.result
  sensitive = true
}
