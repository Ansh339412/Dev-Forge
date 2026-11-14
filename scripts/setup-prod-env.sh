#!/usr/bin/env bash
# Creates .env.prod for your domain with freshly generated secrets.
# Usage: scripts/setup-prod-env.sh devforge.example.com [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

domain="${1:-}"
if [[ -z "$domain" ]]; then
  echo "Usage: $0 <domain> [--force]   (no https://, e.g. devforge.example.com)" >&2
  exit 1
fi
if [[ -f .env.prod && "${2:-}" != "--force" ]]; then
  echo ".env.prod already exists. Re-run with --force to overwrite it." >&2
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }

cp .env.prod.example .env.prod
sed -i.bak \
  -e "s|devforge\.example\.com|${domain}|g" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|" \
  -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -hex 32)|" \
  .env.prod
rm -f .env.prod.bak
chmod 600 .env.prod

echo "Created .env.prod for https://${domain}"
echo "Now fill in these values in .env.prod before starting:"
grep -nE '^(RESEND_API_KEY|SMTP_USER|SMTP_PASS|S3_BUCKET|S3_ENDPOINT|S3_PUBLIC_ENDPOINT|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY)=$' .env.prod || true
