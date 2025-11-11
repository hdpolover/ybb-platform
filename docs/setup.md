# YBB Platform - Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (v24.0+)
- **Docker Compose** (v2.0+)
- **Git**
- **Node.js** (v18+) - for local development
- **Go** (v1.21+) - for local development
- **Python** (v3.11+) - for local development

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/hdpolover/ybb-platform.git
cd ybb-platform
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

### 3. Run Setup Script

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run initial setup
./scripts/setup.sh
```

### 4. Start Development Environment

```bash
# Using Makefile
make dev

# Or using Docker Compose directly
docker-compose up -d
```

### 5. Seed Database (Optional)

```bash
make seed-db
```

### 6. Access the Platform

- **Admin Dashboard**: http://localhost:3000
- **API Gateway**: http://localhost:4000
- **API Documentation**: http://localhost:4000/api/docs
- **Payment Service**: http://localhost:8080
- **File Service**: http://localhost:8000
- **File Service Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001
- **RabbitMQ Console**: http://localhost:15672

## Default Credentials

### Admin User
- **Email**: admin@ybb-platform.com
- **Password**: Admin123!

### MinIO
- **Access Key**: minioadmin
- **Secret Key**: minioadmin

### RabbitMQ
- **Username**: guest
- **Password**: guest

## Service-Specific Setup

### API Gateway (NestJS)

```bash
cd services/api

# Install dependencies
npm install

# Generate Prisma client (if using Prisma)
npm run prisma:generate

# Run migrations
npm run migration:run

# Start in development
npm run start:dev
```

### Payment Service (Golang)

```bash
cd services/payment-service

# Install dependencies
go mod download

# Install Air for hot reload
go install github.com/cosmtrek/air@latest

# Run
air
```

### File Service (Python)

```bash
cd services/file-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Admin Dashboard (Next.js)

```bash
cd services/admin-dashboard

# Install dependencies
npm install

# Run development server
npm run dev
```

## Database Management

### Run Migrations

```bash
# All migrations
make migrate

# Or manually
docker-compose exec postgres psql -U ybb_user -d ybb_db -f /path/to/migration.sql
```

### Backup Database

```bash
make backup
```

### Restore Database

```bash
make restore
```

## Development Workflow

### Start Services

```bash
make dev
```

### View Logs

```bash
# All services
make logs

# Specific service
make api-logs
make payment-logs
make file-logs
make dashboard-logs
```

### Stop Services

```bash
make stop
```

### Rebuild Services

```bash
make build
docker-compose up -d --build
```

### Access Service Shell

```bash
# API Gateway
make api-shell

# Payment Service
make payment-shell

# File Service
make file-shell

# Database
make db-shell

# Redis
make redis-shell
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker status
docker info

# Check service logs
docker-compose logs

# Restart services
make restart
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Port Conflicts

If you have port conflicts, edit `docker-compose.yml` to change the exposed ports:

```yaml
services:
  api:
    ports:
      - "4001:4000"  # Change from 4000 to 4001
```

### Clear Everything

```bash
# Stop and remove all containers, volumes, and images
make clean

# Start fresh
./scripts/setup.sh
make dev
```

## Performance Optimization

### Increase Docker Resources

1. Open Docker Desktop
2. Go to Settings → Resources
3. Increase:
   - CPUs: 4+
   - Memory: 8GB+
   - Swap: 2GB+

### Database Optimization

```sql
-- Connect to database
make db-shell

-- Analyze tables
ANALYZE;

-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

## Security Considerations

### Production Setup

1. **Change all default passwords**
2. **Use strong JWT secrets**
3. **Configure SSL certificates**
4. **Set up firewall rules**
5. **Enable rate limiting**
6. **Configure CORS properly**

### SSL/TLS Setup

```bash
# Generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/nginx/ssl/key.pem \
  -out infrastructure/nginx/ssl/cert.pem

# For production, use Let's Encrypt
```

## Next Steps

- Read the [Architecture Documentation](./architecture.md)
- Review [API Documentation](./api-documentation.md)
- Check [Deployment Guide](./deployment.md) for production
- Review [Contributing Guidelines](./contributing.md)

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check docs/ directory
- **Email**: support@ybb-platform.com
