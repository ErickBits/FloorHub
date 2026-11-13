# Reglas de Negocio, Motor de Comunicados y Cola de Ayuda, y Suite de Pruebas Automatizadas

## 1. Fundamentación del dominio

FloorHub tiene dos núcleos de negocio:

1. **Comunicados con confirmación:** un supervisor publica, el sistema calcula la audiencia, entrega en vivo, registra quién confirmó y recuerda a quien no lo ha hecho.
2. **Cola de ayuda:** un agente levanta la mano, el servidor asigna la prioridad, un único supervisor la toma y la resuelve, y el sistema mide los tiempos.

Las reglas se implementan en tres niveles: **validación** con zod (forma de los datos), **servicios** de la API (reglas que dependen del usuario) y **restricciones de PostgreSQL** (reglas que nunca se pueden romper).

## 2. Catálogo de reglas de negocio (RN)

| Código | Regla | Dónde se garantiza |
|---|---|---|
| RN-01 | El correo es único sin distinguir mayúsculas. | Índice único `lower(email)` y normalización con zod |
| RN-02 | La contraseña tiene entre 8 y 72 caracteres. | zod (`password`) |
| RN-03 | Un agente pertenece exactamente a un equipo; supervisores y administradores no tienen `team_id`. | `CHECK users_team_matches_role` |
| RN-04 | Un usuario inactivo no puede iniciar sesión ni seguir usando su token. | `login` y `authenticateToken` |
| RN-05 | El nombre de un equipo es único dentro de su campaña. | `UNIQUE (campaign_id, name)` |
| RN-06 | Solo un usuario con rol `supervisor` puede asignarse como supervisor de un equipo. | `PUT /admin/teams/:id/supervisors` |
| RN-07 | Un supervisor solo publica a sus equipos, a campañas donde supervisa al menos un equipo o a agentes de sus equipos. | `assertTargetsAllowed` |
| RN-08 | Un comunicado necesita al menos un destino y debe alcanzar al menos a un agente activo. | zod y error `empty_audience` |
| RN-09 | Un comunicado es crítico si y solo si tiene intervalo de recordatorio (1 a 240 minutos). | zod y `CHECK announcements_reminder_matches_priority` |
| RN-10 | El título, el cuerpo, la prioridad, el autor y la fecha de un comunicado publicado no cambian. | Trigger `announcements_immutable_content` |
| RN-11 | La audiencia se calcula y se guarda al publicar (foto fija). | `announcement_recipients` |
| RN-12 | Solo un destinatario puede confirmar; la confirmación es única e inmutable. | FK a `announcement_recipients`, PK compuesta, triggers |
| RN-13 | Los recordatorios llegan solo a quien no ha confirmado, hasta 5 rondas, y se detienen si todos confirmaron o el comunicado venció. | `sendReminder` |
| RN-14 | La prioridad la asigna el servidor: cliente difícil = 3, aprobación = 2, duda de proceso = 1. | `PRIORITY_BY_TYPE` |
| RN-15 | Un agente tiene como máximo una solicitud pendiente o en atención. | Índice único parcial `help_requests_one_active_per_agent_idx` |
| RN-16 | La cola se ordena por estado, prioridad descendente y antigüedad. | `QUEUE_ORDER` |
| RN-17 | Una solicitud solo la toma un supervisor de su equipo, y solo uno. | `UPDATE … WHERE status = 'pending' AND team_id = ANY($3)` |
| RN-18 | Solo quien tomó la solicitud puede resolverla. | `UPDATE … WHERE claimed_by = $2` |
| RN-19 | Las solicitudes resueltas se muestran solo durante 24 horas. | `listRequests` |
| RN-20 | Un agente está conectado si envió un heartbeat en los últimos 45 segundos. | `onlineUsers` y `sweepPresence` |

## 3. Algoritmos principales

### 3.1. Publicación de un comunicado (`publishAnnouncement`)

