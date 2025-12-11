# YBB Platform - Deployment Guide

This guide covers deploying the YBB Platform to production environments.

## Deployment Options

| Method | Use Case |
|--------|----------|
| **Docker Compose** | Single VPS, development staging |
| **Kubernetes** | Production, scalable deployment |

---

## VPS Deployment (Docker Compose)

### Prerequisites

- Ubuntu 22.04+ VPS with 4GB+ RAM
- Docker & Docker Compose installed
- Domain pointing to VPS IP (e.g., `ybbhub.com`)

### 1. Server Setup

```bash
# Clone repository
git clone https://github.com/hdpolover/ybb-platform.git
cd ybb-platform

# Create storage directory for MinIO
sudo mkdir -p /var/ybb-storage
sudo chown -R 1000:1000 /var/ybb-storage

# Copy production environment
cp .env.production.example .env.prod
```

### 2. Configure Environment

Edit `.env.prod` with production values:

```env
# Database
DATABASE_USER=ybb_user
DATABASE_PASSWORD=<strong-password>
DATABASE_NAME=ybb_platform

# JWT (generate with: openssl rand -base64 64)
JWT_SECRET=<generated-secret>

# Domains
NEXT_PUBLIC_API_URL=https://api.ybbhub.com

# MinIO
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>

# Grafana
GRAFANA_PASSWORD=<admin-password>
```

### 3. Deploy Services

```bash
# Build and start production containers
docker-compose -f docker-compose.prod.yml up -d --build

# Or use VPS deployment script
chmod +x scripts/vps-deploy.sh
./scripts/vps-deploy.sh
```

### 4. SSL/TLS Setup

Using Let's Encrypt with Certbot:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates for all domains
sudo certbot --nginx -d ybbhub.com \
  -d api.ybbhub.com \
  -d admin.ybbhub.com \
  -d files.ybbhub.com \
  -d payment.ybbhub.com \
  -d minio.ybbhub.com \
  -d grafana.ybbhub.com
```

### 5. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Check health endpoints
curl https://api.ybbhub.com/health
curl https://files.ybbhub.com/api/v1/files/health
```

---

## Production URLs

| Service | URL |
|---------|-----|
| Admin Dashboard | https://admin.ybbhub.com |
| API Gateway | https://api.ybbhub.com |
| File Service | https://files.ybbhub.com |
| Payment Service | https://payment.ybbhub.com |
| MinIO Console | https://minio.ybbhub.com |
| Grafana | https://grafana.ybbhub.com |

---

## Database Management

### Backup

```bash
# Manual backup
docker exec ybb-postgres pg_dump -U ybb_user ybb_platform > backup.sql

# Or use backup script
./scripts/backup.sh
```

### Restore

```bash
# Restore from backup
docker exec -i ybb-postgres psql -U ybb_user ybb_platform < backup.sql
```

---

## Monitoring

### Grafana

Access at https://grafana.ybbhub.com

- Default login: `admin` / (password from `.env.prod`)
- Pre-configured dashboards for service metrics

### Prometheus

- Metrics endpoint: https://prometheus.ybbhub.com
- Scrapes all services automatically

---

## Updating Services

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Or single service
docker-compose -f docker-compose.prod.yml up -d --build api
```

---

## Troubleshooting

### Service Won't Start

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs <service-name>

# Check resource usage
docker stats
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker exec ybb-postgres pg_isready -U ybb_user

# View PostgreSQL logs
docker logs ybb-postgres
```

### SSL Certificate Issues

```bash
# Renew certificates
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall (UFW)
- [ ] Disable root SSH login
- [ ] Set up fail2ban
- [ ] Enable automatic security updates
- [ ] Configure backup schedule
- [ ] Set up monitoring alerts

---

## Kubernetes Deployment

See `/k8s/` directory for Kubernetes manifests:

```bash
# Apply all manifests
kubectl apply -f k8s/namespaces/
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress/
```
