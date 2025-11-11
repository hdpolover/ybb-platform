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

## References

- Clean Architecture: `/docs/clean-architecture-guide.md`
- Project Structure: `/PROJECT_STRUCTURE.md`
- Architecture Docs: `/docs/architecture.md`

## Remember

- **Presentation → Application → Domain → Infrastructure**
- **Dependencies point INWARD only**
- **Each class has ONE responsibility**
- **Modules are feature-based and self-contained**
- **Use interfaces to decouple layers**
- **Test each layer independently**

When in doubt, ask: "Does this follow clean architecture?" If not, refactor before proceeding.
