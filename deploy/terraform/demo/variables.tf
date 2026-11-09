variable "project" {
  type    = string
  default = "floorhub"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "kubernetes_version" {
  description = "Debe estar en soporte estándar: el extendido cuesta 6 veces más"
  type        = string
  default     = "1.36"
}

variable "postgres_version" {
  type    = string
  default = "17"
}

variable "node_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "node_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "admin_principal_arns" {
  description = "ARN adicionales con acceso de administrador al clúster"
  type        = list(string)
  default     = []
}
