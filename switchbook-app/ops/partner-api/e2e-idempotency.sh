#!/bin/sh
set -eu
base_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$base_dir/../.." && pwd)
compose="docker compose -f $base_dir/e2e-compose.yml -p switchbook-partner-e2e"
migration_fixture=$(mktemp -d "${TMPDIR:-/tmp}/switchbook-partner-migrations.XXXXXX")
export PARTNER_E2E_DB_PASSWORD="${PARTNER_E2E_DB_PASSWORD:-$(openssl rand -hex 32)}"
cleanup() {
  $compose down -v --remove-orphans >/dev/null 2>&1 || true
  find "$migration_fixture" -depth -delete >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup
$compose up -d --wait
cd "$repo_dir"

# Upgrade gate: deploy the previous migration set, seed a legacy photo job,
# then prove the current migration upgrades it without schema pushes.
mkdir -p "$migration_fixture/migrations"
cp prisma/schema.prisma "$migration_fixture/schema.prisma"
for migration in prisma/migrations/*; do
  if [ "$(basename "$migration")" != "20260823215500_separate_partner_photo_identity" ]; then
    cp -R "$migration" "$migration_fixture/migrations/"
  fi
done
export DATABASE_URL="postgresql://partner_e2e:${PARTNER_E2E_DB_PASSWORD}@127.0.0.1:55432/partner_e2e"
npx prisma migrate deploy --schema "$migration_fixture/schema.prisma" >/dev/null
$compose exec -T postgres psql -U partner_e2e -d partner_e2e -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
SET session_replication_role = replica;
INSERT INTO "PartnerSubmissionPhoto"
  ("id", "submissionId", "sourceUrl", "status", "order", "createdAt", "updatedAt")
VALUES
  ('upgrade-photo', 'upgrade-submission', 'https://images.example.com/legacy.png', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
SET session_replication_role = DEFAULT;
SQL
npx prisma migrate deploy >/dev/null
$compose exec -T postgres psql -U partner_e2e -d partner_e2e -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN \"remoteUrl\" = \"sourceUrl\" THEN 1 ELSE 0 END FROM \"PartnerSubmissionPhoto\" WHERE \"id\" = 'upgrade-photo'" | grep -qx 1
npx prisma migrate status >/dev/null

# Clean-install gate: the complete migration history must also build a fresh DB.
$compose exec -T postgres createdb -U partner_e2e partner_e2e_clean
export DATABASE_URL="postgresql://partner_e2e:${PARTNER_E2E_DB_PASSWORD}@127.0.0.1:55432/partner_e2e_clean"
npx prisma migrate deploy >/dev/null
npx prisma migrate status >/dev/null

# Run behavioral concurrency checks against the upgraded database.
export DATABASE_URL="postgresql://partner_e2e:${PARTNER_E2E_DB_PASSWORD}@127.0.0.1:55432/partner_e2e"
npx prisma generate >/dev/null
npx tsx tests/idempotency.e2e.ts
