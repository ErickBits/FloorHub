# Diagrama de secuencia: tomar una solicitud

**Dos supervisores pulsan «Tomar» al mismo tiempo**

Participantes: **Supervisor 1**, **Supervisor 2**, **api**, **PostgreSQL**, **gateway** y **Agente**.

## Mensajes

| # | Desde | Hacia | Mensaje |
|---|---|---|---|
| 1 ∥ 2 | Supervisor 1 y 2 | api | POST /help-requests/{id}/claim (en paralelo) |
| 3 | api | PostgreSQL | UPDATE … SET status = 'in_progress' WHERE status = 'pending' AND team_id = ANY(equipos) |
| 4 | PostgreSQL | PostgreSQL | 🔒 Bloquea la fila; el segundo UPDATE espera |
| 5 | PostgreSQL | api | Supervisor 1: 1 fila actualizada |
| 6 | api | Supervisor 1 | 200 { request } |
| 7 | api | gateway → Agente | help:claimed: «En atención» con el nombre del supervisor |
| 8 | PostgreSQL | api | Supervisor 2: re-evalúa el WHERE, 0 filas |
| 9 | api | PostgreSQL | SELECT status (¿existe y es de su equipo?) |
| 10 | api | Supervisor 2 | ❌ 409 already_claimed |

## Diagrama

![Secuencia de toma concurrente de una solicitud](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/sec_tomar_solicitud.png)
