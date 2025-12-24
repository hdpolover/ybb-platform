# YBB Platform

Monorepo architecture for YBB master platform with microservices managed by Docker.

## Overview

This project is a comprehensive platform for managing YBB (Youth Break the Boundaries) programs, applications, and payments. Built with a microservices architecture using Docker containerization.

## Technology Stack

- **API Gateway**: NestJS (TypeScript)
- **Payment Service**: Golang
- **File Service**: Python (FastAPI)
- **Notification Service**: NestJS (TypeScript)
- **Admin Dashboard**: Next.js 16+
- **Database**: PostgreSQL 16
- **Cache**: Redis 7+
- **Message Queue**: RabbitMQ
- **Storage**: MinIO (S3-compatible)
- **Monitoring**: Prometheus + Grafana
- **Reverse Proxy**: Nginx

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development only)
- Go 1.21+ (for local development only)
- Python 3.11+ (for local development only)

### Quick Start (Linux/macOS)

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

### Quick Start (Windows)
For Windows users, we provide PowerShell scripts that mirror the Make commands.

Ensure you are running PowerShell as Administrator or have sufficient permissions.

```powershell
# Clone and enter the project
git clone https://github.com/hdpolover/ybb-platform.git
cd ybb-platform

# 1. Initial Setup (Run this first time only)
.\scripts\setup.ps1

# 2. Start Development Environment
.\scripts\dev.ps1
```

**Note:** If you encounter execution policy errors, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

### Access Points

| Service | URL |
|---------|-----|
| Admin Dashboard | http://localhost:4001 |
| API Gateway | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| Payment Service | http://localhost:8002 |
| File Service | http://localhost:8001 |
| Notification Service | http://localhost:4002 |
| MinIO Console | http://localhost:9001 |
| RabbitMQ Console | http://localhost:15672 |
| Grafana | http://localhost:43000 |
| Prometheus | http://localhost:49090 |
| pgAdmin | http://localhost:5050 |

### Common Commands
### Linux/macOS (Make)
```bash
make start    # First-time setup + start everything
make dev      # Start all services (after initial setup)
make stop     # Stop all services
make logs     # View logs from all services
make health   # Check service health
make db-reset # Reset database (WARNING: deletes data)
```

### Windows (PowerShell)
```powershell
.\scripts\setup.ps1      # First-time setup
.\scripts\dev.ps1        # Start services
docker-compose down      # Stop services
docker-compose logs -f   # View logs
.\scripts\migrate-db.ps1 # Run migration (all commands)
.\scripts\seed-db.ps1    # Seed database
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
| Notification Service | 4002 | Email & notifications (NestJS) |
| Admin Dashboard | 4001 | Admin interface (Next.js) |

All services are also accessible through Nginx on ports 80/443.

## Documentation

- [Platform Overview](docs/OVERVIEW.md)
- [Architecture](docs/architecture.md)
- [Setup Guide](docs/setup.md)
- [Deployment Guide](docs/deployment.md)
- [Service Credentials](docs/SERVICE_CREDENTIALS.md)
- [Clean Architecture Guide](docs/clean-architecture-guide.md)

## License

Proprietary
