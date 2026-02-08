# GitHub Copilot Instructions for YBB Platform

You are an AI assistant helping with the YBB Platform, a microservices-based application management system built with clean architecture principles.

## Project Context

This is a **microservices monorepo** with the following services:
- **API Gateway** (NestJS/TypeScript) - Main backend API
- **Payment Service** (Golang) - Payment processing with Stripe
- **File Service** (Python/FastAPI) - File upload and storage
- **Admin Dashboard** (Next.js 14) - Web interface

## Architecture Principles - CRITICAL

### 1. Clean Architecture (ALWAYS FOLLOW)
Every service follows clean architecture with these layers:

```
Presentation → Application → Domain → Infrastructure
(API/UI)      (Use Cases)   (Business) (Database/External)
```

**Dependency Rule**: Dependencies ONLY point inward. Outer layers depend on inner layers, NEVER the reverse.

#### Layer Responsibilities

**Domain Layer** (Core Business Logic)
- Entities: Business objects with identity
- Value Objects: Immutable objects without identity
- Interfaces: Repository and service contracts
- Domain Exceptions: Business rule violations
- **NO** dependencies on other layers
- **NO** framework-specific code

**Application Layer** (Use Cases)
- Commands: Write operations (Create, Update, Delete)
- Queries: Read operations (Get, List)
- DTOs: Data transfer objects
- Orchestrates domain objects
- Depends ONLY on Domain layer

**Infrastructure Layer** (Technical Implementation)
- Database repositories
- External service clients
- File system access
- Framework-specific code
- Implements domain interfaces

**Presentation Layer** (API/UI)
- Controllers/Handlers
- Request/Response DTOs
- Routes
- Depends on Application layer only

### 2. Single Responsibility Principle
- Each class has ONE reason to change
- Clear separation: Controller → Use Case → Repository
- Example:
  ```typescript
  UserController.ts    // Handle HTTP only
  CreateUserUseCase.ts // Business logic only
  UserRepository.ts    // Database only
  ```

### 3. Modular Design
- Feature-based modules (auth/, users/, programs/)
- Each module is self-contained
- Modules communicate through well-defined interfaces
- Example structure:
  ```
  modules/users/
    ├── application/      # Use cases
    ├── domain/          # Entities & interfaces
    ├── infrastructure/  # Repositories & services
    └── presentation/    # Controllers & DTOs
  ```

## Code Generation Guidelines

### When Creating a New Feature

1. **Start with Domain Layer**
   ```typescript
   // 1. Create entity
   // core/entities/user.entity.ts
   export class User {
     constructor(
       public readonly id: string,
       public readonly email: Email, // Value object
       public firstName: string,
     ) {}
   }
   
   // 2. Create repository interface
   // core/interfaces/repositories/user.repository.interface.ts
   export interface IUserRepository {
     findById(id: string): Promise<User | null>;
     save(user: User): Promise<User>;
   }
   ```

2. **Then Application Layer**
   ```typescript
   // modules/users/application/commands/create-user.command.ts
   export class CreateUserCommand {
     constructor(
       public readonly email: string,
       public readonly firstName: string,
     ) {}
   }
   
   // modules/users/application/commands/handlers/create-user.handler.ts
   export class CreateUserHandler {
     constructor(private userRepo: IUserRepository) {}
     
     async execute(command: CreateUserCommand): Promise<UserDto> {
       // Business logic here
       const user = new User(...);
       await this.userRepo.save(user);
       return UserMapper.toDto(user);
     }
   }
   ```

3. **Then Infrastructure Layer**
   ```typescript
   // modules/users/infrastructure/persistence/user.repository.ts
   export class UserRepository implements IUserRepository {
     constructor(private db: Database) {}
     
     async findById(id: string): Promise<User | null> {
       const data = await this.db.query(...);
       return data ? UserMapper.toDomain(data) : null;
     }
   }
   ```

