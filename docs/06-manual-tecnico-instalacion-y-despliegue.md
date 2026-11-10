# Manual Técnico de Instalación, Configuración y Despliegue

## 1. Requisitos de infraestructura

### 1.1. Requisitos de hardware (entorno local)

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 núcleos | 4 núcleos |
| Memoria RAM | 4 GB libres para Docker | 8 GB |
| Disco | 5 GB (imágenes y volumen de PostgreSQL) | 10 GB |
| Red | Necesaria para descargar imágenes y dependencias la primera vez | — |

### 1.2. Requisitos de software

| Software | Versión | Para qué |
|---|---|---|
| Docker Engine y Docker Compose v2 | Actual | Levantar todo el sistema en local |
| GNU Make | Cualquiera | Atajos de comandos (`make help`) |
| Node.js | 24 o superior (el proyecto usa 26) | Pruebas, lint y desarrollo sin contenedores |
| Git | Cualquiera | Clonar el repositorio |
| minikube y kubectl | Actual | *(Opcional)* Probar Kubernetes en local |
| Terraform, AWS CLI y kubectl | Terraform ≥ 1.10 | *(Opcional)* Desplegar en AWS |
| Navegador | Chrome, Firefox, Edge o Safari actuales | Usar la aplicación |

## 2. Topología de contenedores en Docker Compose

| Servicio | Imagen | Puerto publicado | Depende de | Healthcheck |
|---|---|---|---|---|
| `postgres` | `postgres:17-alpine` | `127.0.0.1:5433` → 5432 | — | `pg_isready` |
| `redis` | `redis:8-alpine` | `127.0.0.1:6380` → 6379 | — | `redis-cli ping` |
| `migrate` | `floorhub/migrate:local` | — | `postgres` sano | Termina con código 0 |
| `api` | `floorhub/api:local` | — | `migrate` completado, `redis` sano | `GET /health` |
| `gateway` | `floorhub/gateway:local` | — | `migrate` completado, `redis` sano | `GET /health` |
| `worker` | `floorhub/worker:local` | — | `migrate` completado, `redis` sano | `GET /health` |
| `nginx` | `floorhub/nginx:local` | `127.0.0.1:8080` → 8080 | `api` y `gateway` sanos | `GET /health` |

### 2.1. Política de aislamiento de red

- Todos los servicios comparten la red interna de Compose y se llaman por nombre (`postgres`, `redis`, `api`…).
- **Solo Nginx se publica para el navegador.** PostgreSQL y Redis se publican únicamente en `127.0.0.1` (para pruebas y depuración) y en puertos distintos a los estándar para no chocar con servicios instalados en el equipo.
- Redis corre con `--maxmemory 128mb --maxmemory-policy noeviction` y sin persistencia: se reconstruye desde PostgreSQL.
- Nginx resuelve sus upstreams al arrancar; `restart: true` lo reinicia si Compose recrea la API o el gateway.

## 3. Variables de entorno

Copia `.env.example` a `.env` solo si vas a ejecutar procesos fuera de Docker. Docker Compose ya trae valores de desarrollo.

### 3.1. Variables de la aplicación (`packages/shared/src/config.js`)

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `DATABASE_URL` | Sí | — | Conexión con el rol de la aplicación `floorhub_app` |
| `REDIS_URL` | Sí | — | Conexión a Redis |
| `JWT_SECRET` | Sí | — | Mínimo 32 caracteres. Genera uno con `openssl rand -base64 48` |
| `NODE_ENV` | No | `development` | Entorno |
| `LOG_LEVEL` | No | `info` | Nivel de log de pino |
| `PORT` | No | `3000` | Puerto HTTP del proceso |
| `DB_POOL_MAX` | No | `10` | Conexiones máximas del pool |
| `DB_SSL_CA_FILE` | No | — | CA para verificar TLS hacia RDS |
| `JWT_EXPIRES_IN` | No | `8h` | Vigencia del token |
| `BCRYPT_ROUNDS` | No | `10` | Rondas de bcrypt (4 a 15) |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | No | `10` | Intentos de login por IP y correo |
| `HELP_RATE_LIMIT_PER_MINUTE` | No | `10` | Solicitudes de ayuda por agente |
| `REMINDER_MAX_ROUNDS` | No | `5` | Rondas máximas de recordatorios |

Si falta una variable obligatoria o tiene un valor inválido, el proceso **no arranca** y muestra `Configuración inválida: …`.

### 3.2. Variables de migración y seed

| Variable | Descripción |
|---|---|
| `MIGRATION_DATABASE_URL` | Conexión con el rol dueño `floorhub_owner` |
| `SEED_PASSWORD` | Contraseña de los usuarios de demostración (`Demo-FloorHub-2026` en local) |

