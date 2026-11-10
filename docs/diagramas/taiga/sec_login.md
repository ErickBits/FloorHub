# Diagrama de secuencia: iniciar sesión

**Autenticación con límite de intentos**

Participantes: **Usuario**, **SPA React**, **nginx**, **api /auth**, **Redis** y **PostgreSQL**.

## Mensajes

| # | Desde | Hacia | Mensaje |
|---|---|---|---|
| 1 | Usuario | SPA | Escribe correo y contraseña |
| 2 | SPA | nginx → api | POST /api/auth/login |
| 3 | api | Redis | INCR rl:login:{ip}:{correo} |
| 3a | api | SPA | ❌ Más de 10 intentos en el minuto: 429 rate_limited |
| 4 | api | PostgreSQL | SELECT id, password_hash, is_active por correo |
| 5 | api | api | bcrypt.compare (con hash falso si el correo no existe) |
| 5a | api | SPA | ❌ Credenciales inválidas o usuario inactivo: 401 |
| 6 | api | SPA | 200 { token } (JWT HS256, 8 h) |
| 7 | SPA | SPA | Guarda el token en sessionStorage |
| 8 | SPA | api | GET /api/auth/me |
| 9 | api | Redis | Alcance del usuario en caché (60 s) |
| 10 | api | SPA | 200 { user: rol, equipos, campañas } |
| 11 | SPA | Usuario | Muestra la vista de su rol |

## Diagrama

![Secuencia de inicio de sesión](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/sec_login.png)
