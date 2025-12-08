# YBB Platform - Service Credentials & Access Guide

This document contains all the credentials and access information for the YBB Platform services when running in development mode.

## 🌐 Web Interfaces

### pgAdmin (PostgreSQL GUI)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:5050 |
| **Email** | `admin@admin.com` |
| **Password** | `admin123` |

#### Connecting to PostgreSQL Database in pgAdmin:

1. Open http://localhost:5050 and login
2. Right-click **Servers** → **Register** → **Server**
3. **General** tab: Name it `YBB Database`
4. **Connection** tab:
   - Host: `postgres`
   - Port: `5432`
   - Database: `ybb_db`
   - Username: `ybb_user`
   - Password: `ybb_password`
5. Click **Save**

---

### MinIO Console (Object Storage GUI)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:9001 |
| **Username** | `minioadmin` |
| **Password** | `minioadmin` |

#### MinIO Features:
- Browse and manage file buckets
- Upload/download files
- Manage access policies
- View storage metrics

---

### RabbitMQ Management (Message Queue GUI)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:15672 |
| **Username** | `guest` |
| **Password** | `guest` |

#### RabbitMQ Features:
- Monitor queues and exchanges
- View message rates
- Manage connections
- Publish/consume test messages

---

## 🔌 API Services

### API Gateway (NestJS)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:4000 |
| **Swagger Docs** | http://localhost:4000/api/docs |

---

### Admin Dashboard (Next.js)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:4001 |

---

### File Service (Python/FastAPI)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:8001 |
| **Docs** | http://localhost:8001/docs |

---

### Payment Service (Golang)

| Setting | Value |
|---------|-------|
| **URL** | http://localhost:8002 |

---

## 🗄️ Database Connections

### PostgreSQL (Main Database)

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `ybb_db` |
| **Username** | `ybb_user` |
| **Password** | `ybb_password` |

**Connection String:**
```
postgresql://ybb_user:ybb_password@localhost:5432/ybb_db
```

**Docker Internal Connection:**
```
postgresql://ybb_user:ybb_password@postgres:5432/ybb_db
```

---

### Redis (Cache)

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `6379` |
| **Password** | *(none)* |

**Connection String:**
```
redis://localhost:6379
```

---

## 🛠️ Quick Commands

### Access Database Shell
```bash
make db-shell
# or
docker exec -it ybb-postgres psql -U ybb_user -d ybb_db
```

### Access Redis Shell
```bash
make redis-shell
# or
docker exec -it ybb-redis redis-cli
```

### View All Service Logs
```bash
make logs
```

### Check Service Health
```bash
make health
```

### View Running Containers
```bash
make ps
```

---

## 📋 Port Summary

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 4000 | Main backend API |
| Admin Dashboard | 4001 | Next.js web interface |
| File Service | 8001 | File upload/storage API |
| Payment Service | 8002 | Payment processing API |
| PostgreSQL | 5432 | Main database |
| pgAdmin | 5050 | PostgreSQL web GUI |
| Redis | 6379 | Cache server |
| MinIO API | 9000 | Object storage API |
| MinIO Console | 9001 | Object storage web GUI |
| RabbitMQ | 5672 | Message queue |
| RabbitMQ Management | 15672 | Message queue web GUI |
| Nginx | 80/443 | Reverse proxy |

---

## ⚠️ Security Note

These credentials are for **development only**. For production:
- Change all default passwords
- Use environment-specific `.env` files
- Enable SSL/TLS
- Restrict network access
- Use secrets management (e.g., HashiCorp Vault, AWS Secrets Manager)
