# Diagrama de secuencia: confirmar lectura

**Confirmación idempotente y auditable**

Participantes: **Agente**, **api**, **PostgreSQL**, **Redis**, **gateway** y **Supervisor**.

## Mensajes

| # | Desde | Hacia | Mensaje |
|---|---|---|---|
| 1 | Agente | api | POST /api/announcements/{id}/ack |
| 2 | api | PostgreSQL | BEGIN · ¿es destinatario? |
| 2a | api | Agente | ❌ No es destinatario: 404 |
| 3 | api | PostgreSQL | INSERT announcement_acks ON CONFLICT DO NOTHING |
| 3a | api | PostgreSQL | Si ya había confirmado: lee la fecha original |
| 4 | api | PostgreSQL | Si todos confirmaron: next_reminder_at = NULL |
| 5 | api | PostgreSQL | COMMIT |
| 6 | api | Redis | Invalida la caché del agente |
| 7 | api | Agente | 200 { acknowledgedAt } |
| 8 | api | Redis → gateway | announcement:acknowledged |
| 9 | gateway | Supervisor | El porcentaje sube en vivo |

## Diagrama

![Secuencia de confirmación de lectura](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/sec_confirmar.png)
