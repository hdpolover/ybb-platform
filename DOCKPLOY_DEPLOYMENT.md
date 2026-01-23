# Deploying to Dockploy

To deploy YBB Platform services on Dockploy, you will treat each microservice as a separate **"Docker Compose" Service** in the Dockploy dashboard.

## Prerequisites
1.  **Dockploy Server** is running.
2.  **Repo Connected**: Connect your GitHub repository `ybb-platform`.

## Common Setup
Each service requires accessing `dokploy-network` to communicate internally and use Traefik for public domains.

---

## 1. Shared RabbitMQ Service
*   **Name**: `shared-rabbitmq`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/shared-rabbitmq`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `RABBITMQ_DEFAULT_USER` (e.g., guest)
    *   `RABBITMQ_DEFAULT_PASS` (e.g., guest)
    *   `APP_DOMAINS_RULE`: `Host(\`queue.ybbhub.com\`)` (if exposing UI)

## 2. API Service
*   **Name**: `api`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/api`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `DATABASE_USER`
    *   `DATABASE_PASSWORD`
    *   `DATABASE_NAME` (e.g., ybb_platform_db)
    *   `JWT_SECRET`
    *   `APP_DOMAINS_RULE`: `Host(\`api.ybbhub.com\`)`
    *   (Plus RabbitMQ creds to connect to shared-rabbitmq)

## 3. Payment Service
*   **Name**: `payment`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/payment`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `DATABASE_USER`
    *   `DATABASE_PASSWORD`
    *   `DATABASE_NAME` (e.g., ybb_payments_db)
    *   `MIDTRANS_SERVER_KEY`
    *   `APP_DOMAINS_RULE`: `Host(\`payment.ybbhub.com\`)`

## 4. File Service
*   **Name**: `file`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/file`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `DATABASE_USER`
    *   `DATABASE_PASSWORD`
    *   `DATABASE_NAME` (e.g., ybb_files_db)
    *   `MINIO_ENDPOINT`, etc.
    *   `APP_DOMAINS_RULE`: `Host(\`files.ybbhub.com\`)`

## 5. Notification Service
*   **Name**: `notification`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/notification`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`
    *   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
    *   `APP_DOMAINS_RULE`: `Host(\`notify.ybbhub.com\`)` (Optional)

## 6. Admin Dashboard
*   **Name**: `admin-dashboard`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/admin-dashboard`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `APP_DOMAINS_RULE`: `Host(\`staging-admin.ybbhub.com\`)`
    *   `NEXT_PUBLIC_API_URL`: `https://staging-api.ybbhub.com` (Required at Build Time)

## 7. Minimal Admin
*   **Name**: `minimal-admin`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/minimal-admin`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `APP_DOMAINS_RULE`: `Host(\`ops.ybbhub.com\`)`

## 8. Monitoring Stack (Prometheus + Grafana)
*   **Name**: `monitoring`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/monitoring`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `GRAFANA_USER`
    *   `GRAFANA_PASSWORD`
    *   `APP_DOMAINS_RULE`: `Host(\`monitor.ybbhub.com\`)`

## 9. PgAdmin
*   **Name**: `pgadmin`
*   **Repository**: `ybb-platform`
*   **Branch**: `main`
*   **Build Path**: `services/pgadmin`
*   **Compose Path**: `docker-compose.dokploy.yml`
*   **Environment Variables**:
    *   `PGADMIN_EMAIL`
    *   `PGADMIN_PASSWORD`
    *   `APP_DOMAINS_RULE`: `Host(\`db.ybbhub.com\`)`

## Notes
*   **Internal Communication**: Services communicate via `dokploy-network` using container names (e.g., `ybb-shared-rabbitmq`, `ybb-payment`). The provided compose files are pre-configured for this.
*   **Databases**: Each service (API, Payment, File) spins up its own dedicated PostgreSQL container within its deployment. This is defined in their respective `docker-compose.dokploy.yml` files.
