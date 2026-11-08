#!/usr/bin/env bash
# Quick check that a deployment is serving the app and that the API sits behind authentication.
# Usage: scripts/smoke.sh https://devforge.example.com
set -euo pipefail
base="${1:?Usage: $0 <base-url>}"
base="${base%/}"
fail=0

check() { # name, expected status, url
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$3" || echo 000)
  if [[ "$code" == "$2" ]]; then echo "ok    $1 ($code)"; else echo "FAIL  $1: expected $2, got $code"; fail=1; fi
}

check "frontend serves the app"        200 "$base/"
check "frontend health"                200 "$base/healthz"
check "API is up and requires sign-in" 401 "$base/api/v1/workspaces"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$base/metrics" || echo 000)
body=$(curl -s --max-time 15 "$base/metrics" | head -c 200 || true)
if grep -q "http_request_duration_seconds" <<<"$body"; then echo "FAIL  metrics are exposed publicly"; fail=1; else echo "ok    metrics are not public ($code)"; fi

exit $fail
