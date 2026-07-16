#!/bin/bash

# YBB Platform - Health Check

set -e

echo "=================================="
echo "YBB Platform - Health Check"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    SERVICE_NAME=$1
    URL=$2
    
    if curl -f -s -o /dev/null ${URL}; then
        echo -e "${GREEN}✓${NC} ${SERVICE_NAME} is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} ${SERVICE_NAME} is not responding"
        return 1
    fi
}

check_docker_service() {
    SERVICE_NAME=$1
    
    if docker-compose ps ${SERVICE_NAME} | grep "Up" > /dev/null; then
        echo -e "${GREEN}✓${NC} ${SERVICE_NAME} container is running"
        return 0
    else
        echo -e "${RED}✗${NC} ${SERVICE_NAME} container is not running"
        return 1
    fi
}

# Check infrastructure services
echo "Infrastructure Services:"
check_docker_service postgres
check_docker_service redis
check_docker_service minio

echo ""
echo "Application Services:"
check_docker_service api
check_docker_service payment-service
check_docker_service file-service
check_docker_service notification-service
check_docker_service admin-dashboard
check_docker_service nginx

echo ""
echo "HTTP Health Checks:"
check_service "Admin Dashboard" "http://localhost:4001" || true
check_service "API Gateway" "http://localhost:4000/health" || true
check_service "Payment Service" "http://localhost:8002/health" || true
check_service "File Service" "http://localhost:8001/health" || true
check_service "Notification Service" "http://localhost:4002/health" || true

echo ""
echo "=================================="
echo "Health check completed"
echo "=================================="
