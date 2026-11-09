#!/usr/bin/env bash
# Lista los recursos del proyecto que generan costo. Con --strict falla si queda alguno.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_tools aws

STRICT=false
[ "${1:-}" = "--strict" ] && STRICT=true
found=0

report() {
  local label="$1" output="$2" count
  count="$(printf '%s\n' "$output" | grep -c . || true)"
  printf '%-22s %s\n' "$label" "$count"
  if [ "$count" -gt 0 ]; then
    printf '%s\n' "$output" | sed '/^$/d; s/^/    /'
    found=$((found + count))
  fi
}

tag_filter="Name=tag:Project,Values=$PROJECT"
query() { "$@" --output text | tr '\t' ' ' | sed '/^None$/d'; }

echo "Recursos activos de '$PROJECT' en $AWS_REGION:"
echo
report "Clúster EKS" "$(aws eks list-clusters --query "clusters[?@=='$PROJECT']" --output text | tr '\t' '\n')"
report "Instancias EC2" "$(query aws ec2 describe-instances --filters "$tag_filter" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name]')"
report "Volúmenes EBS" "$(query aws ec2 describe-volumes --filters "$tag_filter" --query 'Volumes[].[VolumeId,Size,State]')"
report "Elastic IPs" "$(query aws ec2 describe-addresses --filters "$tag_filter" --query 'Addresses[].[PublicIp]')"
report "NAT Gateways" "$(query aws ec2 describe-nat-gateways --filter "$tag_filter" "Name=state,Values=pending,available" --query 'NatGateways[].[NatGatewayId]')"
report "Bases de datos RDS" "$(query aws rds describe-db-instances \
  --query "DBInstances[?TagList[?Key=='Project' && Value=='$PROJECT']].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus]")"

# Se comprueban las etiquetas de cada balanceador porque los crea Kubernetes.
load_balancers=""
for arn in $(aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output text); do
  tagged="$(aws elbv2 describe-tags --resource-arns "$arn" \
    --query "TagDescriptions[0].Tags[?Key=='Project' && Value=='$PROJECT'] | length(@)" --output text)"
  if [ "$tagged" != "0" ]; then
    load_balancers+="$(aws elbv2 describe-load-balancers --load-balancer-arns "$arn" \
      --query 'LoadBalancers[0].[LoadBalancerName,Type,State.Code]' --output text | tr '\t' ' ')"$'\n'
  fi
done
report "Load Balancers" "$load_balancers"

echo
if [ "$found" -eq 0 ]; then
  echo "Todo limpio: no hay recursos del proyecto cobrando."
  echo "El stack bootstrap (bucket S3 y presupuesto) sigue activo y cuesta centavos al mes."
  exit 0
fi
echo "Hay $found recurso(s) activos. Con todo encendido, el costo es de unos 0,26 USD por hora."
if [ "$STRICT" = true ]; then
  echo "ERROR: la destrucción no quedó completa. Revisa estos recursos en la consola de AWS." >&2
  exit 1
fi
