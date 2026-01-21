#!/bin/bash
# Simple alert system

EMAIL="your-email@example.com"
HOSTNAME=$(hostname)

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "Disk usage is at $DISK_USAGE%" | mail -s "⚠️ $HOSTNAME: Disk Space Alert" $EMAIL
fi

# Check if containers are running
for container in ybb-postgres-prod ybb-api-prod ybb-program-next; do
    if ! docker ps | grep -q $container; then
        echo "$container is not running" | mail -s "⚠️ $HOSTNAME: Container Down" $EMAIL
    fi
done
