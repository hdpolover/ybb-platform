# GitHub Copilot Documentation

> Comprehensive documentation and reference guides for GitHub Copilot to ensure consistent code generation aligned with YBB Platform architecture.

## 📚 Documentation Overview

This directory contains reference documentation designed to guide GitHub Copilot (and developers) in generating code that follows our architectural patterns, best practices, and coding standards.

---

## 📖 Documentation Files

### 1. [GitHub Copilot Instructions](../copilot-instructions.md)
**Primary reference for GitHub Copilot AI assistant**

The main configuration file for GitHub Copilot. Contains:
- Clean Architecture principles
- Directory structure conventions
- Service-specific guidelines (NestJS, Golang, Python, Next.js)
- **Unit of Work pattern** for transaction management
- **CQRS pattern** for commands and queries
- Error handling patterns
- Testing guidelines
- Common anti-patterns to avoid

**Use this:** For quick reference during development

---

### 2. [Transaction Patterns](./transaction-patterns.md)
**Complete reference for transaction management using Unit of Work**

Comprehensive guide covering:
- When to use transactions
- Unit of Work pattern implementation
- Transaction naming conventions
- Timeout configuration guidelines (3s/5s/10s)
- Helper methods for common operations
- Error handling and retry logic
- Common patterns with code examples
- Anti-patterns and pitfalls

**Use this:** When implementing any multi-table operation or payment processing

---

### 3. [CQRS Patterns](./cqrs-patterns.md)
**Command Query Responsibility Segregation patterns**

Complete guide for separating reads and writes:
- Commands (write operations) structure
- Queries (read operations) structure
- Handler implementation patterns
- File structure and organization
- Controller integration
- Common patterns (Create, Update, Delete, List, Get)
- Module registration
- Idempotency and events

**Use this:** When creating any new feature or endpoint

---

### 4. [Testing Patterns](./testing-patterns.md)
**Comprehensive testing guide for all layers**

Testing strategy and examples:
- Testing philosophy (test pyramid)
- Unit testing handlers (Commands & Queries)
- Integration testing with database
- E2E testing full API flows
- Mocking patterns (UnitOfWork, Prisma, Services)
- Test data builders and factories
- Common testing scenarios
- Best practices and checklist

**Use this:** Before writing tests for any new feature

---

### 5. [Code Review Checklist](./code-review-checklist.md)
**Quality assurance checklist for pull requests**

Comprehensive review criteria:
- Architecture & design compliance
- Code quality standards
- Transaction management verification
- CQRS pattern compliance
- Error handling review
- Testing coverage
- Performance considerations
- Security checks
- Documentation requirements
- Git & PR guidelines

**Use this:** Before submitting or reviewing any pull request

---

## 🚀 Quick Start

### For New Features

1. **Plan** → Read [CQRS Patterns](./cqrs-patterns.md) for structure
2. **Implement** → Follow [GitHub Copilot Instructions](../copilot-instructions.md)
3. **Transactions** → Use [Transaction Patterns](./transaction-patterns.md) for multi-table operations
4. **Test** → Follow [Testing Patterns](./testing-patterns.md)
5. **Review** → Use [Code Review Checklist](./code-review-checklist.md)

### For Bug Fixes

1. **Write test** → Reproduce the bug with a failing test
2. **Fix** → Correct the issue following architecture patterns
3. **Verify** → Ensure all tests pass
4. **Review** → Check against code review checklist

### For Refactoring

1. **Understand** → Read [Clean Architecture Guide](../../docs/clean-architecture-guide.md)
2. **Plan** → Identify architectural improvements
3. **Refactor** → Follow patterns in documentation
4. **Test** → Ensure all tests still pass
5. **Document** → Update relevant documentation

---

## 🎯 Architecture Principles

### Clean Architecture

```
Presentation → Application → Domain → Infrastructure
(Controllers)  (Use Cases)   (Business)  (Database/External)
```

**Rule:** Dependencies ALWAYS point inward.

