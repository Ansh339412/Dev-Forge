# Kubernetes deployment guide

Two ways to deploy, same images and probes:

| | Use for | Includes |
|---|---|---|
| `k8s/` + `scripts/k8s-local.sh` | a local cluster (kind) | the app **and** Postgres, Redis, SeaweedFS storage, MailHog |
| `helm/devforge` | a cloud cluster | the app only; use managed Postgres, Redis and S3 |

## Local cluster (kind)

Prerequisites: Docker, [kind](https://kind.sigs.k8s.io), kubectl, openssl, and committed migrations
(`docker compose run --rm --no-deps backend sh scripts/gen-initial-migration.sh`). Ports 80 and 443 must be free.

```bash
scripts/k8s-local.sh
echo "127.0.0.1 devforge.local s3.devforge.local" | sudo tee -a /etc/hosts
open http://devforge.local
kubectl -n devforge port-forward svc/mailhog 8025:8025   # verification emails
scripts/k8s-local.sh --destroy                            # tear down
```

The script creates the cluster and ingress-nginx, builds and loads both images, creates `devforge-secrets` with random values (never committed), applies `k8s/`, runs the migration Job, then restarts and waits for the deployments.

### What the manifests set up

- **Deployments** for backend and frontend (2 replicas, zero-downtime rolling updates), StatefulSets with persistent volumes for Postgres and SeaweedFS, a Deployment for Redis.
- **Probes:** backend `startup` + `liveness` (`/health/live`) + `readiness` (`/health/ready`, checks Postgres and Redis); frontend `/healthz`.
- **Resources:** requests and limits on every container; backend HPA at 70% CPU (2 to 6 pods; needs metrics-server).
- **Hardening:** non-root users, no privilege escalation, all capabilities dropped, read-only root filesystem on the backend, seccomp `RuntimeDefault`, and NetworkPolicies (default deny, then per-service allows).
- **Config:** non-secret settings in the `devforge-config` ConfigMap, secrets in `devforge-secrets`.
- **Ingress:** `/api` and `/socket.io` go to the backend, everything else to the frontend; the metrics port is not routed.

## Monitoring on Kubernetes

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
kubectl apply -f k8s/monitoring/servicemonitor.yaml
kubectl -n monitoring create configmap devforge-dashboard --from-file=monitoring/grafana/dashboards/devforge.json
kubectl -n monitoring label configmap devforge-dashboard grafana_dashboard=1
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3001:80
```

Convert `monitoring/alerts.yml` into a `PrometheusRule` for alerting.

## Cloud deployment with Helm

1. Provision a managed PostgreSQL, a Redis, an S3 bucket (private, public access blocked), and an ingress controller (and cert-manager for TLS).
2. Create the secret once (never put these in values files or git):

```bash
kubectl create namespace devforge
kubectl -n devforge create secret generic devforge-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=JWT_ACCESS_SECRET="$(openssl rand -hex 32)" \
  --from-literal=S3_ACCESS_KEY_ID='...' --from-literal=S3_SECRET_ACCESS_KEY='...' \
  --from-literal=RESEND_API_KEY='...'        # optional
```

3. Install (CI does the same on every merge to `main`):

```bash
helm upgrade --install devforge helm/devforge -n devforge --atomic --timeout 8m \
  --set fullnameOverride=devforge \
  --set backend.image.repository=<owner>/<repo>/backend  --set backend.image.tag=<sha> \
  --set frontend.image.repository=<owner>/<repo>/frontend --set frontend.image.tag=<sha> \
  --set config.APP_URL=https://devforge.example.com --set config.CORS_ORIGIN=https://devforge.example.com \
  --set ingress.host=devforge.example.com --set ingress.tls.enabled=true
```

A `pre-install,pre-upgrade` hook Job runs `prisma migrate deploy` first, so a failed migration stops the rollout and `--atomic` rolls back. Use `imagePullSecrets` if the registry is private.

## Troubleshooting

| Symptom | Check |
|---|---|
| Backend pods not ready | `kubectl -n devforge logs deploy/backend`; readiness fails if Postgres or Redis is unreachable |
| `relation does not exist` | the migration Job did not finish: `kubectl -n devforge logs job/backend-migrate` |
| Downloads fail locally | `s3.devforge.local` must be in `/etc/hosts` |
| Socket.IO disconnects | ingress timeouts: keep the `proxy-read-timeout` annotations |

## Known limitations

- The SeaweedFS image is unpinned and the local storage setup is untested.
- kind's default network plugin does not enforce NetworkPolicies; use Calico or Cilium to see them applied.
- Several backend replicas need the Socket.IO Redis adapter for real-time events to reach every client (not added yet).
- Manifests and the chart have been syntax-checked only; they have not been applied to a cluster in the authoring environment.
