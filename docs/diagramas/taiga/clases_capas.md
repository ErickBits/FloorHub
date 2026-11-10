# Diagrama de clases: arquitectura por capas

**Módulos del código representados como clases**

El código usa módulos con funciones; aquí cada módulo se dibuja como una clase con sus funciones públicas.

## Clases

| Clase | Estereotipo | Operaciones |
|---|---|---|
| AnnouncementRoutes | router /api/announcements | POST /, GET /, GET /:id/status, POST /:id/ack |
| HelpRequestRoutes | router /api/help-requests | POST /, GET /, POST /:id/claim, POST /:id/resolve |
| AnnouncementsService | service | publishAnnouncement, listForAgent, listForSupervisor, announcementStatus, acknowledgeAnnouncement |
| HelpRequestsService | service | createRequest, listRequests, claimRequest, resolveRequest |
| Context | shared | config, pool, redis, cache, emitter, queues, log, background() |
| Scope | shared/scope.js | signToken, authenticateToken, getUserScope |
| Cache | shared/cache.js | getOrSet, invalidate |
| Queues | shared/queues.js | enqueueReminder, enqueueNotifications |
| Jobs | worker/jobs.js | sendReminder, reconcileReminders, sweepPresence, dailySummary, deliverNotification |
| Gateway | gateway/server.js | createGateway, roomsFor |

## Dependencias

| Desde | Hacia |
|---|---|
| AnnouncementRoutes | AnnouncementsService, Scope |
| HelpRequestRoutes | HelpRequestsService |
| AnnouncementsService, HelpRequestsService, Jobs | Context |
| Context | Cache, Queues |
| Gateway | Scope |
| Queues | Jobs (vía BullMQ) |

## Diagrama

![Diagrama de clases por capas](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/clases_capas.png)
