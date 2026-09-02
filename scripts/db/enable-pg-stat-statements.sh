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
# Container names are resolved at run time, not hardcoded: postgres-payment
# and postgres-file set `container_name:` in their compose files
# (ybb-prod-postgres-payment / ybb-prod-postgres-file), but postgres-api does
# not — Dokploy auto-names it <appName>-postgres-api-1 (compose project
# naming), which differs per deploy/environment.
#
# Usage: ./scripts/db/enable-pg-stat-statements.sh

set -euo pipefail

# resolve_container <label> <docker ps filter args...>
# Fails loudly unless exactly one running container matches the filter.
resolve_container() {
  local label="$1"
  shift
  local -a ids
  mapfile -t ids < <(docker ps -q "$@")
  if [ "${#ids[@]}" -eq 0 ]; then
    echo "ERROR: no running container found for $label (docker ps $*)" >&2
    exit 1
  fi
  if [ "${#ids[@]}" -gt 1 ]; then
    echo "ERROR: multiple running containers matched for $label (docker ps $*): ${ids[*]}" >&2
    exit 1
  fi
  printf '%s' "${ids[0]}"
}

api="$(resolve_container postgres-api --filter 'name=postgres-api-1$')"
payment="$(resolve_container postgres-payment --filter 'name=^ybb-prod-postgres-payment$')"
file="$(resolve_container postgres-file --filter 'name=^ybb-prod-postgres-file$')"

for entry in "postgres-api:$api" "postgres-payment:$payment" "postgres-file:$file"; do
  label="${entry%%:*}"
  container="${entry#*:}"
  echo "==> $label ($container)"
  docker exec -i "$container" sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"'
done
