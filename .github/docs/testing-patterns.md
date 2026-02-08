# Testing Patterns - Quick Reference

> Comprehensive testing patterns for YBB Platform using Jest, focusing on Clean Architecture and CQRS.

## Table of Contents
1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Unit Testing Handlers](#unit-testing-handlers)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Mocking Patterns](#mocking-patterns)
7. [Test Data Builders](#test-data-builders)
8. [Common Scenarios](#common-scenarios)

---

## Testing Philosophy

### Test Pyramid

```
        /\
       /  \  E2E Tests (Few)
      /----\
     /      \  Integration Tests (Some)
    /--------\
   /          \
  /____________\ Unit Tests (Many)
```

**Distribution:**
- **70%** Unit Tests (Fast, isolated)
- **20%** Integration Tests (Database, external services)
- **10%** E2E Tests (Full flow, API to database)

### What to Test

**✅ Test:**
- Business logic (handlers, domain entities)
- Edge cases and error conditions
- Validation rules
- State transitions
- Transaction rollback behavior

**❌ Don't Test:**
- Framework code (NestJS internals)
- Database driver behavior
- Third-party libraries
- Trivial getters/setters

---

## Test Structure

### File Naming

```
src/
  modules/users/
    application/
      commands/
        handlers/
          create-user.handler.ts
          create-user.handler.spec.ts  ← Test file
```

**Convention:** `{filename}.spec.ts`

### Test Suite Structure

```typescript
describe('CreateUserHandler', () => {
  // Setup
  let handler: CreateUserHandler;
  let mockUnitOfWork: jest.Mocked<UnitOfWork>;
  let mockMetrics: jest.Mocked<MetricsService>;
  
  beforeEach(() => {
    // Arrange: Create mocks and handler
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('execute', () => {
    it('should create user successfully', async () => {
      // Test case
    });
    
    it('should throw ConflictException if email exists', async () => {
      // Test case
    });
    
    it('should handle referral code', async () => {
      // Test case
    });
  });
  
  describe('error handling', () => {
    it('should record error metrics on failure', async () => {
      // Test case
    });
  });
});
```

### AAA Pattern (Arrange-Act-Assert)

```typescript
it('should create user successfully', async () => {
  // Arrange: Setup test data and mocks
  const command = new CreateUserCommand('test@test.com', 'John', 'Doe', 'password123');
  const expectedUser = { id: 'user-123', email: 'test@test.com' };
  mockUnitOfWork.execute.mockResolvedValue(expectedUser);
  
  // Act: Execute the handler
  const result = await handler.execute(command);
  
  // Assert: Verify results
  expect(result).toEqual(expectedUser);
  expect(mockUnitOfWork.execute).toHaveBeenCalledWith(
    expect.any(Function),
    { name: 'create-user', timeout: 5000 }
  );
  expect(mockMetrics.recordCommandExecution).toHaveBeenCalledWith(
    'CreateUser',
    'success',
    expect.any(Number)
  );
});
```

---

## Unit Testing Handlers

### Command Handler Template

```typescript
// create-user.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateUserHandler } from './create-user.handler';
import { CreateUserCommand } from '../create-user.command';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let mockUnitOfWork: jest.Mocked<UnitOfWork>;
  let mockMetrics: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    // Create mocks
    mockUnitOfWork = {
      execute: jest.fn(),
    } as any;

    mockMetrics = {
      recordCommandExecution: jest.fn(),
    } as any;

    // Create handler
    handler = new CreateUserHandler(mockUnitOfWork, mockMetrics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should create user successfully', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'test@test.com',
        'John',
        'Doe',
        'password123'
      );
      
      const mockResult = {
        id: 'user-123',
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      
      mockUnitOfWork.execute.mockResolvedValue(mockResult);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockUnitOfWork.execute).toHaveBeenCalledWith(
        expect.any(Function),
        { name: 'create-user', timeout: 5000 }
      );
      expect(mockMetrics.recordCommandExecution).toHaveBeenCalledWith(
        'CreateUser',
        'success',
        expect.any(Number)
      );
    });

    it('should throw ConflictException if email exists', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'existing@test.com',
        'John',
        'Doe',
        'password123'
      );
      
      mockUnitOfWork.execute.mockRejectedValue(
        new ConflictException('User already exists')
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      expect(mockMetrics.recordCommandExecution).toHaveBeenCalledWith(
        'CreateUser',
        'error',
        expect.any(Number)
      );
    });

    it('should handle referral code when provided', async () => {
      // Arrange
      const command = new CreateUserCommand(
        'test@test.com',
        'John',
        'Doe',
        'password123',
        'REFER123' // with referral
      );
      
      const mockResult = { id: 'user-123' };
      mockUnitOfWork.execute.mockResolvedValue(mockResult);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockUnitOfWork.execute).toHaveBeenCalled();
      
      // Verify the transaction callback
      const transactionCallback = mockUnitOfWork.execute.mock.calls[0][0];
      const mockRepos = {
        users: { create: jest.fn().mockResolvedValue({ id: 'user-123' }) },
        participants: { create: jest.fn() },
        createAmbassadorReferral: jest.fn(),
      };
      
      await transactionCallback(mockRepos);
      expect(mockRepos.createAmbassadorReferral).toHaveBeenCalledWith('user-123', 'REFER123');
    });
  });

  describe('error handling', () => {
    it('should record error metrics on database failure', async () => {
      // Arrange
      const command = new CreateUserCommand('test@test.com', 'John', 'Doe', 'pass');
      const dbError = new Error('Database connection failed');
      mockUnitOfWork.execute.mockRejectedValue(dbError);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(dbError);
      expect(mockMetrics.recordCommandExecution).toHaveBeenCalledWith(
        'CreateUser',
        'error',
        expect.any(Number)
      );
    });
  });
});
```

### Query Handler Template

```typescript
// get-user.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { GetUserHandler } from './get-user.handler';
import { GetUserQuery } from '../get-user.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

describe('GetUserHandler', () => {
  let handler: GetUserHandler;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    handler = new GetUserHandler(mockPrisma, mockCache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return user from cache if available', async () => {
      // Arrange
      const query = new GetUserQuery('user-123');
      const cachedUser = { id: 'user-123', email: 'test@test.com' };
      mockCache.get.mockResolvedValue(cachedUser);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toEqual(cachedUser);
      expect(mockCache.get).toHaveBeenCalledWith('user:user-123');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not in cache', async () => {
      // Arrange
      const query = new GetUserQuery('user-123');
      const dbUser = {
        id: 'user-123',
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        participant: { id: 'p-123' }
      };
      
      mockCache.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(dbUser);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: expect.any(Object)
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'user:user-123',
        expect.any(Object),
        300
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      const query = new GetUserQuery('non-existent');
      mockCache.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });
});
```

---

## Integration Testing

### Testing Transactions with Database

```typescript
// unit-of-work.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

describe('UnitOfWork Integration', () => {
  let module: TestingModule;
  let unitOfWork: UnitOfWork;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        UnitOfWork,
        PrismaService,
        {
          provide: MetricsService,
          useValue: {
            transactionDuration: { observe: jest.fn() },
            transactionTotal: { inc: jest.fn() },
          },
        },
      ],
    }).compile();

    unitOfWork = module.get<UnitOfWork>(UnitOfWork);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  beforeEach(async () => {
    // Clean test data
    await prisma.participant.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('transaction execution', () => {
    it('should commit transaction on success', async () => {
      // Arrange
      const email = `test-${Date.now()}@test.com`;

      // Act
      const result = await unitOfWork.execute(
        async (repos) => {
          const user = await repos.users.create({
            data: {
              email,
              firstName: 'John',
              lastName: 'Doe',
              password: 'hashed',
            }
          });

          await repos.participants.create({
            data: {
              userId: user.id,
              firstName: 'John',
              lastName: 'Doe',
            }
          });

          return user;
        },
        { name: 'test-transaction', timeout: 5000 }
      );

      // Assert
      expect(result).toBeDefined();
      
      const user = await prisma.user.findUnique({ where: { email } });
      const participant = await prisma.participant.findUnique({
        where: { userId: user.id }
      });
      
      expect(user).toBeDefined();
      expect(participant).toBeDefined();
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      const email = `test-${Date.now()}@test.com`;
      const initialUserCount = await prisma.user.count();

      // Act & Assert
      await expect(
        unitOfWork.execute(
          async (repos) => {
            await repos.users.create({
              data: {
                email,
                firstName: 'John',
                lastName: 'Doe',
                password: 'hashed',
              }
            });

            throw new Error('Force rollback');
          },
          { name: 'test-rollback', timeout: 5000 }
        )
      ).rejects.toThrow('Force rollback');

      // Assert: No user created
      const finalUserCount = await prisma.user.count();
      expect(finalUserCount).toBe(initialUserCount);
      
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    });

    it('should retry on deadlock', async () => {
      // This tests the retry mechanism
      let attemptCount = 0;

      const result = await unitOfWork.executeWithRetry(
        async (repos) => {
          attemptCount++;
          
          // Simulate deadlock on first attempt
          if (attemptCount === 1) {
            const error: any = new Error('Deadlock');
            error.code = 'P2034';
            throw error;
          }

          return { success: true };
        },
        { name: 'test-retry', timeout: 5000, maxRetries: 3 }
      );

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(2);
    });
  });

  describe('helper methods', () => {
    it('should create ambassador referral', async () => {
      // Arrange
      const ambassador = await prisma.ambassador.create({
        data: { userId: 'amb-123', referralCode: 'REFER123' }
      });

      const user = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@test.com`,
          firstName: 'John',
          lastName: 'Doe',
          password: 'hashed',
        }
      });

      // Act
      await unitOfWork.execute(
        async (repos) => {
          await repos.createAmbassadorReferral(user.id, 'REFER123');
        },
        { name: 'test-referral', timeout: 3000 }
      );

      // Assert
      const referral = await prisma.ambassadorReferral.findFirst({
        where: { userId: user.id }
      });
      
      expect(referral).toBeDefined();
      expect(referral.ambassadorId).toBe(ambassador.id);
    });
  });
});
```

---

## E2E Testing

### Full API Flow Testing

```typescript
// users.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('Users API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean test data
    await prisma.participant.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      // Arrange
      const createUserDto = {
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password123!',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/users')
        .send(createUserDto)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(String),
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(response.body.password).toBeUndefined();

      // Verify database
      const user = await prisma.user.findUnique({
        where: { email: 'test@test.com' }
      });
      expect(user).toBeDefined();
    });

    it('should return 409 if email already exists', async () => {
      // Arrange: Create existing user
      await prisma.user.create({
        data: {
          email: 'existing@test.com',
          firstName: 'Jane',
          lastName: 'Doe',
          password: 'hashed',
        }
      });

      const createUserDto = {
        email: 'existing@test.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password123!',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/users')
        .send(createUserDto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should validate input', async () => {
      // Arrange
      const invalidDto = {
        email: 'not-an-email',
        firstName: '',
        // missing lastName
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/users')
        .send(invalidDto)
        .expect(400);

      // Assert
      expect(response.body.message).toBeInstanceOf(Array);
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by ID', async () => {
      // Arrange
      const user = await prisma.user.create({
        data: {
          email: 'test@test.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'hashed',
        }
      });

      // Act
      const response = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: user.id,
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should return 404 if user not found', async () => {
      await request(app.getHttpServer())
        .get('/users/non-existent-id')
        .expect(404);
    });
  });
});
```

---

## Mocking Patterns

### Mock UnitOfWork

```typescript
const mockUnitOfWork: jest.Mocked<UnitOfWork> = {
  execute: jest.fn(),
  executeReadOnly: jest.fn(),
  executeWithRetry: jest.fn(),
} as any;
```

### Mock PrismaService

```typescript
const mockPrisma: jest.Mocked<PrismaService> = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  participant: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;
```

### Mock External Services

```typescript
const mockEmailService: jest.Mocked<EmailService> = {
  sendWelcome: jest.fn().mockResolvedValue(true),
  sendPasswordReset: jest.fn().mockResolvedValue(true),
} as any;
```

### Mock Metrics

```typescript
const mockMetrics: jest.Mocked<MetricsService> = {
  recordCommandExecution: jest.fn(),
  paymentTotal: { inc: jest.fn() },
  paymentAmount: { observe: jest.fn() },
} as any;
```

---

## Test Data Builders

### Builder Pattern

```typescript
// test/builders/user.builder.ts
export class UserBuilder {
  private user: Partial<User> = {
    id: 'user-123',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  withId(id: string): this {
    this.user.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  verified(): this {
    this.user.emailVerified = true;
    return this;
  }

  build(): User {
    return this.user as User;
  }
}

// Usage in tests
const user = new UserBuilder()
  .withEmail('custom@test.com')
  .verified()
  .build();
```

### Factory Functions

```typescript
// test/factories/user.factory.ts
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    email: 'test@test.com',
    firstName: 'John',
lastName: 'Doe',
    password: 'hashed',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Usage
const user = createMockUser({ email: 'custom@test.com', emailVerified: true });
```

---

## Common Scenarios

### 1. Testing Async Operations

```typescript
it('should handle async operations', async () => {
  mockUnitOfWork.execute.mockImplementation(async (callback) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return callback({} as any);
  });

  await handler.execute(command);

  expect(mockUnitOfWork.execute).toHaveBeenCalled();
});
```

### 2. Testing Error Recovery

```typescript
it('should retry and recover from transient errors', async () => {
  let attemptCount = 0;
  
  mockUnitOfWork.execute.mockImplementation(async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Transient error');
    }
    return { success: true };
  });

