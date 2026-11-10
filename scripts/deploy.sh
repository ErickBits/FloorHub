#!/usr/bin/env bash
# Crea la infraestructura, despliega la aplicación, corre migraciones y seed, e imprime la URL.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_tools aws terraform kubectl docker

IMAGE_OWNER="${IMAGE_OWNER:-}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)}"
if [ -z "$IMAGE_OWNER" ] || [ -z "$IMAGE_TAG" ]; then
  echo "Uso: IMAGE_OWNER=tu-usuario-de-github [IMAGE_TAG=sha-del-commit] make deploy" >&2
  exit 1
fi
IMAGE_OWNER="$(echo "$IMAGE_OWNER" | tr '[:upper:]' '[:lower:]')"

# Comprobar las imágenes antes de crear nada evita pagar por un despliegue que no puede funcionar.
log "Comprobando las imágenes con la etiqueta $IMAGE_TAG"
for service in api gateway worker nginx migrate; do
  image="ghcr.io/$IMAGE_OWNER/floorhub-$service:$IMAGE_TAG"
  if ! docker manifest inspect "$image" >/dev/null 2>&1; then
    echo "No se encuentra $image. ¿Terminó el workflow de imágenes y el paquete es público?" >&2
    exit 1
  fi
done

trap 'echo; echo "ATENCIÓN: el despliegue falló y puede haber recursos cobrando. Corrige y reintenta, o ejecuta: make destroy" >&2' ERR

log "Creando la infraestructura (15 a 25 minutos)"
terraform_init
terraform -chdir="$TF_DIR" apply -input=false -auto-approve

CLUSTER="$(terraform -chdir="$TF_DIR" output -raw cluster_name)"
aws eks update-kubeconfig --name "$CLUSTER" --region "$AWS_REGION" >/dev/null

log "Creando el Secret de la aplicación"
kubectl create namespace "$PROJECT" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
# Un archivo temporal evita que los secretos aparezcan en la lista de procesos.
secrets_file="$(mktemp)"
trap 'rm -f "$secrets_file"; echo; echo "ATENCIÓN: el despliegue falló y puede haber recursos cobrando. Corrige y reintenta, o ejecuta: make destroy" >&2' ERR
chmod 600 "$secrets_file"
{
  echo "DATABASE_URL=$(terraform -chdir="$TF_DIR" output -raw database_url)"
  echo "MIGRATION_DATABASE_URL=$(terraform -chdir="$TF_DIR" output -raw migration_database_url)"
  echo "JWT_SECRET=$(terraform -chdir="$TF_DIR" output -raw jwt_secret)"
  echo "SEED_PASSWORD=$(terraform -chdir="$TF_DIR" output -raw seed_password)"
} > "$secrets_file"
kubectl -n "$PROJECT" create secret generic floorhub-secrets --from-env-file="$secrets_file" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
rm -f "$secrets_file"

log "Desplegando la aplicación"
# Un Job es inmutable: se borra el anterior para poder repetir el despliegue.
kubectl -n "$PROJECT" delete job migrate-seed --ignore-not-found >/dev/null
kubectl kustomize "$REPO_ROOT/deploy/k8s/overlays/prod" \
  | sed -E "s#ghcr.io/OWNER/(floorhub-[a-z]+):latest#ghcr.io/$IMAGE_OWNER/\1:$IMAGE_TAG#" \
  | kubectl apply -f -

log "Esperando migraciones, seed y servicios"
kubectl -n "$PROJECT" wait --for=condition=complete job/migrate-seed --timeout=300s
for deployment in redis api gateway worker nginx; do
  kubectl -n "$PROJECT" rollout status "deployment/$deployment" --timeout=300s
done

log "Esperando la dirección del balanceador"
hostname=""
for _ in $(seq 1 60); do
  hostname="$(kubectl -n "$PROJECT" get service nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  [ -n "$hostname" ] && break
  sleep 10
done
if [ -z "$hostname" ]; then
  echo "El balanceador no obtuvo dirección a tiempo." >&2
  exit 1
fi
trap - ERR

cat <<SUMMARY

========================================================
 FloorHub está desplegado
 URL:      http://$hostname   (el DNS puede tardar 2-3 minutos)
 Admin:    andres.morales@floorhub.com (ver README para el resto)
 Contraseña: make demo-password

 CADA HORA ENCENDIDO CUESTA UNOS 0,26 USD.
 Al terminar ejecuta: make destroy
========================================================
SUMMARY
