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
- Node.js 18+ (for local development only)
- Go 1.21+ (for local development only)
- Python 3.11+ (for local development only)

### Quick Start (One Command!)

```bash
# Clone and enter the project
git clone https://github.com/hdpolover/ybb-platform.git
cd ybb-platform

# Start everything with one command
make start
```

That's it! 🚀 The command will:
1. Create `.env` from template (if not exists)
2. Build all Docker images
3. Start PostgreSQL and wait for it to be ready
4. Start all microservices

### Access Points

| Service | URL |
|---------|-----|
| Admin Dashboard | http://localhost:4001 |
| API Gateway | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| Payment Service | http://localhost:8002 |
| File Service | http://localhost:8001 |
| MinIO Console | http://localhost:9001 |

### Common Commands

```bash
make start    # First-time setup + start everything
make dev      # Start all services (after initial setup)
make stop     # Stop all services
make logs     # View logs from all services
make health   # Check service health
make db-reset # Reset database (WARNING: deletes data)
```

### Troubleshooting

**Database connection error?**
```bash
# Check if PostgreSQL is running
docker exec ybb-postgres pg_isready -U ybb_user -d postgres

# View postgres logs
docker logs ybb-postgres
```

**Need a fresh start?**
```bash
make db-reset  # Resets database and restarts everything
```

## Project Structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed project structure and architecture.

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 4000 | Main backend API (NestJS) |
| Payment Service | 8002 | Payment processing (Go/GORM) |
| File Service | 8001 | File upload & storage (Python/FastAPI) |
| Admin Dashboard | 4001 | Admin interface (Next.js) |

All services are also accessible through Nginx on ports 80/443.

## Documentation

- Architecture: `docs/architecture.md`
- Clean Architecture Guide: `docs/clean-architecture-guide.md`
- Setup Guide: `docs/setup.md`
- Caching & Performance: `docs/CACHING_GUIDE.md`
- API Documentation: `docs/api-documentation.md`
- Deployment: `docs/deployment.md`

## License

Proprietary
