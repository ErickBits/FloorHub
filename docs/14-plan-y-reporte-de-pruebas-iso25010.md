# Plan Maestro y Reporte de Pruebas de Software (ISO/IEC 25010) — FloorHub

## 1. Estrategia de aseguramiento de calidad y alcance

**Objetivo.** Demostrar que FloorHub cumple sus 25 requisitos funcionales y los no funcionales verificables, con énfasis en lo que no se puede comprobar a simple vista: concurrencia, auditoría, autorización y recuperación ante fallos.

**Principio de la estrategia: probar contra servicios reales.** Las pruebas automáticas usan PostgreSQL 17 y Redis 8 reales en Docker, no simulaciones. Un mock no habría detectado un error de bloqueo de filas, un trigger mal escrito ni un evento que no cruza entre réplicas.

### 1.1. Características de calidad evaluadas (ISO/IEC 25010)

| Característica | Subcaracterística | Cómo se evalúa |
|---|---|---|
| Adecuación funcional | Completitud y corrección | Pruebas de integración de la API y casos manuales de la interfaz |
| Seguridad | Confidencialidad, integridad, no repudio, autenticidad | Pruebas de autorización, rate limiting, inyección SQL y auditoría |
| Fiabilidad | Tolerancia a fallos y recuperabilidad | Pruebas de Redis caído, reconciliador y presencia expirada |
| Eficiencia de desempeño | Comportamiento temporal | Tiempo de la suite y prueba de 10 peticiones simultáneas |
| Usabilidad | Operabilidad y accesibilidad | Casos manuales con teclado y en pantalla pequeña |
| Compatibilidad | Interoperabilidad | Casos manuales en varios navegadores |
| Mantenibilidad | Capacidad de prueba | CI en cada Pull Request: lint, pruebas y build |
| Portabilidad | Instalabilidad | `make up` en limpio, minikube y EKS |

### 1.2. Niveles y arquitectura de las suites

| Nivel | Herramienta | Alcance | Ejecución |
|---|---|---|---|
| Integración de la API | Vitest + supertest | Rutas, servicios y base de datos reales | `npm test` y CI |
| Integración de tiempo real | Vitest + socket.io-client | Dos réplicas reales del gateway con Redis | `npm test` y CI |
| Integración del worker | Vitest | Trabajos de BullMQ contra PostgreSQL y Redis | `npm test` y CI |
| Análisis estático | ESLint 9 | Todo el monorepo, incluido React | `npm run lint` y CI |
| Infraestructura | `terraform validate`, `kustomize build` | Stacks de Terraform y overlays de Kubernetes | CI |
| Sistema (manual) | Navegador | Interfaz por rol y flujos completos | Antes de la sustentación |

**Aislamiento:** las pruebas crean y destruyen su propia base `floorhub_test` (`test/globalSetup.js`) y usan el índice 1 de Redis.

## 2. Suite 1: autenticación y autorización

8 casos en `apps/api/test/auth.test.js`: inicio de sesión sin exponer el hash, mensaje idéntico ante cualquier credencial errada, límite de intentos, token obligatorio, rutas de administración bloqueadas, desactivación inmediata, coherencia de rol y equipo, y `/health`. **Resultado: 8/8 aprobados.**

## 3. Suite 2: cola de ayuda y concurrencia

11 casos en `apps/api/test/helpRequests.test.js`. El más importante lanza **10 peticiones simultáneas** para tomar la misma solicitud: exactamente 1 recibe 200 y 9 reciben 409, y la base queda con un único responsable. También cubre la prioridad fijada por el servidor, la solicitud única por agente, el aislamiento entre equipos, el rate limiting, la inyección SQL y la conversación entre agente y supervisor. **Resultado: 11/11 aprobados.**

## 4. Suite 3: comunicados y registro de auditoría

11 casos en `apps/api/test/announcements.test.js`: porcentaje de confirmación, alcance por campaña, confirmación idempotente, publicación fuera del alcance, comunicados ajenos, intervalo obligatorio, invalidación de caché, funcionamiento sin Redis y las tres capas de auditoría (permisos, triggers incluso para el dueño y contenido inmutable). **Resultado: 11/11 aprobados.**

## 4.1. Suite 3.1: administración, directorio y presencia

7 casos en `apps/api/test/admin.test.js`: alta, listado y edición de campañas, equipos y usuarios; rechazo de ediciones vacías o de registros inexistentes; reasignación de supervisores con actualización inmediata del alcance; respuestas sin el hash de la contraseña; y un directorio y una presencia limitados al alcance del supervisor. **Resultado: 7/7 aprobados.**

## 5. Suites 4 y 5: tiempo real y worker

- **Gateway** (`apps/gateway/test/gateway.test.js`), 6 casos: rechazo sin token, entrega entre réplicas, aislamiento entre equipos, presencia y varias pestañas. **6/6 aprobados.**
- **Worker** (`apps/worker/test/jobs.test.js`), 7 casos: recordatorios solo a pendientes, idempotencia, máximo de rondas, parada al confirmar todos, reconstrucción tras reiniciar Redis, expiración de presencia y resumen diario. **7/7 aprobados.**

El detalle caso por caso (ID, resultado esperado y estado) está en [07-reglas-de-negocio-y-pruebas.md](07-reglas-de-negocio-y-pruebas.md).

## 6. Reporte de ejecución automatizada

| Dato | Valor |
|---|---|
| Fecha | 13/11/2026 |
| Comando | `npx vitest run --reporter=verbose` |
| Entorno | PostgreSQL 17-alpine y Redis 8-alpine en Docker, Node.js 26 |
| Archivos | 6 de 6 aprobados |
| Casos | **50 de 50 aprobados (100 %)** |
| Duración | 5,07 s |
| Lint | `npx eslint .` sin errores ni advertencias |

