#!/usr/bin/env bash
# Crea la infraestructura, despliega la aplicación, corre migraciones y seed, e imprime la URL.
# Con TLS=1 (make deploy-tls) la aplicación se sirve por HTTPS con un certificado de Let's Encrypt.
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

TLS="${TLS:-}"
if [ -n "$TLS" ]; then
  require_tools curl
  OVERLAY=prod-tls
  PUBLIC_SERVICE=caddy
  # El entorno de pruebas de Let's Encrypt no tiene límites estrictos, pero el navegador no confía en él.
  if [ -n "${ACME_STAGING:-}" ]; then
    ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
  else
    ACME_CA=https://acme-v02.api.letsencrypt.org/directory
  fi
else
  OVERLAY=prod
  PUBLIC_SERVICE=nginx
fi

# IP pública del NLB, sacada de la API de AWS para no esperar a que su DNS propague.
# Un NLB conserva sus IP mientras exista, así que el nombre sslip.io no cambia entre despliegues.
nlb_public_ip() {
  local arn
  arn="$(aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?DNSName=='$1'].LoadBalancerArn | [0]" --output text 2>/dev/null || true)"
  [ -n "$arn" ] && [ "$arn" != "None" ] || return 0
  # Las interfaces de red de un NLB se describen como "ELB net/<nombre>/<id>".
  aws ec2 describe-network-interfaces \
    --filters "Name=description,Values=ELB ${arn#*:loadbalancer/}" \
    --query 'NetworkInterfaces[].Association.PublicIp' --output text 2>/dev/null \
    | tr '\t' '\n' | sed '/^None$/d;/^$/d' | sort | head -n 1 || true
}

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

log "Desplegando la aplicación (overlay $OVERLAY)"
# Un Job es inmutable: se borra el anterior para poder repetir el despliegue.
kubectl -n "$PROJECT" delete job migrate-seed --ignore-not-found >/dev/null
# Al cambiar de modo se borra el balanceador del modo anterior para que no siga cobrando.
if [ -n "$TLS" ]; then
  if [ "$(kubectl -n "$PROJECT" get service nginx -o jsonpath='{.spec.type}' 2>/dev/null || true)" = "LoadBalancer" ]; then
    kubectl -n "$PROJECT" delete service nginx >/dev/null
  fi
else
  kubectl -n "$PROJECT" delete deployment,service caddy --ignore-not-found >/dev/null
  kubectl -n "$PROJECT" get configmap -o name 2>/dev/null | grep '^configmap/caddy-' \
    | xargs -r kubectl -n "$PROJECT" delete >/dev/null || true
fi
kubectl kustomize "$REPO_ROOT/deploy/k8s/overlays/$OVERLAY" \
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
  hostname="$(kubectl -n "$PROJECT" get service "$PUBLIC_SERVICE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  [ -n "$hostname" ] && break
  sleep 10
done
if [ -z "$hostname" ]; then
  echo "El balanceador no obtuvo dirección a tiempo." >&2
  exit 1
fi

url="http://$hostname   (el DNS puede tardar 2-3 minutos)"
if [ -n "$TLS" ]; then
  log "Configurando HTTPS con sslip.io y Let's Encrypt"
  ip=""
  for _ in $(seq 1 30); do
    ip="$(nlb_public_ip "$hostname")"
    [ -n "$ip" ] && break
    sleep 10
  done
  if [ -z "$ip" ]; then
    echo "No se pudo obtener la IP pública del balanceador." >&2
    exit 1
  fi
  # sslip.io resuelve 3-91-10-20.sslip.io a 3.91.10.20 sin registrar nada.
  site_host="${ip//./-}.sslip.io"
  previous="$(kubectl -n "$PROJECT" get configmap caddy-site \
    -o jsonpath='{.data.SITE_HOST} {.data.ACME_CA}' 2>/dev/null || true)"
  kubectl -n "$PROJECT" create configmap caddy-site \
    --from-literal=SITE_HOST="$site_host" --from-literal=ACME_CA="$ACME_CA" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  # Si Caddy ya corría con otros valores hay que reiniciarlo; si no, arranca solo al aparecer el ConfigMap.
  if [ -n "$previous" ] && [ "$previous" != "$site_host $ACME_CA" ]; then
    kubectl -n "$PROJECT" rollout restart deployment/caddy >/dev/null
  fi
  kubectl -n "$PROJECT" rollout status deployment/caddy --timeout=300s

  url="https://$site_host"
  log "Esperando el certificado de $site_host (2 a 5 minutos)"
  curl_opts=(-fsS -o /dev/null --max-time 10)
  [ -n "${ACME_STAGING:-}" ] && curl_opts+=(-k)
  tls_ready=""
  for _ in $(seq 1 60); do
    if curl "${curl_opts[@]}" "$url/health" 2>/dev/null; then
      tls_ready=1
      break
    fi
    sleep 10
  done
  if [ -z "$tls_ready" ]; then
    cat >&2 <<WARN

ATENCIÓN: la aplicación está desplegada, pero HTTPS no respondió en 10 minutos.
  Revisa:      kubectl -n $PROJECT logs deployment/caddy
  Sin TLS:     IMAGE_OWNER=$IMAGE_OWNER make deploy   (vuelve a HTTP sin recrear la infraestructura)
  Si Let's Encrypt rechaza por límite de emisión, prueba con ACME_STAGING=1 make deploy-tls
WARN
  fi
fi
trap - ERR

cat <<SUMMARY

========================================================
 FloorHub está desplegado
 URL:      $url
 Admin:    andres.morales@floorhub.com (ver README para el resto)
 Contraseña: make demo-password

 CADA HORA ENCENDIDO CUESTA UNOS 0,26 USD.
 Al terminar ejecuta: make destroy
========================================================
SUMMARY
