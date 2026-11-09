SHELL := /bin/bash
.DEFAULT_GOAL := help
MINIKUBE_PROFILE := floorhub
KUBECTL_DEV := kubectl --context $(MINIKUBE_PROFILE) -n floorhub
BOOTSTRAP_DIR := deploy/terraform/bootstrap

.PHONY: help install up down reset logs migrate seed test lint build \
	k8s-up k8s-url k8s-logs k8s-down bootstrap deploy destroy cost-check aws-logs demo-password

help: ## Muestra esta ayuda
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Instala las dependencias de desarrollo
	npm ci

up: ## Levanta todo en local: http://localhost:8080
	docker compose up -d --build --wait

down: ## Detiene el entorno local y conserva los datos
	docker compose down

reset: ## Detiene el entorno local y borra sus datos
	docker compose down -v

logs: ## Muestra los logs del entorno local
	docker compose logs -f --tail=100 api gateway worker nginx

migrate: ## Aplica las migraciones en local
	docker compose up -d --wait postgres
	docker compose run --rm --build migrate node src/cli.js migrate

seed: ## Carga los datos de demostración en local
	docker compose up -d --wait postgres
	docker compose run --rm --build migrate node src/cli.js seed

test: ## Ejecuta los tests contra PostgreSQL y Redis reales
	docker compose up -d --wait postgres redis
	npm test

lint: ## Revisa el estilo del código
	npm run lint

build: ## Construye las imágenes de Docker
	docker compose build

k8s-up: build ## Despliega en minikube con su propio perfil
	./scripts/k8s-dev.sh

k8s-url: ## Abre un túnel local hacia la aplicación en minikube
	$(KUBECTL_DEV) port-forward service/nginx 8081:80

k8s-logs: ## Muestra los logs en minikube
	$(KUBECTL_DEV) logs -f -l 'app in (api,gateway,worker)' --max-log-requests=10 --tail=50

k8s-down: ## Borra el clúster de minikube
	minikube delete -p $(MINIKUBE_PROFILE)

bootstrap: ## Una sola vez: crea el bucket de estado, OIDC y el presupuesto
	terraform -chdir=$(BOOTSTRAP_DIR) init -input=false
	terraform -chdir=$(BOOTSTRAP_DIR) apply

deploy: ## CREA RECURSOS QUE COBRAN en AWS (IMAGE_OWNER=usuario IMAGE_TAG=sha)
	./scripts/deploy.sh

destroy: ## Destruye todo en AWS y verifica que no quede nada
	./scripts/destroy.sh

cost-check: ## Muestra los recursos activos del proyecto en AWS
	./scripts/cost-check.sh

aws-logs: ## Muestra los logs de la aplicación en EKS
	kubectl -n floorhub logs -f -l 'app in (api,gateway,worker)' --max-log-requests=10 --tail=50

demo-password: ## Muestra la contraseña de los usuarios de la demo en AWS
	@terraform -chdir=deploy/terraform/demo output -raw seed_password; echo
