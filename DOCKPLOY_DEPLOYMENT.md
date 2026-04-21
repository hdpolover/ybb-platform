# Deploying to Dokploy

Each service is a separate **Docker Compose** project in Dokploy. All use `docker-compose.dokploy.yml` — do **not** use `docker-compose.prod.yml` (that's for manual VPS deployments).

## Prerequisites
1.  Dokploy server running with Traefik enabled.
2.  GitHub repo `ybb-platform` connected to your Dokploy account.
3.  `dokploy-network` exists (Dokploy creates this automatically).

---

## Deployment Order

Deploy in this order due to dependencies:

| Wave | Service | Depends On |
|------|---------|------------|
| 1 | `shared-rabbitmq` | nothing |
| 2 | `payment`, `file`, `notification` | RabbitMQ |
| 3 | `api` | RabbitMQ + payment + file |
| 4 | `admin-dashboard` | API URL (baked at build time) |
| anytime | `monitoring`, `pgadmin` | nothing critical |

---

## Dokploy Field Reference

For every service:
- **Repository**: `ybb-platform`
- **Branch**: `main`
- **Compose Path**: `services/<service-name>/docker-compose.dokploy.yml`
- **Watch Path**: `services/<service-name>/**`

---

## 1. Shared RabbitMQ
- **Compose Path**: `services/shared-rabbitmq/docker-compose.dokploy.yml`
- **Watch Path**: `services/shared-rabbitmq/**`
- **Environment Variables**:
    - `RABBITMQ_DEFAULT_USER`
    - `RABBITMQ_DEFAULT_PASS`
    - `APP_DOMAINS_RULE`: `Host(\`queue.ybbhub.com\`)` (optional, for management UI)

## 2. Payment Service
- **Compose Path**: `services/payment/docker-compose.dokploy.yml`
- **Watch Path**: `services/payment/**`
- **Environment Variables**:
    - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (e.g., `ybb_payments_db`)
    - `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`
    - `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`
    - `MIDTRANS_IS_PRODUCTION`: `true`
    - `INTERNAL_SERVICE_KEY`
    - `APP_DOMAINS_RULE`: `Host(\`payments.ybbhub.com\`)`
    - `LOKI_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)

## 3. File Service
- **Compose Path**: `services/file/docker-compose.dokploy.yml`
- **Watch Path**: `services/file/**`
- **Environment Variables**:
    - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (e.g., `ybb_files_db`)
    - `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
    - `MINIO_PUBLIC_ENDPOINT`
    - `APP_DOMAINS_RULE`: `Host(\`files.ybbhub.com\`)`
    - `LOKI_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)

## 4. Notification Service
- **Compose Path**: `services/notification/docker-compose.dokploy.yml`
- **Watch Path**: `services/notification/**`
- **Environment Variables**:
    - `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`
    - `RESEND_API_KEY`, `RESEND_FROM`
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (if using SMTP instead of Resend)
    - `APP_DOMAINS_RULE`: `Host(\`notifications.ybbhub.com\`)` (optional)
    - `LOKI_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)

## 5. API Service
- **Compose Path**: `services/api/docker-compose.dokploy.yml`
- **Watch Path**: `services/api/**`
- **Environment Variables**:
    - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (e.g., `ybb_platform_db`)
    - `REDIS_PASSWORD`
    - `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`
    - `PAYMENT_SERVICE_URL`: `http://ybb-prod-payment:8002`
    - `PAYMENT_SERVICE_FALLBACK_URL`: `https://payments.ybbhub.com` (used when internal Docker DNS fails)
    - `PAYMENT_SERVICE_INTERNAL_KEY`
    - `FILE_SERVICE_URL`: `http://ybb-prod-file:8001`
    - `STORAGE_PUBLIC_URL`
    - `CORS_ORIGINS` (e.g., `https://chinayouthsummit.com,https://admin.ybbhub.com`)
    - `JWT_SECRET`, `JWT_EXPIRES_IN`
    - `ADMIN_REGISTRATION_SECRET`
    - `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON string)
    - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_STORAGE_BUCKET`
    - `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID`
    - `APP_DOMAINS_RULE`: `Host(\`api.ybbhub.com\`)`
    - `LOKI_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)
    - **Optional tuning**:
        - `READ_REPLICA_URL`
        - `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: 5)
        - `CIRCUIT_BREAKER_SUCCESS_THRESHOLD` (default: 3)
        - `CIRCUIT_BREAKER_TIMEOUT` (default: 60000)

## 6. Admin Dashboard
- **Compose Path**: `services/admin-dashboard/docker-compose.dokploy.yml`
- **Watch Path**: `services/admin-dashboard/**`
- **Environment Variables**:
    - `NEXT_PUBLIC_API_URL`: `https://api.ybbhub.com` (**required at build time**)
    - `APP_DOMAINS_RULE`: `Host(\`admin.ybbhub.com\`)`

## 7. Monitoring Stack (Prometheus + Grafana + Loki + Tempo)
- **Compose Path**: `services/monitoring/docker-compose.dokploy.yml`
- **Watch Path**: `services/monitoring/**`
- **Environment Variables**:
    - `GRAFANA_USER`, `GRAFANA_PASSWORD`
    - `APP_DOMAINS_RULE`: `Host(\`monitor.ybbhub.com\`)`

## 8. PgAdmin
- **Compose Path**: `services/pgadmin/docker-compose.dokploy.yml`
- **Watch Path**: `services/pgadmin/**`
- **Environment Variables**:
    - `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`
    - `APP_DOMAINS_RULE`: `Host(\`db.ybbhub.com\`)`

---

## Notes
- **Container names**: All prod containers are prefixed `ybb-prod-` (e.g., `ybb-prod-api`, `ybb-prod-postgres-api`) to avoid conflicts with staging containers on the same host.
- **Internal URLs**: Services on `dokploy-network` communicate by container name (e.g., `http://ybb-prod-payment:8002`).
- **Databases**: Each stateful service (API, Payment, File) runs its own dedicated PostgreSQL container defined in its own compose file.
- **Seeding**: On first boot, the API runs `seed:prod` which only seeds auth providers, brands, and admin accounts — no dummy data.
