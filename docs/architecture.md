# YBB Platform - Architecture

## System Architecture

The YBB Platform is built using a microservices architecture with the following key components:

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           Nginx (Reverse Proxy)                  │
│                         Port 80/443 (HTTP/HTTPS)                 │
└───────────────┬──────────────────────────┬──────────────────────┘
                │                          │
        ┌───────▼────────┐        ┌───────▼────────┐
        │ Admin Dashboard│        │  API Gateway    │
        │   (Next.js)    │        │   (NestJS)      │
        │   Port 4001    │        │   Port 4000     │
        └────────────────┘        └───────┬─────────┘
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                │                         │                         │
        ┌───────▼────────┐      ┌────────▼────────┐      ┌────────▼────────┐
        │Payment Service │      │  File Service   │      │ Notification    │
        │    (Golang)    │      │    (Python)     │      │    Service      │
        │   Port 8002    │      │   Port 8001     │      │   Port 4002     │
        └───────┬────────┘      └────────┬────────┘      └────────┬────────┘
                │                        │                        │
                └────────────┬───────────┴────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┬───────────────────┐
        │                    │                    │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│   PostgreSQL   │  │     Redis      │  │     MinIO      │  │   RabbitMQ     │
│   (Database)   │  │    (Cache)     │  │   (Storage)    │  │  (Messages)    │
│   Port 5432    │  │   Port 6379    │  │  Port 9000/1   │  │  Port 5672     │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

## Service Communication

### 1. Admin Dashboard (Next.js)
- **Purpose**: Web-based administration interface
- **Technology**: Next.js 16+ with App Router, TypeScript, Tailwind CSS
- **Communication**: REST API calls to API Gateway

### 2. API Gateway (NestJS)
- **Purpose**: Central entry point for all API requests
- **Technology**: NestJS, TypeScript, TypeORM/Prisma
- **Responsibilities**:
  - Authentication and authorization
  - Request routing
  - Rate limiting
  - Response aggregation
- **Communication**:
  - REST APIs for external clients
  - gRPC for internal service communication
  - Direct database access

### 3. Payment Service (Golang)
- **Purpose**: Handle payment processing and Stripe integration
- **Technology**: Go 1.21+, Fiber/Gin, GORM
- **Responsibilities**:
  - Payment processing
  - Stripe integration
  - Payment webhooks
  - Refund handling
- **Communication**:
  - gRPC server for API Gateway
  - REST endpoints for webhooks
  - Direct database access

### 4. File Service (Python)
- **Purpose**: File upload, storage, and processing
- **Technology**: Python 3.11+, FastAPI, boto3
- **Responsibilities**:
  - File uploads
  - Image processing
  - S3/MinIO storage management
  - File metadata management
- **Communication**:
  - REST/gRPC for API Gateway
  - MinIO S3 API for storage
  - Direct database access

## Data Flow

### Example: User Application Submission

```
1. User submits application via Admin Dashboard
2. Dashboard → API Gateway (POST /api/v1/applications)
3. API Gateway validates and creates application record
4. API Gateway → File Service (upload supporting documents)
5. File Service → MinIO (store files)
6. File Service returns file URLs
7. API Gateway → Payment Service (create payment intent)
8. Payment Service → Stripe API
9. Payment Service returns payment details
10. API Gateway returns complete response to Dashboard
```

## Database Schema

### Core Tables
- **users**: User accounts and authentication
- **programs**: YBB programs and events
- **applications**: User applications to programs
- **payments**: Payment transactions
- **files**: File metadata and references
- **audit_logs**: System audit trail
- **sessions**: JWT refresh tokens

### Relationships
```
users (1) ──── (N) applications ──── (1) programs
applications (1) ──── (1) payments
users (1) ──── (N) files
```

## Security Architecture

### Authentication
- JWT-based authentication
- Access tokens (short-lived, 15 min)
- Refresh tokens (long-lived, 30 days)
- Token rotation on refresh

### Authorization
- Role-Based Access Control (RBAC)
- Roles: admin, staff, user
- Route-level guards
- Resource-level permissions

### Security Measures
1. **API Gateway Level**:
   - Rate limiting
   - CORS configuration
   - Input validation
   - Request sanitization

2. **Service Level**:
   - Internal authentication
   - gRPC security
   - Environment-based secrets

3. **Database Level**:
   - Prepared statements
   - ORM query builders
   - Connection pooling
   - Read replicas

4. **Infrastructure Level**:
   - HTTPS/TLS encryption
   - Network isolation
   - Container security
   - Secret management

## Scalability Strategy

### Horizontal Scaling
- All services are stateless
- Can scale independently
- Load balancing via Nginx

### Caching Strategy
- Redis for session storage
- API response caching
- Database query caching
- CDN for static assets

### Database Optimization
- Indexing strategy
- Read replicas
- Connection pooling
- Query optimization

### Message Queue (Optional)
- RabbitMQ for async operations
- Email notifications
- Background jobs
- Event-driven processing

## Monitoring & Observability

### Logging
- Centralized logging (ELK Stack)
- Structured JSON logs
- Log levels: error, warn, info, debug
- Request/response logging

### Metrics
- Prometheus for metrics collection
- Grafana for visualization
- Service health checks
- Performance metrics

### Tracing (Optional)
- Jaeger for distributed tracing
- Request flow tracking
- Performance bottleneck identification

## Technology Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16+, TypeScript, Tailwind CSS |
| API Gateway | NestJS 10+, TypeScript, Prisma |
| Payment Service | Go 1.21+, Fiber, GORM |
| File Service | Python 3.11+, FastAPI |
| Notification Service | NestJS 10+, TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7+ |
| Storage | MinIO (S3-compatible) |
| Message Queue | RabbitMQ 3+ |
| Monitoring | Prometheus, Grafana |
| Reverse Proxy | Nginx |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions |

## Design Decisions

### Why Microservices?
- Independent scaling
- Technology flexibility
- Team autonomy
- Fault isolation
- Easier maintenance

### Why Multiple Languages?
- **NestJS (TypeScript)**: Excellent for API gateways, strong typing
- **Go**: Performance for payment processing, concurrency
- **Python**: Rich ecosystem for file processing, ML capabilities

### Why Docker?
- Consistent environments
- Easy deployment
- Resource isolation
- Version control for infrastructure

## Future Enhancements

1. **Service Mesh**: Implement Istio for advanced traffic management
2. **Event Sourcing**: Add event store for audit and replay
3. **GraphQL**: Consider GraphQL gateway for flexible querying
4. **Serverless Functions**: Edge functions for specific operations
5. **ML/AI**: Analytics and recommendation engine