  const result = await handler.execute(command);

  expect(attemptCount).toBe(3);
  expect(result).toEqual({ success: true });
});
```

### 3. Testing Validation

```typescript
it('should validate email format', async () => {
  const command = new CreateUserCommand(
    'invalid-email',
    'John',
    'Doe',
    'password'
  );

  await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
});
```

### 4. Testing Authorization

```typescript
it('should throw UnauthorizedException if user not admin', async () => {
  const command = new DeleteUserCommand('user-123');
  
  mockAuthService.isAdmin.mockResolvedValue(false);

  await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
});
```

---

## Best Practices

### ✅ Do

1. **Test Behavior, Not Implementation**
   - Test what the code does, not how it does it
   - Avoid testing private methods

2. **Use Descriptive Test Names**
   - `it('should create user with valid data')`
   - `it('should throw ConflictException if email exists')`

3. **Isolate Tests**
   - Each test should be independent
   - Use `beforeEach` to reset state

4. **Mock External Dependencies**
   - Database, APIs, file system
   - Use in-memory implementations for tests

5. **Test Edge Cases**
   - Null/undefined values
   - Empty arrays
   - Boundary conditions

6. **Keep Tests Fast**
   - Unit tests < 10ms
   - Integration tests < 500ms
   - E2E tests < 5s

### ❌ Don't

1. **Don't Test Framework Code**
   - Don't test NestJS decorators
   - Don't test Prisma client

2. **Don't Use Real Database in Unit Tests**
   - Mock PrismaService
   - Use in-memory database for integration tests

3. **Don't Share State Between Tests**
   - Each test should be independent
   - Clean up after each test

4. **Don't Ignore Async**
   - Always `await` async operations
   - Use `async/await` consistently

---

## Quick Checklist

### Before Pushing Code

- [ ] All tests pass (`npm test`)
- [ ] Code coverage > 80% for new code
- [ ] No skipped tests (`it.skip`, `describe.skip`)
- [ ] No focused tests (`it.only`, `describe.only`)
- [ ] Mocks are cleaned up in `afterEach`
- [ ] Test names are descriptive
- [ ] Edge cases covered
- [ ] Error scenarios tested

---

## See Also

- [Transaction Patterns](./transaction-patterns.md)
- [CQRS Patterns](./cqrs-patterns.md)
- [Code Review Checklist](./code-review-checklist.md)
- [Unit of Work Implementation](../../services/api/docs/UNIT_OF_WORK_IMPLEMENTATION.md)
