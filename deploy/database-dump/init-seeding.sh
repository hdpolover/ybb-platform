#!/bin/bash
set -e

echo "🚀 Starting automatic database seeding..."

if [ "$ENABLE_DB_SEEDING" != "true" ]; then
    echo "🚫 DB Seeding is disabled (ENABLE_DB_SEEDING is not 'true'). Skipping."
    exit 0
fi

DUMP_DIR="/tmp/dumps"
DB_USER="$POSTGRES_USER"
DB_NAME="$POSTGRES_DB"
DUMP_PREFIX="ybb_platform_db_backup_cutoff_20260208.sql.gz.part-"

# Check if we have the split files
if ls "$DUMP_DIR/$DUMP_PREFIX"* 1> /dev/null 2>&1; then
    echo "🧩 Found split gzipped SQL parts: $DUMP_DIR/$DUMP_PREFIX*"
    
    echo "📥 Importing dump from split files..."
    cat "$DUMP_DIR/$DUMP_PREFIX"* | gunzip -c | psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME"
    
    echo "✅ Database seeded successfully from split dump."
else
    echo "⚠️ No split dump files found matching prefix '$DUMP_DIR/$DUMP_PREFIX'. Skipping seeding."
fi
