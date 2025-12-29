#!/bin/bash
# Master backup script

LOG_FILE="/home/deploy/backups/backup.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "================================" | tee -a "$LOG_FILE"
echo "Backup started: $(date)" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"

# Run all backup scripts
~/scripts/backup-databases.sh 2>&1 | tee -a "$LOG_FILE"
~/scripts/backup-minio.sh 2>&1 | tee -a "$LOG_FILE"
~/scripts/backup-volumes.sh 2>&1 | tee -a "$LOG_FILE"

echo "================================" | tee -a "$LOG_FILE"
echo "Backup completed: $(date)" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
