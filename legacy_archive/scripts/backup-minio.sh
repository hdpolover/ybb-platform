#!/bin/bash
# Backup MinIO buckets

BACKUP_DIR="/home/deploy/backups/storage"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory
mkdir -p "$BACKUP_DIR/$TIMESTAMP"

# Backup each bucket
for bucket in images documents avatars certificates uploads; do
    docker exec ybb-minio-prod mc mirror --preserve local/$bucket "$BACKUP_DIR/$TIMESTAMP/$bucket"
done

# Compress backup
tar -czf "$BACKUP_DIR/minio_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$BACKUP_DIR/$TIMESTAMP"

# Delete old backups
find "$BACKUP_DIR" -name "minio_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "MinIO backup completed: $TIMESTAMP"
