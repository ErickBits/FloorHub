variable "project" {
  type    = string
  default = "floorhub"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "budget_usd" {
  type    = number
  default = 30
}

variable "alert_email" {
  description = "Correo que recibe las alertas del presupuesto"
  type        = string
}

variable "github_repository" {
  description = "Repositorio autorizado para desplegar, en formato usuario/repositorio"
  type        = string
}

variable "github_environment" {
  type    = string
  default = "demo"
}
