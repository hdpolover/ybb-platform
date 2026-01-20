# Restructuring Plan for ybb-platform

## Objective
To separate the `ybb-platform` repository into completely self-contained service folders. Each service will be a standalone unit managing its own environment, Docker configuration, and codebase.

**Key Principle: No Shared Dependencies.**
The current `shared/` directory concept will be abandoned. Services will not rely on a root-level `shared` folder. Any necessary code (types, constants, protos) currently in `shared/` will be moved or duplicated into the specific services that need them.

## Current State
- **Monorepo-style** linked by a root `docker-compose.yml`.
- **Services:** `api`, `payment-service`, `admin-dashboard`, `file-service`, `minimal-admin`, `notification-service`.
- **Shared Resources:** `shared/` folder (Constants, Protos, Types) currently exists at root.

## Target Structure

The root will primarily serve as a container for the independent services.

```
ybb-platform/
├── services/
│   ├── api/
│   │   ├── .env
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── shared/                   # Migrated/Duplicated types & constants specific to API
│   │   │   └── ...
│   │   └── ...
│   ├── payment-service/
│   │   ├── .env
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile
│   │   ├── internal/
│   │   │   ├── shared/                   # Migrated/Duplicated types & constants specific to Go
│   │   │   └── ...
│   │   └── ...
│   ├── admin-dashboard/
│   │   ├── .env
│   │   ├── docker-compose.yml
│   │   ├── src/
│   │   │   ├── shared/                   # Migrated/Duplicated types & constants specific to Dashboard
│   │   │   └── ...
│   │   └── ...
│   └── ... (other services)
├── infrastructure/                       # (Optional) Reference backups only
└── (removed root shared folder)
```

## Implementation Steps

### 1. Networking approach
- [ ] No shared Docker network. Services will communicate via **Configured URLs** in `.env` (e.g., `PAYMENT_SERVICE_URL=http://localhost:8002` or `https://payment.ybbhub.com`).
- [ ] Each service exposes its necessary ports to the host so they are reachable.

### 2. Service Isolation Execution
For *each* service (`api`, `payment-service`, `admin-dashboard`, `file-service`, `notification-service`):

1.  **Eliminate External Dependencies**:
    -   Identify imports from `../../shared`.
    -   Copy relevant files from valid `shared/` subdirectories (`constants`, `types`, `proto`) directly into the service's own source tree (e.g., `services/api/src/common` or `services/api/src/shared`).
    -   Update import paths in list service to point to the local copy.

2.  **Docker & Build Config**:
    -   Create `services/<service>/docker-compose.yml`:
        -   Define the service container. **Ensure Ports are exposed** (e.g., `8002:8002`).
        -   Define dedicated database/cache containers (e.g., `postgres-api`, `redis-api`) provided they don't conflict on host ports.
    -   Update `Dockerfile`:
        -   Remove any steps copying `../../shared`.
        -   Ensure build context is strictly the service directory (e.g., `docker build .` from inside `services/api`).

3.  **Environment**:
    -   Create a dedicated ` .env` file inside the service folder.

### 3. Infrastructure Specifics
-   **Databases**: Each service `docker-compose.yml` will own its database adapter.
    -   *Critical Note*: **Port Management** is essential. Since we are exposing ports to the host for inter-service communication, we must ensure NO port conflicts (e.g., API DB on 5432, Payment DB on 5434).
-   **Protos**: Since `proto` files define contracts between services (e.g., API <-> Microservice), copies will need to be maintained in each service, or generated code must be checked in directly to each service.

## Next Steps
-   Approve this plan.
-   Select the first service to migrate (Recommended: `api`).