4. **Finally Presentation Layer**
   ```typescript
   // modules/users/presentation/users.controller.ts
   @Controller('users')
   export class UsersController {
     constructor(private createUserHandler: CreateUserHandler) {}
     
     @Post()
     async create(@Body() dto: CreateUserDto) {
       const command = new CreateUserCommand(dto.email, dto.firstName);
       return this.createUserHandler.execute(command);
     }
   }
   ```

### File Naming Conventions

**NestJS/TypeScript:**
- Entities: `user.entity.ts`
- Interfaces: `user.repository.interface.ts`
- Commands: `create-user.command.ts`
- Handlers: `create-user.handler.ts`
- Controllers: `users.controller.ts`
- Repositories: `user.repository.ts`
- DTOs: `create-user.dto.ts`

**Golang:**
- Entities: `user.go`
- Interfaces: `user_repository.go`
- Commands: `create_user.go`
- Handlers: `create_user_handler.go`

**Python:**
- Entities: `user.py`
- Commands: `create_user.py`
- Handlers: `create_user_handler.py`

### NEVER Do This ❌

```typescript
// ❌ Controller accessing repository directly
@Controller('users')
export class UsersController {
  constructor(private userRepo: UserRepository) {} // BAD!
  
  @Get()
  async getUsers() {
    return this.userRepo.findAll(); // Bypassing business logic!
  }
}

// ❌ Domain entity depending on infrastructure
import { Database } from './infrastructure/database'; // BAD!

export class User {
  async save() {
    await Database.query(...); // Domain shouldn't know about DB!
  }
}

// ❌ Use case with HTTP-specific code
export class CreateUserUseCase {
  async execute(req: Request) { // BAD! HTTP dependency in use case
    const user = req.body; // Should use DTO
  }
}
```

### ALWAYS Do This ✅

```typescript
// ✅ Clean architecture flow
@Controller('users')
export class UsersController {
  constructor(private createUserUseCase: CreateUserUseCase) {}
  
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const command = new CreateUserCommand(dto.email, dto.firstName);
    return this.createUserUseCase.execute(command);
  }
}

// ✅ Use case depends on interface
export class CreateUserUseCase {
  constructor(private userRepo: IUserRepository) {} // Interface!
  
  async execute(command: CreateUserCommand): Promise<UserDto> {
    // Pure business logic
  }
}

// ✅ Repository implements interface
export class UserRepository implements IUserRepository {
  // Implementation details
}
```

## Service-Specific Guidelines

### API Gateway (NestJS)

**Directory Structure:**
```
modules/[feature]/
  ├── application/
  │   ├── commands/
  │   │   └── handlers/
  │   ├── queries/
  │   │   └── handlers/
  │   └── dto/
  ├── domain/ (if module-specific)
  ├── infrastructure/
  │   ├── persistence/
  │   └── services/
  └── presentation/
      ├── [feature].controller.ts
      └── dto/
```

**Use NestJS decorators appropriately:**
```typescript
@Injectable()  // For services, use cases, repositories
@Controller()  // For controllers only
@Module()      // For module definition
```

### Payment Service (Golang)

**Directory Structure:**
```
internal/
  ├── domain/
  │   ├── entities/
  │   └── repositories/
  ├── application/
  │   ├── commands/
  │   └── queries/
  ├── infrastructure/
  │   └── persistence/
  └── presentation/
```

**Use interfaces:**
```go
// Domain layer
type PaymentRepository interface {
    FindByID(id string) (*Payment, error)
    Save(payment *Payment) error
}

// Infrastructure layer
type postgresPaymentRepository struct {
    db *sql.DB
}

func (r *postgresPaymentRepository) FindByID(id string) (*Payment, error) {
    // Implementation
}
```

### File Service (Python)

**Directory Structure:**
```
app/
  ├── domain/
  ├── application/
  ├── infrastructure/
  └── presentation/
```

**Use ABC for interfaces:**
```python
from abc import ABC, abstractmethod

class FileRepository(ABC):
    @abstractmethod
    async def find_by_id(self, file_id: str) -> File:
        pass
    
    @abstractmethod
    async def save(self, file: File) -> File:
        pass
```

