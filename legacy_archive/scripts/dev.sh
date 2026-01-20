#!/bin/bash

# YBB Platform - Start Development Environment

set -e

echo "Starting YBB Platform Development Environment..."

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Start all services
docker-compose up -d

echo ""
echo "Services are starting..."
echo ""

# Wait for services to be healthy
sleep 5

echo "Service Status:"
docker-compose ps

echo ""
echo "=================================="
echo "YBB Platform is running!"
echo "=================================="
echo ""
echo "Access points:"
echo "  Admin Dashboard:      http://localhost:4001"
echo "  API Gateway:          http://localhost:4000"
echo "  API Docs:             http://localhost:4000/api/docs"
echo "  Payment Service:      http://localhost:8002"
echo "  File Service:         http://localhost:8001"
echo "  File Docs:            http://localhost:8001/docs"
echo "  Notification Service: http://localhost:4002"
echo "  MinIO Console:        http://localhost:9001"
echo "  RabbitMQ:             http://localhost:15672"
echo "  Grafana:              http://localhost:43000"
echo "  Prometheus:           http://localhost:49090"
echo ""
echo "Database:"
echo "  PostgreSQL:      localhost:5432"
echo "  Redis:           localhost:6379"
echo ""
echo "Run 'make logs' to view logs"
echo "Run 'make stop' to stop all services"
echo ""
