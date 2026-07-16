# YBB Platform - Architecture Principles

## Core Principles

### 1. Clean Architecture
- **Dependency Rule**: Dependencies point inward. Inner layers know nothing about outer layers.
- **Layer Structure**:
  ```
  ┌─────────────────────────────────────┐
  │     Presentation/API Layer          │  (Controllers, Routes, DTOs)
  ├─────────────────────────────────────┤
  │     Application/Use Case Layer      │  (Business Logic, Orchestration)
  ├─────────────────────────────────────┤
  │     Domain Layer                    │  (Entities, Business Rules)
  ├─────────────────────────────────────┤
  │     Infrastructure Layer            │  (Database, External Services)
  └─────────────────────────────────────┘
  ```

### 2. Single Responsibility Principle (SRP)
- Each module/class has ONE reason to change
- Clear separation of concerns
- Example:
  - `UserService` → User business logic only
  - `UserRepository` → Database operations only
  - `UserController` → HTTP request handling only

### 3. Modular Design
- Feature-based modules (not layer-based at root)
- Each module is self-contained and can be independently deployed
- Clear module boundaries with defined interfaces

## Directory Structure by Service

### API Gateway (NestJS) - Clean Architecture

```
services/api/src/
├── main.ts
├── app.module.ts
│
├── core/                           # Core/Domain Layer
│   ├── entities/                   # Domain entities (business objects)
│   │   ├── user.entity.ts
│   │   ├── program.entity.ts
│   │   └── application.entity.ts
│   ├── interfaces/                 # Repository & service interfaces
│   │   ├── repositories/
│   │   │   ├── user.repository.interface.ts
│   │   │   └── program.repository.interface.ts
│   │   └── services/
│   │       └── email.service.interface.ts
│   ├── exceptions/                 # Domain exceptions
│   │   ├── user-not-found.exception.ts
│   │   └── invalid-operation.exception.ts
│   └── value-objects/              # Value objects (immutable)
│       ├── email.vo.ts
│       └── money.vo.ts
│
├── modules/                        # Feature Modules (Modular Design)
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── application/            # Use Cases
│   │   │   ├── commands/          # Write operations
│   │   │   │   ├── login.command.ts
│   │   │   │   ├── register.command.ts
│   │   │   │   └── handlers/
│   │   │   │       ├── login.handler.ts
│   │   │   │       └── register.handler.ts
│   │   │   ├── queries/           # Read operations
│   │   │   │   ├── get-current-user.query.ts
│   │   │   │   └── handlers/
│   │   │   │       └── get-current-user.handler.ts
│   │   │   └── dto/               # Data Transfer Objects
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   ├── infrastructure/        # Infrastructure Layer
│   │   │   ├── persistence/
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── session.repository.ts
│   │   │   ├── services/
│   │   │   │   ├── jwt.service.ts
│   │   │   │   └── hash.service.ts
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts
│   │   │       └── roles.guard.ts
│   │   └── presentation/          # Presentation Layer
│   │       ├── auth.controller.ts
│   │       └── dto/
│   │           ├── auth-response.dto.ts
│   │           └── login-request.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── create-user.command.ts
│   │   │   │   ├── update-user.command.ts
│   │   │   │   └── handlers/
│   │   │   ├── queries/
│   │   │   │   ├── get-user.query.ts
│   │   │   │   ├── list-users.query.ts
│   │   │   │   └── handlers/
│   │   │   └── dto/
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   └── user.repository.ts
│   │   │   └── mappers/
│   │   │       └── user.mapper.ts
│   │   └── presentation/
│   │       ├── users.controller.ts
│   │       └── dto/
│   │
│   ├── programs/
│   │   ├── programs.module.ts
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── presentation/
│   │
│   └── applications/
│       ├── applications.module.ts
│       ├── application/
│       ├── infrastructure/
│       └── presentation/
│
├── shared/                         # Shared Utilities
│   ├── decorators/
│   ├── interceptors/
│   ├── filters/
│   ├── pipes/
│   └── utils/
│
└── config/                         # Configuration
    ├── database.config.ts
    └── app.config.ts
```

