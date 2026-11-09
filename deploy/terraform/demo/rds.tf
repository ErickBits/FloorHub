# Generadas por Terraform: nunca se escriben en el repositorio. Quedan en el estado
# de S3, cifrado y privado. Sin caracteres especiales porque viajan dentro de una URL.
resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "random_password" "db_app" {
  length  = 32
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "seed" {
  length  = 16
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = var.project
  subnet_ids = aws_subnet.private[*].id
}

# Solo los nodos del clúster pueden llegar a la base.
resource "aws_security_group" "database" {
  name        = "${var.project}-database"
  description = "PostgreSQL solo desde los nodos de EKS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL desde EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }
}

# Exige TLS en cada conexión, aunque PostgreSQL 15+ en RDS ya lo trae activado por defecto.
resource "aws_db_parameter_group" "main" {
  name_prefix = "${var.project}-"
  family      = "postgres${var.postgres_version}"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "main" {
  identifier             = var.project
  engine                 = "postgres"
  engine_version         = var.postgres_version
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = "floorhub"
  username               = "floorhub_owner"
  password               = random_password.db_master.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = false
  apply_immediately      = true

  # Pensado para destruirse sin obstáculos: es una demo de un día.
  deletion_protection      = false
  skip_final_snapshot      = true
  backup_retention_period  = 0
  delete_automated_backups = true

  # El soporte extendido de RDS cobra aparte.
  engine_lifecycle_support = "open-source-rds-extended-support-disabled"
}
