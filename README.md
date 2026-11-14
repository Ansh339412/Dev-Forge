# DevForge

Project and team collaboration platform for software teams. This repo currently contains **the backend (phases 1-4) and the first cut of the React frontend** of the backend.

| Area | Status |
|---|---|
| Monorepo, Docker Compose (Postgres, Redis, MailHog, backend) | done |
| Auth: register, email verify, login, refresh rotation, sessions, password reset | done |
| Users: profile, change password | done |
| Workspaces: CRUD, members, role changes, invitations, workspace-scoped RBAC | done |
| Projects: CRUD, status/priority/deadline, manager, members, activity history, completion % | done |
| Tasks: CRUD, labels, comments, Kanban board with drag-and-drop ordering API | done |
| Dashboard analytics (totals, overdue, productivity, completion %, daily activity) | done |
| Notifications: in-app + email, real-time via Socket.IO, due-soon reminders | done |
| Integrations: GitHub (connect repo, recent commits), Resend email API | done |
| DevOps: Dockerfiles, Compose, Kubernetes manifests, Helm chart, GitHub Actions (lint, test, scan, build, push, approved deploy), Prometheus + Grafana, Playwright and Supertest suites | done (not yet run end to end) |
| Attachments: upload through the API to S3-compatible storage (SeaweedFS locally), forced-download links | done |
| Frontend: sign-in/register/verify/reset, workspaces, projects, Kanban drag-and-drop, task drawer (comments, labels, files), dashboard, members + invitations, live notifications | done (first cut) |
| Frontend: project tabs (board, activity feed, GitHub commits, settings with team management and delete), account page (profile, notification preference, password, sessions), component tests | done |
| Kubernetes, Helm, GitHub Actions, Prometheus/Grafana | later |

## Quick start (Docker)

Prerequisites: Docker with Compose v2.

