# Database Dump & Restore Guide

This directory contains a "Golden State" database dump of the YBB Platform API, captured after the initial heavy migration of ~225k users.

## 📂 Contents

- `ybb_platform_db_backup_cutoff_20260208.sql`: The SQL dump file (PostgreSQL).
- `restore-dump.sh`: A helper script to restore this dump into a Docker container.

## 🚀 How to Use in Production/Staging

Instead of running the full migration script (which takes hours), follow this process:

### 1. Start the Services
Ensure your PostgreSQL container is running.
```bash
docker-compose up -d postgres-api
```

### 2. Restore the Dump
Run the restore script. It defaults to the `ybb-postgres-api` container and `ybb_platform_db` database.
```bash
cd deploy/database-dump
./restore-dump.sh
```

**Note:** This will OVERWRITE the existing database in the container with the dump state.

### 3. Run Incremental Migration
After restoring, you likely have new users that registered *after* the dump was created. 
Navigate to the API service and run the incremental migration script.

```bash
cd ../../services/api
./run-incremental-migration.sh
```
This script automatically detects the last migrated record in the restored DB and resumes fetching new data from the remote source.

## 📅 Dump Details
- **Date**: Feb 8, 2026
- **Content**: Users, Participants, Applications, Program Content, Brand Metadata.
- **Records**: ~225k Users.
