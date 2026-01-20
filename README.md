# YBB Platform (Microservices Architecture)

This repository contains the YBB Platform services managed as strictly isolated microservices.

## Architecture

Each service is self-contained with its own:
- `docker-compose.yml`
- Environment Variables (`.env`)
- Database (if applicable)
- Codebase

### Service Registry

| Service | Directory | Port (App) | Port (DB) | Port (RabbitMQ) |
|---------|-----------|------------|-----------|-----------------|
| **API Gateway** | `services/api` | 4000 | 5432 | N/A |
| **Payment Service** | `services/payment-service` | 8002 | 5433 | 5673 |
| **File Service** | `services/file-service` | 8001 | 5434 | N/A |
| **Notification** | `services/notification-service` | 4002 | N/A | 5674 |
| **Admin Dashboard** | `services/admin-dashboard` | 4001 | N/A | N/A |
| **Minimal Admin** | `services/minimal-admin` | 4003 | N/A | N/A |

### Networking

Services communicate using `http://host.docker.internal:<PORT>` to ensure strict isolation while allowing local interoperability without a shared Docker network.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Make (optional, for convenience scripts)

### Management

A root `Makefile` is provided to orchestrate the services simultaneously.

```bash
# Start all services
make start

# Stop all services
make stop

# Check status
make status
```

### Individual Service Management

You can also manage services individually:

```bash
cd services/payment-service
docker compose up -d
docker compose logs -f
```

## Legacy Files

Old configuration files, scripts, and documentation from the monorepo era have been moved to `legacy_archive/`.
