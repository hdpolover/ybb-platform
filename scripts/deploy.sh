#!/bin/bash

# ===========================================
# YBB Platform - Manual Deployment Script
# ===========================================
# Use this for manual deployments or as a webhook target
# Usage: ./deploy.sh [tag]

set -e

# Configuration
APP_DIR="/opt/ybb-platform"
COMPOSE_FILE="docker-compose.vps.yml"
IMAGE_TAG="${1:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting deployment...${NC}"

cd $APP_DIR

# Source environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}❌ .env file not found!${NC}"
    exit 1
fi

# Update IMAGE_TAG
export IMAGE_TAG=$IMAGE_TAG

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest images...${NC}"
docker-compose -f $COMPOSE_FILE pull

# Backup database before deployment (optional)
echo -e "${YELLOW}💾 Creating pre-deployment backup...${NC}"
./backup.sh 2>/dev/null || echo "Skipping backup (database might not be running)"

# Deploy with zero-downtime
echo -e "${YELLOW}🔄 Deploying services...${NC}"
docker-compose -f $COMPOSE_FILE up -d --remove-orphans

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 15

# Health check
echo -e "${YELLOW}🏥 Running health checks...${NC}"
if curl -sf http://localhost:4000/health > /dev/null; then
    echo -e "${GREEN}✅ API Gateway is healthy${NC}"
else
    echo -e "${RED}⚠️ API Gateway health check failed${NC}"
fi

if curl -sf http://localhost:4001 > /dev/null; then
    echo -e "${GREEN}✅ Admin Dashboard is healthy${NC}"
else
    echo -e "${RED}⚠️ Admin Dashboard health check failed${NC}"
fi

# Cleanup old images
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -af --filter "until=24h"

# Show running containers
echo -e "\n${GREEN}📊 Running containers:${NC}"
docker-compose -f $COMPOSE_FILE ps

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
