# YBB Platform

Monorepo architecture for YBB master platform with microservices managed by Docker.

## Overview

This project is a comprehensive platform for managing YBB (Youth Break the Boundaries) programs, applications, and payments. Built with a microservices architecture using Docker containerization.

## Technology Stack

- **API Gateway**: NestJS (TypeScript)
- **Payment Service**: Golang
- **File Service**: Python (FastAPI)
- **Admin Dashboard**: Next.js 14+
- **Database**: PostgreSQL 16
- **Cache**: Redis 7+
- **Storage**: MinIO (S3-compatible)
- **Reverse Proxy**: Nginx

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Go 1.21+
- Python 3.11+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/hdpolover/ybb-platform.git
cd ybb-platform

# Copy environment files
cp .env.example .env

# Run setup script
./scripts/setup.sh

# Start all services
make dev
# or
docker-compose up -d

# Check service health
./scripts/health-check.sh
```

## Project Structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed project structure and architecture.

## Services

- **API Gateway** (Port 4000): Main backend API
- **Payment Service** (Port 8080): Payment processing and Stripe integration
- **File Service** (Port 8000): File upload, storage, and processing
- **Admin Dashboard** (Port 3000): Admin management interface

All services are accessible through Nginx on ports 80/443.

## Documentation

- Architecture: `docs/architecture.md`
- Setup Guide: `docs/setup.md`
- API Documentation: `docs/api-documentation.md`
- Deployment: `docs/deployment.md`

## License

Proprietary
