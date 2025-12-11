#!/bin/bash

# YBB Platform - Seed Database

set -e

echo "=================================="
echo "Seeding Database with Sample Data"
echo "=================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Check if PostgreSQL is running
if ! docker-compose ps postgres | grep "Up" > /dev/null; then
    echo "ERROR: PostgreSQL is not running"
    echo "Run 'make dev' first to start services"
    exit 1
fi

echo "Seeding users..."
docker-compose exec -T postgres psql -U ${DATABASE_USER} -d ${DATABASE_NAME} < database/seeds/users.sql

echo "Seeding programs..."
docker-compose exec -T postgres psql -U ${DATABASE_USER} -d ${DATABASE_NAME} < database/seeds/programs.sql

echo ""
echo "=================================="
echo "Database seeding completed!"
echo "=================================="
echo ""
echo "Default admin credentials:"
echo "  Email: admin@ybbhub.com"
echo "  Password: Admin123!"
echo ""
echo "Test user credentials:"
echo "  Email: user@ybbhub.com"
echo "  Password: Admin123!"
echo ""