### Payment Service (Golang) - Clean Architecture

```
services/payment-service/
├── cmd/
│   └── server/
│       └── main.go                # Entry point
│
├── internal/
│   ├── domain/                    # Domain Layer
│   │   ├── entities/
│   │   │   ├── payment.go
│   │   │   └── refund.go
│   │   ├── repositories/         # Repository interfaces
│   │   │   └── payment_repository.go
│   │   ├── services/             # Domain service interfaces
│   │   │   └── payment_processor.go
│   │   └── errors/               # Domain errors
│   │       └── payment_errors.go
│   │
│   ├── application/               # Application Layer (Use Cases)
│   │   ├── commands/
│   │   │   ├── create_payment.go
│   │   │   ├── process_refund.go
│   │   │   └── handlers/
│   │   ├── queries/
│   │   │   ├── get_payment.go
│   │   │   ├── list_payments.go
│   │   │   └── handlers/
│   │   └── dto/
│   │       ├── payment_request.go
│   │       └── payment_response.go
│   │
│   ├── infrastructure/            # Infrastructure Layer
│   │   ├── persistence/
│   │   │   ├── postgres/
│   │   │   │   └── payment_repository.go
│   │   │   └── migrations/
│   │   ├── services/
│   │   │   ├── stripe_service.go
│   │   │   └── notification_service.go
│   │   ├── grpc/
│   │   │   └── server.go
│   │   └── http/
│   │       └── webhook_handler.go
│   │
│   └── presentation/              # Presentation Layer
│       ├── grpc/
│       │   └── payment_handler.go
│       └── http/
│           └── payment_controller.go
│
└── pkg/                           # Shared packages
    ├── logger/
    ├── validator/
    └── middleware/
```

### File Service (Python) - Clean Architecture

```
services/file-service/app/
├── main.py                        # Entry point
│
├── domain/                        # Domain Layer
│   ├── entities/
│   │   ├── file.py
│   │   └── file_metadata.py
│   ├── repositories/             # Repository interfaces
│   │   └── file_repository.py
│   ├── services/                 # Domain service interfaces
│   │   ├── storage_service.py
│   │   └── processor_service.py
│   └── exceptions/
│       └── file_exceptions.py
│
├── application/                   # Application Layer
│   ├── commands/
│   │   ├── upload_file.py
│   │   ├── delete_file.py
│   │   └── handlers/
│   ├── queries/
│   │   ├── get_file.py
│   │   ├── list_files.py
│   │   └── handlers/
│   └── dto/
│       ├── file_upload_dto.py
│       └── file_response_dto.py
│
├── infrastructure/                # Infrastructure Layer
│   ├── persistence/
│   │   └── postgres/
│   │       └── file_repository.py
│   ├── storage/
│   │   ├── minio_storage.py
│   │   └── s3_storage.py
│   ├── processors/
│   │   ├── image_processor.py
│   │   └── document_processor.py
│   └── mappers/
│       └── file_mapper.py
│
└── presentation/                  # Presentation Layer
    ├── api/
    │   ├── routes/
    │   │   ├── upload.py
    │   │   ├── download.py
    │   │   └── files.py
    │   └── dto/
    │       └── file_dto.py
    └── dependencies.py
```

### Admin Dashboard (Next.js) - Clean Architecture

```
services/admin-dashboard/src/
├── app/                           # Next.js App Router
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/
│
├── modules/                       # Feature Modules
│   ├── auth/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   └── interfaces/
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   └── dto/
│   │   ├── infrastructure/
│   │   │   └── api/
│   │   │       └── auth-api.ts
│   │   └── presentation/
│   │       ├── components/
│   │       └── hooks/
│   │
│   ├── users/
│   ├── programs/
│   └── applications/
│
├── shared/                        # Shared Utilities
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types/
│
└── lib/                          # Core libraries
    ├── api-client.ts
    └── auth.ts
```

