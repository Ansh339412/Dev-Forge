# Architecture

## System overview

```mermaid
flowchart LR
  user([Browser]) -->|HTTPS| ingress[Ingress / nginx]
  ingress -->|/| fe[Frontend: static React app]
  ingress -->|/api, /socket.io| be

  subgraph be[Backend: NestJS modular monolith]
    direction TB
    auth[auth] --- users[users] --- ws[workspaces]
    proj[projects] --- tasks[tasks, comments, labels] --- att[attachments]
    notif[notifications] --- rt[realtime: Socket.IO] --- ana[analytics]
    integ[integrations: GitHub] --- act[activity log]
  end

  be --> pg[(PostgreSQL)]
  be --> redis[(Redis)]
  be --> s3[(S3-compatible storage)]
  be -->|email| mail[Resend API / SMTP]
  be -->|commits| gh[GitHub API]
  prom[Prometheus] -->|:9100/metrics| be
  graf[Grafana] --> prom
```

Metrics are served on a separate port (9100) that the ingress never routes to.

## Modules and how they talk

Modules own their controllers, services and DTOs and use each other only through exported services or **domain events** (`src/common/events.ts`), so any module can later become a service:

| Event | Emitted by | Consumed by |
|---|---|---|
| `task.assigned`, `task.commented`, `project.updated`, `invitation.created` | tasks, comments, projects, invitations | notifications (in-app + email) |
| `notification.created`, `task.changed` | notifications, tasks | realtime gateway (Socket.IO push) |
| `files.orphaned` | tasks, projects, workspaces | attachments (deletes stored files) |

## Request flow: authorisation

1. Global `JwtAuthGuard` authenticates every route except those marked `@Public()`; the user is reloaded from the database on each request.
2. `WorkspaceRolesGuard` (on `workspaces/:workspaceId/...` routes) checks membership and the minimum role. Non-members get 404.
3. Services add the finer rules (project manager vs admin, developers only in projects they belong to).

## Data model

```mermaid
erDiagram
  users ||--o{ sessions : has
  users ||--o{ user_tokens : has
  users ||--o{ workspace_members : joins
  workspaces ||--o{ workspace_members : has
  workspaces ||--o{ workspace_invitations : has
  users ||--o{ workspace_invitations : sends
  workspaces ||--o{ projects : contains
  users ||--o{ projects : manages
  projects ||--o{ project_members : has
  users ||--o{ project_members : is
  projects ||--o{ tasks : contains
  users |o--o{ tasks : "assigned to"
  tasks ||--o{ comments : has
  users ||--o{ comments : writes
  tasks ||--o{ attachments : has
  tasks ||--o{ task_labels : tagged
  labels ||--o{ task_labels : applied
  workspaces ||--o{ labels : owns
  users ||--o{ notifications : receives
  projects ||--o{ github_repositories : links
  projects ||--o{ activity_logs : records
  workspaces ||--o{ activity_logs : records

  users { uuid id PK
    text email UK
    text passwordHash
    enum systemRole
    timestamp emailVerifiedAt
    bool emailNotifications }
  sessions { uuid id PK
    text refreshTokenHash UK
    timestamp expiresAt
    timestamp revokedAt }
  workspaces { uuid id PK
    text name
    text slug UK }
  workspace_members { uuid id PK
    enum role }
  projects { uuid id PK
    enum status
    enum priority
    timestamp deadline
    uuid managerId FK }
  tasks { uuid id PK
    enum status
    enum priority
    float position
    timestamp dueDate
    uuid assigneeId FK }
  attachments { uuid id PK
    text fileName
    int sizeBytes
    text storageKey UK }
  notifications { uuid id PK
    enum type
    timestamp readAt
    text dedupeKey }
```

Indexes follow the access patterns: `tasks(projectId, status, position)` for the board, `tasks(assigneeId)` and `tasks(dueDate)` for dashboards and reminders, `activity_logs(projectId, createdAt)` for history, `notifications(userId, readAt, createdAt)` for the bell, and unique token hashes for single-use links.

## Key decisions

- **Modular monolith** first; events and exported services mark the future seams.
- **Kanban order** is a `Float position` per task: a drop writes one row (midpoint of the neighbours) and a column is renumbered only when neighbours get too close.
- **Refresh tokens** are random, stored hashed, rotated on use; replaying a used token revokes the whole user's sessions.
- **Single-use links** (verify, reset, invite) are claimed atomically with `updateMany ... where usedAt is null`, so two requests cannot both succeed.
- **Uploads** pass through the API (size/type checked, random storage keys); downloads are short-lived presigned links that force a download.
- **Migrations** are a separate deploy step (Kubernetes Job / Helm hook), never run by app pods at startup.
