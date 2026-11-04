#!/usr/bin/env bash
# Rebuild the local e2e database from the schema dump and synthetic fixtures.
#
# Requires the docker-compose.e2e.yml stack to be running:
#   docker compose -f docker-compose.e2e.yml up -d --wait
#
# Env overrides:
#   E2E_SCHEMA_SQL   path to a pg_dump --schema-only file (default: latest snapshot in data/db_backup/)
#   E2E_SKIP_SEED=1  load the schema only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="${E2E_SCHEMA_SQL:-$(ls -d "$ROOT"/data/db_backup/*/ | sort | tail -n 1)schema.sql}"
COMPOSE=(docker compose -f "$ROOT/docker-compose.e2e.yml")
# psql runs inside the postgres container so the client is at least as new as
# the server (the dump uses \restrict, which older psql clients reject).
PSQL=("${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -q -U postgres -d deproceduralizer_e2e)

if [[ ! -f "$SCHEMA" ]]; then
  echo "schema file not found: $SCHEMA" >&2
  exit 1
fi

echo "==> Resetting schema from $SCHEMA"
# Never DROP DATABASE here: neon-proxy stores its control-plane table in this
# database at container start. Dropping the public schema is enough.
"${PSQL[@]}" -c 'DROP SCHEMA IF EXISTS public CASCADE;' -c 'CREATE SCHEMA public;'
# The dump uses gin_trgm_ops but does not create the extension itself.
"${PSQL[@]}" -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'

# Strip statements that only make sense for a brand-new database or a newer psql.
sed -e '/^\\restrict /d' \
    -e '/^\\unrestrict /d' \
    -e '/^CREATE SCHEMA public;$/d' \
    -e '/^SET transaction_timeout/d' \
    "$SCHEMA" | "${PSQL[@]}"

if [[ "${E2E_SKIP_SEED:-0}" == "1" ]]; then
  echo "==> Schema loaded (seed skipped)"
  exit 0
fi

echo "==> Seeding synthetic fixtures"
export E2E_DATABASE_URL_DIRECT="${E2E_DATABASE_URL_DIRECT:-postgres://postgres:postgres@localhost:${E2E_PG_PORT:-5432}/deproceduralizer_e2e}"
cd "$ROOT/frontend"
pnpm --filter @deproceduralizer/database seed:e2e
