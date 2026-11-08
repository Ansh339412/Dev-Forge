#!/usr/bin/env bash
# Deploys DevForge to a local kind cluster: cluster + ingress, images, secrets, manifests, migrations.
# Usage: scripts/k8s-local.sh            (create/refresh)
#        scripts/k8s-local.sh --destroy  (delete the cluster)
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=devforge
NS=devforge

if [[ "${1:-}" == "--destroy" ]]; then
  kind delete cluster --name "$CLUSTER"
  exit 0
fi

for tool in docker kind kubectl openssl; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done

if [[ -z "$(ls -A backend/prisma/migrations 2>/dev/null)" ]]; then
  echo "No Prisma migrations found. Create them first:" >&2
  echo "  docker compose run --rm --no-deps backend sh scripts/gen-initial-migration.sh" >&2
  exit 1
fi

echo "==> Cluster"
if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --name "$CLUSTER" --config k8s/kind-config.yaml
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

if ! kubectl get namespace ingress-nginx >/dev/null 2>&1; then
  echo "==> Installing ingress-nginx"
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/kind/deploy.yaml
fi
kubectl -n ingress-nginx wait --for=condition=ready pod \
  -l app.kubernetes.io/component=controller --timeout=180s

echo "==> Building and loading images"
docker build -t devforge-backend:local --target runtime backend
docker build -t devforge-frontend:local --target runtime frontend
kind load docker-image devforge-backend:local devforge-frontend:local --name "$CLUSTER"

echo "==> Secrets"
kubectl apply -f k8s/namespace.yaml
if ! kubectl -n "$NS" get secret devforge-secrets >/dev/null 2>&1; then
  pg_password=$(openssl rand -hex 16)
  kubectl -n "$NS" create secret generic devforge-secrets \
    --from-literal=POSTGRES_USER=devforge \
    --from-literal=POSTGRES_PASSWORD="$pg_password" \
    --from-literal=POSTGRES_DB=devforge \
    --from-literal=DATABASE_URL="postgresql://devforge:${pg_password}@postgres:5432/devforge?schema=public" \
    --from-literal=JWT_ACCESS_SECRET="$(openssl rand -hex 32)" \
    --from-literal=S3_ACCESS_KEY_ID="$(openssl rand -hex 8)" \
    --from-literal=S3_SECRET_ACCESS_KEY="$(openssl rand -hex 16)"
fi

echo "==> Applying manifests"
kubectl apply -k k8s
kubectl -n "$NS" rollout status statefulset/postgres --timeout=180s

echo "==> Migrating database"
kubectl -n "$NS" delete job backend-migrate --ignore-not-found
kubectl -n "$NS" apply -f k8s/migrate-job.yaml
kubectl -n "$NS" wait --for=condition=complete job/backend-migrate --timeout=180s

kubectl -n "$NS" rollout restart deployment/backend deployment/frontend
kubectl -n "$NS" rollout status deployment/backend --timeout=180s
kubectl -n "$NS" rollout status deployment/frontend --timeout=180s

cat <<MSG

Ready. Add this line to /etc/hosts (needs sudo), then open http://devforge.local
  127.0.0.1 devforge.local s3.devforge.local
Mail is caught by MailHog:  kubectl -n $NS port-forward svc/mailhog 8025:8025
MSG
