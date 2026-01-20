#!/bin/bash

# YBB Platform - Database Backup

set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Create backup directory if it doesn't exist
mkdir -p infrastructure/postgres/backups

# Generate backup filename with timestamp
BACKUP_FILE="infrastructure/postgres/backups/ybb_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "Creating database backup..."
docker-compose exec -T postgres pg_dump -U ${DATABASE_USER} ${DATABASE_NAME} > ${BACKUP_FILE}

# Compress the backup
gzip ${BACKUP_FILE}

echo ""
echo "Backup created successfully:"
echo "${BACKUP_FILE}.gz"
echo ""

# Keep only the last 10 backups
echo "Cleaning up old backups (keeping last 10)..."
cd infrastructure/postgres/backups
ls -t ybb_backup_*.sql.gz | tail -n +11 | xargs -r rm
cd - > /dev/null

echo "Backup completed!"
