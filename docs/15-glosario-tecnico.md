# Glosario Técnico, Catálogo del Dominio y Fórmulas — FloorHub

## 1. Glosario del piso de operaciones (BPO)

| Término | Definición |
|---|---|
| BPO | *Business Process Outsourcing*: empresa que atiende procesos de otras, como el servicio al cliente. |
| Piso de operaciones | Área donde trabajan los agentes atendiendo llamadas o chats. |
| Campaña | Conjunto de equipos que atienden a un mismo cliente del BPO (por ejemplo, *Banco del Valle*). |
| Equipo | Grupo de agentes con uno o varios supervisores. |
| Agente | Persona que atiende a los clientes finales. |
| Supervisor | Líder que coordina, comunica cambios y apoya a uno o varios equipos. |
| Comunicado | Aviso que el supervisor envía a sus agentes. |
| Comunicado crítico | Aviso que exige confirmación y genera recordatorios hasta que se confirme. |
| Confirmación | Registro de que un agente leyó un comunicado («Leí y entendí»). |
| Levantar la mano | Pedir ayuda al supervisor desde FloorHub. |
| Cola de ayuda | Lista de solicitudes pendientes y en atención de los equipos de un supervisor. |
| Tomar una solicitud | Asumir la responsabilidad de atenderla. |
| Presencia | Indicador de si un agente está conectado en este momento. |
| Tiempo de espera | Desde que se crea la solicitud hasta que un supervisor la toma. |
| Tiempo de atención | Desde que se toma la solicitud hasta que se resuelve. |

## 2. Glosario técnico

| Término | Definición |
|---|---|
| API REST | Interfaz HTTP con recursos y verbos (`GET`, `POST`, `PATCH`, `PUT`). |
| SPA | *Single Page Application*: la página se carga una vez y cambia de vista sin recargar. |
| WebSocket | Conexión permanente que permite al servidor enviar cambios al instante. |
| Socket.IO | Librería sobre WebSocket con salas, reconexión y adaptadores. |
| Sala (*room*) | Grupo de conexiones que reciben los mismos eventos (`user:{id}`, `team:{id}`, `team:{id}:supervisors`). |
| Pub/Sub | Patrón de publicación y suscripción; Redis lo usa para repartir eventos entre réplicas. |
| JWT | *JSON Web Token*: token firmado que identifica la sesión. |
| bcrypt | Algoritmo lento a propósito para guardar contraseñas. |
| RBAC | Control de acceso basado en roles. |
| BullMQ | Librería de colas de trabajos sobre Redis, con reintentos y trabajos con retraso. |
| Trabajo idempotente | Trabajo que, si se ejecuta dos veces, produce el mismo resultado que una sola vez. |
| Reconciliador | Proceso que compara el estado deseado (PostgreSQL) con el real (Redis) y corrige la diferencia. |
| Heartbeat | Señal periódica (cada 15 s) que indica que el cliente sigue conectado. |
| Rate limiting | Límite de peticiones por unidad de tiempo. |
| Transacción | Grupo de operaciones que se aplican todas o ninguna (`BEGIN` … `COMMIT`). |
| Bloqueo de fila | PostgreSQL impide que dos transacciones modifiquen la misma fila a la vez. |
| Trigger | Función que la base ejecuta automáticamente ante un evento (por ejemplo, `BEFORE UPDATE`). |
| Índice único parcial | Índice que exige unicidad solo en las filas que cumplen una condición. |
| Mínimo privilegio | Dar a cada componente solo los permisos que necesita. |
| Contenedor | Paquete con la aplicación y sus dependencias que corre igual en cualquier máquina. |
| Kubernetes | Orquestador que despliega, escala y recupera contenedores. |
| Pod | Unidad mínima de Kubernetes; aquí, un contenedor de un servicio. |
| HPA | *Horizontal Pod Autoscaler*: agrega o quita réplicas según el uso de CPU. |
| Liveness / Readiness | Sondas que indican si un pod debe reiniciarse o si puede recibir tráfico. |
| EKS / RDS / NLB | Servicios de AWS: Kubernetes administrado, base de datos administrada y balanceador de red. |
| Terraform | Herramienta de infraestructura como código. |
| OIDC | Protocolo con el que GitHub Actions obtiene credenciales temporales de AWS sin guardar claves. |
| CSP | *Content-Security-Policy*: cabecera que limita qué scripts y recursos puede cargar la página. |

