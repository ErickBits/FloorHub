# Diagrama de secuencia: publicar un comunicado

**Transacción y efectos después del commit**

Participantes: **Supervisor**, **api**, **PostgreSQL**, **Redis**, **gateway (×N)**, **worker** y **Agentes**.

## Mensajes

| # | Desde | Hacia | Mensaje |
|---|---|---|---|
| 1 | Supervisor | api | POST /api/announcements { título, cuerpo, prioridad, destinos } |
| 2 | api | api | zod: al menos un destino; si es crítico, intervalo |
| 3 | api | PostgreSQL | BEGIN |
| 4 | api | PostgreSQL | Valida los agentes elegidos directamente |
| 5 | api | api | assertTargetsAllowed: solo sus equipos y campañas (si no, 403) |
| 6 | api | PostgreSQL | INSERT announcements |
| 7 | api | PostgreSQL | INSERT announcement_targets |
| 8 | api | PostgreSQL | INSERT announcement_recipients (foto fija de la audiencia) |
| 8a | api | Supervisor | ❌ Audiencia vacía: ROLLBACK y 422 empty_audience |
| 9 | api | PostgreSQL | COMMIT |
| 10 | api | Supervisor | 201 { announcement, recipients_count } |
| 11 | api | Redis | Invalida la caché de la bandeja de los agentes |
| 12 | api | Redis → gateway | announcement:new a user:{id} (Pub/Sub) |
| 13 | gateway | Agentes | Entrega en vivo |
| 14 | api | Redis → worker | Si es crítico: encola el recordatorio de la ronda 0 con retraso |

## Diagrama

![Secuencia de publicación de un comunicado](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/sec_publicar_comunicado.png)
