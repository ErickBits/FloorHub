# Especificación de Requerimientos de Software (SRS) — Norma IEEE 830 y BDD

**Proyecto:** FloorHub, plataforma interna para el piso de operaciones de un BPO
**Versión del documento:** 1.0 · **Fecha:** 10/11/2026
**Fuente de verdad:** el código del repositorio `FloorHub` (migración `db/migrations/001_initial_schema.sql`, rutas de `apps/api/src/routes` y pruebas de `apps/*/test`).

---

## 1. Fase de investigación y fundamentación

### 1.1. Planteamiento del problema

En el piso de operaciones de un BPO (*Business Process Outsourcing*, un centro de contacto que atiende clientes en nombre de otras empresas) trabajan decenas de agentes organizados en equipos y campañas. Allí se repiten dos problemas:

1. **Los procesos cambian a diario y los agentes se enteran tarde.** Los cambios se comunican por correo, por chats generales o de viva voz. El supervisor no sabe quién leyó el cambio y quién no, y un agente que no se enteró sigue aplicando el proceso viejo frente al cliente.
2. **Las solicitudes de ayuda se pierden.** Cuando un agente necesita una aprobación, tiene un cliente difícil o una duda de proceso, escribe en un chat general o levanta la mano físicamente. Las solicitudes no tienen orden ni responsable: a veces dos supervisores atienden la misma y otras veces nadie la atiende.

### 1.2. Justificación

Un comunicado con **confirmación de lectura auditable** convierte "se envió el correo" en "estas 18 personas confirmaron a esta hora y estas 2 no". Una **cola de ayuda con un único responsable por solicitud** elimina la atención duplicada y permite medir tiempos de espera y de atención.

Las dos funciones necesitan tiempo real: un comunicado crítico no sirve si llega al recargar la página, y una cola de ayuda deja de ser útil si el supervisor no ve las solicitudes nuevas al instante.

### 1.3. Objetivos del proyecto

**Objetivo general.** Desarrollar una aplicación web en tiempo real que permita a los supervisores de un BPO publicar comunicados con confirmación de lectura auditable y atender las solicitudes de ayuda de sus agentes mediante una cola ordenada con un único responsable.

**Objetivos específicos.**

1. Implementar comunicados informativos y críticos dirigidos a campañas, equipos o agentes, con porcentaje de confirmación en vivo y recordatorios automáticos.
2. Implementar una cola de ayuda con prioridad asignada por el servidor y toma atómica de solicitudes.
3. Garantizar que las confirmaciones sean un registro de auditoría que no se puede editar ni borrar.
4. Controlar el acceso por rol (agente, supervisor y administrador) en REST y en WebSocket.
5. Desplegar el sistema en contenedores sobre Kubernetes (Amazon EKS) con un costo menor a 30 USD.
6. Verificar el comportamiento con pruebas automáticas contra PostgreSQL y Redis reales.

### 1.4. Alcance y delimitación del sistema

| Incluido | Fuera del alcance |
|---|---|
| Inicio de sesión con correo y contraseña, sesión independiente por ventana | Registro abierto de usuarios: las cuentas las crea el administrador |
| Gestión de usuarios, campañas, equipos y supervisores | Integración con la telefonía o el CRM del BPO |
| Comunicados informativos y críticos con confirmación y recordatorios | Envío de correos o notificaciones push al celular |
| Cola de ayuda: levantar la mano, tomar y resolver | Chat entre agente y supervisor |
| Presencia en vivo de los agentes de un equipo | Reportes históricos y tableros de analítica |
| Resumen diario (se escribe en los logs) | Firma criptográfica de la auditoría |
| Despliegue local (Docker Compose, minikube) y en AWS (EKS) | TLS público en la demo (requiere un dominio propio) |

---

## 2. Matriz de requerimientos funcionales (RF) — Estándar IEEE 830

Prioridad: **Alta** = imprescindible, **Media** = importante, **Baja** = deseable. La columna CU enlaza con los casos de uso de [10-casos-de-uso.md](10-casos-de-uso.md).

