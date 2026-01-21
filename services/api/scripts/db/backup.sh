#!/bin/bash
# =============================================================================
# YBB Platform - PostgreSQL Backup Script
# =============================================================================
# This script creates a backup of the PostgreSQL database.
# 
# Usage:
#   ./backup.sh                    # Creates backup with timestamp
#   ./backup.sh custom_name        # Creates backup with custom name
#
# Backups are stored in: infrastructure/postgres/backups/
# =============================================================================

set -e

# Configuration
BACKUP_DIR="$(dirname "$0")/backups"
CONTAINER_NAME="${POSTGRES_CONTAINER:-ybb-postgres}"
DATABASE_NAME="${DATABASE_NAME:-ybb_db}"
DATABASE_USER="${DATABASE_USER:-ybb_user}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="${1:-backup_${TIMESTAMP}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

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

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log_info "Starting PostgreSQL backup..."
log_info "Container: $CONTAINER_NAME"
log_info "Database: $DATABASE_NAME"
log_info "Backup name: $BACKUP_NAME"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    # Try production container name
    CONTAINER_NAME="ybb-postgres-prod"
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "PostgreSQL container is not running!"
        exit 1
    fi
fi

# Create backup
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

log_info "Creating backup: $BACKUP_FILE"

docker exec "$CONTAINER_NAME" pg_dump -U "$DATABASE_USER" "$DATABASE_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "Backup completed successfully!"
    log_info "File: $BACKUP_FILE"
    log_info "Size: $BACKUP_SIZE"
else
    log_error "Backup failed!"
    exit 1
fi

# Cleanup old backups
log_info "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f | wc -l)
log_info "Total backups: $BACKUP_COUNT"

log_info "Done!"
