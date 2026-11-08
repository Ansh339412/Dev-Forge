# Put DevForge online (single server)

The quickest real deployment: one Linux server running everything with Docker Compose, with HTTPS handled
automatically by Caddy. A 2 GB RAM server is enough for a demo or a small team. Kubernetes (see
`docs/kubernetes.md`) is the heavier option for later.

## Before you start (on your own computer)

1. Run the app locally once (`docker compose up --build -V`) and fix anything that breaks. Do not deploy something that has never started.
2. Commit the Prisma migrations and the three `package-lock.json` files:
   `docker compose run --rm --no-deps backend sh scripts/gen-initial-migration.sh`
3. Push the project to a Git repository (or keep the folder to copy to the server).

## What you need to have

| Item | Why | Easy option |
|---|---|---|
| A server (Ubuntu 22.04+, 2 GB RAM) | runs the stack | any VPS provider |
| A domain name | HTTPS certificate | your own domain, or free `<server-ip-with-dashes>.sslip.io` (for 203.0.113.7 use `203-0-113-7.sslip.io`) |
| An S3-compatible bucket | file attachments | Cloudflare R2, Backblaze B2 or AWS S3. Keep it private. |
| A Resend API key | verification, reset and invitation emails | resend.com (verify your sending domain) |

## Steps

```bash
# 1. On the server: install Docker, allow only SSH, HTTP and HTTPS
curl -fsSL https://get.docker.com | sh
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# 2. Point your domain's DNS "A" record at the server's IP, then get the code onto the server
git clone <your-repo-url> devforge && cd devforge

# 3. Create .env.prod with random secrets, then fill in the S3 and Resend values it lists
bash scripts/setup-prod-env.sh devforge.example.com
nano .env.prod          # S3_BUCKET, S3_ENDPOINT/S3_PUBLIC_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, RESEND_API_KEY

# 4. Start (the first build takes a few minutes; migrations run automatically before the backend starts)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# 5. Check it
bash scripts/smoke.sh https://devforge.example.com
```

Open your domain, register, and verify with the emailed link. The first account to create a workspace becomes its admin.

## Storage provider notes

- **Cloudflare R2:** `S3_ENDPOINT` and `S3_PUBLIC_ENDPOINT` both `https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=false`.
- **AWS S3:** leave both endpoints empty, set `S3_REGION` (for example `eu-west-1`), use an IAM user limited to that one bucket.
- Downloads use short-lived links that your browser opens directly against the provider, so the public endpoint must be reachable from the internet.

## Running it

| Task | Command |
|---|---|
| Logs | `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend` |
| Update to new code | `git pull && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build` |
| Restart | `... restart backend` |
| Back up the database | `docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_dump -U devforge devforge \| gzip > backup-$(date +%F).sql.gz` |

Run the backup daily (cron) and copy the files off the server. Test a restore at least once.

## Security checklist

- SSH keys only (disable password login), automatic security updates (`unattended-upgrades`).
- `.env.prod` stays on the server with `chmod 600` and is never committed.
- Only ports 80 and 443 are public; Postgres, Redis and the metrics port are not published.
- Keep `ENABLE_SWAGGER=false` unless you need the API docs.

## Troubleshooting

| Symptom | Check |
|---|---|
| Certificate not issued | DNS record must point at this server; ports 80/443 open; `docker compose ... logs caddy` |
| Backend restarting | `logs backend`: usually a missing value in `.env.prod` (the app names the missing variable) |
| `relation ... does not exist` | migrations missing: commit `backend/prisma/migrations` and rebuild; `logs migrate` |
| No emails | `RESEND_API_KEY` and a verified sender domain; `logs backend` shows the provider's response |
| Attachments fail | bucket exists and is private; keys have read/write on it; endpoint values match your provider |
| Everyone rate-limited together | `TRUST_PROXY_HOPS` must be 2 with this stack |

## Limits of this setup

One server means no high availability, and a rebuild causes a few seconds of downtime. Real-time updates work on a single backend instance only. This stack has not been run end to end yet, so expect to fix small issues on the first start.
