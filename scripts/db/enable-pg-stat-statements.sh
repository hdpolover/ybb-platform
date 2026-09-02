#!/bin/bash
# YBB Platform: enable pg_stat_statements on each Postgres DB.
#
# shared_preload_libraries=pg_stat_statements (set via each docker-compose.dokploy.yml
# command block) only loads the shared library; the extension itself still
# needs CREATE EXTENSION run once per database by a superuser/owner, and only
# after the container has been recreated with that setting active. Run this
# after each compose deploy that changed the command block.
#
# Reads POSTGRES_USER/POSTGRES_DB from inside each container's own env
# (already set by Dokploy from the compose `environment:` block), so no host
# shell setup is required beyond having docker access to the VPS.
#
# Usage: ./scripts/db/enable-pg-stat-statements.sh

set -euo pipefail

for container in ybb-prod-postgres-api ybb-prod-postgres-payment ybb-prod-postgres-file; do
  echo "==> $container"
  docker exec -i "$container" sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"'
done
