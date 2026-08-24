#!/bin/sh
set -eu
base_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$base_dir/../.." && pwd)
compose="docker compose -f $base_dir/e2e-compose.yml -p switchbook-partner-e2e"
cleanup() { $compose down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
$compose up -d --wait
export DATABASE_URL=postgresql://partner_e2e:partner_e2e_password@127.0.0.1:55432/partner_e2e
cd "$repo_dir"
npx prisma migrate deploy >/dev/null
npx tsx tests/idempotency.e2e.ts
