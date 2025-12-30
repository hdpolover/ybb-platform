#!/bin/bash

# YBB Platform - Safe Start Script
# This script ensures all prerequisites are met before starting the system.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   YBB Platform - Safe Start System   ${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 1. Check Prerequisites
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH.${NC}"
    exit 1
fi
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose is available${NC}"

# Check .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}! .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env created${NC}"
        echo -e "${YELLOW}! Please review .env configuration before proceeding in production.${NC}"
    else
        echo -e "${RED}Error: .env.example not found. Cannot create config.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# 2. Build Images
echo -e "${YELLOW}[2/6] Building Docker images...${NC}"
echo "This may take a while..."
docker-compose build
echo -e "${GREEN}✓ Build complete${NC}"

# 3. Start Infrastructure
echo -e "${YELLOW}[3/6] Starting infrastructure services...${NC}"
docker-compose up -d postgres redis rabbitmq minio

echo "Waiting for database to be ready..."
RETRIES=30
until docker-compose exec -T postgres pg_isready -U ${DATABASE_USER:-ybb_user} > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    sleep 2
    RETRIES=$((RETRIES-1))
done
echo ""

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}Error: Database failed to start.${NC}"
    docker-compose logs postgres
    exit 1
fi
echo -e "${GREEN}✓ Infrastructure is ready${NC}"

# 4. Run Migrations
echo -e "${YELLOW}[4/6] Running database migrations...${NC}"

# API Service Migrations (Prisma)
echo "Running API migrations (Prisma)..."
if docker-compose run --rm api npx prisma migrate deploy; then
    echo -e "${GREEN}✓ API migrations applied${NC}"
else
    echo -e "${RED}Error: API migrations failed.${NC}"
    exit 1
fi

# Payment Service and File Service handle their own migrations on startup,
# but we rely on them starting successfully in the next step.

# 5. Start Application Services
echo -e "${YELLOW}[5/6] Starting application services...${NC}"
docker-compose up -d

# 6. Health Check & Status
echo -e "${YELLOW}[6/6] Verifying services...${NC}"
sleep 5
docker-compose ps

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}   YBB Platform Started Successfully  ${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "Access Points:"
echo -e "  ${BLUE}Admin Dashboard:${NC} http://localhost:4001"
echo -e "  ${BLUE}API Gateway:${NC}     http://localhost:4000"
echo -e "  ${BLUE}Payment Service:${NC} http://localhost:8002"
echo -e "  ${BLUE}File Service:${NC}    http://localhost:8001"
echo -e "  ${BLUE}MinIO Console:${NC}   http://localhost:9001"
echo ""
echo -e "Useful Commands:"
echo -e "  make logs    - View logs"
echo -e "  make stop    - Stop all services"
echo -e "  make restart - Restart all services"
echo ""
