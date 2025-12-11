# PostgreSQL Backups
# ==================
# This directory stores database backups created by backup.sh
#
# Backup naming convention:
#   backup_YYYYMMDD_HHMMSS.sql.gz
#
# To create a backup:
#   cd infrastructure/postgres
#   ./backup.sh
#
# To restore a backup:
#   ./restore.sh backup_20231211_143000.sql.gz
#
# Backups older than 30 days are automatically deleted.
# Adjust BACKUP_RETENTION_DAYS in backup.sh to change this.