### 3.3. Archivo `.env` de ejemplo

```dotenv
POSTGRES_USER=floorhub_owner
POSTGRES_PASSWORD=floorhub_owner_dev
POSTGRES_DB=floorhub
MIGRATION_DATABASE_URL=postgres://floorhub_owner:floorhub_owner_dev@127.0.0.1:5433/floorhub
DATABASE_URL=postgres://floorhub_app:floorhub_app_dev@127.0.0.1:5433/floorhub
REDIS_URL=redis://127.0.0.1:6380/0
JWT_SECRET=cambia-este-secreto-de-ejemplo-por-uno-aleatorio
SEED_PASSWORD=Demo-FloorHub-2026
LOG_LEVEL=info
```

> Estos valores son solo para desarrollo. En AWS, Terraform genera las contraseñas y el secreto y los entrega como Secrets de Kubernetes.

## 4. Despliegue local con Docker Compose (recomendado)

### Paso 1: clonar el repositorio

```bash
git clone <url-del-repositorio> FloorHub
cd FloorHub
```

### Paso 2: construir e iniciar

```bash
make up
```

Construye las imágenes, aplica las migraciones, carga los datos de demostración y levanta todos los servicios.

### Paso 3: validar el estado

```bash
docker compose ps
```

Todos los servicios deben aparecer como `healthy`, salvo `migrate`, que debe haber terminado (`Exited (0)`).

### Paso 4: abrir la aplicación

Entra a <http://localhost:8080> con cualquier usuario de demostración, por ejemplo `laura.gomez@floorhub.com` / `Demo-FloorHub-2026`.

### Paso 5: revisar los logs

```bash
make logs                       # todos los servicios
docker compose logs -f api      # uno solo
```

### Comandos de operación local

| Comando | Qué hace |
|---|---|
| `make up` | Levanta todo |
| `make down` | Detiene y conserva los datos |
| `make reset` | Detiene y **borra** los datos (vuelve al seed inicial) |
| `make migrate` / `make seed` | Aplica migraciones o recarga el seed |
| `make test` | Corre las 42 pruebas contra PostgreSQL y Redis reales |
| `make lint` | Revisa el estilo con ESLint |

## 5. Desarrollo sin contenedores para el frontend

Para editar la interfaz con recarga en caliente:

```bash
make up                         # backend en Docker
npm install                     # una sola vez
npm run dev -w apps/web         # Vite en http://localhost:5173
```

Vite reenvía `/api` y `/ws` a Nginx en `localhost:8080`, así que el backend sigue en Docker.

### 5.1. Ejecutar las pruebas

```bash
docker compose up -d --wait postgres redis
npm test
```

Las pruebas crean su propia base `floorhub_test` y usan el índice 1 de Redis, así que no tocan los datos de desarrollo. Para apuntar a otros servidores existen `TEST_PG_HOST`, `TEST_PG_OWNER` y `TEST_REDIS_URL`.

## 6. Kubernetes local con minikube

```bash
make k8s-up      # crea el perfil "floorhub" de minikube, construye las imágenes y aplica el overlay dev
make k8s-url     # abre un túnel en http://localhost:8081
make k8s-logs
make k8s-down    # borra el clúster
```

Estructura de Kustomize:

| Carpeta | Contenido |
|---|---|
| `deploy/k8s/base` | Namespace, ConfigMap, Deployments de nginx, api, gateway, worker y redis, Job `migrate` y HPA |
| `deploy/k8s/overlays/dev` | PostgreSQL dentro del clúster para minikube |
| `deploy/k8s/overlays/prod` | Imágenes de GHCR y conexión a RDS |

Para probar la recuperación: `kubectl --context floorhub -n floorhub delete pod -l app=gateway`. Kubernetes lo recrea y los clientes reconectan solos.

## 7. Despliegue en AWS

> ⚠️ `make deploy` **crea recursos que cobran** (unos 0,26 USD por hora). Destruye el mismo día.

### 7.1. Preparación (una sola vez)

1. Sube el repositorio a GitHub como público y espera a que termine el workflow **Images**.
2. Confirma que los paquetes `floorhub-*` en GHCR sean públicos.
3. Crea el stack permanente:

   ```bash
   cp deploy/terraform/bootstrap/terraform.tfvars.example deploy/terraform/bootstrap/terraform.tfvars
   # Edita tu correo y tu repositorio
   make bootstrap
   ```

4. Confirma el correo de suscripción de AWS Budgets.
5. Para desplegar desde GitHub Actions: crea el Environment `demo` con revisores obligatorios y la variable `AWS_ROLE_ARN` con la salida `github_role_arn`.