| Característica ISO 25010 | Casos automáticos | Aprobados |
|---|---:|---:|
| Seguridad | 20 | 20 |
| Adecuación funcional | 19 | 19 |
| Fiabilidad | 7 | 7 |
| Eficiencia de desempeño | 2 | 2 |
| Mantenibilidad (observabilidad) | 2 | 2 |
| **Total** | **50** | **50** |

<details>
<summary>Clasificación de cada caso por característica</summary>

| Característica | Casos |
|---|---|
| Seguridad (20) | PA-01 a PA-07, PH-05, PH-06, PH-09, PH-10, PC-04, PC-05, PC-09, PC-10, PC-11, PG-01, PD-04, PD-05, PD-06 |
| Adecuación funcional (19) | PH-01, PH-02, PH-03, PH-04, PH-07, PH-08, PH-11, PC-01, PC-02, PC-03, PC-06, PW-01, PW-03, PW-04, PW-07, PD-01, PD-02, PD-03, PD-07 |
| Fiabilidad (7) | PC-08, PG-04, PG-05, PW-02, PW-05, PW-06, PG-03 |
| Eficiencia de desempeño (2) | PC-07, PG-02 |
| Mantenibilidad (2) | PA-08, PG-06 |

</details>

## 7. Plan de pruebas manuales del sistema

Cubren lo que las pruebas automáticas no alcanzan: la interfaz, la usabilidad y la compatibilidad. **Estado: por ejecutar** antes de la sustentación; registra el resultado en la última columna.

| ID | Requisito | Caso | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|---|
| PM-01 | RF-02 | Cerrar sesión | Entrar y pulsar **Salir** | Vuelve al inicio de sesión; al recargar no hay sesión | ☐ |
| PM-02 | RF-03 | Sesión por ventana | Abrir dos ventanas con Laura y Santiago | Cada una conserva su usuario | ☐ |
| PM-03 | RF-13 | Entrega en vivo | Laura publica a «Retención» con Santiago conectado | Llega sin recargar y aparece un aviso | ☐ |
| PM-04 | RF-15 | Porcentaje en vivo | Santiago confirma con el detalle abierto en Laura | El porcentaje sube sin recargar | ☐ |
| PM-05 | RF-16 | Recordatorio | Crítico con intervalo de 1 min; Daniela no confirma | Daniela recibe el recordatorio a los ~60 s | ☐ |
| PM-06 | RF-22 | Seguimiento del agente | Laura toma la solicitud de Daniela | Daniela ve «En atención» y el nombre de Laura | ☐ |
| PM-07 | RF-23 | Historial | Resolver una solicitud | Aparece en «Resueltas recientemente» y en «Resueltas (24 h)» | ☐ |
| PM-08 | RF-24 | Presencia | Cerrar la ventana de Santiago | Laura lo ve desconectado | ☐ |
| PM-09 | RF-07, RF-25 | Buscadores | Buscar «munoz» en usuarios | Encuentra a Valentina Muñoz | ☐ |
| PM-10 | RNF-12 | Reinicio de Redis | Publicar un crítico y ejecutar `docker compose restart redis` | El recordatorio llega igual | ☐ |
| PM-11 | RNF-16 | Teclado | Publicar un comunicado usando solo el teclado | Se completa con ↑ ↓, Enter y Tab | ☐ |
| PM-12 | RNF-17 | Pantalla pequeña | Abrir en 375 px de ancho | El menú pasa a horizontal y todo se puede usar | ☐ |
| PM-13 | RNF-17 | Navegadores | Repetir PM-03 en Chrome, Firefox y Edge | Mismo comportamiento | ☐ |
| PM-14 | RNF-18 | Instalación limpia | `make reset && make up` | Todo `healthy` y login correcto | ☐ |
| PM-15 | RNF-11 | Caída de una réplica | En minikube, borrar un pod del gateway | Los clientes reconectan solos | ☐ |

## 8. Matriz de trazabilidad: requisitos y pruebas

| Requisito | Pruebas automáticas | Pruebas manuales |
|---|---|---|
| RF-01 | PA-01, PA-02 | — |
| RF-02 | — | PM-01 |
| RF-03 | — | PM-02 |
| RF-04, RF-05 | PA-06, PA-07 | — |
| RF-06 | PA-06 | — |
| RF-07 | — | PM-09 |
| RF-08 a RF-10 | PA-05 | — |
| RF-11, RF-12 | PC-02, PC-04, PC-06 | — |
| RF-13 | PG-02, PG-03, PC-07 | PM-03 |
| RF-14 | PC-03, PC-05, PC-09, PC-10 | — |
| RF-15 | PC-01 | PM-04 |
| RF-16 | PW-01 a PW-05 | PM-05 |
| RF-17, RF-18 | PH-04, PH-05, PH-08 | — |
| RF-19 | PH-03, PH-06 | — |
| RF-20 | PH-01, PH-06 | — |
| RF-21 | PH-02, PH-07 | — |
| RF-22 | — | PM-06 |
| RF-23 | — | PM-07 |
| RF-24 | PG-04, PG-05, PW-06 | PM-08 |
| RF-25 | — | PM-09 |

**Brechas conocidas:** las rutas de campañas y equipos no tienen pruebas propias (solo la de bloqueo por rol, PA-05), y RF-02, RF-03, RF-07, RF-22, RF-23 y RF-25 dependen de la verificación manual.
