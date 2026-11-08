# CI/CD

Workflow: `.github/workflows/ci.yml`. Pull requests run everything except pushing and deploying.

| Requirement | Job / step |
|---|---|
| 1. Linting | `backend` and `frontend`: `npm run lint` (ESLint) |
| 2. Automated tests | `backend`: unit tests and Supertest end-to-end tests against real Postgres and Redis; `frontend`: Vitest; `e2e`: Playwright against the docker compose stack |
| 3. Build frontend and backend | `npm run build` in both |
| 4. Build Docker images | `images`: the `runtime` stage of each Dockerfile |
| 5. Scan dependencies and images | `npm audit` (high or worse), `repo-scan` (Trivy: vulnerabilities and committed secrets), and a Trivy scan of each built image; any fixable HIGH/CRITICAL finding fails the build |
| 6. Push to a registry | `images`: GHCR, tagged with the commit SHA and `latest`, on pushes to `main` only, and only after the scan passes |
| 7. Deploy after approval | `deploy`: uses the `production` environment, so required reviewers gate it; `helm upgrade --atomic` then a smoke test of `/healthz` |

## One-time setup

1. **Commit lockfiles** (`package-lock.json` in `backend`, `frontend`, `e2e`) and the Prisma migrations. Until then CI falls back to `npm install` and generates a migration (and says so).
2. Settings > Environments > `production`: add **required reviewers**.
3. Environment secrets/variables: secret `KUBE_CONFIG` (base64 of a kubeconfig for a deploy-only service account), variables `APP_URL` and `APP_HOST`.
4. Create `devforge-secrets` in the cluster (see `docs/kubernetes.md`). CI never sees application secrets.
5. If GHCR packages are private, create an image pull secret and set `imagePullSecrets` in the chart values.

## Run the same checks locally

```bash
cd backend  && npm run lint && npm test && npm run test:e2e && npm run build
cd frontend && npm run lint && npm test && npm run build
bash scripts/setup-env.sh && docker compose up -d --build && (cd e2e && npx playwright test)
```

## Notes

- Actions are pinned to major versions; for stricter supply-chain control pin them to commit SHAs (Dependabot is configured to keep them current).
- The pipeline has not been executed yet. Expect to fix small lint or dependency findings on the first run.
