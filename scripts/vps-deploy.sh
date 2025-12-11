#!/bin/bash

# Navigate to the project root directory (one level up from scripts)
cd "$(dirname "$0")/.." || exit 1

# Force Docker BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "🚀 Starting Deployment with BuildKit..."

# Build and start containers
docker-compose -f docker-compose.prod.yml up -d --build

# Prune old images to save space (optional)
docker image prune -f

echo "✅ Services are running!"

echo "📜 Tailing logs... (Press Ctrl+C to stop watching logs, services will keep running)"
docker-compose -f docker-compose.prod.yml logs -f