1. Validar la entrada con zod (RN-08, RN-09).
2. Abrir una transacción.
3. Verificar que los agentes elegidos directamente existan y estén activos (si no, `422 invalid_target`).
4. Verificar el alcance del supervisor (RN-07); si falla, `403`.
5. Insertar el comunicado. Si es crítico, `next_reminder_at = now() + intervalo`.
6. Insertar los destinos elegidos (`announcement_targets`).
7. Insertar la audiencia: agentes activos alcanzados por campaña, equipo o selección directa, sin duplicados (RN-11).
8. Si la audiencia está vacía, revertir con `422 empty_audience`.
9. Confirmar la transacción y, **después**, invalidar la caché, emitir los eventos y, si es crítico, encolar la primera ronda de recordatorios.

### 3.2. Porcentaje de confirmación (`announcementStatus`)

```text
porcentaje = round(confirmados / destinatarios visibles × 100)
```

El autor ve a toda la audiencia; otro supervisor solo ve a los agentes de sus equipos, y su porcentaje se calcula sobre ellos. Con 0 destinatarios visibles, el porcentaje es 0.

### 3.3. Rondas de recordatorio (`sendReminder`)

1. Bloquear el comunicado con `SELECT … FOR UPDATE` **solo si** `reminders_sent` coincide con la ronda del trabajo y la fecha ya venció. Si no coincide, el trabajo es un duplicado y termina sin notificar.
2. Buscar a los destinatarios sin confirmación.
3. Si no queda nadie o el comunicado venció: `next_reminder_at = NULL` y terminar.
4. Sumar 1 a `reminder_count` de cada pendiente y a `reminders_sent` del comunicado.
5. Si aún quedan rondas (`ronda < REMINDER_MAX_ROUNDS`), programar la siguiente; si no, `next_reminder_at = NULL`.
6. Después del commit, encolar una notificación por agente y la siguiente ronda.

**Reconciliador:** cada 60 s busca comunicados con `next_reminder_at <= now()` y reencola su ronda con `jobId = reminder-{id}-{ronda}`. Si el trabajo ya existe en la cola, BullMQ lo ignora; si Redis se reinició y lo perdió, se vuelve a crear.

### 3.4. Cola de ayuda

| Paso | Operación | Error posible |
|---|---|---|
| Crear | `INSERT` con la prioridad de `PRIORITY_BY_TYPE` y el equipo del agente | `409 active_request_exists` si viola RN-15; `429` si supera 10 por minuto |
| Listar (supervisor) | Solicitudes de sus equipos, resueltas de las últimas 24 h, máx. 200 | — |
| Tomar | `UPDATE` atómico de `pending` a `in_progress` | `409 already_claimed` o `404` si no es de sus equipos |
| Resolver | `UPDATE` de `in_progress` a `resolved` solo si `claimed_by` es el supervisor | `409 cannot_resolve` |
| Tiempos | `wait_seconds = claimed_at (o ahora) − created_at`; `resolution_seconds = resolved_at − claimed_at` | — |

## 4. Suite de pruebas: autenticación y autorización (`apps/api/test/auth.test.js`)

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| PA-01 | Inicia sesión y devuelve al usuario sin su hash | 200 con token; `/me` no incluye `password_hash` | ✅ Aprobado |
| PA-02 | Rechaza credenciales incorrectas con el mismo mensaje | 401 idéntico para correo inexistente y contraseña errada | ✅ Aprobado |
| PA-03 | Limita los intentos de login | Los primeros 5 intentos dan 401 y el último 429 | ✅ Aprobado |
| PA-04 | Exige un token válido | 401 sin token o con token falso | ✅ Aprobado |
| PA-05 | Bloquea las rutas de administración a otros roles | 403 para un usuario que no es administrador | ✅ Aprobado |
| PA-06 | Un usuario desactivado pierde el acceso de inmediato | Su token deja de funcionar | ✅ Aprobado |
| PA-07 | Valida las reglas de rol y equipo | 422 si el rol y el equipo no son coherentes | ✅ Aprobado |
| PA-08 | `/health` informa del estado de sus dependencias | 200 con `checks` | ✅ Aprobado |

