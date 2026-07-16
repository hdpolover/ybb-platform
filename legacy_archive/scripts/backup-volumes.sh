#!/bin/bash
# Backup Docker volumes

BACKUP_DIR="/home/deploy/backups/volumes"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup volumes
docker run --rm \
  -v ybb-platform_postgres_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine \
  tar -czf "/backup/postgres_volume_$TIMESTAMP.tar.gz" -C /data .

docker run --rm \
  -v ybb-platform_redis_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine \
  tar -czf "/backup/redis_volume_$TIMESTAMP.tar.gz" -C /data .

# Delete old backups
find "$BACKUP_DIR" -name "*_volume_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Docker volumes backup completed: $TIMESTAMP"
