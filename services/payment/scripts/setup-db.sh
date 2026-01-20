#!/bin/bash

# Payment Service Database Setup Script
# Run this after starting PostgreSQL container

set -e

echo "🔧 Setting up Payment Service Database..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker exec ybb-postgres pg_isready -U ybb_user > /dev/null 2>&1; do
  sleep 1
done

echo "✅ PostgreSQL is ready"

# Run migration
echo "📦 Running payment service migrations..."
docker exec ybb-postgres psql -U ybb_user -d ybb_payments_db -f /docker-entrypoint-initdb.d/payment_schema.sql

echo "✅ Payment database setup complete!"
echo ""
echo "Database Details:"
echo "  - Database: ybb_payments_db"
echo "  - Host: localhost (or postgres in Docker)"
echo "  - Port: 5432"
echo "  - User: ybb_user"
echo ""
echo "Connection String:"
echo "  postgresql://ybb_user:ybb_pass@localhost:5432/ybb_payments_db"
