# Diagrama de clases: modelo de dominio

**Entidades del negocio**

Cada clase corresponde a una tabla de PostgreSQL.

## Clases

| Clase | Atributos principales |
|---|---|
| Campaign | id, name, isActive, createdAt |
| Team | id, campaignId, name, isActive |
| User | id, email, passwordHash, fullName, role, teamId, isActive |
| Announcement | id, authorId, title, body, priority, reminderIntervalMinutes, remindersSent, nextReminderAt, expiresAt, publishedAt |
| AnnouncementTarget | campaignId, teamId, userId (exactamente uno) |
| AnnouncementRecipient | reminderCount, lastRemindedAt |
| AnnouncementAck | acknowledgedAt |
| HelpRequest | id, type, priority, summary, status, createdAt, claimedAt, resolvedAt · waitSeconds(), resolutionSeconds() |
| «enum» UserRole | agent, supervisor, admin |
| «enum» HelpStatus | pending, in_progress, resolved |

## Relaciones

| Desde | Hacia | Multiplicidad | Nombre |
|---|---|---|---|
| Campaign | Team | 1 → 0..* | agrupa |
| Team | User | 1 → 0..* | agentes |
| Team | User | 0..* — 0..* | supervisores |
| User | Announcement | 1 → 0..* | publica |
| Announcement | AnnouncementTarget | 1 ◆ 1..* (composición) | destinos |
| Announcement | AnnouncementRecipient | 1 ◆ 1..* (composición) | foto de audiencia |
| AnnouncementRecipient | AnnouncementAck | 1 → 0..1 | confirma |
| User | HelpRequest | 1 → 0..* | crea |
| User | HelpRequest | 0..1 → 0..* | toma |
| Team | HelpRequest | 1 → 0..* | atiende |

## Diagrama

![Diagrama de clases del dominio](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/clases_dominio.png)
