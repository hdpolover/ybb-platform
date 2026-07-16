# YBB Platform - Service Credentials & Access Guide

This document contains all credentials and access information for YBB Platform services in development mode.

> ⚠️ **These credentials are for development only.** Change all passwords for production.

---

## 🌐 Web Interfaces

### pgAdmin (PostgreSQL GUI)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:5050 |
| **Email** | `admin@admin.com` |
| **Password** | `admin123` |

**Connecting to Database:**
1. Open http://localhost:5050 and login
2. Right-click **Servers** → **Register** → **Server**
3. **General** tab: Name it `YBB Database`
4. **Connection** tab:
   - Host: `postgres`
   - Port: `5432`
   - Database: `ybb_platform`
   - Username: `ybb_user`
   - Password: `ybb_password`

---

### MinIO Console (Object Storage)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:9001 |
| **Username** | `minioadmin` |
| **Password** | `minioadmin` |

---

### RabbitMQ Management

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:15672 |
| **Username** | `guest` |
| **Password** | `guest` |

---

### Grafana (Monitoring Dashboard)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:43000 |
| **Username** | `admin` |
| **Password** | `admin123` |

---

### Prometheus (Metrics)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:49090 |
| **Authentication** | None (development) |

---

## 🔌 API Services

| Service | URL | Docs |
|---------|-----|------|
| API Gateway | http://localhost:4000 | http://localhost:4000/api/docs |
| Admin Dashboard | http://localhost:4001 | - |
| File Service | http://localhost:8001 | http://localhost:8001/docs |
| Payment Service | http://localhost:8002 | - |
| Notification Service | http://localhost:4002 | - |

---

## 🗄️ Database Connections

### PostgreSQL

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `ybb_platform` |
| **Username** | `ybb_user` |
| **Password** | `ybb_password` |

**Connection String:**
```
postgresql://ybb_user:ybb_password@localhost:5432/ybb_platform
```

**Docker Internal:**
```
postgresql://ybb_user:ybb_password@postgres:5432/ybb_platform
```

### Service-Specific Databases

| Service | Database |
|---------|----------|
| API Gateway | `ybb_platform` |
| Payment Service | `ybb_payments_db` |
| File Service | `ybb_files_db` |

---

### Redis (Cache)

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `6379` |
| **Password** | *(none)* |

---

## 🛠️ Quick Commands

```bash
# Database shell
make db-shell

# Redis shell
make redis-shell

# View logs
make logs

# Check health
make health
```

---

## 📋 Port Summary

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 4000 | Main backend API |
| Admin Dashboard | 4001 | Next.js web interface |
| Notification Service | 4002 | Notification handling |
| File Service | 8001 | File upload/storage API |
| Payment Service | 8002 | Payment processing API |
| PostgreSQL | 5432 | Main database |
| pgAdmin | 5050 | PostgreSQL web GUI |
| Redis | 6379 | Cache server |
| MinIO API | 9000 | Object storage API |
| MinIO Console | 9001 | Object storage web GUI |
| RabbitMQ | 5672 | Message queue |
| RabbitMQ Management | 15672 | Message queue web GUI |
| Grafana | 43000 | Monitoring dashboard |
| Prometheus | 49090 | Metrics collection |
| Nginx | 80/443 | Reverse proxy |

---

## ⚠️ Security Note

For production deployment:
- Change all default passwords
- Use environment-specific `.env` files
- Enable SSL/TLS
- Restrict network access
- Use secrets management (HashiCorp Vault, AWS Secrets Manager, etc.)
