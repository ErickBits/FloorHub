# Políticas de Seguridad, Resiliencia y Calidad de Software

## 1. Evaluación de calidad bajo la norma ISO/IEC 25010

| Característica | Subcaracterística evaluada | Cómo la cumple FloorHub | Evidencia |
|---|---|---|---|
| Adecuación funcional | Corrección | Toma atómica de solicitudes, porcentaje de confirmación exacto, prioridad fijada por el servidor | 42 pruebas automáticas aprobadas |
| Eficiencia de desempeño | Comportamiento temporal | Eventos por WebSocket; caché de bandeja (120 s), equipos (300 s) y alcance (60 s) | Pruebas de caché e invalidación |
| Eficiencia de desempeño | Utilización de recursos | 11 pods en el peor caso caben en un nodo `t3.medium`; pools de PostgreSQL limitados a 50 conexiones | Dimensionamiento en el diseño técnico |
| Compatibilidad | Coexistencia | Puertos locales solo en `127.0.0.1`, base de pruebas y Redis exclusivos | `docker-compose.yml`, `test/env.js` |
| Usabilidad | Operabilidad y accesibilidad | Una página por función, buscadores sin tildes, ARIA, estados con texto | Revisión manual |
| Fiabilidad | Disponibilidad y tolerancia a fallos | 2 réplicas mínimas de api y gateway; reconciliador de recordatorios | Prueba «reconstruye desde PostgreSQL los recordatorios perdidos» |
| Seguridad | Confidencialidad, integridad, no repudio, autenticidad | JWT, bcrypt, RBAC, auditoría de solo inserción, mínimo privilegio | Pruebas de autorización y de auditoría |
| Mantenibilidad | Modularidad y capacidad de prueba | Monorepo con paquete compartido, validación centralizada con zod, CI | Workflow `ci.yml` |
| Portabilidad | Instalabilidad y adaptabilidad | La misma imagen corre en Docker Compose, minikube y EKS | `deploy/` |

## 2. Política de gestión de identidad y acceso (IAM)

### 2.1. Control de acceso basado en roles (RBAC)

- Tres roles cerrados: `agent`, `supervisor` y `admin` (tipo `user_role` en PostgreSQL).
- **No hay registro abierto:** solo el administrador crea cuentas.
- El rol y el alcance (equipos y campañas) se resuelven **en el servidor** en cada petición a partir del `sub` del token. El cliente nunca envía su rol.
- `requireRole(...)` protege cada ruta. Un recurso fuera del alcance responde **404** en lugar de 403, para no revelar que existe.
- En WebSocket, cada socket entra solo a las salas que su JWT le permite (`user:{id}`, `team:{id}`, `team:{id}:supervisors`). Un agente no puede escuchar eventos de otro equipo.
- Cuando el administrador cambia el rol, el equipo o el estado de un usuario, o los supervisores de un equipo, se invalida la caché de alcance y se **cierra el socket** del usuario para que reconecte con las salas correctas.

### 2.2. Ciclo de vida del token

| Aspecto | Política |
|---|---|
| Formato | JWT firmado con HS256; solo contiene `sub` (id del usuario), `iat` y `exp` |
| Vigencia | 8 horas (`JWT_EXPIRES_IN`), la duración de un turno |
| Secreto | `JWT_SECRET` de al menos 32 caracteres; la configuración se rechaza si es más corto. En AWS lo genera Terraform |
| Almacenamiento | `sessionStorage`, una sesión por ventana |
| Revocación | No hay lista negra: un usuario desactivado falla en `authenticateToken` porque su estado se consulta en cada petición |
| Algoritmo | Se fija `algorithms: ['HS256']` al verificar, para impedir el ataque de algoritmo `none` |

### 2.3. Hashing de contraseñas

- **bcrypt** con 10 rondas (`BCRYPT_ROUNDS`, configurable entre 4 y 15).
- Longitud entre 8 y 72 caracteres: bcrypt solo usa los primeros 72 bytes.
- **Tiempo constante ante usuarios inexistentes:** si el correo no existe, se compara contra un hash falso, para que el tiempo de respuesta no revele qué correos están registrados.
- Mismo mensaje para todo fallo: «Correo o contraseña incorrectos».

## 3. Protección de datos personales (Ley 1581 de 2012 — Habeas Data, Colombia)

| Principio de la ley | Aplicación en FloorHub |
|---|---|
| Finalidad | Los datos se usan solo para coordinar la operación: comunicar cambios y atender solicitudes de ayuda |
| Libertad | Los datos los registra el BPO como empleador; el uso debe estar autorizado en la política de tratamiento de la empresa |
| Veracidad | El administrador puede corregir nombre, rol y equipo en cualquier momento |
| Transparencia | Cada usuario ve su propia información en la interfaz |
| Acceso y circulación restringida | RBAC: un agente no ve datos de otros agentes; un supervisor solo ve a sus equipos |
| Seguridad | Contraseñas con hash, TLS hacia la base en AWS, base en subredes privadas |
| Confidencialidad | No se registran contraseñas ni tokens en los logs |

