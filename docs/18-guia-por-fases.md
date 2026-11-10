# FloorHub: guía por fases

Qué se construyó en cada fase, cómo probarlo y qué vale la pena aprender.

## Fase 2: backend REST y PostgreSQL

**Qué hay:** API Express, migraciones con `node-pg-migrate` y seed idempotente, en `apps/api` y `db`.

**Cómo probarlo:** `make test`.

**Qué aprender:**
- **Concurrencia sin candados:** lee `claimRequest` en `apps/api/src/services/helpRequests.js` y su test, que lanza 10 peticiones simultáneas.
- **Mínimo privilegio:** la aplicación usa `floorhub_app`, que no puede borrar auditoría. Los permisos están en la migración.
- **Tests contra servicios reales:** un mock nunca habría probado el bloqueo de filas de PostgreSQL.

## Fase 3: WebSockets, Redis y worker

**Qué hay:** gateway con Socket.IO y adaptador de Redis, caché, rate limiting, presencia y trabajos de BullMQ.

**Cómo probarlo:** el test `apps/gateway/test/gateway.test.js` levanta **dos réplicas reales**. Para ver la recuperación de Redis, publica un comunicado crítico y ejecuta `docker compose restart redis`: el recordatorio llega igual.

**Qué aprender:**
- **Un Redis con varios trabajos:** en `context.js` hay dos conexiones. La de caché falla rápido y la de colas reintenta sin límite.
- **Trabajos idempotentes:** en `sendReminder`, el candado de fila y el número de ronda impiden notificar dos veces.
- **Fuente de verdad:** todo lo que está en Redis debe poder reconstruirse desde PostgreSQL.

## Fase 4: frontend

**Qué hay:** React con Vite y una vista por rol, en `apps/web`.

**Cómo probarlo:** `make up`, y sigue la demostración del README.

**Qué aprender:**
- **Resincronizar al reconectar:** `useSocket` llama a `reload` en cada conexión.
- **`sessionStorage`:** permite una sesión distinta por ventana, a cambio de mayor exposición ante XSS. La CSP de Nginx ayuda a mitigarlo.

## Fase 5: Docker, Compose y Nginx

**Qué hay:** imágenes multi-stage sin root, `docker-compose.yml` y proxy con soporte de WebSocket.

**Cómo probarlo:** `make up` y `docker compose ps`, donde todos deben aparecer como `healthy`.

**Qué aprender:**
- **Proxy de WebSocket:** en `nginx.conf`, las cabeceras `Upgrade` y `Connection` hacen posible el cambio de protocolo.
- **`CMD ["node", ...]` y no `npm`:** node recibe `SIGTERM` directamente y puede cerrar limpio.

## Fase 6: Kubernetes

**Qué hay:** Kustomize con `base` y overlays `dev` y `prod`, HPA, sondas y `securityContext`.

**Cómo probarlo:** `make k8s-up` y luego `make k8s-url`, y entra a <http://localhost:8081>. Para ver la recuperación, ejecuta `kubectl --context floorhub -n floorhub delete pod -l app=gateway`.

**Qué aprender:**
- **Readiness frente a liveness:** `/health` revisa dependencias y saca el pod del tráfico; `/livez` no las revisa, porque reiniciar un pod no arregla una base caída.
- **Requests y limits:** los requests deciden dónde cabe un pod, y los limits lo frenan o lo terminan.

## Fase 7: Terraform en AWS

**Qué hay:** los stacks `bootstrap` (permanente) y `demo` (efímero), en `deploy/terraform`.

**Cómo probarlo:** `terraform validate` no crea nada. Lo demás se prueba en el ensayo.

**Qué aprender:**
- **Quién crea cada recurso:** el NLB lo crea Kubernetes, por eso Terraform no lo conoce y `make destroy` debe borrarlo primero.
- **Etiquetas:** las de Terraform no llegan a lo que crea un node group. Por eso existe el `aws_launch_template`.
- **Los costos se esconden en los valores por defecto:** el soporte extendido de EKS y `include_credit` son dos ejemplos.

## Fase 8: CI/CD y operación

**Qué hay:** workflows de GitHub Actions, Makefile y scripts de despliegue y verificación.

**Cómo probarlo:** abre un Pull Request. Después, usa la guía del día de la presentación del README.

**Qué aprender:**
- **OIDC:** GitHub obtiene credenciales temporales y la condición `sub` limita el rol a este repositorio y a su Environment.
- **Probar también los scripts de seguridad:** una prueba simulada reveló que `cost-check` contaba un recurso de menos, y que un único recurso activo aparecía como 0. Un verificador sin probar da una falsa tranquilidad.