| Código | Requisito | Descripción | Actor | Prioridad | CU |
|---|---|---|---|---|---|
| RF-01 | Iniciar sesión | Autenticar con correo y contraseña y abrir las páginas del rol del usuario. | Todos | Alta | CU-01 |
| RF-02 | Cerrar sesión | Terminar la sesión de la ventana actual y volver al inicio de sesión. | Todos | Alta | CU-02 |
| RF-03 | Sesión por ventana | Mantener una sesión independiente en cada ventana o pestaña del navegador. | Todos | Baja | CU-01 |
| RF-04 | Crear usuarios | Registrar nombre, correo único, contraseña, rol y, si es agente, su equipo. | Administrador | Alta | CU-15 |
| RF-05 | Editar usuarios | Modificar nombre, rol, equipo y contraseña de un usuario existente. | Administrador | Alta | CU-15 |
| RF-06 | Activar o desactivar usuarios | Impedir o restablecer el acceso sin borrar el historial. | Administrador | Alta | CU-16 |
| RF-07 | Buscar usuarios | Filtrar el listado por nombre, correo, equipo y rol. | Administrador | Media | CU-15 |
| RF-08 | Gestionar campañas | Crear, renombrar, activar y desactivar campañas. | Administrador | Alta | CU-17 |
| RF-09 | Gestionar equipos | Crear equipos dentro de una campaña, renombrarlos, activarlos y desactivarlos. | Administrador | Alta | CU-18 |
| RF-10 | Asignar supervisores | Asignar uno o varios supervisores a un equipo y retirarlos. | Administrador | Alta | CU-19 |
| RF-11 | Publicar comunicados | Crear comunicados informativos o críticos dirigidos a una campaña, un equipo o un agente. | Supervisor | Alta | CU-07 |
| RF-12 | Restringir destinatarios | Permitir publicar solo dentro de los equipos que supervisa. | Sistema | Alta | CU-07 |
| RF-13 | Entrega en tiempo real | Mostrar el comunicado a los destinatarios conectados sin recargar la página. | Sistema | Alta | CU-03 |
| RF-14 | Confirmar lectura | Registrar «Leí y entendí» con fecha y hora, sin posibilidad de modificarlo. | Agente | Alta | CU-04 |
| RF-15 | Seguimiento de confirmación | Mostrar el porcentaje de confirmación, quién confirmó y quién falta. | Supervisor | Alta | CU-08 |
| RF-16 | Recordatorios automáticos | Reenviar los comunicados críticos a quien no ha confirmado, cada N minutos y hasta 5 rondas. | Sistema | Alta | CU-13 |
| RF-17 | Levantar la mano | Crear una solicitud de ayuda con tipo y resumen; máximo una activa por agente. | Agente | Alta | CU-05 |
| RF-18 | Prioridad automática | Asignar la prioridad según el tipo: cliente difícil 3, aprobación 2, duda de proceso 1. | Sistema | Alta | CU-05 |
| RF-19 | Cola de ayuda | Listar las solicitudes de los equipos del supervisor por prioridad y antigüedad. | Supervisor | Alta | CU-10 |
| RF-20 | Tomar solicitud | Asignar la solicitud a un único supervisor; si otro la tomó antes, avisar. | Supervisor | Alta | CU-11 |
| RF-21 | Resolver solicitud | Cerrar la solicitud y calcular los tiempos de espera y de atención. | Supervisor | Alta | CU-12 |
| RF-22 | Seguimiento del agente | Notificar en vivo al agente cuando su solicitud se toma o se resuelve. | Sistema | Media | CU-06 |
| RF-23 | Historial reciente | Mostrar las solicitudes resueltas de las últimas 24 horas. | Agente, Supervisor | Baja | CU-06, CU-10 |
| RF-24 | Presencia | Mostrar qué agentes de los equipos del supervisor están conectados. | Supervisor | Media | CU-09 |
| RF-25 | Selectores con buscador | Permitir escribir para filtrar campañas, equipos, supervisores y destinatarios. | Todos | Media | CU-07, CU-15, CU-18 |

---

## 3. Matriz de requerimientos no funcionales (RNF) — Norma ISO/IEC 25010

