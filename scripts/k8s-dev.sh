#!/usr/bin/env bash
# Despliega en minikube. Todas las imágenes se cargan desde este equipo, de modo que
# funciona aunque el nodo de minikube no pueda resolver DNS externo.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_tools minikube kubectl docker

PROFILE=floorhub
kube() { kubectl --context "$PROFILE" "$@"; }

log "Iniciando minikube (perfil $PROFILE)"
# --keep-context: no cambia el contexto de kubectl que ya estés usando.
minikube start -p "$PROFILE" --keep-context --cpus=2 --memory=4096 --addons=metrics-server

log "Cargando las imágenes"
docker pull -q redis:8-alpine >/dev/null
docker pull -q postgres:17-alpine >/dev/null
minikube -p "$PROFILE" image load \
  floorhub/api:local floorhub/gateway:local floorhub/worker:local floorhub/nginx:local floorhub/migrate:local \
  redis:8-alpine postgres:17-alpine

# El HPA necesita metrics-server. Se quita el digest de la imagen del addon para usar la copia cargada.
metrics_image="$(kube -n kube-system get deployment metrics-server \
  -o jsonpath='{.spec.template.spec.containers[0].image}' | sed 's/@.*//')"
metrics_ready=false
for attempt in 1 2 3 4 5; do
  if docker pull -q "$metrics_image" >/dev/null; then
    metrics_ready=true
    break
  fi
  echo "No se pudo descargar metrics-server (intento $attempt/5)."
  sleep 30
done
if [ "$metrics_ready" = true ]; then
  minikube -p "$PROFILE" image load "$metrics_image"
  kube -n kube-system set image deployment/metrics-server "metrics-server=$metrics_image" >/dev/null
  kube -n kube-system rollout status deployment/metrics-server --timeout=180s
else
  # Se continúa: la aplicación funciona igual, solo que el HPA no podrá escalar.
  echo "AVISO: sin metrics-server el HPA no escalará. Vuelve a ejecutar make k8s-up más tarde."
fi

log "Desplegando la aplicación"
# Si el namespace se está borrando, hay que esperar: no admite recursos nuevos.
for _ in $(seq 1 30); do
  [ "$(kube get namespace floorhub -o jsonpath='{.status.phase}' 2>/dev/null)" = "Terminating" ] || break
  sleep 5
done
kube -n floorhub delete job migrate-seed --ignore-not-found >/dev/null 2>&1 || true
kube apply -k "$REPO_ROOT/deploy/k8s/overlays/dev"
kube -n floorhub wait --for=condition=complete job/migrate-seed --timeout=300s
for deployment in redis api gateway worker nginx; do
  kube -n floorhub rollout status "deployment/$deployment" --timeout=180s
done

echo
echo "Listo. Para abrir la aplicación ejecuta: make k8s-url (y entra a http://localhost:8081)"