## Module Communication

### 1. Between Layers (Within a Service)
```typescript
// ❌ BAD: Controller directly accessing repository
@Controller('users')
export class UsersController {
  constructor(private userRepository: UserRepository) {}
  
  @Get()
  async getUsers() {
    return this.userRepository.findAll(); // Direct dependency on infrastructure
  }
}

// ✅ GOOD: Controller → Use Case → Repository
@Controller('users')
export class UsersController {
  constructor(private getUsersUseCase: GetUsersUseCase) {}
  
  @Get()
  async getUsers() {
    return this.getUsersUseCase.execute();
  }
}

// Use Case
export class GetUsersUseCase {
  constructor(private userRepository: IUserRepository) {} // Interface, not concrete class
  
  async execute(): Promise<UserDto[]> {
    const users = await this.userRepository.findAll();
    return users.map(user => UserMapper.toDto(user));
  }
}
```

### 2. Between Modules (Within a Service)
```typescript
// ❌ BAD: Direct module dependency
import { UserService } from '../users/application/services/user.service';

// ✅ GOOD: Through module exports and interfaces
// users.module.ts
@Module({
  providers: [UserService],
  exports: [UserService], // Explicitly export what others can use
})
export class UsersModule {}

// applications.module.ts
@Module({
  imports: [UsersModule], // Import the module, not individual services
  providers: [ApplicationService],
})
export class ApplicationsModule {}
```

### 3. Between Services
```typescript
// ✅ Use well-defined APIs (REST/gRPC)
// API Gateway → Payment Service
export class PaymentClient {
  constructor(private grpcClient: GrpcClient) {}
  
  async createPayment(data: CreatePaymentDto): Promise<PaymentDto> {
    return this.grpcClient.call('payment.PaymentService', 'CreatePayment', data);
  }
}
```

## Best Practices

### 1. Dependency Injection
```typescript
// ✅ Use constructor injection
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger,
  ) {}
}
```

### 2. Interface Segregation
```typescript
// ✅ Small, focused interfaces
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

// ❌ BAD: Fat interface
export interface IUserRepository {
  findById(id: string): Promise<User>;
  findByEmail(email: string): Promise<User>;
  save(user: User): Promise<User>;
  sendEmail(user: User): Promise<void>; // Wrong responsibility!
  generateReport(): Promise<Report>;    // Wrong responsibility!
}
```

### 3. CQRS Pattern
```typescript
// Separate read and write operations

// Command (Write)
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {}
}

export class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<UserDto> {
    // Validation, business logic, persistence
  }
}

// Query (Read)
export class GetUserQuery {
  constructor(public readonly id: string) {}
}

export class GetUserHandler {
  async execute(query: GetUserQuery): Promise<UserDto> {
    // Fetch and return data
  }
}
```

### 4. Error Handling
```typescript
// Domain exceptions
export class UserNotFoundException extends DomainException {
  constructor(userId: string) {
    super(`User with id ${userId} not found`);
    this.name = 'UserNotFoundException';
  }
}

// Global exception filter
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Map domain exceptions to HTTP responses
  }
}
```

## Testing Strategy

### 1. Unit Tests
- Test business logic in isolation
- Mock all dependencies
- Focus on use cases and domain logic

### 2. Integration Tests
- Test module integration
- Use test database
- Test repository implementations

### 3. E2E Tests
- Test complete user flows
- Test API endpoints
- Test service interactions

## Migration Guide

### Phase 1: New Features
- Implement all new features following clean architecture
- Use the structure defined above

### Phase 2: Refactor Existing Code
- Identify modules with high coupling
- Extract use cases from controllers
- Create repository interfaces
- Move business logic to domain layer

### Phase 3: Continuous Improvement
- Regular code reviews focusing on architecture
- Refactor one module at a time
- Update documentation as you go
