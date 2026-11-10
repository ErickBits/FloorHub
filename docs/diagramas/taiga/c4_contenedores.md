# Diagrama de contenedores (C4 · nivel 2)

**Procesos y almacenes de datos de FloorHub**

## Contenedores

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| Navegador | SPA React · sessionStorage | Interfaz de cada rol |
| nginx | Nginx | Sirve la SPA, hace de proxy de /api y /ws, CSP y cabeceras de seguridad |
| api | Node.js · Express · zod | API REST |
| gateway | Node.js · Socket.IO | WebSocket en /ws, salas y presencia |
| worker | Node.js · BullMQ | Recordatorios, reconciliador y resumen diario |
| migrate | node-pg-migrate | Migraciones y datos de demostración |
| 🗄️ PostgreSQL 17 | Base relacional | Fuente de verdad |
| 🗄️ Redis 8 | Memoria | Caché, Pub/Sub, colas, rate limit y presencia |

## Conexiones

| Desde | Hacia | Protocolo | Para qué |
|---|---|---|---|
| Navegador | nginx | HTTP y WebSocket | Página, API y eventos |
| nginx | api | HTTP | Ruta /api |
| nginx | gateway | WebSocket | Ruta /ws |
| api, gateway, worker | PostgreSQL | SQL | Leer y escribir datos |
| migrate | PostgreSQL | SQL | DDL y datos demo |
| api | Redis | RESP | Caché, emisión de eventos y encolado |
| gateway | Redis | Pub/Sub | Recibir eventos de otras réplicas |
| worker | Redis | RESP | Colas y emisión |

## Diagrama

![Diagrama de contenedores C4](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/c4_contenedores.png)
