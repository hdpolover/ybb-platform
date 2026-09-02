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
    - `FILE_SERVICE_INTERNAL_KEY` (shared secret for API ↔ file-service private routes)
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
    - **Optional queue migration cleanup**:
        - `NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY` (`true` for one deploy to clear/recreate legacy queues, then set back to `false`)
        - `NOTIFICATION_QUEUE_CLEANUP_TARGETS` (comma-separated queue base names; default `notification_queue`)

## 5. API Service
- **Compose Path**: `services/api/docker-compose.dokploy.yml`
- **Watch Path**: `services/api/**`
- **Environment Variables**:
    - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (e.g., `ybb_platform_db`)
    - `REDIS_PASSWORD`
    - `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`
    - `PAYMENT_SERVICE_URL`: `http://ybb-prod-payment:8002`
    - `PAYMENT_GRPC_URL`: `ybb-prod-payment:50053`
    - `PAYMENT_SERVICE_FALLBACK_URL`: `https://payments.ybbhub.com` (used when internal Docker DNS fails)
    - `PAYMENT_SERVICE_INTERNAL_KEY`
    - `FILE_SERVICE_URL`: `http://ybb-prod-file:8001`
    - `FILE_SERVICE_INTERNAL_KEY` (must match file-service secret)
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
        - `RABBITMQ_QUEUE_CLEANUP_ON_DEPLOY` (`true` for one deploy to clear/recreate legacy queues, then set back to `false`)
        - `RABBITMQ_QUEUE_CLEANUP_TARGETS` (comma-separated queue base names to delete)

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

## Postgres tuning

All three Postgres containers (API, Payment, File) shipped on stock
`postgres:15-alpine` defaults — sized for a 1GB toy install, not the shared
32GB VPS these run on. `docker-compose.dokploy.yml` now passes tuned settings
via the postgres service's `command:` block:

- `postgres-api` (the large, hot DB — participants/applications/logs):
  `shared_buffers=1GB` (was 128MB), `effective_cache_size=3GB` (was 4GB
  default but assumed the whole host; 3GB reflects what's actually free on a
  shared box), `work_mem=16MB` (was 4MB — fewer disk spills on sorts/joins),
  `maintenance_work_mem=256MB` (was 64MB — faster index builds/vacuum),
  `random_page_cost=1.1` (was 4 — the volume is SSD-backed, default assumes
  spinning disk and pushes the planner away from index scans it should use),
  plus `track_io_timing=on`, `pg_stat_statements` preloaded, and
  `log_min_duration_statement=500` (log queries over 500ms). Also sets
  `shm_size: 1gb` on the service (Docker default is 64MB) — Postgres uses
  `/dev/shm` for parallel-query workers, and a parallel hash join at the new
  work_mem can approach that default budget on its own; a couple of
  concurrent parallel queries would exhaust it and fail with "could not
  resize shared memory segment: No space left on device" instead of
  degrading gracefully.
- `postgres-payment` and `postgres-file`: these DBs are tiny, so no memory
  settings were touched — only `track_io_timing=on` and `pg_stat_statements`
  were added, for the same visibility.

**pg_stat_statements requires one more step.** `shared_preload_libraries`
only loads the library into the server; the extension still needs
`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` run once per database
after the container restarts with the new setting active. Run
`scripts/db/enable-pg-stat-statements.sh` (from the VPS, with `docker` access
to all three containers) to do this for all three DBs.

**Changing `command:` recreates the container.** Applying this (or any future
tuning change) causes a few seconds of Postgres downtime while it restarts
and the API/Payment/File services reconnect. Deploy during a quiet window.

---

## Backups

Each of the three Postgres-backed compose files (API, Payment, File) runs a
`postgres-backup-local` sidecar next to its `postgres-*` service. It dumps
daily (`SCHEDULE=@daily`), keeping 7 daily / 4 weekly / 3 monthly copies, into
a named volume (`postgres_api_backups`, `postgres_payment_backups`,
`postgres_file_backups`) local to the VPS. This is on-host only — there is no
off-site copy yet.

### Restore recipe

Find the dump you want inside the backup volume, then restore it into the
target Postgres container. Example for the API database:

```bash
# 1. List available dumps (daily/weekly/monthly subfolders)
docker run --rm -v postgres_api_backups:/backups alpine ls -la /backups/daily

# 2. Copy the dump you want out of the volume (or `docker cp` from a throwaway container)
docker run --rm -v postgres_api_backups:/backups -v $(pwd):/out alpine \
  cp /backups/daily/<dump-file>.sql.gz /out/

# 3. Restore into the running postgres-api container (drops/recreates is on you —
#    this pipes into psql against the existing DB, so restore into a fresh DB/container
#    for a real disaster-recovery drill, not the live one)
gunzip -c <dump-file>.sql.gz | docker exec -i ybb-prod-postgres-api \
  psql -U "$DATABASE_USER" -d "$DATABASE_NAME"
```

Swap `postgres_api_backups` / `ybb-prod-postgres-api` for the payment or file
equivalents (`postgres_payment_backups` / `ybb-prod-postgres-payment`,
`postgres_file_backups` / `ybb-prod-postgres-file`) as needed.

**Follow-up (not done here):** no off-site sync exists — a VPS-level failure
loses both the live data and the backup volume. Add one later by pointing an
`rclone`/`AWS_*` sidecar at the same backup volumes, or by switching to a
`postgres-backup-local` fork/image with native S3 upload support.

## Notes
- **Container names**: All prod containers are prefixed `ybb-prod-` (e.g., `ybb-prod-api`, `ybb-prod-postgres-api`) to avoid conflicts with staging containers on the same host.
- **Internal URLs**: Services on `dokploy-network` communicate by container name (e.g., `http://ybb-prod-payment:8002`).
- **Databases**: Each stateful service (API, Payment, File) runs its own dedicated PostgreSQL container defined in its own compose file.
- **Seeding**: On first boot, the API runs `seed:prod` which only seeds auth providers, brands, and admin accounts — no dummy data.