## 5. Suite de pruebas: cola de ayuda (`apps/api/test/helpRequests.test.js`)

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| PH-01 | Dos supervisores nunca toman la misma solicitud al mismo tiempo | De 10 peticiones simultáneas, 1 recibe 200 y 9 reciben 409 | ✅ Aprobado |
| PH-02 | Recorre pendiente, en atención y resuelta, y mide los tiempos | Estados y tiempos correctos | ✅ Aprobado |
| PH-03 | Ordena la cola por prioridad y luego por antigüedad | Cliente difícil antes que duda de proceso | ✅ Aprobado |
| PH-04 | El servidor ignora una prioridad enviada por el agente | Prioridad según el tipo | ✅ Aprobado |
| PH-05 | Solo permite una solicitud activa por agente | 409 en la segunda | ✅ Aprobado |
| PH-06 | Un supervisor de otro equipo no ve ni toma la solicitud | No aparece en su cola; 404 al tomarla | ✅ Aprobado |
| PH-07 | Solo quien atiende la solicitud puede resolverla | 409 para otro supervisor | ✅ Aprobado |
| PH-08 | Valida las entradas | 400 con datos inválidos o un id que no es UUID | ✅ Aprobado |
| PH-09 | Limita la creación de solicitudes | 429 al superar el límite | ✅ Aprobado |
| PH-10 | Una inyección SQL se trata como texto | El texto se guarda tal cual y la tabla sigue intacta | ✅ Aprobado |
| PH-11 | El agente y quien tomó la solicitud conversan hasta que se resuelve | Las respuestas se guardan en orden; tras resolver, 409 | ✅ Aprobado |

## 6. Suite de pruebas: comunicados y auditoría (`apps/api/test/announcements.test.js`)

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| PC-01 | Calcula el porcentaje de confirmación con la lista de pendientes | Porcentaje, confirmados y pendientes correctos | ✅ Aprobado |
| PC-02 | Una campaña alcanza a sus equipos y no a los de otra | Audiencia limitada a la campaña | ✅ Aprobado |
| PC-03 | Confirmar dos veces conserva la fecha original | Misma `acknowledgedAt` | ✅ Aprobado |
| PC-04 | Impide publicar fuera del alcance del supervisor | 403 | ✅ Aprobado |
| PC-05 | Impide confirmar o consultar comunicados ajenos | 404 | ✅ Aprobado |
| PC-06 | Un comunicado crítico exige intervalo de recordatorio | 400 | ✅ Aprobado |
| PC-07 | La caché se invalida cuando llega un comunicado nuevo | La bandeja muestra el nuevo de inmediato | ✅ Aprobado |
| PC-08 | La app sigue funcionando si la consulta no puede usar Redis | Responde desde PostgreSQL | ✅ Aprobado |
| PC-09 | El rol de la aplicación no puede editar ni borrar confirmaciones | `permission denied` en UPDATE, DELETE y TRUNCATE | ✅ Aprobado |
| PC-10 | Los triggers lo impiden incluso al dueño de las tablas | `restrict_violation` | ✅ Aprobado |
| PC-11 | El contenido de un comunicado publicado no se puede cambiar | `restrict_violation` | ✅ Aprobado |

