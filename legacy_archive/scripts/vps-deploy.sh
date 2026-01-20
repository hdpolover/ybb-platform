#!/bin/bash

# Navigate to the project root directory (one level up from scripts)
cd "$(dirname "$0")/.." || exit 1

# Force Docker BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "🚀 Starting Deployment with BuildKit..."

# Check if "docker compose" is available (v2)
if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "🐳 Using: $COMPOSE_CMD"

# Build and start containers
$COMPOSE_CMD -f docker-compose.prod.yml up -d --build

# Prune old images to save space (optional)
docker image prune -f

echo "✅ Services are running!"

echo "📜 Tailing logs... (Press Ctrl+C to stop watching logs, services will keep running)"
$COMPOSE_CMD -f docker-compose.prod.yml logs -f