The stack also runs SeaweedFS (S3-compatible storage for attachments; MinIO's community edition is archived) and the Vite dev server for the frontend.

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD (URL-safe) and JWT_ACCESS_SECRET (openssl rand -hex 32)
# also put the same password into DATABASE_URL

# 1. Start dependencies
docker compose up -d postgres redis mailhog

# 2. One-time: write the initial migration from schema.prisma (needs no database), then commit backend/prisma/migrations
docker compose run --rm --no-deps backend sh scripts/gen-initial-migration.sh
#    (or run scripts/setup-env.sh instead of copying .env by hand: it generates all secrets)
#    If you already ran init for phases 1-2:  --name projects_and_tasks
docker compose run --rm backend npx prisma migrate dev --name init

# 3. Run everything
docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:3000/api/v1
- Swagger UI: http://localhost:3000/api/docs
- Health: `GET /health/live`, `GET /health/ready`
- Verification / invitation / reset emails: http://localhost:8025 (MailHog)

By default, local email is caught by MailHog and is not delivered to real inboxes. To send through Brevo, set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` to your Brevo SMTP login, `SMTP_PASS` to your Brevo SMTP key, and `MAIL_FROM` to a sender verified with Brevo in your local `.env`. Leave `RESEND_API_KEY` empty when using SMTP; a configured Resend key takes precedence. Restart the backend with `docker compose up -d --force-recreate backend`. Never commit `.env` or share provider credentials.

After a `package.json` change, rebuild with `docker compose up --build -V`.
After a later schema change: `docker compose run --rm backend npx prisma migrate dev --name <change>`.

Tests (needs `npm install` and `npx prisma generate` in `backend/`): `npm test`.

## Deploy frontend to GitHub Pages

The Vite frontend can be published as a GitHub Pages static site. The workflow in `.github/workflows/deploy-pages.yml` builds the app with a hash router and a repo-scoped base path, then uploads the generated `frontend/dist` output to GitHub Pages.

To enable it in GitHub:

1. Open the repository settings and enable GitHub Pages.
2. Set the source to `GitHub Actions`.
3. Push to `main` or trigger the workflow manually.

The site will be served at `https://<user>.github.io/<repo>/`.

The Pages site is frontend-only until a backend is deployed. See
[`docs/free-hosting.md`](docs/free-hosting.md) for a free-tier backend setup and
the required database, Redis, file storage, email, and GitHub Actions settings.

## Operations

| Task | Command |
|---|---|
| Generate `.env` with random secrets | `bash scripts/setup-env.sh` |
| Metrics, dashboards, alerts (Prometheus :9090, Grafana :3001) | `docker compose --profile monitoring up` |
| Go live on one server (HTTPS, Docker Compose) | `docs/deploy-vps.md` |
| Local Kubernetes (kind) | `scripts/k8s-local.sh` |
| Cloud Kubernetes (Helm) | see `docs/kubernetes.md` |
| Tests | see `docs/testing.md` |

Documentation: `docs/architecture.md` (system and ER diagrams), `docs/kubernetes.md`, `docs/cicd.md`, `docs/testing.md`; the API reference is Swagger UI at `/api/docs` (disabled in production unless `ENABLE_SWAGGER=true`).

Backend metrics are on port 9100 (`/metrics`), separate from the API port so the ingress never exposes them.

## Using the app

1. Register at http://localhost:5173/register, open MailHog (http://localhost:8025) and click the verification link.
2. Sign in, create a workspace, then a project. Add tasks from the board; drag cards between columns.
3. Invite a second user from Members (the email lands in MailHog), accept the link while signed in as that user, and watch assignments and comments arrive as live notifications.

**Attachments** are uploaded through the API (not directly to storage), limited to 10 MB and to images, PDF, text, CSV, JSON and ZIP. Files are stored under random keys, and download links are short-lived and always force a download. Deleting a task, project or workspace removes its files too.

**On AWS:** set `S3_ENDPOINT` and `S3_PUBLIC_ENDPOINT` empty, `S3_FORCE_PATH_STYLE=false`, `S3_CREATE_BUCKET=false`, create the bucket yourself (private, no public access) and use an IAM user limited to that bucket.

## Try it with curl

```bash
curl -X POST localhost:3000/api/v1/auth/register -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"a-long-passphrase","name":"Me"}'
# open MailHog, copy the token from the verification link
curl -X POST localhost:3000/api/v1/auth/verify-email -H 'content-type: application/json' -d '{"token":"<token>"}'
curl -X POST localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"a-long-passphrase"}'
# use accessToken as: Authorization: Bearer <token>
curl -X POST localhost:3000/api/v1/workspaces -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"name":"Acme Engineering"}'
```

## Phase 3 API summary

All routes are under `/api/v1/workspaces/:workspaceId/...` and require membership (non-members get 404).

| Route | Min role | Notes |
|---|---|---|
| `POST/GET projects`, `GET projects/:id` | PM to create, Viewer to read | list includes task counts per status and `completionPercent` |
| `PATCH projects/:id` | PM | only that project's manager or a workspace admin; only an admin can change the manager |
| `DELETE projects/:id` | Admin | |
| `GET/POST/DELETE projects/:id/members` | Viewer / PM / PM | manager or admin only; removing a member unassigns their tasks |
| `GET projects/:id/activity?page&limit` | Viewer | project activity history |
| `POST/GET projects/:id/tasks`, `GET .../tasks/board` | Developer to write | Developers can only work in projects they belong to; PM/Admin in any |
| `PATCH/DELETE .../tasks/:taskId` | Developer | delete: creator, PM or admin |
| `POST .../tasks/:taskId/move` | Developer | body `{status, afterTaskId?}`; drop below `afterTaskId`, or top of column if omitted |
| `GET/POST .../tasks/:taskId/comments`, `PATCH/DELETE .../:commentId` | Developer to write | edit: author only; delete: author or admin |
| `GET/POST/DELETE labels` | Viewer / PM / PM | workspace-wide |

**Kanban ordering:** each task has a `position` (double). A drop computes the midpoint between its new neighbours, so only one row is written; if neighbours get too close, that column is renumbered inside the same transaction.

### Phase 4 API summary

| Route | Notes |
|---|---|
| `GET workspaces/:id/analytics/dashboard?days=14` | totals, per-project completion %, per-member productivity, dense daily created/completed series (UTC) |
| `GET workspaces/:id/analytics/my-tasks` | caller's open tasks, soonest due first |
| `GET /notifications?unread=true&page&limit`, `GET /notifications/unread-count` | |
| `POST /notifications/:id/read`, `POST /notifications/read-all` | |
| `PATCH /users/me {emailNotifications}` | opt out of notification emails (in-app stays on) |
| `POST/GET/DELETE projects/:id/integrations/github`, `GET .../github/:repoId/commits?limit` | connect = project manager or admin; commits cached 5 min in Redis |

**Notifications** are created for: task assigned, task commented, project updated, workspace invitation (existing users), and task due within 24h (hourly job, deduplicated per task and due date).

**Real-time (Socket.IO, namespace `/realtime`):**

```js
const socket = io('http://localhost:3000/realtime', { auth: { token: accessToken } });
socket.on('notification', (n) => { /* new in-app notification */ });
socket.emit('project.join', { projectId }, (res) => { /* { ok: true } if you are a workspace member */ });
socket.on('task.changed', (e) => { /* { kind: created|updated|moved|deleted, taskId, ... } -> refetch the board */ });
```

The token is checked at connect time; reconnect after refreshing it. More than one backend replica needs the Socket.IO Redis adapter (planned with the Kubernetes phase).

**Email:** set `RESEND_API_KEY` to send through the Resend API; otherwise SMTP is used (MailHog locally, or a provider such as Brevo when configured).

**Events:** assignment, comments and project updates are emitted as domain events (`src/common/events.ts`). The notifications module in the next phase subscribes to them without changing this code.

## Architecture

Modular monolith (NestJS). Each module owns its controllers, services and DTOs and talks to others only through exported services, so any module can later be extracted into a service.

```
backend/src
  auth/        registration, login, refresh rotation, sessions, password reset
  users/       profile, change password
  workspaces/  workspaces, members, invitations
  projects/    projects, project members, completion stats
  tasks/       tasks + Kanban moves, comments, labels
  activity/    audit/activity log written by the modules above
  analytics/   dashboard queries
  notifications/  in-app + email notifications, due-soon scheduler
  realtime/    Socket.IO gateway
  integrations/github/  GitHub repo + commits
  common/      guards (JWT, workspace RBAC), decorators, utils
  prisma/ redis/ mail/ health/ config/
```

### Roles

- **Super Admin**: `User.systemRole = SUPER_ADMIN`; bypasses workspace membership checks. Set manually in the database; there is deliberately no API to grant it.
- **Workspace roles** (per workspace): `WORKSPACE_ADMIN > PROJECT_MANAGER > DEVELOPER > VIEWER`, enforced by `WorkspaceRolesGuard` via `@MinWorkspaceRole()`. Developers work only inside projects they are members of; Project Managers and Admins work in any project; Viewers are read-only.

### Security decisions

- Passwords hashed with Argon2; minimum 10 characters.
- Access JWT lives 15 minutes; refresh tokens are random, stored only as SHA-256 hashes, rotated on use, and reuse of a rotated token revokes all of that user's sessions.
- Verification, reset and invitation tokens are single-use (atomic claim), hashed at rest, and expire.
- Forgot-password and resend-verification respond identically whether or not the account exists.
- Global rate limit of 100 req/min per IP, 5 req/min on auth endpoints. Helmet, strict CORS, whitelist validation (unknown fields rejected).
- Non-members get 404 on workspace routes so workspace IDs are not enumerable.
- No credentials in the repo; the app refuses to boot with missing env vars or the placeholder JWT secret.