### 7.2. Desplegar

```bash
aws sts get-caller-identity          # ¿es la cuenta correcta?
make cost-check                      # debe estar limpio
IMAGE_OWNER=tu-usuario IMAGE_TAG=$(git rev-parse HEAD) make deploy
make demo-password                   # contraseña de los usuarios de la demo
```

Crear todo tarda entre 15 y 25 minutos. La alternativa es el workflow **Deploy to AWS**, que pide aprobación manual.

### 7.3. Verificar

- [ ] La URL del NLB abre y permite iniciar sesión.
- [ ] Un comunicado llega a dos ventanas al instante.
- [ ] Dos supervisores no pueden tomar la misma solicitud.
- [ ] `kubectl -n floorhub get pods,hpa` muestra todo en `Running`.
- [ ] `make cost-check` muestra 1 clúster, 2 instancias, 2 volúmenes, 1 base y 1 balanceador.

### 7.4. Destruir

```bash
make destroy
```

Debe terminar con **«Todo limpio»**. Después, revisa `make cost-check` y la consola de AWS (EC2, Load Balancers, Volúmenes, RDS y EKS en `us-east-1`). Destruye desde el mismo lugar donde desplegaste, porque solo quien creó el clúster tiene acceso a Kubernetes.

### 7.5. Costos estimados

| Recurso | USD/hora | USD/día |
|---|---:|---:|
| Plano de control de EKS | 0,1000 | 2,40 |
| 2 nodos EC2 `t3.medium` | 0,0832 | 2,00 |
| Discos de los nodos (40 GB gp3) | 0,0044 | 0,11 |
| RDS `db.t4g.micro` | 0,0160 | 0,38 |
| Almacenamiento RDS (20 GB gp3) | 0,0032 | 0,08 |
| Network Load Balancer y su uso | 0,0285 | 0,68 |
| 4 IPv4 públicas | 0,0200 | 0,48 |
| **Total** | **0,2552** | **6,13** |

Total estimado del proyecto (ensayo de 6 h, presentación de 24 h y reserva): **8,16 USD**, con un margen del 73 % frente a 30 USD. Precios de `us-east-1` revisados el 05/11/2026, sin impuestos.

## 8. CI/CD con GitHub Actions

| Workflow | Disparador | Qué hace |
|---|---|---|
| `ci.yml` | Pull Request y push a `main` | `npm ci`, lint, pruebas con PostgreSQL y Redis, build del frontend, `terraform fmt` y `validate`, render de Kustomize |
| `images.yml` | Pull Request y push a `main` | Construye las imágenes y las publica en GHCR |
| `deploy.yml` | Manual, con aprobación | Despliega en AWS con credenciales OIDC |
| `destroy.yml` | Manual, escribiendo `DESTRUIR` para confirmar | Destruye el stack `demo` |

## 9. Verificación de sondas de salud

### 9.1. Liveness (`/livez`)

```bash
docker compose exec api node -e "fetch('http://127.0.0.1:3000/livez').then(r=>r.json()).then(console.log)"
```

Responde `{"status":"ok"}` mientras el proceso esté vivo. No revisa dependencias: reiniciar un pod no arregla una base caída.

### 9.2. Readiness (`/health`)

```bash
docker compose exec api node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.json()).then(console.log)"
```

```json
{ "status": "ok", "service": "api", "checks": { "postgres": "ok", "redis": "ok" } }
```

| `status` | Código | Significado |
|---|---|---|
| `ok` | 200 | Todo funciona |
| `degraded` | 200 | Redis falla; la API sigue atendiendo desde PostgreSQL |
| `error` | 503 | PostgreSQL falla; el pod sale del tráfico |

## 10. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `make up` falla con «port is already allocated» | Otro servicio usa el 8080, 5433 o 6380 | Detén ese servicio o cambia el puerto en `docker-compose.yml` |
| El navegador no carga nada | Nginx no arrancó porque la API o el gateway no están sanos | `docker compose ps` y `docker compose logs api gateway` |
| `Configuración inválida: JWT_SECRET…` | Secreto de menos de 32 caracteres | Genera uno con `openssl rand -base64 48` |
| No puedo entrar con `@floorhub.test` | Datos de una versión anterior | `make reset && make up` |
| Los comunicados no llegan en vivo | WebSocket caído o Redis detenido | Revisa el indicador de conexión y `docker compose logs gateway redis` |
| Las pruebas fallan al conectar | PostgreSQL y Redis no están corriendo | `docker compose up -d --wait postgres redis` |