## 6.1. Suite de pruebas: administración, directorio y presencia (`apps/api/test/admin.test.js`)

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| PD-01 | Crea, lista y edita campañas | 201 al crear; aparece en el listado; 200 al desactivar | ✅ Aprobado |
| PD-02 | Rechaza ediciones vacías o de registros inexistentes | 400 `empty_update`; 404 para equipo o usuario inexistente | ✅ Aprobado |
| PD-03 | Crea equipos y los lista con sus supervisores | 201; el listado incluye los supervisores de cada equipo | ✅ Aprobado |
| PD-04 | Reasigna supervisores y actualiza su alcance de inmediato | `/me` refleja el nuevo equipo; 404 si se asigna a un agente | ✅ Aprobado |
| PD-05 | Edita usuarios sin exponer el hash de la contraseña | 200 sin `password_hash` en la respuesta | ✅ Aprobado |
| PD-06 | El directorio solo muestra lo que el supervisor puede elegir | Solo sus campañas, equipos y agentes; 403 para un agente | ✅ Aprobado |
| PD-07 | La presencia lista a los agentes del equipo con su estado | Agentes de sus equipos con `online` | ✅ Aprobado |

## 7. Suite de pruebas: tiempo real (`apps/gateway/test/gateway.test.js`)

La suite levanta **dos réplicas reales** del gateway conectadas al mismo Redis.

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| PG-01 | Rechaza conexiones sin un token válido | Error `unauthorized` en el handshake | ✅ Aprobado |
| PG-02 | Un evento publicado por la API llega a clientes de cualquier réplica | Ambos clientes lo reciben | ✅ Aprobado |
| PG-03 | Un agente no recibe eventos de otro equipo | No llega ningún evento | ✅ Aprobado |
| PG-04 | Informa la presencia al conectar y al desconectar | `presence:changed` con `online` true y false | ✅ Aprobado |
| PG-05 | Con dos pestañas sigue conectado hasta cerrar la última | No se marca desconectado al cerrar la primera | ✅ Aprobado |
| PG-06 | `/health` responde | 200 | ✅ Aprobado |

## 8. Suite de pruebas: trabajos del worker (`apps/worker/test/jobs.test.js`)

| ID | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|
| PW-01 | Recuerda solo a quien no ha confirmado y programa la siguiente ronda | Notifica solo a pendientes | ✅ Aprobado |
| PW-02 | Un trabajo repetido no notifica dos veces | La segunda ejecución envía 0 | ✅ Aprobado |
| PW-03 | Se detiene al alcanzar el máximo de rondas | `next_reminder_at = NULL` | ✅ Aprobado |
| PW-04 | Deja de recordar cuando todos confirmaron | `next_reminder_at = NULL` | ✅ Aprobado |
| PW-05 | Reconstruye desde PostgreSQL los recordatorios perdidos con un reinicio de Redis | Se reencolan | ✅ Aprobado |
| PW-06 | Expira la presencia de quien dejó de enviar heartbeats | Se emite `online: false` | ✅ Aprobado |
| PW-07 | Genera el resumen diario | Devuelve los conteos | ✅ Aprobado |

## 9. Registro consolidado de ejecución

| Dato | Valor |
|---|---|
| Fecha de ejecución | 13/11/2026 |
| Herramienta | Vitest 5.1.0 con supertest y socket.io-client |
| Entorno | PostgreSQL 17 y Redis 8 reales en Docker; base `floorhub_test` y Redis índice 1 |
| Archivos de prueba | 6 aprobados de 6 |
| Casos de prueba | **50 aprobados de 50** |
| Duración total | 5,07 s |
| Lint (ESLint) | Sin errores |

| Suite | Casos | Aprobados |
|---|---:|---:|
| Autenticación y autorización | 8 | 8 |
| Cola de ayuda | 11 | 11 |
| Comunicados y auditoría | 11 | 11 |
| Administración, directorio y presencia | 7 | 7 |
| Tiempo real (gateway) | 6 | 6 |
| Trabajos del worker | 7 | 7 |
| **Total** | **50** | **50** |

**Por qué contra servicios reales y no con mocks:** un mock nunca habría probado el bloqueo de filas de PostgreSQL (PH-01), los triggers (PC-10) ni la entrega entre réplicas por Redis (PG-02).

### Cómo reproducir la ejecución

```bash
docker compose up -d --wait postgres redis
npx vitest run --reporter=verbose
npx eslint .
```