### CQRS (Command Query Responsibility Segregation)

**Commands:**
- Modify state (Create, Update, Delete)
- Use `UnitOfWork` for transactions
- Return minimal data

**Queries:**
- Read state without side effects
- Use caching when appropriate
- Return rich DTOs

### Unit of Work Pattern

**Multi-table operations:**
```typescript
await this.unitOfWork.execute(
  async (repos) => {
    // All operations share same transaction
    const user = await repos.users.create({ ... });
    await repos.participants.create({ ... });
  },
  { name: 'operation-name', timeout: 5000 }
);
```

**Advanced features:**
```typescript
// Read replica routing
await this.unitOfWork.executeReadOnly(async (repos) => {
  return await repos.users.findMany();
});

// Query batching
await this.unitOfWork.batchExecute([
  (repos) => repos.users.create({ data: user1 }),
  (repos) => repos.users.create({ data: user2 }),
]);

// Distributed tracing
await this.unitOfWork.execute(
  async (repos) => { /* ... */ },
  { name: 'operation', traceId: req.id, spanName: 'db-span' }
);
```

**Benefits:**
- Centralized transaction management
- Automatic metrics recording
- Retry logic on deadlocks
- Type-safe repository access
- Read replica support
- Circuit breaker protection
- Distributed tracing

---

## 📊 Key Patterns

### 1. Transaction Timeouts

| Complexity | Tables | Timeout | Example |
|-----------|--------|---------|---------|
| Simple | 2-3 | 3000ms | Email verification |
| Medium | 3-4 | 5000ms | Payment processing |
| Complex | 5+ | 10000ms | User registration |

### 2. Handler Structure

**Command Handler:**
```typescript
@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly metricsService: MetricsService,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    return this.unitOfWork.execute(
      async (repos) => {
        // Business logic
      },
      { name: 'create-user', timeout: 5000 }
    );
  }
}
```

**Query Handler:**
```typescript
@Injectable()
export class GetUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(query: GetUserQuery): Promise<UserDto> {
    // Read logic with caching
  }
}
```

### 3. File Structure

```
modules/[feature]/
├── application/
│   ├── commands/
│   │   ├── create-[feature].command.ts
│   │   └── handlers/
│   │       └── create-[feature].handler.ts
│   ├── queries/
│   │   ├── get-[feature].query.ts
│   │   └── handlers/
│   │       └── get-[feature].handler.ts
│   └── dto/
├── domain/
│   ├── entities/
│   └── interfaces/
├── infrastructure/
│   └── persistence/
└── presentation/
    └── [feature].controller.ts
```

---

## 🔍 Common Scenarios

### Scenario 1: Creating a New Feature

**Steps:**
1. Create domain entities and interfaces
2. Create command/query classes
3. Implement handlers (use UnitOfWork for writes)
4. Create controller with DTOs
5. Write unit and integration tests
6. Update module providers

**Files to reference:**
- [CQRS Patterns](./cqrs-patterns.md) - Structure
- [Transaction Patterns](./transaction-patterns.md) - If multi-table
- [Testing Patterns](./testing-patterns.md) - Tests

### Scenario 2: Implementing Payment Flow

**Steps:**
1. Create payment command with transaction data
2. Implement handler with UnitOfWork (5-10s timeout)
3. Use helper: `repos.updateApplicationPaymentStatus()`
4. Record metrics for payment success/failure
5. Emit events after transaction commits
6. Test rollback scenarios

