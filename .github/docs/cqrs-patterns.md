# CQRS Patterns - Quick Reference

> Command Query Responsibility Segregation (CQRS) patterns for YBB Platform.

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Commands (Write Operations)](#commands-write-operations)
3. [Queries (Read Operations)](#queries-read-operations)
4. [File Structure](#file-structure)
5. [Handler Patterns](#handler-patterns)
6. [Controller Integration](#controller-integration)
7. [Common Patterns](#common-patterns)
8. [Best Practices](#best-practices)

---

## Core Concepts

### The CQRS Principle

> **Separate read operations from write operations for better scalability and maintainability.**

**Commands:**
- Modify state (Create, Update, Delete)
- Named with imperative verbs (`CreateUser`, `UpdateProfile`)
- Return minimal data (ID, success confirmation)
- Use transactions when touching multiple tables

**Queries:**
- Read state without side effects
- Named with descriptive nouns (`GetUser`, `ListApplications`)
- Return rich DTOs optimized for the view
- No transactions needed (unless complex read-only logic)

### Benefits

1. **Scalability**: Read and write models can be optimized separately
2. **Maintainability**: Clear responsibility separation
3. **Testability**: Each handler tests one specific use case
4. **Performance**: Queries can use read replicas, caching, denormalized views

---

## Commands (Write Operations)

### Command Structure

```typescript
// modules/users/application/commands/create-user.command.ts
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly password: string,
    public readonly referralCode?: string,
  ) {}
}
```

**Rules:**
- Immutable (readonly properties)
- Contains only data needed for the operation
- No business logic
- Use TypeScript classes (not interfaces) for DI compatibility

### Command Handler Structure

```typescript
// modules/users/application/commands/handlers/create-user.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { CreateUserCommand } from '../create-user.command';
import { UserDto } from '../../dto/user.dto';

@Injectable()
export class CreateUserHandler {
  private readonly logger = new Logger(CreateUserHandler.name);

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly metricsService: MetricsService,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    const start = Date.now();
    this.logger.debug(`Creating user: ${command.email}`);

    try {
      const result = await this.unitOfWork.execute(
        async (repos) => {
          // 1. Validate business rules
          const existingUser = await repos.users.findUnique({
            where: { email: command.email }
          });
          
          if (existingUser) {
            throw new ConflictException('User already exists');
          }

          // 2. Create user
          const user = await repos.users.create({
            data: {
              email: command.email,
              firstName: command.firstName,
              lastName: command.lastName,
              password: await this.hashPassword(command.password),
            }
          });

          // 3. Create related entities
          await repos.participants.create({
            data: {
              userId: user.id,
              firstName: command.firstName,
              lastName: command.lastName,
            }
          });

          // 4. Handle optional logic
          if (command.referralCode) {
            await repos.createAmbassadorReferral(user.id, command.referralCode);
          }

          return UserMapper.toDto(user);
        },
        { name: 'create-user', timeout: 5000 }
      );

      // 5. Record success metrics
      this.metricsService.recordCommandExecution('CreateUser', 'success', Date.now() - start);
      this.logger.log(`User created: ${result.id}`);

      return result;

    } catch (error) {
      // 6. Record failure metrics
      this.metricsService.recordCommandExecution('CreateUser', 'error', Date.now() - start);
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // Hash implementation
  }
}
```

### Command Handler Checklist

- [ ] `@Injectable()` decorator
- [ ] Inject `UnitOfWork` for multi-table operations
- [ ] Inject `MetricsService` for monitoring
- [ ] Logger with handler name
- [ ] Validate business rules inside transaction
- [ ] Use transaction for multi-table operations
- [ ] Record metrics (success and failure)
- [ ] Return DTO (not domain entity)
- [ ] Handle errors appropriately

---

## Queries (Read Operations)

### Query Structure

```typescript
// modules/users/application/queries/get-user.query.ts
export class GetUserQuery {
  constructor(public readonly userId: string) {}
}
```

**Rules:**
- Immutable (readonly properties)
- Contains only identifiers/filters
- No business logic

### Query Handler Structure

```typescript
// modules/users/application/queries/handlers/get-user.handler.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { GetUserQuery } from '../get-user.query';
import { UserDto } from '../../dto/user.dto';

@Injectable()
export class GetUserHandler {
  private readonly logger = new Logger(GetUserHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(query: GetUserQuery): Promise<UserDto> {
    this.logger.debug(`Getting user: ${query.userId}`);

    // 1. Check cache
    const cacheKey = `user:${query.userId}`;
    const cached = await this.cache.get<UserDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // 2. Query database
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: {
        participant: true,
        identities: true,
      }
    });

    if (!user) {
      throw new NotFoundException(`User ${query.userId} not found`);
    }

    // 3. Map to DTO
    const dto = UserMapper.toDto(user);

    // 4. Cache result
    await this.cache.set(cacheKey, dto, 300); // 5 minutes

    return dto;
  }
}
```

### Query Handler Checklist

- [ ] `@Injectable()` decorator
- [ ] Inject `PrismaService` (not UnitOfWork)
- [ ] Inject `CacheService` if appropriate
- [ ] Logger with handler name
- [ ] Check cache before database query
- [ ] Use appropriate includes/selects
- [ ] Throw `NotFoundException` if not found
- [ ] Return DTO (not raw database object)
- [ ] Cache results when applicable

---

## File Structure

### Module Organization

```
modules/users/
├── application/
│   ├── commands/
│   │   ├── create-user.command.ts
│   │   ├── update-user.command.ts
│   │   ├── delete-user.command.ts
│   │   └── handlers/
│   │       ├── create-user.handler.ts
│   │       ├── update-user.handler.ts
│   │       └── delete-user.handler.ts
│   ├── queries/
│   │   ├── get-user.query.ts
│   │   ├── list-users.query.ts
│   │   └── handlers/
│   │       ├── get-user.handler.ts
│   │       └── list-users.handler.ts
│   └── dto/
│       ├── user.dto.ts
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
├── domain/
│   ├── entities/
│   │   └── user.entity.ts
│   └── interfaces/
│       └── user.repository.interface.ts
├── infrastructure/
│   └── persistence/
│       └── user.repository.ts
├── presentation/
│   ├── users.controller.ts
│   └── dto/
│       ├── create-user-request.dto.ts
│       └── update-user-request.dto.ts
└── users.module.ts
```

---

## Handler Patterns

### Pattern 1: Simple Create

```typescript
@Injectable()
export class CreateProgramHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(command: CreateProgramCommand): Promise<ProgramDto> {
    return this.unitOfWork.execute(
      async (repos) => {
        const program = await repos.tx.program.create({
          data: {
            name: command.name,
            description: command.description,
            status: 'draft',
          }
        });

        return ProgramMapper.toDto(program);
      },
      { name: 'create-program', timeout: 3000 }
    );
  }
}
```

### Pattern 2: Update with Validation

```typescript
@Injectable()
export class UpdateUserHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(command: UpdateUserCommand): Promise<UserDto> {
    return this.unitOfWork.execute(
      async (repos) => {
        // Validate user exists
        const user = await repos.users.findUnique({
          where: { id: command.userId }
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Validate business rules
        if (command.email && command.email !== user.email) {
          const emailTaken = await repos.users.findUnique({
            where: { email: command.email }
          });

          if (emailTaken) {
            throw new ConflictException('Email already in use');
          }
        }

        // Update
        const updated = await repos.users.update({
          where: { id: command.userId },
          data: {
            firstName: command.firstName ?? user.firstName,
            lastName: command.lastName ?? user.lastName,
            email: command.email ?? user.email,
          }
        });

        return UserMapper.toDto(updated);
      },
      { name: 'update-user', timeout: 5000 }
    );
  }
}
```

### Pattern 3: Delete with Cascade

```typescript
@Injectable()
export class DeleteUserHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    await this.unitOfWork.execute(
      async (repos) => {
        // Validate user exists
        const user = await repos.users.findUnique({
          where: { id: command.userId }
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Delete related entities (if not cascaded in DB)
        await repos.tx.identity.deleteMany({
          where: { userId: command.userId }
        });

        await repos.participants.delete({
          where: { userId: command.userId }
        });

        // Delete user
        await repos.users.delete({
          where: { id: command.userId }
        });
      },
      { name: 'delete-user', timeout: 5000 }
    );
  }
}
```

### Pattern 4: List with Filtering

```typescript
@Injectable()
export class ListUsersHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListUsersQuery): Promise<PaginatedDto<UserDto>> {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    // Build filters
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Execute query with pagination
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { participant: true }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      data: users.map(UserMapper.toDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
}
```

### Pattern 5: Get with Relations

```typescript
@Injectable()
export class GetApplicationDetailsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetApplicationDetailsQuery): Promise<ApplicationDetailsDto> {
    const application = await this.prisma.participantApplication.findUnique({
      where: { id: query.applicationId },
      include: {
        participant: {
          include: {
            user: true
          }
        },
        program: {
          include: {
            brand: true
          }
        },
        essays: true,
        documents: true,
        invoice: true,
      }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return ApplicationMapper.toDetailsDto(application);
  }
}
```

---

## Controller Integration

### RESTful Controller

```typescript
// modules/users/presentation/users.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

// Command Handlers
import { CreateUserHandler } from '../application/commands/handlers/create-user.handler';
import { UpdateUserHandler } from '../application/commands/handlers/update-user.handler';
import { DeleteUserHandler } from '../application/commands/handlers/delete-user.handler';

// Query Handlers
import { GetUserHandler } from '../application/queries/handlers/get-user.handler';
import { ListUsersHandler } from '../application/queries/handlers/list-users.handler';

// Commands & Queries
import { CreateUserCommand } from '../application/commands/create-user.command';
import { UpdateUserCommand } from '../application/commands/update-user.command';
import { DeleteUserCommand } from '../application/commands/delete-user.command';
import { GetUserQuery } from '../application/queries/get-user.query';
import { ListUsersQuery } from '../application/queries/list-users.query';

// DTOs
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    // Command Handlers
    private readonly createUserHandler: CreateUserHandler,
    private readonly updateUserHandler: UpdateUserHandler,
    private readonly deleteUserHandler: DeleteUserHandler,
    
    // Query Handlers
    private readonly getUserHandler: GetUserHandler,
    private readonly listUsersHandler: ListUsersHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() dto: CreateUserRequestDto) {
    const command = new CreateUserCommand(
      dto.email,
      dto.firstName,
      dto.lastName,
      dto.password,
      dto.referralCode,
    );
    
    return this.createUserHandler.execute(command);
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  async list(@Query() dto: ListUsersQueryDto) {
    const query = new ListUsersQuery(
      dto.page,
      dto.limit,
      dto.search,
      dto.status,
    );
    
    return this.listUsersHandler.execute(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getById(@Param('id') id: string) {
    const query = new GetUserQuery(id);
    return this.getUserHandler.execute(query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserRequestDto) {
    const command = new UpdateUserCommand(
      id,
      dto.firstName,
      dto.lastName,
      dto.email,
    );
    
    return this.updateUserHandler.execute(command);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  async delete(@Param('id') id: string) {
    const command = new DeleteUserCommand(id);
    await this.deleteUserHandler.execute(command);
    return { message: 'User deleted successfully' };
  }
}
```

### Module Registration

```typescript
// modules/users/users.module.ts
import { Module } from '@nestjs/common';

// Command Handlers
import { CreateUserHandler } from './application/commands/handlers/create-user.handler';
import { UpdateUserHandler } from './application/commands/handlers/update-user.handler';
import { DeleteUserHandler } from './application/commands/handlers/delete-user.handler';

// Query Handlers
import { GetUserHandler } from './application/queries/handlers/get-user.handler';
import { ListUsersHandler } from './application/queries/handlers/list-users.handler';

// Controller
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    // Command Handlers
    CreateUserHandler,
    UpdateUserHandler,
    DeleteUserHandler,
    
    // Query Handlers
    GetUserHandler,
    ListUsersHandler,
  ],
  exports: [
    // Export handlers if needed by other modules
    CreateUserHandler,
    GetUserHandler,
  ],
})
export class UsersModule {}
```

---

## Common Patterns

### 1. Idempotent Commands

```typescript
@Injectable()
export class VerifyEmailHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(command: VerifyEmailCommand): Promise<void> {
    await this.unitOfWork.execute(
      async (repos) => {
        const user = await repos.users.findUnique({
          where: { id: command.userId }
        });

        // Idempotent - don't fail if already verified
        if (user.emailVerified) {
          return; // Already verified, nothing to do
        }

        await repos.users.update({
          where: { id: command.userId },
          data: { emailVerified: true, emailVerifiedAt: new Date() }
        });
      },
      { name: 'verify-email', timeout: 3000 }
    );
  }
}
```

### 2. Commands with Events

```typescript
@Injectable()
export class CreateOrderHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: CreateOrderCommand): Promise<OrderDto> {
    const order = await this.unitOfWork.execute(
      async (repos) => {
        return repos.tx.order.create({
          data: { /* ... */ }
        });
      },
      { name: 'create-order', timeout: 5000 }
    );

    // Emit event AFTER transaction commits
    this.eventEmitter.emit('order.created', {
      orderId: order.id,
      userId: command.userId,
      amount: command.amount,
    });

    return OrderMapper.toDto(order);
  }
}
```

### 3. Optimistic Locking

```typescript
@Injectable()
export class UpdateInventoryHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(command: UpdateInventoryCommand): Promise<void> {
    await this.unitOfWork.execute(
      async (repos) => {
        const product = await repos.tx.product.findUnique({
          where: { id: command.productId }
        });

        if (product.version !== command.expectedVersion) {
          throw new ConflictException('Product was modified by another user');
        }

        await repos.tx.product.update({
          where: { id: command.productId },
          data: {
            stock: command.newStock,
            version: { increment: 1 },
          }
        });
      },
      { name: 'update-inventory', timeout: 3000 }
    );
  }
}
```

---

## Best Practices

### ✅ Do

1. **Separate Commands and Queries**
   - Commands in `application/commands/`
   - Queries in `application/queries/`

2. **One Handler Per Use Case**
   - Each handler does ONE thing
   - Easy to test, maintain, and understand

3. **Use Transactions for Commands**
   - Multi-table operations = UnitOfWork
   - Single table = Direct Prisma call acceptable

4. **Cache Query Results**
   - Frequently accessed data
   - Invalidate on related commands

5. **Validate in Handlers**
   - Business rules inside transaction
   - Input validation in DTOs (class-validator)

6. **Return DTOs, Not Entities**
   - Controllers receive DTOs
   - Handlers return DTOs
   - Never expose database models

7. **Record Metrics**
   - Command execution time
   - Success/failure rates
   - Business metrics (signups, purchases, etc.)

### ❌ Don't

1. **Don't Mix Reads and Writes**
   - Query handlers should NEVER modify state
   - Command handlers should return minimal data

2. **Don't Put Business Logic in Controllers**
   - Controllers route requests
   - Handlers contain business logic

3. **Don't Access Repositories in Controllers**
   - Always go through handlers

4. **Don't Use Handlers for Trivial Operations**
   - Simple CRUD with no logic = direct repository acceptable
   - Complex logic or multi-table = handler required

5. **Don't Return Raw Database Objects**
   - Always map to DTOs
   - Hide implementation details

---

## Testing Examples

See [Testing Patterns](./testing-patterns.md) for comprehensive testing examples.

---

## See Also

- [Transaction Patterns](./transaction-patterns.md)
- [Testing Patterns](./testing-patterns.md)
- [Clean Architecture Guide](../../docs/clean-architecture-guide.md)
- [Unit of Work Implementation](../../services/api/docs/UNIT_OF_WORK_IMPLEMENTATION.md)
