# Diagrama de despliegue en AWS

**Infraestructura de la demo en us-east-1**

Terraform crea la red, el clúster y la base. Kubernetes crea el balanceador.

## Red

| Elemento | Detalle |
|---|---|
| VPC | 10.40.0.0/16 |
| Subredes públicas (2 zonas) | 10.40.0.0/24 y 10.40.1.0/24 · nodos de EKS y NLB · ruta al Internet Gateway |
| Subredes privadas (2 zonas) | 10.40.10.0/24 y 10.40.11.0/24 · RDS · sin ruta a Internet |

## Recursos

| Recurso | Configuración |
|---|---|
| Network Load Balancer | Creado por el Service LoadBalancer de Kubernetes |
| Amazon EKS 1.36 | 2 nodos t3.medium bajo demanda, namespace floorhub |
| nginx | 2 réplicas |
| api y gateway | 2 a 3 réplicas, HPA al 70 % de CPU |
| worker | 1 réplica |
| redis | 1 réplica, emptyDir, noeviction |
| Job migrate | Migraciones y seed |
| 🗄️ RDS PostgreSQL 17 | db.t4g.micro, Single-AZ, TLS |
| S3 | Estado de Terraform cifrado |
| AWS Budgets | Alertas al 25, 50 y 80 % de 30 USD |
| GHCR | Imágenes de los contenedores |
| GitHub Actions (OIDC) | Ejecuta terraform y kubectl sin claves guardadas |

## Diagrama

![Diagrama de despliegue en AWS](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/despliegue_aws.png)
