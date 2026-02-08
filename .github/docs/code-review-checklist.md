# Code Review Checklist

> Comprehensive checklist for reviewing code in YBB Platform. Use this to ensure consistency and quality before merging.

## Table of Contents
1. [Architecture & Design](#architecture--design)
2. [Code Quality](#code-quality)
3. [Transaction Management](#transaction-management)
4. [CQRS Patterns](#cqrs-patterns)
5. [Error Handling](#error-handling)
6. [Testing](#testing)
7. [Performance](#performance)
8. [Security](#security)
9. [Documentation](#documentation)
10. [Git & PR](#git--pr)

---

## Architecture & Design

### Clean Architecture Compliance

- [ ] **Dependency Direction**
  - Dependencies point inward (Presentation → Application → Domain → Infrastructure)
  - No reversed dependencies (e.g., Domain importing Infrastructure)

- [ ] **Layer Responsibilities**
  - Presentation layer only handles HTTP/routing
  - Application layer contains use case logic
  - Domain layer has no framework dependencies
  - Infrastructure implements domain interfaces

- [ ] **Module Structure**
  - Feature follows module structure (`application/`, `domain/`, `infrastructure/`, `presentation/`)
  - Files are in correct directories
  - Module is self-contained

### SOLID Principles

- [ ] **Single Responsibility**
  - Each class/function has one reason to change
  - Clear separation of concerns

- [ ] **Open/Closed Principle**
  - Open for extension, closed for modification
  - Uses interfaces/abstract classes

- [ ] **Liskov Substitution**
  - Derived classes can replace base classes
  - No unexpected behavior in implementations

- [ ] **Interface Segregation**
  - Interfaces are focused and specific
  - No fat interfaces with unused methods

- [ ] **Dependency Inversion**
  - Depends on abstractions, not concretions
  - Uses dependency injection

---

## Code Quality

### Naming Conventions

- [ ] **Classes**
  - PascalCase: `CreateUserHandler`, `UserRepository`
  - Descriptive and specific

- [ ] **Files**
  - kebab-case: `create-user.handler.ts`, `user.repository.ts`
  - Matches class name

- [ ] **Variables/Functions**
  - camelCase: `userId`, `createUser`
  - Clear and descriptive

- [ ] **Constants**
  - UPPER_SNAKE_CASE: `MAX_RETRIES`, `DEFAULT_TIMEOUT`

- [ ] **Booleans**
  - Prefixed with `is`, `has`, `should`: `isValid`, `hasPermission`

### Code Structure

- [ ] **Function Length**
  - Functions < 50 lines
  - Complex functions broken into smaller ones

- [ ] **File Length**
  - Files < 300 lines
  - Split large files into multiple

- [ ] **Class Size**
  - Classes < 200 lines
  - Extract responsibilities to new classes

- [ ] **Nesting Depth**
  - Max 3 levels of nesting
  - Use early returns

- [ ] **Parameters**
  - Max 4 parameters per function
  - Use objects for more parameters

### TypeScript Best Practices

- [ ] **Type Safety**
  - No `any` types (use `unknown` if needed)
  - Proper interfaces/types defined
  - Return types specified

- [ ] **Immutability**
  - Use `readonly` where appropriate
  - Avoid mutating parameters

- [ ] **Null Safety**
  - Use optional chaining (`?.`)
  - Use nullish coalescing (`??`)
  - Handle null/undefined explicitly

---

## Transaction Management

### Unit of Work Pattern

- [ ] **Correct Usage**
  - Multi-table operations use `UnitOfWork`
  - Single operations don't use transactions
  - Read-only queries use `executeReadOnly()` if complex

- [ ] **Transaction Naming**
  - Descriptive name: `user-registration`, `payment-processing`
  - Consistent naming convention
  - Name present in all transactions

- [ ] **Timeout Configuration**
  - Simple (2-3 tables): 3000ms
  - Medium (3-4 tables): 5000ms
  - Complex (5+ tables): 10000ms
  - Timeout is appropriate for complexity

- [ ] **Helper Methods**
  - Uses built-in helpers when available
  - `createAmbassadorReferral()`, `createAdmin()`, etc.
  - Not reimplementing common operations

- [ ] **Error Handling**
  - Try-catch around transactions
  - Errors logged appropriately
  - Metrics recorded on failure

### Anti-Patterns

- [ ] **Not Using** `prisma.$transaction` directly
- [ ] **Not Mixing** transaction and non-transaction operations
- [ ] **Not Forgetting** transaction names
- [ ] **Not Using** wrong timeout values
- [ ] **Not Creating** transactions for single operations

---

## CQRS Patterns

### Commands (Write Operations)

- [ ] **Structure**
  - Command class with readonly properties
  - Named with imperative verb: `CreateUserCommand`
  - Contains only necessary data

- [ ] **Handler**
  - `@Injectable()` decorator present
  - Injects `UnitOfWork` for multi-table operations
  - Injects `MetricsService` for monitoring
  - Has logger with handler name

- [ ] **Validation**
  - Business rules validated inside transaction
  - Input validation in DTOs
  - Meaningful error messages

- [ ] **Return Value**
  - Returns DTO, not domain entity
  - Minimal data (ID, success confirmation)

- [ ] **Metrics**
  - Success metrics recorded
  - Error metrics recorded
  - Duration tracked

### Queries (Read Operations)

- [ ] **Structure**
  - Query class with readonly properties
  - Named with descriptive noun: `GetUserQuery`
  - Contains only identifiers/filters

- [ ] **Handler**
  - Injects `PrismaService` (not UnitOfWork)
  - No state modification
  - Returns DTO

- [ ] **Caching**
  - Cache checked before database
  - Results cached when appropriate
  - Cache invalidation strategy clear

- [ ] **Optimization**
  - Appropriate `select`/`include`
  - Pagination for lists
  - Indexes on filtered columns

---

## Error Handling

### Exception Types

- [ ] **Correct HTTP Exceptions**
  - `NotFoundException` for missing resources
  - `ConflictException` for duplicates
  - `BadRequestException` for invalid input
  - `UnauthorizedException` for auth failures
  - `ForbiddenException` for permission issues

- [ ] **Domain Exceptions**
  - Custom exceptions for business rules
  - Extend `DomainException` base class
  - Meaningful error messages

- [ ] **Error Context**
  - Errors include relevant context
  - No sensitive data in error messages
  - Stack traces logged (not sent to client)

### Error Recovery

- [ ] **Graceful Degradation**
  - Fallback mechanisms in place
  - Partial failures handled
  - External service failures don't crash app

- [ ] **Retry Logic**
  - Transient errors retried
  - Max retry attempts configured
  - Exponential backoff used

---

## Testing

### Test Coverage

- [ ] **Unit Tests**
  - All handlers have unit tests
  - Edge cases covered
  - Error scenarios tested
  - Mocks used appropriately

- [ ] **Integration Tests**
  - Transaction rollback tested
  - Database operations verified
  - Helper methods tested

- [ ] **E2E Tests**
  - Critical flows covered
  - API endpoints tested
  - Authentication tested

### Test Quality

- [ ] **Test Names**
  - Descriptive: `should throw ConflictException if email exists`
  - Follow convention: `should [expected behavior] [condition]`

- [ ] **Test Structure**
  - AAA pattern (Arrange-Act-Assert)
  - One assertion per test (or related assertions)
  - Tests are independent

- [ ] **Test Data**
  - No hardcoded production data
  - Use builders/factories
  - Clean up after tests

- [ ] **No Test Pollution**
  - No `it.only` or `describe.only`
  - No skipped tests without reason
  - All tests pass

---

## Performance

### Database Operations

- [ ] **Query Optimization**
  - Uses indexes on filtered columns
  - Avoids N+1 queries
  - Pagination on large datasets

- [ ] **Connection Pooling**
  - Connection pool configured
  - Connections released properly

- [ ] **Transactions**
  - Short transaction duration
  - No external calls inside transactions
  - Appropriate timeout values

### Caching

- [ ] **Cache Strategy**
  - Frequently accessed data cached
  - TTL configured appropriately
  - Cache invalidation on updates

- [ ] **Cache Keys**
  - Descriptive and unique
  - Consistent naming convention
  - No key collisions

### API Performance

- [ ] **Response Time**
  - Target < 200ms for most endpoints
  - Heavy operations use background jobs
  - Endpoints monitored

- [ ] **Payload Size**
  - Large responses paginated
  - Unnecessary data filtered out
  - Compression enabled

---

## Security

### Authentication & Authorization

- [ ] **Authentication**
  - Protected routes use guards
  - JWT tokens validated
  - Refresh tokens implemented

- [ ] **Authorization**
  - Role-based access control
  - Permission checks in handlers
  - Resource ownership verified

- [ ] **Session Management**
  - Sessions expire appropriately
  - Logout invalidates tokens
  - Concurrent sessions handled

### Input Validation

- [ ] **DTO Validation**
  - `class-validator` decorators used
  - Custom validators for complex rules
  - Validation errors are clear

- [ ] **SQL Injection**
  - Prisma used (parameterized queries)
  - No raw SQL with user input
  - Input sanitized

- [ ] **XSS Prevention**
  - Output encoded
  - No `dangerouslySetInnerHTML`
  - Content Security Policy configured

### Data Protection

- [ ] **Sensitive Data**
  - Passwords hashed (bcrypt)
  - Sensitive fields not logged
  - PII encrypted at rest

- [ ] **API Security**
  - Rate limiting configured
  - CORS properly configured
  - Helmet.js enabled

---

## Documentation

### Code Documentation

- [ ] **Comments**
  - Complex logic explained
  - Why documented, not what
  - No commented-out code

- [ ] **JSDoc**
  - Public methods documented
  - Parameters described
  - Return values documented

- [ ] **README**
  - Module purpose explained
  - Setup instructions clear
  - Examples provided

### API Documentation

- [ ] **Swagger/OpenAPI**
  - Endpoints documented
  - Request/response examples
  - Error codes listed

- [ ] **DTO Descriptions**
  - `@ApiProperty` decorators
  - Validation rules documented
  - Examples provided

---

## Git & PR

### Commit Messages

- [ ] **Format**
  - Follows convention: `type(scope): message`
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  - Clear and concise

- [ ] **Content**
  - Describes what and why
  - References issue/ticket
  - Atomic commits

### Pull Request

- [ ] **Size**
  - < 500 lines changed
  - Focused on single feature/fix
  - Multiple features = multiple PRs

- [ ] **Description**
  - Clear title
  - What changed
  - Why changed
  - How to test

- [ ] **Testing**
  - Tests added for new features
  - Tests updated for changes
  - All tests pass locally
  - CI/CD passes

- [ ] **Code Review**
  - Self-reviewed before requesting review
  - All feedback addressed
  - Approvals from required reviewers

### Branch Strategy

- [ ] **Branch Naming**
  - `feature/description`, `fix/description`, `refactor/description`
  - Lowercase with hyphens
  - Descriptive

- [ ] **Target Branch**
  - Feature → `develop`
  - Hotfix → `main`
  - Release → `main` and `develop`

---

## Quick Review Checklist

Use this for fast reviews:

### Must Check ✅

- [ ] Clean Architecture followed
- [ ] UnitOfWork used for multi-table operations
- [ ] Transaction names and timeouts configured
- [ ] CQRS pattern followed (Commands/Queries separate)
- [ ] Error handling implemented
- [ ] Unit tests added
- [ ] No security vulnerabilities
- [ ] Code is readable and maintainable
- [ ] No breaking changes (or documented)
- [ ] PR description is clear

### Nice to Have 🌟

- [ ] Performance optimized
- [ ] Comprehensive test coverage
- [ ] API documentation updated
- [ ] Logging added
- [ ] Metrics recorded
- [ ] Code comments for complex logic
- [ ] Examples in documentation

---

## Review Guidelines

### For Reviewers

1. **Start with High-Level**
   - Architecture compliance
   - Design patterns
   - Overall approach

2. **Then Details**
   - Code quality
   - Naming conventions
   - Edge cases

3. **Provide Context**
   - Explain why, not just what
   - Link to documentation
   - Suggest improvements

4. **Be Constructive**
   - Praise good practices
   - Suggest alternatives
   - Ask questions, don't demand

5. **Focus on**
   - Correctness
   - Security
   - Performance
   - Maintainability

### For Authors

1. **Self-Review First**
   - Review your own PR
   - Run through this checklist
   - Fix obvious issues

2. **Provide Context**
   - Clear PR description
   - Screenshots/videos if UI
   - Test instructions

3. **Respond to Feedback**
   - Address all comments
   - Explain decisions
   - Update code or documentation

4. **Keep It Small**
   - Smaller PRs reviewed faster
   - Easier to understand
   - Less risk

---

## Automated Checks

These should be automated in CI/CD:

- [ ] Linting passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Code coverage > 80%
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Docker image builds
- [ ] E2E tests pass (staging)

---

## References

- [Clean Architecture Guide](../../docs/clean-architecture-guide.md)
- [Transaction Patterns](./transaction-patterns.md)
- [CQRS Patterns](./cqrs-patterns.md)
- [Testing Patterns](./testing-patterns.md)
- [Unit of Work Implementation](../../services/api/docs/UNIT_OF_WORK_IMPLEMENTATION.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-08 | Initial checklist with UoW patterns |

---

**Remember:** The goal of code review is to improve code quality and share knowledge, not to be a gatekeeper. Be kind, be clear, and be collaborative. 🚀