### Admin Dashboard (Next.js)

**Use clean architecture in client:**
```typescript
// modules/users/infrastructure/api/users-api.ts
export class UsersApi {
  async getUsers(): Promise<UserDto[]> {
    // API call
  }
}

// modules/users/application/use-cases/get-users.use-case.ts
export class GetUsersUseCase {
  constructor(private api: IUsersApi) {}
  
  async execute(): Promise<UserViewModel[]> {
    const users = await this.api.getUsers();
    return users.map(u => this.toViewModel(u));
  }
}

// modules/users/presentation/hooks/use-users.ts
export function useUsers() {
  const useCase = new GetUsersUseCase(new UsersApi());
  return useQuery(['users'], () => useCase.execute());
}
```

## Testing Guidelines

**Test at the right layer:**

```typescript
// Unit test - Application layer
describe('CreateUserUseCase', () => {
  it('should create user', async () => {
    const mockRepo = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    
    const useCase = new CreateUserUseCase(mockRepo);
    await useCase.execute(new CreateUserCommand('test@test.com', 'John'));
    
    expect(mockRepo.save).toHaveBeenCalled();
  });
});

// Integration test - Infrastructure layer
describe('UserRepository', () => {
  it('should save user to database', async () => {
    // Use test database
    const repo = new UserRepository(testDb);
    const user = new User('1', new Email('test@test.com'), 'John');
    
    await repo.save(user);
    const found = await repo.findById('1');
    
    expect(found).toBeDefined();
  });
});
```

## Common Patterns

### CQRS (Commands & Queries)
- **Commands**: Modify state (Create, Update, Delete)
- **Queries**: Read state (Get, List)
- Keep them separate

### Repository Pattern
```typescript
// Interface in domain
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

// Implementation in infrastructure
export class UserRepository implements IUserRepository {
  // PostgreSQL/TypeORM implementation
}
```

### Dependency Injection
- Use constructor injection
- Inject interfaces, not concrete classes
- Let the DI container handle instantiation

## Error Handling

```typescript
// Domain exception
export class UserNotFoundException extends DomainException {
  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}

// Application layer
export class GetUserUseCase {
  async execute(query: GetUserQuery): Promise<UserDto> {
    const user = await this.repo.findById(query.id);
    if (!user) {
      throw new UserNotFoundException(query.id);
    }
    return UserMapper.toDto(user);
  }
}

// Presentation layer - global filter handles it
@Catch(DomainException)
export class DomainExceptionFilter {
  catch(exception: DomainException) {
    return {
      statusCode: 400,
      message: exception.message,
    };
  }
}
```

## When Making Changes

1. **Identify the layer** where change belongs
2. **Check dependencies** - are they pointing inward?
3. **Use interfaces** for cross-layer communication
4. **Keep modules independent** - avoid direct imports between feature modules
5. **Follow naming conventions** for consistency

## Transaction Management (CRITICAL)

### Unit of Work Pattern

**ALWAYS use UnitOfWork for multi-repository operations.** Never use `this.prisma.$transaction` directly in handlers.

```typescript
// ✅ CORRECT: Use UnitOfWork
@Injectable()
export class CreateUserHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}
  
  async execute(command: CreateUserCommand): Promise<UserDto> {
    return this.unitOfWork.execute(
      async (repos) => {
        // All operations share the same transaction
        const user = await repos.users.create({ data: { ... } });
        await repos.participants.create({ data: { userId: user.id, ... } });
        await repos.createAmbassadorReferral(user.id, command.referralCode);
        
        return UserMapper.toDto(user);
      },
      { 
        name: 'user-registration',  // For monitoring
        timeout: 10000              // 10s for complex operation
      }
    );
  }
}

// ❌ WRONG: Direct Prisma transaction
async execute(command: CreateUserCommand) {
  return this.prisma.$transaction(async (tx) => {  // Don't do this!
    const user = await tx.user.create(...);
    // ...
  });
}
```

