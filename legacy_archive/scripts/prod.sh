#!/bin/bash

# YBB Platform - Production Deployment

set -e

echo "=================================="
echo "YBB Platform - Production Deployment"
echo "=================================="
echo ""

# Check if production .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create a production .env file before deploying."
    exit 1
fi

# Load environment variables
source .env

# Ensure we're using production environment
export NODE_ENV=production
export GO_ENV=production
export PYTHON_ENV=production

echo "Building production images..."
docker-compose -f docker-compose.prod.yml build

echo ""
echo "Stopping existing services..."
docker-compose -f docker-compose.prod.yml down

echo ""
echo "Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T api npm run migration:run || true

echo ""
echo "=================================="
echo "Production deployment completed!"
echo "=================================="
echo ""
echo "Run 'docker-compose -f docker-compose.prod.yml ps' to check service status"
echo "Run 'docker-compose -f docker-compose.prod.yml logs -f' to view logs"
echo ""
