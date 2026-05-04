#!/bin/sh
set -e

echo "🧹 Running prestart notification RabbitMQ queue migration cleanup..."
/app/rabbitmq-queue-cleanup.sh

echo "🚀 Starting notification service..."
exec "$@"