**Datos personales que se tratan:** nombre completo, correo corporativo, rol, equipo, confirmaciones de lectura con fecha y hora, solicitudes de ayuda y su estado de conexión. **No se tratan datos sensibles** ni datos financieros; por eso PCI-DSS no aplica.

> La demo pública usa HTTP porque un certificado necesita un dominio propio. Por eso **solo debe usarse con datos ficticios**, como los del seed.

## 4. Política de resiliencia y recuperación

### 4.1. Comportamiento ante fallos

| Fallo | Efecto | Recuperación |
|---|---|---|
| Cae una réplica de api o gateway | El Service envía el tráfico a la otra réplica | Kubernetes recrea el pod |
| Cae Redis | Sin tiempo real ni caché por unos segundos; la API responde desde PostgreSQL (`degraded`); el rate limiting deja pasar | Los clientes reconectan y recargan por REST; el reconciliador reencola recordatorios en ≤ 60 s; la presencia vuelve en el siguiente heartbeat (15 s) |
| Cae PostgreSQL | `/health` responde 503 y el pod sale del tráfico | `/livez` no revisa la base, así que el pod no se reinicia en bucle |
| Un gateway muere sin avisar | Sus agentes aparecerían conectados | `sweep-presence` los expira tras 45 s sin heartbeat |
| Se pierde la conexión del navegador | Indicador de desconexión | Socket.IO reconecta y la vista recarga su estado |

### 4.2. Métricas de continuidad

| Métrica | Entorno de demo (AWS) | Recomendación para producción |
|---|---|---|
| RPO (pérdida de datos aceptable) | No hay copias: el stack es efímero y se destruye el mismo día | 5 min con copias automáticas y PITR de RDS |
| RTO (tiempo de recuperación) | 15 a 25 min con `make deploy` | < 15 min con RDS Multi-AZ |
| Copias de seguridad | `backup_retention = 0` para desplegar más rápido | Retención de 7 días |

## 5. Mitigación de vulnerabilidades: OWASP API Security Top 10 (2023)

| Riesgo | Mitigación en FloorHub |
|---|---|
| API1 Autorización a nivel de objeto (BOLA) | Cada consulta filtra por `team_id = ANY(equipos del usuario)` o por `agent_id`; un objeto ajeno responde 404 |
| API2 Autenticación rota | bcrypt, JWT con algoritmo fijo, límite de 10 intentos por minuto, mensaje genérico |
| API3 Autorización a nivel de propiedad | Respuestas con columnas explícitas: `password_hash` nunca se devuelve. zod rechaza campos como `priority` enviados por el agente |
| API4 Consumo de recursos sin límite | Cuerpo máximo de 64 kB, listas de destinos de máx. 500, listados con `LIMIT`, rate limiting en login y ayuda |
| API5 Autorización a nivel de función | `requireRole` en cada ruta; `/api/admin/*` solo para `admin` |
| API6 Acceso sin restricción a flujos sensibles | Una sola solicitud activa por agente (índice único) y límite de 10 por minuto |
| API7 SSRF | La API no hace peticiones a URLs que envíe el usuario |
| API8 Configuración insegura | Contenedores sin root y con disco de solo lectura, cabeceras de seguridad, `x-powered-by` desactivado, errores sin detalles internos |
| API9 Inventario inadecuado | Contrato documentado en `api/openapi_floorhub.yaml`; una sola versión desplegada |
| API10 Consumo inseguro de APIs | No consume APIs de terceros |

**Inyección SQL:** todas las consultas usan parámetros (`$1, $2…`). En el único `UPDATE` dinámico (`buildUpdate`), los nombres de columna salen del código, nunca de la petición. La prueba «una inyección SQL se trata como texto» lo verifica.

## 6. Seguridad de la infraestructura

| Control | Implementación |
|---|---|
| Secretos fuera del repositorio | Terraform genera las contraseñas; el estado se guarda cifrado en S3 privado |
| Credenciales de CI temporales | GitHub Actions usa OIDC; el rol se limita al repositorio y al Environment `demo` con revisores obligatorios |
| Contenedores | Usuario sin root, `readOnlyRootFilesystem`, sin escalamiento de privilegios |
| Base de datos | Subredes privadas, TLS con CA verificada (`DB_SSL_CA_FILE`) |
| Costos | AWS Budgets con alertas al 25, 50 y 80 % de 30 USD, `include_credit = false` y `make cost-check` |

## 7. Observabilidad

- **Logs JSON estructurados** con pino, con nivel configurable (`LOG_LEVEL`). Los errores no controlados se registran con ruta y método.
- **Sondas de salud** en cada servicio:

| Endpoint | Revisa | Uso en Kubernetes |
|---|---|---|
| `/livez` | Solo que el proceso responda | `livenessProbe`: reinicia el pod si se cuelga |
| `/health` | PostgreSQL (y Redis en el gateway) | `readinessProbe`: saca el pod del tráfico si sus dependencias fallan |

- **Resumen diario** a las 23:00: comunicados, confirmaciones, solicitudes y espera promedio de las últimas 24 h, escrito en los logs.
- En AWS los logs se consultan con `make aws-logs` (`kubectl logs`); los logs del plano de control de EKS están desactivados para no pagar ingesta de CloudWatch.
