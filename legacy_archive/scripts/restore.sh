#!/bin/bash

# YBB Platform - Database Restore

set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# List available backups
echo "Available backups:"
ls -lht infrastructure/postgres/backups/ybb_backup_*.sql.gz | head -10

echo ""
read -p "Enter backup filename to restore (e.g., ybb_backup_20251111_120000.sql.gz): " BACKUP_FILE

BACKUP_PATH="infrastructure/postgres/backups/${BACKUP_FILE}"

if [ ! -f ${BACKUP_PATH} ]; then
    echo "ERROR: Backup file not found: ${BACKUP_PATH}"
    exit 1
fi

echo ""
echo "WARNING: This will overwrite the current database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo ""
echo "Decompressing backup..."
gunzip -c ${BACKUP_PATH} > /tmp/restore.sql

echo "Restoring database..."
docker-compose exec -T postgres psql -U ${DATABASE_USER} -d ${DATABASE_NAME} < /tmp/restore.sql

# Clean up
rm /tmp/restore.sql

echo ""
echo "Database restored successfully from ${BACKUP_FILE}"
