#!/bin/sh
set -e

echo "🔄 Generating Prisma Client..."
prisma generate

echo "🗄️  Running database migrations..."
prisma migrate deploy

echo "🚀 Starting application..."
exec "$@"