### Transaction Timeout Guidelines

Choose timeout based on operation complexity:
- **Simple (2 tables)**: 3000ms (3s)
- **Medium (3-4 tables)**: 5000ms (5s)
- **Complex (5+ tables)**: 10000ms (10s)

```typescript
// Simple example
await this.unitOfWork.execute(
  async (repos) => {
    await repos.users.update({ where: { id }, data: { emailVerified: true } });
    await repos.participants.update({ where: { userId: id }, data: { emailVerified: true } });
  },
  { name: 'verify-email-sync', timeout: 3000 }
);

// Complex example
await this.unitOfWork.execute(
  async (repos) => {
    const user = await repos.users.create({ ... });
    const participant = await repos.participants.create({ ... });
    await repos.createAmbassadorReferral(user.id, referralCode);
    await repos.incrementAmbassadorReferrals(ambassadorId);
    await repos.applications.create({ ... });
  },
  { name: 'user-registration', timeout: 10000 }
);
```

### Read-Only Operations

Use `executeReadOnly()` for queries that don't modify data:

```typescript
// ✅ Automatically routed to read replica when READ_REPLICA_URL is configured
const stats = await this.unitOfWork.executeReadOnly(
  async (repos) => {
    const userCount = await repos.users.count();
    const participantCount = await repos.participants.count();
    return { userCount, participantCount };
  },
  { name: 'dashboard-stats' }
);
```

### Helper Methods in TransactionalRepositories

Use built-in helper methods for common patterns:

```typescript
await this.unitOfWork.execute(async (repos) => {
  // ✅ Use helper methods
  await repos.createAmbassadorReferral(userId, referralCode);
  await repos.incrementAmbassadorReferrals(ambassadorId);
  await repos.createAdmin(userId, email, fullName, brandIds);
  await repos.updateApplicationPaymentStatus(applicationId, 'paid');
  
  // ❌ Don't reimplement common operations
  // await repos.tx.ambassadorReferral.create({ ... }); // Use helper instead
}, { name: 'operation', timeout: 5000 });
```

### When NOT to Use Transactions

Don't use transactions for:
- Single repository operations
- Read-only queries
- Operations that don't need atomicity

```typescript
// ❌ Overkill - single operation
await this.unitOfWork.execute(
  async (repos) => {
    return repos.users.findUnique({ where: { id } });
  },
  { name: 'get-user' }
);

// ✅ Correct - direct repository access
const user = await this.prisma.user.findUnique({ where: { id } });
```

### Advanced Features Configuration

The Unit of Work supports advanced features for scalability and reliability. Configure via environment variables:

#### Read Replica Routing
Automatically routes read-only queries to replica databases:

```bash
# .env
READ_REPLICA_URL=postgresql://user:pass@replica-host:5432/ybb_platform
```

```typescript
// Automatically uses READ_REPLICA_URL when configured
const users = await this.unitOfWork.executeReadOnly(
  async (repos) => repos.users.findMany(),
  { name: 'list-users' }
);
```

#### Circuit Breaker Protection
Prevents cascade failures during database outages:

```bash
# .env (optional - uses defaults if not set)
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5   # Open after 5 failures
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3   # Close after 3 successes  
CIRCUIT_BREAKER_TIMEOUT=60000         # Reset after 60 seconds
```

No code changes required - automatically enabled!

#### Query Batching
Execute multiple operations in a single transaction:

```typescript
await this.unitOfWork.batchExecute([
  { repos => repos.users.create({ data: user1 }) },
  { repos => repos.users.create({ data: user2 }) },
  { repos => repos.users.create({ data: user3 }) },
], { name: 'bulk-user-import' });
```

See [ADVANCED_FEATURES_SETUP.md](../services/api/docs/ADVANCED_FEATURES_SETUP.md) for complete documentation.

## CQRS Pattern

### Commands (Write Operations)

Commands modify state and should be named imperatively:

