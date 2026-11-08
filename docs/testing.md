# Testing

| Layer | Tool | Where | What it covers |
|---|---|---|---|
| Unit | Jest | `backend/src/**/*.spec.ts` | token hashing, login rules, Kanban ordering, analytics series, GitHub repo parsing |
| API end-to-end | Jest + Supertest | `backend/test/app.e2e-spec.ts` | sign-up and email verification (single-use tokens), login rules, workspace/project/task flow, Kanban reordering, completion percentages, dashboard totals, non-member 404, viewer role limits, invitations (right and wrong email), last-admin protection, refresh rotation and replay revocation, health probes |
| Unit | Vitest | `frontend/src/lib/*.test.ts` | drag-and-drop move calculation, role and project-edit permissions, activity sentences, API error messages |
| Component | Vitest + React Testing Library | `frontend/src/**/*.test.tsx` | sign-in errors and the resend-verification offer, single-use verification token spent once under StrictMode, auth redirect and loading state, accessible progress bars and labelled fields |
| Browser | Playwright | `e2e/tests/smoke.spec.ts` | register, verify through MailHog, sign in, create workspace and project, add a task, move it between columns |

## Running

```bash
# Backend unit tests (after `npx prisma generate`)
cd backend && npm test

# Backend API e2e: needs a migrated Postgres and Redis
docker compose up -d postgres redis
export DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db>?schema=public"
export REDIS_URL=redis://localhost:6379
npx prisma migrate deploy && npm run test:e2e

# Frontend
cd frontend && npm test

# Browser tests against the full stack
bash scripts/setup-env.sh && docker compose up -d --build
cd e2e && npm install && npx playwright install chromium && npx playwright test
```

The e2e tests replace the mail service with an in-memory outbox, switch rate limiting off (`THROTTLE_DISABLED`, which the app refuses to boot with in production), and disable the metrics port.

## Test report

**No results are recorded yet.** The test suites have not been executed against dependencies in the authoring environment; only these were run standalone: Kanban position logic, drag-and-drop move logic, role comparison, project-edit permission rule, activity sentences, daily series builder, GitHub repository parsing, and the setup script. After your first CI run, paste the summary here:

| Suite | Passed | Failed | Skipped | Duration | Date |
|---|---|---|---|---|---|
| Backend unit | | | | | |
| Backend API e2e | | | | | |
| Frontend unit | | | | | |
| Playwright | | | | | |

Not covered yet: component tests for the board, task drawer and dashboard, tests for the GitHub and Resend integrations (they need HTTP mocking), load testing, and accessibility audits.
