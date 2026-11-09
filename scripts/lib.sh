#!/usr/bin/env bash
# Valores y funciones compartidos por los scripts de AWS.
PROJECT="${PROJECT:-floorhub}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION" AWS_PAGER=""
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/deploy/terraform/demo"

log() { printf '\n==> %s\n' "$*"; }

require_tools() {
  local missing=()
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Faltan estas herramientas: ${missing[*]}" >&2
    exit 1
  fi
}

state_bucket() {
  echo "${PROJECT}-tfstate-$(aws sts get-caller-identity --query Account --output text)"
}

terraform_init() {
  local bucket
  bucket="$(state_bucket)"
  if ! aws s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    echo "No existe el bucket de estado $bucket. Ejecuta primero: make bootstrap" >&2
    exit 1
  fi
  terraform -chdir="$TF_DIR" init -input=false -reconfigure -backend-config="bucket=$bucket" >/dev/null
}
