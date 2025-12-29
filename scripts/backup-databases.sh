#!/bin/bash
# Backup all PostgreSQL databases

BACKUP_DIR="/home/deploy/backups/databases"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup ybb-platform database
docker exec ybb-postgres-prod pg_dump -U ybb_admin ybb_db | gzip > "$BACKUP_DIR/ybb_db_$TIMESTAMP.sql.gz"

# Delete old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Database backup completed: $TIMESTAMP"
