#!/bin/bash

# Force Docker BuildKit for faster builds and to suppress legacy warnings
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "🚀 Starting Deployment with BuildKit..."

# Build and start containers
docker-compose -f docker-compose.prod.yml up -d --build

# Prune old images to save space (optional)
docker image prune -f

echo "✅ Services are running!"
