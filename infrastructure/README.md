# Infrastructure Configuration

This folder contains infrastructure configuration files for Docker Compose and Kubernetes deployments.

## Structure

```
infrastructure/
├── grafana/        # Grafana monitoring dashboards
├── minio/          # MinIO object storage configuration
├── nginx/          # Nginx reverse proxy configuration
├── pgadmin/        # pgAdmin PostgreSQL GUI
├── postgres/       # PostgreSQL database initialization scripts
├── prometheus/     # Prometheus metrics collection
├── rabbitmq/       # RabbitMQ message queue configuration
└── redis/          # Redis cache configuration
```

## PostgreSQL Initialization

The `postgres/init/` folder contains SQL scripts that run automatically when the PostgreSQL container is first created:

1. **01-init-databases.sql** - Creates three databases:
   - `ybb_platform` - Main API service database (Prisma)
   - `ybb_payments_db` - Payment service database (GORM)
   - `ybb_files_db` - File service database (SQLAlchemy)

2. **02-init-extensions.sql** - Installs PostgreSQL extensions:
   - `uuid-ossp` - UUID generation
   - `pgcrypto` - Cryptographic functions
   - `pg_trgm` - Full-text search (main DB only)
   - `btree_gin`, `btree_gist` - Advanced indexing (main DB only)

3. **03-init-users.sql** - Grants permissions to `ybb_user` for all databases

### Database Architecture

```
┌─────────────────────────────────────┐
│  PostgreSQL Container               │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ybb_platform                │   │
│  │ (API Service - Prisma)      │   │
│  │ - users, programs           │   │
│  │ - applications              │   │
│  │ - payments (lightweight)    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ybb_payments_db             │   │
│  │ (Payment Service - GORM)    │   │
│  │ - payment_methods           │   │
│  │ - payments (full data)      │   │
│  │ - payment_events            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ybb_files_db                │   │
│  │ (File Service - SQLAlchemy) │   │
│  │ - files (storage metadata)  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Nginx Configuration

The `nginx/conf.d/` folder contains reverse proxy configurations:

- **api.conf** - Routes traffic to microservices:
  - `/api/v1/` → API Service (port 4000)
  - `/api/v1/payments/` → Payment Service (port 8002)
  - `/api/v1/files/` → File Service (port 8001)
  - `/admin` → Admin Dashboard (port 3001)

- **dashboard.conf** - Admin dashboard specific configuration
- **ssl.conf** - SSL/TLS settings for production

### Port Mapping

| Service | Internal Port | Nginx Route |
|---------|--------------|-------------|
| API Service | 4000 | `/api/v1/` |
| Payment Service | 8002 | `/api/v1/payments/` |
| File Service | 8001 | `/api/v1/files/` |
| Admin Dashboard | 4001 | `/admin` |

## RabbitMQ Configuration

The `rabbitmq/rabbitmq.conf` file configures the message queue for event-driven communication between services.

**Events:**
- `payment.created`
- `payment.succeeded`
- `payment.failed`
- `payment.proof_uploaded`
- `payment.refunded`

## MinIO Configuration

MinIO is used for object storage (file uploads, payment proofs, etc.).

**Default Settings:**
- API Port: 9000
- Console Port: 9001
- Bucket: `ybb-files`

## Redis Configuration

Redis is used for caching and session storage.

**Default Port:** 6379

## Monitoring Stack

### Prometheus

Prometheus collects metrics from all services.

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:49090 |
| **Config** | `prometheus/prometheus.yml` |

See [Prometheus README](./prometheus/README.md) for details.

### Grafana

Grafana provides visualization dashboards.

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:43000 |
| **Username** | `admin` |
| **Password** | `admin123` |

See [Grafana README](./grafana/README.md) for details.

## Usage

### Docker Compose (Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

### Kubernetes (Production)

See `/k8s/` folder for Kubernetes deployment configurations.

```bash
# Apply namespace
kubectl apply -f k8s/namespaces/

# Apply configmaps and secrets
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/

# Deploy services
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# Apply ingress
kubectl apply -f k8s/ingress/
```

## Environment Variables

Required environment variables are defined in `.env` file at the project root.

**Key Variables:**
- `DATABASE_USER` - PostgreSQL username
- `DATABASE_PASSWORD` - PostgreSQL password
- `DATABASE_NAME` - Main database name (ybb_platform)
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `RABBITMQ_USER` - RabbitMQ username
- `RABBITMQ_PASSWORD` - RabbitMQ password
- `REDIS_PASSWORD` - Redis password

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker exec ybb-postgres pg_isready -U ybb_user -d postgres

# List databases
docker exec ybb-postgres psql -U ybb_user -d postgres -l

# Connect to database
docker exec -it ybb-postgres psql -U ybb_user -d ybb_platform
```

### MinIO Access Issues

```bash
# Check MinIO is running
docker logs ybb-minio

# Access MinIO console
open http://localhost:9001
```

### RabbitMQ Issues

```bash
# Check RabbitMQ is running
docker logs ybb-rabbitmq

# Access RabbitMQ management console
open http://localhost:15672
```

## Security Notes

⚠️ **Production Deployment:**
1. Change all default passwords in `.env`
2. Enable SSL/TLS in Nginx
3. Use secrets management (Kubernetes Secrets, AWS Secrets Manager, etc.)
4. Restrict PostgreSQL access to internal network only
5. Enable authentication for Redis
6. Use private Docker registry for images

## For Developers

- Postgres init scripts run only on first container creation
- To re-run init scripts, delete the volume: `docker volume rm ybb-platform_postgres_data`
- Each service has its own database - no cross-database queries
- Use RabbitMQ events for inter-service communication
