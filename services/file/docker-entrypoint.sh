#!/bin/sh
set -e

echo "🔄 Generating Prisma Client..."
prisma generate

echo "🗄️  Running database migrations..."
prisma migrate deploy

echo "🚀 Starting gRPC server (background)..."
python -m app.grpc_main &

echo "🚀 Starting application..."
exec "$@"
