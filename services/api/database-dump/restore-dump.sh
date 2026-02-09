#!/bin/bash

# ybb-platform/deploy/database-dump/restore-dump.sh

# Usage: ./restore-dump.sh [CONTAINER_NAME] [DB_USER] [DB_NAME] [DUMP_FILE]

CONTAINER_NAME=${1:-"ybb-postgres-api"}
DB_USER=${2:-"ybb_user"}
DB_NAME=${3:-"ybb_platform_db"}
DUMP_FILE=${4:-"ybb_platform_db_backup_migrated_20260209.sql"}

# Check for file existence (plain, gz, or split parts)
USE_SPLIT=false
USE_GZ=false

if [ -f "$DUMP_FILE" ]; then
    echo "📄 Found plain SQL file: $DUMP_FILE"
elif [ -f "${DUMP_FILE}.gz" ]; then
    echo "📦 Found gzipped SQL file: ${DUMP_FILE}.gz"
    USE_GZ=true
elif ls "${DUMP_FILE}.gz.part-"* 1> /dev/null 2>&1; then
    echo "🧩 Found split gzipped SQL parts: ${DUMP_FILE}.gz.part-*"
    USE_SPLIT=true
else
    echo "❌ Dump file '${DUMP_FILE}' (or .gz / .gz.part-*) not found!"
    exit 1
fi

echo "🚀 Restoring Database '$DB_NAME' inside container '$CONTAINER_NAME'..."

# Option A: using psql via docker exec (piping file content)
# Check if container is running
if [ "$(docker inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>/dev/null)" != "true" ]; then
    echo "❌ Container '$CONTAINER_NAME' is not running!"
    exit 1
fi

echo "🧹 Clearing existing database schema..."
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "📥 Importing dump..."

if [ "$USE_SPLIT" = true ]; then
    cat "${DUMP_FILE}.gz.part-"* | gunzip -c | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
elif [ "$USE_GZ" = true ]; then
    gunzip -c "${DUMP_FILE}.gz" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
else
    cat "$DUMP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
fi

if [ $? -eq 0 ]; then
    echo "✅ Database restore completed successfully."
else
    echo "❌ Database restore failed."
    exit 1
fi
