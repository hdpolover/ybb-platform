#!/bin/bash
set -e

echo "🚀 Starting automatic database seeding (v1.1)..."
echo "📂 Script Location: $0"
echo "👤 Current User: $(whoami)"
echo "📅 Date: $(date)"

if [ "$1" == "--force" ]; then
    echo "⚠️ Force flag detected. Bypassing safety check."
    echo "🧹 Clearing existing database schema..."
    # Explicitly print the action to verify the script version
    echo "DEBUG: Running DROP SCHEMA public CASCADE;"
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
elif [ "$ENABLE_DB_SEEDING" != "true" ]; then
    echo "🚫 DB Seeding is disabled (ENABLE_DB_SEEDING is not 'true'). Skipping."
    exit 0
fi

DUMP_DIR="/tmp/dumps"
DB_USER="$POSTGRES_USER"
DB_NAME="$POSTGRES_DB"
DUMP_PREFIX="ybb_platform_db_backup_cutoff_20260208.sql.gz.part-"

echo "🔍 Debugging: Contents of $DUMP_DIR:"
ls -la "$DUMP_DIR" || echo "❌ Cannot list $DUMP_DIR"

# Check if we have the split files
if ls "$DUMP_DIR/$DUMP_PREFIX"* 1> /dev/null 2>&1; then
    echo "🧩 Found split gzipped SQL parts: $DUMP_DIR/$DUMP_PREFIX*"
    
    echo "📥 Importing dump from split files..."
    cat "$DUMP_DIR/$DUMP_PREFIX"* | gunzip -c | psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME"
    
    echo "✅ Database seeded successfully from split dump."
else
    echo "⚠️ No split dump files found matching prefix '$DUMP_DIR/$DUMP_PREFIX'. Skipping seeding."
fi
