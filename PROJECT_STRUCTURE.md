# YBB Platform - Project Structure

## Overview
Monorepo architecture for YBB master platform with microservices managed by Docker.

## Directory Structure

```
ybb-platform/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
│
├── services/
│   ├── api/                           # NestJS API Gateway & Main Backend
│   │   ├── Dockerfile
│   │   ├── Dockerfile.prod
│   │   ├── .dockerignore
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/               # Shared utilities
│   │   │   │   ├── guards/
│   │   │   │   ├── decorators/
│   │   │   │   ├── interceptors/
│   │   │   │   ├── filters/
│   │   │   │   └── pipes/
│   │   │   ├── config/               # Configuration
│   │   │   │   ├── database.config.ts
│   │   │   │   ├── redis.config.ts
│   │   │   │   └── app.config.ts
│   │   │   ├── auth/                 # Authentication module
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── strategies/
│   │   │   │   └── dto/
│   │   │   ├── users/                # Users module
│   │   │   ├── programs/             # YBB Programs module
│   │   │   ├── applications/         # Applications module
│   │   │   └── health/               # Health check module
│   │   └── test/
│   │
│   ├── payment-service/               # Golang Payment Service
│   │   ├── Dockerfile
│   │   ├── Dockerfile.prod
│   │   ├── .dockerignore
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── .env.example
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── config/               # Configuration
│   │   │   ├── handler/              # HTTP handlers
│   │   │   │   ├── payment.go
│   │   │   │   └── webhook.go
│   │   │   ├── service/              # Business logic
│   │   │   │   ├── payment.go
│   │   │   │   └── stripe.go
│   │   │   ├── repository/           # Database layer
│   │   │   ├── model/                # Data models
│   │   │   ├── middleware/           # Middleware
│   │   │   └── grpc/                 # gRPC server
│   │   ├── pkg/                      # Shared packages
│   │   │   ├── logger/
│   │   │   └── validator/
│   │   └── api/
│   │       └── proto/                # Protocol buffer definitions
│   │
│   ├── file-service/                  # Python File Management Service
│   │   ├── Dockerfile
│   │   ├── Dockerfile.prod
│   │   ├── .dockerignore
│   │   ├── requirements.txt
│   │   ├── requirements-dev.txt
│   │   ├── .env.example
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── routes/
│   │   │   │   │   ├── upload.py
│   │   │   │   │   ├── download.py
│   │   │   │   │   └── process.py
│   │   │   │   └── dependencies.py
│   │   │   ├── core/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── storage.py       # S3/MinIO integration
│   │   │   │   ├── processor.py     # Image/file processing
│   │   │   │   └── security.py
│   │   │   ├── models/
│   │   │   │   └── file.py
│   │   │   ├── schemas/
│   │   │   │   └── file.py
│   │   │   └── utils/
│   │   └── tests/
│   │
│   └── admin-dashboard/               # Next.js Admin Dashboard
│       ├── Dockerfile
│       ├── Dockerfile.prod
│       ├── .dockerignore
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── .env.example
│       ├── public/
│       ├── src/
│       │   ├── app/                  # App Router
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── (auth)/          # Auth routes
│       │   │   │   ├── login/
│       │   │   │   └── register/
│       │   │   ├── (dashboard)/     # Dashboard routes
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── dashboard/
│       │   │   │   ├── programs/
│       │   │   │   ├── applications/
│       │   │   │   ├── users/
│       │   │   │   ├── payments/
│       │   │   │   └── settings/
│       │   │   └── api/             # API routes
│       │   ├── components/
│       │   │   ├── ui/              # shadcn/ui components
│       │   │   ├── layout/
│       │   │   ├── forms/
│       │   │   └── shared/
│       │   ├── lib/
│       │   │   ├── api-client.ts    # API communication
│       │   │   ├── auth.ts
│       │   │   └── utils.ts
│       │   ├── hooks/
│       │   ├── types/
│       │   └── store/               # State management (Zustand)
│       └── tests/
│
├── infrastructure/
│   ├── nginx/
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   ├── conf.d/
│   │   │   ├── api.conf
│   │   │   ├── dashboard.conf
│   │   │   └── ssl.conf
│   │   └── ssl/                     # SSL certificates
│   │
│   ├── postgres/
│   │   ├── Dockerfile
│   │   ├── init/
│   │   │   ├── 01-init-databases.sql
│   │   │   ├── 02-init-extensions.sql
│   │   │   └── 03-init-users.sql
│   │   └── backups/
│   │
│   ├── redis/
│   │   ├── redis.conf
│   │   └── Dockerfile
│   │
│   ├── minio/                       # Object Storage
│   │   └── config/
│   │
│   └── rabbitmq/                    # Message Queue (optional)
│       └── rabbitmq.conf
│
├── shared/
│   ├── proto/                       # gRPC/Protocol Buffer definitions
│   │   ├── payment.proto
│   │   ├── file.proto
│   │   └── common.proto
│   ├── types/                       # Shared TypeScript types
│   │   ├── user.ts
│   │   ├── program.ts
│   │   ├── application.ts
│   │   └── payment.ts
│   ├── constants/                   # Shared constants
│   └── docs/                        # API documentation
│       ├── api-gateway.md
│       ├── payment-service.md
│       └── file-service.md
│
├── database/
│   ├── migrations/                  # Database migrations
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_programs_table.sql
│   │   └── ...
│   ├── seeds/                       # Seed data
│   │   ├── users.sql
│   │   └── programs.sql
│   └── schema.sql                   # Complete schema
│
├── scripts/
│   ├── setup.sh                     # Initial setup script
│   ├── dev.sh                       # Start development environment
│   ├── prod.sh                      # Production deployment
│   ├── seed-db.sh                   # Seed database
│   ├── backup.sh                    # Backup script
│   ├── restore.sh                   # Restore script
│   ├── generate-proto.sh            # Generate proto files
│   └── health-check.sh              # Health check all services
│
├── k8s/                             # Kubernetes manifests (for production)
│   ├── namespaces/
│   ├── deployments/
│   ├── services/
│   ├── ingress/
│   ├── configmaps/
│   └── secrets/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # CI pipeline
│       ├── cd.yml                   # CD pipeline
│       └── test.yml                 # Test workflow
│
└── docs/
    ├── architecture.md              # Architecture overview
    ├── setup.md                     # Setup instructions
    ├── api-documentation.md         # API documentation
    ├── deployment.md                # Deployment guide
    └── contributing.md              # Contribution guidelines
```

