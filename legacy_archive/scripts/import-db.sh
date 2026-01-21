#!/bin/bash

# Configuration
CONTAINER_NAME="ybb-postgres"
DB_USER="ybb_user"
DB_NAME="ybb_db"

if [ -z "$1" ]; then
    echo "Usage: ./import-db.sh <dump_file.sql>"
    exit 1
fi

DUMP_FILE="$1"

# Check if file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "Error: File $DUMP_FILE not found."
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "Error: Container $CONTAINER_NAME is not running."
    exit 1
fi

echo "⚠️  WARNING: This will overwite the existing database '$DB_NAME' in '$CONTAINER_NAME'."
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo "Importing database from '$DUMP_FILE'..."

# Drop and recreate schema (simplest way to ensure clean state)
# Note: We pipe the file into docker exec
cat "$DUMP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Database imported successfully."
else
    echo "❌ Error importing database."
fi
