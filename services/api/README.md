# YBB Platform API Service

NestJS-based API Gateway following Clean Architecture principles with Prisma ORM.

## Architecture

```
src/
├── core/                      # Domain Layer (Business Logic)
│   ├── entities/             # Domain entities
│   ├── value-objects/        # Value objects
│   ├── interfaces/           # Repository & service interfaces
│   └── exceptions/           # Domain exceptions
├── modules/                   # Feature Modules
│   ├── [module]/
│   │   ├── application/      # Application Layer (Use Cases)
│   │   │   ├── commands/     # Write operations
│   │   │   ├── queries/      # Read operations
│   │   │   └── dto/          # Data Transfer Objects
│   │   ├── domain/           # Module-specific domain (if any)
│   │   ├── infrastructure/   # Infrastructure Layer
│   │   │   ├── persistence/  # Repositories (Prisma)
│   │   │   ├── mappers/      # Domain ↔ Prisma mapping
│   │   │   └── services/     # External services
│   │   └── presentation/     # Presentation Layer
│   │       └── controllers/  # HTTP Controllers
└── shared/                    # Shared Infrastructure
    ├── decorators/
    ├── filters/
    ├── guards/
    ├── interceptors/
    ├── pipes/
    └── infrastructure/
        └── prisma/           # Prisma service & module
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ybb_platform?schema=public"
JWT_SECRET="your-secret-key"

# Optional: Advanced Features for Production
READ_REPLICA_URL="postgresql://user:password@replica:5432/ybb_platform"
DATABASE_READ_POOL_MAX=20
DATABASE_READ_POOL_MIN=2
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3
CIRCUIT_BREAKER_TIMEOUT=60000
```

**Advanced Features:**
- `READ_REPLICA_URL` - Optional read replica database for improved read performance
- `DATABASE_READ_POOL_*` - Optional dedicated connection pool sizing for read replica clients
- `CIRCUIT_BREAKER_*` - Circuit breaker configuration for database reliability (defaults shown above)

See [ADVANCED_FEATURES_SETUP.md](./docs/ADVANCED_FEATURES_SETUP.md) for detailed configuration.

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed
```

### Default Credentials (from Seed)

- **Email**: `admin@ybbhub.com`
- **Password**: `admin123`
- **Brand**: `Youth Break the Boundaries` (slug: `ybb`)

### 4. Start Development Server

```bash
npm run start:dev
```

API will be available at `http://localhost:3000`

## Available Scripts

### Development
- `npm run start:dev` - Start in watch mode
- `npm run start:debug` - Start with debugger

### Database
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Create and apply migrations
- `npm run prisma:studio` - Open Prisma Studio GUI
- `npm run prisma:seed` - Seed database with initial data
- `npm run prisma:reset` - Reset database (⚠️ deletes all data)

### Testing
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

### Production
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run prisma:migrate:prod` - Apply migrations in production

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3000/api/docs`

## Database Schema

The application uses Prisma with PostgreSQL. Key models:

- **User** - System users
- **Admin** - Admin users with roles
- **AdminRole** - Role definitions
- **Permission** - System permissions
- **Program** - Events/programs
- **Application** - User applications to programs
- **Payment** - Payment records
- **File** - File uploads

See `prisma/schema.prisma` for complete schema.

## Clean Architecture Layers

### 1. Domain Layer (`core/`)
- Pure business logic
- No dependencies on frameworks
- Entities, Value Objects, Interfaces

### 2. Application Layer (`modules/*/application/`)
- Use cases (Commands & Queries)
- Orchestrates domain objects
- DTOs for data transfer

### 3. Infrastructure Layer (`modules/*/infrastructure/`)
- Database access (Prisma repositories)
- External services
- Implements domain interfaces

### 4. Presentation Layer (`modules/*/presentation/`)
- HTTP controllers
- Request/Response handling
- API routes

## Key Principles

1. **Dependency Rule**: Dependencies point inward (Presentation → Application → Domain)
2. **Repository Pattern**: All database access through repositories
3. **CQRS**: Separate Commands (write) and Queries (read)
4. **Dependency Injection**: Use interfaces, inject implementations
5. **Mappers**: Convert between Domain entities and Prisma models

## Example: Creating a New Feature

```bash
# 1. Define domain entity (if needed)
# core/entities/new-entity.entity.ts

# 2. Define repository interface
# core/interfaces/repositories/new-entity.repository.interface.ts

# 3. Create use case
# modules/new-module/application/commands/create-new-entity.command.ts
# modules/new-module/application/commands/handlers/create-new-entity.handler.ts

# 4. Implement repository
# modules/new-module/infrastructure/persistence/new-entity.repository.ts
# modules/new-module/infrastructure/mappers/new-entity.mapper.ts

# 5. Create controller
# modules/new-module/presentation/new-entity.controller.ts
```

## Migration from MySQL

To migrate data from existing MySQL database:

```bash
# Set MySQL credentials in environment
export MYSQL_HOST=localhost
export MYSQL_USER=root
export MYSQL_PASSWORD=password
export MYSQL_DATABASE=ybb_master_app_db

# Run migration script
node scripts/migrate-mysql-to-postgres.js
```

See [MySQL Migration Guide](../../docs/mysql-to-postgresql-migration.md) for details.

## Testing Strategy

- **Unit Tests**: Test individual classes (use cases, entities)
- **Integration Tests**: Test repository implementations with test database
- **E2E Tests**: Test complete request/response cycles

## Contributing

1. Follow clean architecture principles
2. Write tests for new features
3. Use conventional commits
4. Update documentation

## License

Private - All Rights Reserved
