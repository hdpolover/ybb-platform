#!/bin/bash

# Configuration
CONTAINER_NAME="ybb-postgres"
DB_USER="ybb_user" # Default, will be overridden by env if set in compose, but good fallback
DB_NAME="ybb_db" # Default, adjust if needed
OUTPUT_FILE="ybb_db_dump_$(date +%Y%m%d_%H%M%S).sql"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "Error: Container $CONTAINER_NAME is not running."
    exit 1
fi

echo "Exporting database '$DB_NAME' from container '$CONTAINER_NAME'..."

# Execute pg_dump inside the container
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -F p > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Database exported successfully to: $OUTPUT_FILE"
    echo "You can share this file with other developers."
else
    echo "❌ Error exporting database."
    # Remove empty file if failed
    [ -f "$OUTPUT_FILE" ] && rm "$OUTPUT_FILE"
fi