```typescript
// Command DTO
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {}
}

// Command Handler
@Injectable()
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly metricsService: MetricsService,
  ) {}
  
  async execute(command: CreateUserCommand): Promise<UserDto> {
    const start = Date.now();
    
    try {
      const result = await this.unitOfWork.execute(
        async (repos) => {
          // Business logic here
          const user = await repos.users.create({
            data: {
              email: command.email,
              firstName: command.firstName,
              lastName: command.lastName,
            }
          });
          
          return UserMapper.toDto(user);
        },
        { name: 'create-user', timeout: 5000 }
      );
      
      // Record success metrics
      this.metricsService.recordCommandExecution('CreateUser', 'success', Date.now() - start);
      return result;
      
    } catch (error) {
      this.metricsService.recordCommandExecution('CreateUser', 'error', Date.now() - start);
      throw error;
    }
  }
}
```

### Queries (Read Operations)

Queries return data without side effects:

```typescript
// Query DTO
export class GetUserQuery {
  constructor(public readonly userId: string) {}
}

// Query Handler
@Injectable()
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly prisma: PrismaService) {}
  
  async execute(query: GetUserQuery): Promise<UserDto> {
    // No transaction needed for reads
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: { participant: true }
    });
    
    if (!user) {
      throw new UserNotFoundException(query.userId);
    }
    
    return UserMapper.toDto(user);
  }
}
```

### Handler Registration

Register handlers in module providers:

```typescript
@Module({
  providers: [
    // Commands
    CreateUserHandler,
    UpdateUserHandler,
    DeleteUserHandler,
    
    // Queries
    GetUserHandler,
    ListUsersHandler,
  ]
})
export class UsersModule {}
```

## Metrics and Monitoring

### Always Record Metrics for Critical Operations

```typescript
@Injectable()
export class PaymentHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly metricsService: MetricsService,
  ) {}
  
  async execute(command: ProcessPaymentCommand): Promise<void> {
    const start = Date.now();
    
    try {
      await this.unitOfWork.execute(
        async (repos) => {
          // Payment processing logic
        },
        { name: 'process-payment', timeout: 10000 }
      );
      
      // ✅ Record success
      this.metricsService.paymentTotal.inc({
        currency: command.currency,
        method: command.method,
        status: 'success'
      });
      
      this.metricsService.paymentAmount.observe({
        currency: command.currency,
        method: command.method,
        status: 'success'
      }, command.amount);
      
    } catch (error) {
      // ✅ Record failure
      this.metricsService.paymentTotal.inc({
        currency: command.currency,
        method: command.method,
        status: 'failed'
      });
      
      throw error;
    } finally {
      // ✅ Record duration
      const duration = (Date.now() - start) / 1000;
      this.metricsService.jobProcessingDuration.observe({
        queue_name: 'payment-processing',
        status: 'success'
      }, duration);
    }
  }
}
```

### Transaction Metrics (Automatic)

The UnitOfWork automatically records:
- `db_transaction_duration_seconds` (histogram)
- `db_transaction_total` (counter with status labels)

Monitor these in Prometheus/Grafana:
- p50/p95/p99 latencies per transaction name
- Success/failure rates
- Alert on > 500ms (warning) or > 2s (critical)

## Testing Patterns

### Unit Testing Command Handlers

Mock the UnitOfWork to test business logic:

