# Diagrama de componentes de la API (C4 · nivel 3)

**Módulos internos del contenedor api**

Recorrido de una petición: `app.js` → `authenticate` → `requireRole` → ruta → servicio → `errorHandler`.

## Componentes

| Componente | Responsabilidad |
|---|---|
| app.js | Compone Express, límite JSON de 64 kB, /livez y /health |
| middleware/auth | authenticate (JWT y alcance) y requireRole |
| middleware/rateLimit | Ventana fija por minuto en Redis (login y ayuda) |
| middleware/errors | Traduce errores de zod, AppError y PostgreSQL a JSON |
| routes/ | auth, admin, announcements, helpRequests, directory y presence |
| services/announcements | Publicar, listar, estado y confirmar |
| services/helpRequests | Crear, listar, tomar y resolver |

## Paquete compartido (@floorhub/shared)

| Módulo | Responsabilidad |
|---|---|
| scope.js | Firma y verifica el JWT, carga el alcance del usuario |
| cache.js | getOrSet con TTL e invalidación |
| queues.js | Colas de BullMQ con jobId determinista |
| realtime.js | Nombres de eventos, salas y presencia |
| db.js | Pool de conexiones y withTransaction |

## Diagrama

![Diagrama de componentes de la API](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/c4_componentes_api.png)
