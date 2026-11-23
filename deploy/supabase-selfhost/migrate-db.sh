#!/usr/bin/env bash
# Dump the cloud database (roles, schema, data incl. auth.users) and restore it
# into the self-hosted instance over an SSH tunnel, then run post-restore.sql.
#
#   ./migrate-db.sh dump      # only dump the cloud DB into ./dump
#   ./migrate-db.sh restore   # only restore ./dump into self-hosted
#   ./migrate-db.sh           # both
#
# Requires: supabase CLI + Docker Desktop running (the CLI runs pg_dump in a container), psql.
set -euo pipefail
cd "$(dirname "$0")"
source .env.migrate

DUMP=dump
TUNNEL_PORT=54329
SELF_DB_URL="postgresql://postgres.${SELF_POOLER_TENANT_ID}:${SELF_POSTGRES_PASSWORD}@localhost:${TUNNEL_PORT}/postgres"

dump() {
  mkdir -p "$DUMP"
  supabase db dump --db-url "$CLOUD_DB_URL" -f "$DUMP/roles.sql" --role-only
  supabase db dump --db-url "$CLOUD_DB_URL" -f "$DUMP/schema.sql"
  supabase db dump --db-url "$CLOUD_DB_URL" -f "$DUMP/data.sql" --use-copy --data-only
  psql "$CLOUD_DB_URL" -X -A -t -f verify.sql > "$DUMP/counts.cloud.txt"
  echo "Dumped to $DUMP/ (row counts in $DUMP/counts.cloud.txt)"
}

open_tunnel() {
  # Supavisor listens on 5432 on the droplet; it is never exposed publicly.
  ssh -f -N -o ExitOnForwardFailure=yes -L "${TUNNEL_PORT}:localhost:5432" "$SSH_HOST"
  trap 'pkill -f "ssh -f -N -o ExitOnForwardFailure=yes -L ${TUNNEL_PORT}:localhost:5432" || true' EXIT
}

restore() {
  open_tunnel
  psql \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --file "$DUMP/roles.sql" \
    --file "$DUMP/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$DUMP/data.sql" \
    --dbname "$SELF_DB_URL"

  psql "$SELF_DB_URL" -X \
    -v old_base="https://${CLOUD_REF}.supabase.co" \
    -v new_base="$SELF_URL" \
    -f post-restore.sql

  psql "$SELF_DB_URL" -X -A -t -f verify.sql > "$DUMP/counts.self.txt"
  if diff "$DUMP/counts.cloud.txt" "$DUMP/counts.self.txt"; then
    echo "Row counts match."
  else
    echo "Row counts differ (storage.objects is expected to be 0 until migrate-storage.sh runs)."
  fi
}

case "${1:-all}" in
  dump) dump ;;
  restore) restore ;;
  all) dump; restore ;;
  *) echo "usage: $0 [dump|restore]"; exit 1 ;;
esac
