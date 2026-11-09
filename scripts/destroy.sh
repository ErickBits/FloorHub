#!/usr/bin/env bash
# El orden importa: el balanceador lo crea Kubernetes, así que Terraform no lo conoce.
# Si quedara activo, seguiría cobrando y además bloquearía el borrado de la VPC.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_tools aws terraform kubectl

terraform_init

project_vpc() {
  aws ec2 describe-vpcs --filters "Name=tag:Project,Values=$PROJECT" --query 'Vpcs[0].VpcId' --output text 2>/dev/null || true
}

project_load_balancers() {
  local vpc
  vpc="$(project_vpc)"
  [ -n "$vpc" ] && [ "$vpc" != "None" ] || return 0
  aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?VpcId=='$vpc'].LoadBalancerArn" --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d' || true
}

log "1/4 Borrando los recursos de Kubernetes"
if aws eks describe-cluster --name "$PROJECT" >/dev/null 2>&1; then
  aws eks update-kubeconfig --name "$PROJECT" --region "$AWS_REGION" >/dev/null
  # Con esto Kubernetes libera el balanceador. Si falla, el paso 2 lo borra por la API de AWS.
  kubectl delete namespace "$PROJECT" --ignore-not-found --wait=true --timeout=300s \
    || echo "Kubernetes no terminó a tiempo; se continúa con la verificación en AWS."
else
  echo "El clúster ya no existe."
fi

log "2/4 Esperando a que AWS elimine el balanceador"
for attempt in $(seq 1 30); do
  arns="$(project_load_balancers)"
  [ -z "$arns" ] && break
  # A los 5 minutos se borra directamente, para no dejar un balanceador cobrando.
  if [ "$attempt" -ge 30 ]; then break; fi
  if [ "$attempt" -eq 10 ]; then
    echo "Sigue activo tras 5 minutos: se borra directamente por la API de AWS."
    for arn in $arns; do aws elbv2 delete-load-balancer --load-balancer-arn "$arn" || true; done
  fi
  echo "Aún activo ($attempt/30)..."
  sleep 30
done

# Kubernetes puede dejar Security Groups propios (k8s-*) que impedirían borrar la VPC.
vpc="$(project_vpc)"
if [ -n "$vpc" ] && [ "$vpc" != "None" ]; then
  for sg in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc" \
    --query "SecurityGroups[?starts_with(GroupName, 'k8s-')].GroupId" --output text); do
    aws ec2 delete-security-group --group-id "$sg" || true
  done
fi

log "3/4 Ejecutando terraform destroy (10 a 20 minutos)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve

log "4/4 Verificando que no quede nada cobrando"
"$REPO_ROOT/scripts/cost-check.sh" --strict