```typescript
describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let mockUnitOfWork: jest.Mocked<UnitOfWork>;
  let mockMetrics: jest.Mocked<MetricsService>;
  
  beforeEach(() => {
    mockUnitOfWork = {
      execute: jest.fn(),
    } as any;
    
    mockMetrics = {
      recordCommandExecution: jest.fn(),
    } as any;
    
    handler = new CreateUserHandler(mockUnitOfWork, mockMetrics);
  });
  
  it('should create user and participant atomically', async () => {
    // Arrange
    const command = new CreateUserCommand('test@test.com', 'John', 'Doe');
    const expectedResult = { id: '1', email: 'test@test.com' };
    
    mockUnitOfWork.execute.mockResolvedValue(expectedResult);
    
    // Act
    const result = await handler.execute(command);
    
    // Assert
    expect(mockUnitOfWork.execute).toHaveBeenCalledWith(
      expect.any(Function),
      { name: 'create-user', timeout: 5000 }
    );
    expect(result).toEqual(expectedResult);
    expect(mockMetrics.recordCommandExecution).toHaveBeenCalledWith(
      'CreateUser',
      'success',
      expect.any(Number)
    );
  });
  
  it('should record metrics on error', async () => {
    // Arrange
    const command = new CreateUserCommand('test@test.com', 'John', 'Doe');
    mockUnitOfWork.execute.mockRejectedValue(new Error('DB error'));
    
    // Act & Assert
    await expect(handler.execute(command)).rejects.toThrow('DB error');
    expect(mockMetrics.recordCommandExecution).toHaveBeenCalledWith(
      'CreateUser',
      'error',
      expect.any(Number)
    );
  });
});
```

### Integration Testing Transactions

Test full transaction flow with test database:

```typescript
describe('UnitOfWork Integration', () => {
  let unitOfWork: UnitOfWork;
  let prisma: PrismaService;
  
  beforeAll(async () => {
    // Setup test database
    const module = await Test.createTestingModule({
      providers: [UnitOfWork, PrismaService, MetricsService],
    }).compile();
    
    unitOfWork = module.get(UnitOfWork);
    prisma = module.get(PrismaService);
  });
  
  it('should rollback on error', async () => {
    // Arrange
    const initialCount = await prisma.user.count();
    
    // Act & Assert
    await expect(
      unitOfWork.execute(async (repos) => {
        await repos.users.create({ data: { email: 'test@test.com' } });
        throw new Error('Force rollback');
      }, { name: 'test-rollback' })
    ).rejects.toThrow('Force rollback');
    
    // Assert - no user created
    const finalCount = await prisma.user.count();
    expect(finalCount).toBe(initialCount);
  });
});
```

### Testing Query Handlers

Simple mock for read operations:

```typescript
describe('GetUserHandler', () => {
  let handler: GetUserHandler;
  let mockPrisma: jest.Mocked<PrismaService>;
  
  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    } as any;
    
    handler = new GetUserHandler(mockPrisma);
  });
  
  it('should return user DTO', async () => {
    // Arrange
    const query = new GetUserQuery('user-123');
    const mockUser = { id: 'user-123', email: 'test@test.com' };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    
    // Act
    const result = await handler.execute(query);
    
    // Assert
    expect(result).toMatchObject({ id: 'user-123', email: 'test@test.com' });
  });
  
  it('should throw not found exception', async () => {
    // Arrange
    const query = new GetUserQuery('non-existent');
    mockPrisma.user.findUnique.mockResolvedValue(null);
    
    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(UserNotFoundException);
  });
});
```

## References

- Clean Architecture: `/docs/clean-architecture-guide.md`
- Project Structure: `/PROJECT_STRUCTURE.md`
- Architecture Docs: `/docs/architecture.md`
- Unit of Work Implementation: `/services/api/docs/UNIT_OF_WORK_IMPLEMENTATION.md`
- Transaction Patterns: `/.github/docs/transaction-patterns.md`
- CQRS Patterns: `/.github/docs/cqrs-patterns.md`
- Testing Patterns: `/.github/docs/testing-patterns.md`

## Remember

- **Presentation → Application → Domain → Infrastructure**
- **Dependencies point INWARD only**
- **Each class has ONE responsibility**
- **Modules are feature-based and self-contained**
- **Use interfaces to decouple layers**
- **Test each layer independently**
- **ALWAYS use UnitOfWork for multi-repository transactions**
- **Record metrics for critical operations**
- **Follow CQRS: Commands modify, Queries read**
- **Name transactions for monitoring**
- **Choose appropriate timeouts (3s/5s/10s)**

When in doubt, ask: "Does this follow clean architecture?" If not, refactor before proceeding.
