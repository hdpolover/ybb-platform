#!/bin/bash
# =============================================================================
# YBB Platform - PostgreSQL Restore Script
# =============================================================================
# This script restores a PostgreSQL database from a backup.
#
# Usage:
#   ./restore.sh backup_name.sql.gz
#
# WARNING: This will DROP and recreate the database!
# =============================================================================

set -e

# Configuration
BACKUP_DIR="$(dirname "$0")/backups"
CONTAINER_NAME="${POSTGRES_CONTAINER:-ybb-postgres}"
DATABASE_NAME="${DATABASE_NAME:-ybb_db}"
DATABASE_USER="${DATABASE_USER:-ybb_user}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check arguments
if [ -z "$1" ]; then
    log_error "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists (try with and without path)
if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="${BACKUP_DIR}/$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $1"
    exit 1
fi

log_warn "=============================================="
log_warn "WARNING: This will DROP and recreate the database!"
log_warn "Database: $DATABASE_NAME"
log_warn "Backup: $BACKUP_FILE"
log_warn "=============================================="
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    # Try production container name
    CONTAINER_NAME="ybb-postgres-prod"
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "PostgreSQL container is not running!"
        exit 1
    fi
fi

log_info "Starting database restore..."

# Drop existing connections
log_info "Terminating existing connections..."
docker exec "$CONTAINER_NAME" psql -U "$DATABASE_USER" -d postgres -c "
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$DATABASE_NAME'
  AND pid <> pg_backend_pid();" 2>/dev/null || true

# Drop and recreate database
log_info "Recreating database..."
docker exec "$CONTAINER_NAME" psql -U "$DATABASE_USER" -d postgres -c "DROP DATABASE IF EXISTS $DATABASE_NAME;"
docker exec "$CONTAINER_NAME" psql -U "$DATABASE_USER" -d postgres -c "CREATE DATABASE $DATABASE_NAME OWNER $DATABASE_USER;"

# Restore from backup
log_info "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DATABASE_USER" -d "$DATABASE_NAME"

if [ $? -eq 0 ]; then
    log_info "Restore completed successfully!"
else
    log_error "Restore failed!"
    exit 1
fi

log_info "Done!"
