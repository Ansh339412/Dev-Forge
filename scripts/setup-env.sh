#!/usr/bin/env bash
# Creates .env from .env.example with freshly generated random secrets.
# Usage: scripts/setup-env.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env && "${1:-}" != "--force" ]]; then
  echo ".env already exists. Re-run with --force to overwrite it." >&2
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }

pg_password=$(openssl rand -hex 16)
jwt_secret=$(openssl rand -hex 32)
s3_key=$(openssl rand -hex 8)
s3_secret=$(openssl rand -hex 16)
grafana_password=$(openssl rand -hex 12)

cp .env.example .env
sed -i.bak \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pg_password}|" \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://devforge:${pg_password}@localhost:5432/devforge?schema=public|" \
  -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${jwt_secret}|" \
  -e "s|^S3_ACCESS_KEY_ID=.*|S3_ACCESS_KEY_ID=${s3_key}|" \
  -e "s|^S3_SECRET_ACCESS_KEY=.*|S3_SECRET_ACCESS_KEY=${s3_secret}|" \
  -e "s|^GRAFANA_ADMIN_PASSWORD=.*|GRAFANA_ADMIN_PASSWORD=${grafana_password}|" \
  .env
rm -f .env.bak
chmod 600 .env
echo "Created .env with generated secrets. Never commit it."
