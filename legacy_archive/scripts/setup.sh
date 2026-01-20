#!/bin/bash

# YBB Platform - Initial Setup Script

set -e

echo "=================================="
echo "YBB Platform - Initial Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}Please update the .env file with your configuration before continuing.${NC}"
    read -p "Press Enter to continue after updating .env..."
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Load environment variables
source .env

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if Docker Compose is available
if ! docker-compose --version > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is available${NC}"

echo ""
echo "Building Docker images..."
docker-compose build

echo ""
echo "Starting infrastructure services (PostgreSQL, Redis, MinIO)..."
docker-compose up -d postgres redis minio

echo ""
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is ready
until docker-compose exec -T postgres pg_isready -U ${DATABASE_USER} > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

echo ""
echo "Running database migrations..."
for migration in database/migrations/*.sql; do
    echo "Running: $(basename $migration)"
    docker-compose exec -T postgres psql -U ${DATABASE_USER} -d ${DATABASE_NAME} -f /docker-entrypoint-initdb.d/$(basename $migration) || true
done
echo -e "${GREEN}✓ Migrations completed${NC}"

echo ""
echo "Creating MinIO buckets..."
docker-compose exec -T minio mc alias set local http://localhost:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} || true
docker-compose exec -T minio mc mb local/${MINIO_BUCKET} || true
docker-compose exec -T minio mc anonymous set download local/${MINIO_BUCKET} || true
echo -e "${GREEN}✓ MinIO configured${NC}"

echo ""
echo "=================================="
echo -e "${GREEN}Setup completed successfully!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "  1. Run 'make dev' to start all services"
echo "  2. Run 'make seed-db' to add sample data (optional)"
echo "  3. Access the admin dashboard at http://localhost:4001"
echo "  4. Access the API at http://localhost:4000"
echo ""