| Código | Característica ISO 25010 | Requisito | Criterio de aceptación / implementación |
|---|---|---|---|
| RNF-01 | Seguridad · Confidencialidad | Las contraseñas nunca se guardan en texto plano. | Hash bcrypt con 10 rondas. |
| RNF-02 | Seguridad · Autenticidad | El acceso caduca al terminar el turno. | Token JWT HS256 de 8 horas; un usuario desactivado pierde el acceso de inmediato, porque su caché de alcance se invalida y su WebSocket se cierra. |
| RNF-03 | Seguridad · Resistencia | Protección contra fuerza bruta y abuso. | Máximo 10 inicios de sesión por minuto (IP y correo) y 10 solicitudes de ayuda por minuto; responde 429. |
| RNF-04 | Seguridad · Confidencialidad | Cada persona solo ve y hace lo que su rol permite. | Control por rol en cada petición REST y en las salas de WebSocket. |
| RNF-05 | Seguridad · Integridad | Cabeceras de protección en el navegador. | Content-Security-Policy, X-Frame-Options DENY y X-Content-Type-Options nosniff. |
| RNF-06 | Seguridad · Integridad | Privilegios mínimos en la base de datos. | La aplicación usa el rol `floorhub_app`; las migraciones usan el rol dueño. |
| RNF-07 | Seguridad · No repudio | Las confirmaciones son prueba de auditoría. | Tabla de solo inserción protegida por triggers; el contenido publicado es inmutable. |
| RNF-08 | Fiabilidad · Recuperabilidad | No se pierde historial. | Borrados restringidos (`ON DELETE RESTRICT`); los usuarios se desactivan. |
| RNF-09 | Adecuación funcional · Corrección | Una solicitud no puede quedar con dos responsables. | `UPDATE` condicional atómico en PostgreSQL; el segundo intento recibe 409. |
| RNF-10 | Eficiencia de desempeño · Comportamiento temporal | Los cambios se ven sin recargar la página. | Eventos por WebSocket (Socket.IO) distribuidos con Redis Pub/Sub. |
| RNF-11 | Fiabilidad · Disponibilidad | El servicio soporta la caída de una réplica. | API y gateway con mínimo 2 réplicas y autoescalado hasta 3 al 70 % de CPU. |
| RNF-12 | Fiabilidad · Tolerancia a fallos | Un reinicio de Redis no pierde recordatorios. | Reconciliador cada minuto desde PostgreSQL; al reconectar, el cliente recarga el estado. |
| RNF-13 | Eficiencia de desempeño · Capacidad | Crecer agregando réplicas. | Servicios sin estado; Redis coordina las réplicas del gateway. |
| RNF-14 | Usabilidad · Estética de la interfaz | Uso cómodo durante turnos largos. | Tema oscuro de bajo contraste, una página por función, textos en español. |
| RNF-15 | Usabilidad · Operabilidad | Encontrar registros entre cientos. | Buscadores sin distinción de tildes en listados y selectores. |
| RNF-16 | Usabilidad · Accesibilidad | Uso con teclado y lectores de pantalla. | Selectores navegables con teclado, roles ARIA y estados con texto además del color. |
| RNF-17 | Compatibilidad · Interoperabilidad | Funciona en distintos dispositivos. | Navegadores actuales; diseño adaptable con menú horizontal en pantallas pequeñas. |
| RNF-18 | Portabilidad · Instalabilidad | Mismo sistema en cualquier entorno. | Contenedores Docker: Docker Compose en local, minikube y Amazon EKS. |
| RNF-19 | Mantenibilidad · Capacidad de prueba | Cambios seguros y verificables. | Monorepo, validación con zod, 42 pruebas automáticas y CI con lint, pruebas y build. |
| RNF-20 | Mantenibilidad · Analizabilidad | Diagnosticar fallos rápidamente. | Logs JSON estructurados (pino) y endpoints `/health` y `/livez` en cada servicio. |
| RNF-21 | Eficiencia de desempeño · Utilización de recursos | Operar con presupuesto reducido. | Infraestructura por debajo de 30 USD en AWS (estimado 8,16 USD), con alertas de presupuesto y `make destroy`. |

---

## 4. Historias de usuario con criterios de aceptación (formato BDD / Gherkin)

### 4.1. Historia de usuario 1: comunicado crítico con recordatorios

> **Como** supervisor, **quiero** publicar un comunicado crítico para mi equipo **para** saber quién lo leyó y que el sistema insista a quien no.

```gherkin
Característica: Comunicados críticos con confirmación

  Antecedentes:
    Dado que Laura Gómez supervisa el equipo "Retención"
    Y que Santiago Ramírez y Daniela Ospina son agentes activos de "Retención"

  Escenario: El porcentaje sube cuando un agente confirma
    Cuando Laura publica un comunicado crítico para "Retención" con recordatorio cada 1 minuto
    Entonces Santiago y Daniela reciben el comunicado sin recargar la página
    Y el estado del comunicado muestra 0 % de confirmación
    Cuando Santiago pulsa "Leí y entendí"
    Entonces el estado muestra 50 %, con Santiago en confirmados y Daniela en pendientes

  Escenario: Solo recibe recordatorio quien no ha confirmado
    Dado que Santiago confirmó y Daniela no
    Cuando pasa 1 minuto
    Entonces Daniela recibe "Recordatorio: confirma «…»"
    Y Santiago no recibe ningún recordatorio

  Escenario: Confirmar dos veces conserva la fecha original
    Dado que Santiago confirmó a las 08:00
    Cuando vuelve a confirmar a las 08:05
    Entonces la fecha de confirmación sigue siendo las 08:00
```

### 4.2. Historia de usuario 2: tomar una solicitud de ayuda sin duplicar la atención

> **Como** supervisor, **quiero** tomar una solicitud de la cola **para** que el agente sepa quién lo va a ayudar y ningún otro supervisor la atienda a la vez.