**Files to reference:**
- [Transaction Patterns](./transaction-patterns.md#2-payment-processing-financial-operation)
- [CQRS Patterns](./cqrs-patterns.md#pattern-2-commands-with-events)

### Scenario 3: Optimizing Slow Queries

**Steps:**
1. Check database indexes
2. Add caching layer
3. Use pagination for large datasets
4. Optimize Prisma includes/selects
5. Monitor with metrics

**Files to reference:**
- [Code Review Checklist](./code-review-checklist.md#performance)

---

## ⚠️ Common Pitfalls

### ❌ Don't Do This

```typescript
// 1. Don't use $transaction directly
await this.prisma.$transaction(async (tx) => { ... });

// 2. Don't put business logic in controllers
@Get()
async getUsers() {
  return this.prisma.user.findMany(); // BAD!
}

// 3. Don't forget transaction names
await this.unitOfWork.execute(async (repos) => { ... }); // Missing name!

// 4. Don't mix transaction and external calls
await this.unitOfWork.execute(async (repos) => {
  await repos.users.create({ ... });
  await this.emailService.send(); // BAD! External call in transaction
});
```

### ✅ Do This Instead

```typescript
// 1. Use UnitOfWork
await this.unitOfWork.execute(
  async (repos) => { ... },
  { name: 'operation', timeout: 5000 }
);

// 2. Use handlers for business logic
@Get()
async getUsers(@Query() dto: ListUsersQueryDto) {
  const query = new ListUsersQuery(dto.page, dto.limit);
  return this.listUsersHandler.execute(query);
}

// 3. Always name transactions
await this.unitOfWork.execute(
  async (repos) => { ... },
  { name: 'create-user', timeout: 5000 } // ✓ Named
);

// 4. External calls AFTER transaction
const user = await this.unitOfWork.execute(
  async (repos) => {
    return repos.users.create({ ... });
  },
  { name: 'create-user', timeout: 5000 }
);
await this.emailService.send(user.email); // ✓ After transaction
```

---

## 📈 Monitoring & Metrics

### Automatic Metrics

UnitOfWork automatically records:
- `db_transaction_duration_seconds` (histogram)
- `db_transaction_total` (counter: success/failure)

### Custom Metrics

Record in handlers:
- Command execution time
- Business metrics (signups, payments)
- Error rates

**Example:**
```typescript
this.metricsService.paymentTotal.inc({
  currency: 'IDR',
  method: 'credit_card',
  status: 'success'
});
```

---

## 🔗 Additional Resources

### Project Documentation

- [Architecture Overview](../../docs/architecture.md)
- [Clean Architecture Guide](../../docs/clean-architecture-guide.md)
- [Unit of Work Implementation](../../services/api/docs/UNIT_OF_WORK_IMPLEMENTATION.md)
- [Deployment Guide](../../docs/deployment.md)

### External Resources

- [Clean Architecture (Book)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)

---

## 🤝 Contributing

When adding new patterns or documentation:

1. **Update this README** with links to new documents
2. **Follow the existing format** for consistency
3. **Include code examples** for clarity
4. **Update [GitHub Copilot Instructions](../copilot-instructions.md)** if pattern is critical
5. **Add to [Code Review Checklist](./code-review-checklist.md)** if reviewable

---

## 📝 Changelog

| Date | Changes |
|------|---------|
| 2026-02-08 | Initial documentation structure with UoW patterns |

---

## 💡 Tips for Using with GitHub Copilot

1. **Reference Documentation in Comments**
   ```typescript
   // Following transaction patterns: .github/docs/transaction-patterns.md
   // Using UnitOfWork for multi-table operation
   ```

2. **Ask Copilot Specific Questions**
   - "Create a command handler following CQRS patterns"
   - "Implement transaction with 5s timeout for payment"
   - "Write unit tests for this handler"

3. **Review Generated Code**
   - Use [Code Review Checklist](./code-review-checklist.md)
   - Verify Clean Architecture compliance
   - Check transaction patterns

4. **Iterate and Improve**
   - If generated code doesn't match patterns, provide specific feedback
   - Reference documentation in your prompts

---

## 📞 Support

For questions or clarifications:

1. Check this documentation first
2. Review related documentation in `/docs`
3. Check existing implementations in codebase
4. Ask the team in code reviews

---

**Remember:** These patterns exist to ensure consistency, maintainability, and scalability. When in doubt, follow the documented patterns and ask questions! 🚀
