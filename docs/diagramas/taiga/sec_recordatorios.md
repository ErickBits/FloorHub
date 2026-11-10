# Diagrama de secuencia: recordatorios

**Rondas idempotentes y reconciliación**

Participantes: **BullMQ (Redis)**, **worker**, **PostgreSQL**, **gateway** y **Agente sin confirmar**.

## Mensajes

| # | Desde | Hacia | Mensaje |
|---|---|---|---|
| 1 | BullMQ | worker | send-reminder { announcementId, round } |
| 2 | worker | PostgreSQL | BEGIN y SELECT … WHERE reminders_sent = round FOR UPDATE |
| 2a | worker | PostgreSQL | Ronda ya procesada: ROLLBACK, no notifica dos veces |
| 3 | worker | PostgreSQL | Busca destinatarios sin confirmación |
| 3a | worker | PostgreSQL | Nadie pendiente o comunicado vencido: next_reminder_at = NULL |
| 4 | worker | PostgreSQL | reminder_count + 1 a los pendientes |
| 5 | worker | PostgreSQL | reminders_sent + 1 y próxima fecha si quedan rondas (máx. 5) |
| 6 | worker | PostgreSQL | COMMIT |
| 7 | worker | BullMQ | Una notificación por agente |
| 8 | worker | gateway | announcement:reminder a user:{id} |
| 9 | gateway | Agente | Aviso «Recordatorio: confirma …» |
| 10 | worker | BullMQ | Encola la siguiente ronda con retraso |
| — | worker | PostgreSQL | Cada minuto, reconcile-reminders reencola los vencidos (jobId determinista) |

## Diagrama

![Secuencia de recordatorios](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/sec_recordatorios.png)