```gherkin
Característica: Cola de ayuda con un único responsable

  Escenario: La prioridad la decide el servidor
    Cuando Daniela levanta la mano con el tipo "Cliente difícil" y envía prioridad 1
    Entonces la solicitud queda con prioridad 3

  Escenario: Dos supervisores toman la misma solicitud al mismo tiempo
    Dado que hay una solicitud pendiente de Daniela
    Cuando Laura y otro supervisor de "Retención" pulsan "Tomar" al mismo tiempo
    Entonces solo uno de ellos queda como responsable
    Y el otro recibe "Otro supervisor ya tomó esta solicitud"

  Escenario: Un agente no puede tener dos solicitudes activas
    Dado que Daniela tiene una solicitud "En atención"
    Cuando intenta levantar la mano otra vez
    Entonces el sistema responde "Ya tienes una solicitud activa"
```

### 4.3. Historia de usuario 3: publicar solo dentro del alcance propio

> **Como** responsable de la operación, **quiero** que un supervisor solo pueda publicar a sus propios equipos **para** que no se mezclen instrucciones entre campañas de clientes distintos.

```gherkin
Característica: Alcance del supervisor

  Escenario: Publicar a un equipo ajeno
    Dado que Laura supervisa "Retención" y no supervisa "Tarjetas"
    Cuando intenta publicar un comunicado para el equipo "Tarjetas"
    Entonces el sistema responde 403 "Solo puedes publicar a tus equipos, tus campañas o tus agentes"
    Y no se crea ningún comunicado

  Escenario: Una campaña alcanza solo a sus equipos
    Cuando un supervisor de "Banco del Valle" publica para esa campaña
    Entonces lo reciben los agentes de "Tarjetas"
    Y no lo reciben los agentes de "Telecomunicaciones Andina"
```

---

## 5. Matriz de trazabilidad: requerimientos vs. componentes técnicos

| Requisito | Endpoint o evento | Componente | Tabla / clave | Prueba automática |
|---|---|---|---|---|
| RF-01, RF-03 | `POST /api/auth/login`, `GET /api/auth/me` | `routes/auth.js`, `shared/scope.js` | `users` | auth: «inicia sesión y devuelve al usuario sin su hash» |
| RF-04 a RF-07 | `/api/admin/users` | `routes/admin.js` | `users` | auth: «valida las reglas de rol y equipo», «un usuario desactivado pierde el acceso» |
| RF-08 a RF-10 | `/api/admin/campaigns`, `/teams`, `/teams/:id/supervisors` | `routes/admin.js` | `campaigns`, `teams`, `team_supervisors` | auth: «bloquea las rutas de administración a otros roles» |
| RF-11, RF-12 | `POST /api/announcements` | `services/announcements.js` | `announcements`, `announcement_targets`, `announcement_recipients` | announcements: «impide publicar fuera del alcance», «una campaña alcanza a sus equipos» |
| RF-13 | `announcement:new` | `gateway/server.js`, Redis Pub/Sub | — | gateway: «un evento publicado por la API llega a clientes de cualquier réplica» |
| RF-14 | `POST /api/announcements/:id/ack` | `services/announcements.js` | `announcement_acks` | announcements: «confirmar dos veces conserva la fecha original», registro de auditoría |
| RF-15 | `GET /api/announcements/:id/status` | `services/announcements.js` | `announcement_acks` | announcements: «calcula el porcentaje de confirmación» |
| RF-16 | `announcement:reminder` | `worker/jobs.js` | `announcements.next_reminder_at`, cola `reminders` | worker: 5 pruebas de recordatorios y reconciliador |
| RF-17, RF-18 | `POST /api/help-requests` | `services/helpRequests.js` | `help_requests` | helpRequests: «el servidor ignora una prioridad», «solo una solicitud activa» |
| RF-19 | `GET /api/help-requests` | `services/helpRequests.js` | índice `help_requests_queue_idx` | helpRequests: «ordena la cola por prioridad y antigüedad» |
| RF-20 | `POST /api/help-requests/:id/claim` | `claimRequest` | `help_requests` | helpRequests: «dos supervisores nunca toman la misma solicitud» |
| RF-21 | `POST /api/help-requests/:id/resolve` | `resolveRequest` | `help_requests` | helpRequests: «recorre pendiente, en atención y resuelta» |
| RF-22 | `help:claimed`, `help:resolved` | gateway, sala `user:{id}` | — | gateway: «un agente no recibe eventos de otro equipo» |
| RF-24 | `GET /api/presence`, `presence:changed` | gateway, `worker/sweepPresence` | `presence:team:{id}` (Redis) | gateway: presencia; worker: «expira la presencia» |
| RF-02, RF-23, RF-25 | — | `apps/web` | — | Verificación manual (ver [14-plan-y-reporte-de-pruebas-iso25010.md](14-plan-y-reporte-de-pruebas-iso25010.md)) |