## 3. Catálogo del dominio

### 3.1. Roles

| Valor en la base | Etiqueta | Página inicial |
|---|---|---|
| `agent` | Agente | Comunicados |
| `supervisor` | Supervisor | Cola de ayuda |
| `admin` | Administrador | Listado de usuarios |

### 3.2. Prioridad de comunicados

| Valor | Etiqueta | Intervalo de recordatorio | Rondas máximas |
|---|---|---|---|
| `info` | Informativo | No aplica | 0 |
| `critical` | Crítico | 1 a 240 minutos (obligatorio) | 5 (`REMINDER_MAX_ROUNDS`) |

### 3.3. Tipos de solicitud de ayuda

| Valor | Etiqueta | Prioridad | Cuándo usarlo |
|---|---|---:|---|
| `difficult_customer` | Cliente difícil | 3 | El cliente está alterado o exige un superior |
| `approval` | Aprobación | 2 | Se necesita autorización para una excepción |
| `process_question` | Duda de proceso | 1 | No se sabe cómo aplicar un procedimiento |

### 3.4. Estados de una solicitud

| Valor | Etiqueta | Siguiente estado posible |
|---|---|---|
| `pending` | Pendiente | `in_progress` |
| `in_progress` | En atención | `resolved` |
| `resolved` | Resuelta | — |

### 3.5. Límites del sistema

| Elemento | Límite |
|---|---|
| Título de un comunicado | 1 a 200 caracteres |
| Cuerpo de un comunicado | 1 a 5 000 caracteres |
| Destinos por tipo en un comunicado | Hasta 500 |
| Resumen de una solicitud | 1 a 500 caracteres |
| Nombres de usuario, campaña y equipo | 1 a 120 caracteres |
| Contraseña | 8 a 72 caracteres |
| Cuerpo de una petición | 64 kB |
| Supervisores por equipo (por petición) | Hasta 50 |
| Inicios de sesión | 10 por minuto por IP y correo |
| Solicitudes de ayuda | 10 por minuto por agente |
| Bandeja del agente | 100 comunicados más recientes |
| Comunicados publicados (supervisor) | 50 más recientes |
| Cola del supervisor | 200 solicitudes |

## 4. Fórmulas

### 4.1. Porcentaje de confirmación

```text
porcentaje = redondear( confirmados / destinatarios × 100 )      (0 si no hay destinatarios)
```

### 4.2. Tiempos de una solicitud

```text
espera   = (claimed_at, o la hora actual si sigue pendiente) − created_at
atención = resolved_at − claimed_at
```

### 4.3. Próximo recordatorio

```text
next_reminder_at = ahora + reminder_interval_minutes
se detiene cuando: reminders_sent = 5  o  todos confirmaron  o  el comunicado venció
```

Con un intervalo de 10 minutos, un agente que nunca confirma recibe avisos a los 10, 20, 30, 40 y 50 minutos.

### 4.4. Presencia

```text
conectado  ⇔  último heartbeat ≥ ahora − 45 s
```

El cliente envía un heartbeat cada 15 s, así que se toleran dos heartbeats perdidos antes de marcar al agente como desconectado.

### 4.5. Orden de la cola

```text
ORDER BY estado (pendiente, en atención, resuelta), prioridad DESC, created_at ASC
```

## 5. Normatividad y estándares de referencia

| Norma o estándar | Aplicación en FloorHub |
|---|---|
| IEEE 830 | Estructura de la especificación de requisitos ([01](01-especificacion-requerimientos-ieee830.md)) |
| ISO/IEC 25010 | Modelo de calidad para los RNF y el plan de pruebas ([14](14-plan-y-reporte-de-pruebas-iso25010.md)) |
| Ley 1581 de 2012 (Colombia) | Protección de datos personales de los usuarios ([05](05-politicas-seguridad-resiliencia-y-calidad.md)) |
| OWASP API Security Top 10 (2023) | Matriz de mitigación de vulnerabilidades ([05](05-politicas-seguridad-resiliencia-y-calidad.md)) |
| OpenAPI 3.0 | Contrato de la API ([api/openapi_floorhub.yaml](api/openapi_floorhub.yaml)) |
| Modelo C4 | Diagramas de arquitectura ([02](02-arquitectura-software-c4-y-backend.md)) |
