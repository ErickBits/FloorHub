# Diagrama de contexto (C4 · nivel 1)

**FloorHub y su entorno**

Muestra el sistema como una caja negra: quién lo usa y con qué sistemas externos se relaciona.

## Personas

| Actor | Qué hace con FloorHub |
|---|---|
| 👤 Agente | Lee y confirma comunicados, levanta la mano |
| 👤 Supervisor | Publica comunicados, ve la presencia, toma y resuelve solicitudes |
| 👤 Administrador | Administra usuarios, campañas y equipos |

## Sistemas externos

| Sistema | Relación |
|---|---|
| GitHub | Guarda el código, ejecuta CI/CD y publica las imágenes en GHCR |
| Amazon Web Services | Ejecuta el sistema: EKS, RDS, NLB y Budgets |

## Diagrama

![Diagrama de contexto C4](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/c4_contexto.png)