## Port Allocation

| Service | Development Port | Production Port | Protocol |
|---------|-----------------|-----------------|----------|
| Nginx | 80, 443 | 80, 443 | HTTP/HTTPS |
| Admin Dashboard | 3000 | - | HTTP (internal) |
| API Gateway | 4000 | - | HTTP (internal) |
| Payment Service | 8080 | - | HTTP/gRPC (internal) |
| File Service | 8000 | - | HTTP (internal) |
| PostgreSQL | 5432 | 5432 | TCP |
| Redis | 6379 | 6379 | TCP |
| MinIO | 9000, 9001 | 9000, 9001 | HTTP |
| RabbitMQ | 5672, 15672 | 5672, 15672 | AMQP/HTTP |

## Service Communication

### External Access (via Nginx)
- `/` → Admin Dashboard (Next.js)
- `/api/v1/*` → API Gateway (NestJS)
- `/api/v1/payments/*` → Payment Service (Golang) - proxied through API Gateway
- `/api/v1/files/*` → File Service (Python) - proxied through API Gateway

### Internal Communication
- API Gateway ↔ Payment Service: gRPC
- API Gateway ↔ File Service: REST/gRPC
- All services ↔ PostgreSQL: Direct connection
- All services ↔ Redis: Direct connection
- File Service ↔ MinIO: S3 API

## Technology Stack

### Backend Services
- **API Gateway**: NestJS 10+ (Node.js, TypeScript)
  - Framework: NestJS with Express
  - ORM: TypeORM or Prisma
  - Validation: class-validator, class-transformer
  - Auth: Passport.js (JWT, OAuth2)
  - Documentation: Swagger/OpenAPI
  
- **Payment Service**: Golang 1.21+
  - Framework: Fiber or Gin
  - Database: GORM
  - Payment: Stripe SDK
  - gRPC: google.golang.org/grpc
  
- **File Service**: Python 3.11+
  - Framework: FastAPI
  - Storage: boto3 (S3/MinIO)
  - Processing: Pillow, opencv-python
  - Validation: Pydantic

### Frontend
- **Admin Dashboard**: Next.js 14+ (App Router)
  - UI: shadcn/ui + Tailwind CSS
  - State: Zustand or Redux Toolkit
  - Forms: React Hook Form + Zod
  - Charts: Recharts or Chart.js
  - Tables: TanStack Table

### Infrastructure
- **Database**: PostgreSQL 16 + pgvector
- **Cache**: Redis 7+
- **Reverse Proxy**: Nginx
- **Object Storage**: MinIO (S3-compatible)
- **Message Queue**: RabbitMQ (optional)

### DevOps & Monitoring
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes (production)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Loki or ELK Stack
- **Tracing**: Jaeger (optional)

## Environment Variables

Each service will have its own `.env.example` file. Common variables:

```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/ybb_db
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=ybb_user
DATABASE_PASSWORD=secure_password
DATABASE_NAME=ybb_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d

# Services URLs
API_GATEWAY_URL=http://api:4000
PAYMENT_SERVICE_URL=http://payment-service:8080
FILE_SERVICE_URL=http://file-service:8000

# MinIO/S3
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=ybb-files

# External Services
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Environment
NODE_ENV=development
GO_ENV=development
PYTHON_ENV=development
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Go 1.21+ (for local development)
- Python 3.11+ (for local development)

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd ybb-platform

# Copy environment files
cp .env.example .env

# Run setup script
./scripts/setup.sh

# Start all services
make dev
# or
docker-compose up -d

# Check service health
./scripts/health-check.sh
```

## Development Workflow

1. **Local Development**: Use Docker Compose
2. **Database Migrations**: Run migrations from API service
3. **Testing**: Each service has its own test suite
4. **Building**: Docker builds with multi-stage for production
5. **Deployment**: Kubernetes manifests for production

## Database Schema

### Core Tables
- `users` - User accounts
- `programs` - YBB programs
- `applications` - Program applications
- `payments` - Payment records
- `files` - File metadata
- `audit_logs` - Audit trail

### Relations
- User → Applications (1:N)
- Program → Applications (1:N)
- Application → Payments (1:N)
- User → Files (1:N)

## API Documentation

- **API Gateway**: http://localhost:4000/api/docs (Swagger)
- **Payment Service**: http://localhost:8080/swagger/
- **File Service**: http://localhost:8000/docs (FastAPI auto-docs)

## Security Considerations

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting on all endpoints
- CORS configuration
- Input validation and sanitization
- SQL injection prevention (ORM)
- File upload restrictions
- Environment-based secrets management
- HTTPS in production (Let's Encrypt)

## Scalability

- Horizontal scaling for all services
- Database read replicas
- Redis cluster for caching
- CDN for static assets
- Load balancing with Nginx
- Message queue for async operations

## Next Steps

1. Create base project structure
2. Set up Docker Compose
3. Initialize each service with boilerplate
4. Configure database and migrations
5. Implement authentication
6. Build core features per service
7. Set up CI/CD pipeline
8. Deploy to staging/production
