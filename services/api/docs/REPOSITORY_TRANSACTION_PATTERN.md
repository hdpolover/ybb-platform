# Repository Transaction Pattern

## Overview
This document explains how to implement transaction support in repositories while maintaining clean architecture principles.

## The Challenge

Our application uses the Repository Pattern to abstract database operations. However, Prisma transactions require passing the transaction client `tx` through the call chain. This creates tension between:

1. **Clean Architecture**: Repositories should hide implementation details
2. **Transaction Requirements**: Multiple repository operations need to share a transaction scope

## Solution Approaches

### Approach 1: Handler-Level Transactions (Current - Recommended)

For complex operations involving multiple entities, handle transactions at the **handler/service layer** using direct Prisma operations.

#### When to Use
- Operations span multiple aggregates
- Complex business logic with multiple steps
- Need fine-grained control over transaction scope

#### Example: User Registration
```typescript
// register.handler.ts
@Injectable()
export class RegisterHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: RegisterCommand) {
    return await this.prisma.$transaction(async (tx) => {
      // Direct Prisma operations within transaction
      const user = await tx.user.create({
        data: {
          email: command.email,
          identities: { create: {...} }
        }
      });
      
      const participant = await tx.participant.create({
        data: { userId: user.id, ... }
      });
      
      if (command.referralCode) {
        await tx.ambassadorReferral.create({...});
        await tx.ambassador.update({...});
      }
      
      return user;
    });
  }
}
```

#### Pros
✅ Simple and explicit  
✅ Easy to understand transaction scope  
✅ No repository API changes needed  
✅ Works well for complex, one-off operations  

#### Cons
❌ Bypasses repository abstraction  
❌ Handler knows about database structure  
❌ Harder to reuse transaction logic  

### Approach 2: Repository Methods with Optional Transaction Client

Add optional `tx` parameter to repository methods for operations that may be part of a transaction.

#### When to Use
- Reusable repository operations
- Operations called from multiple places
- Want to maintain repository abstraction

#### Example: Application Repository

```typescript
// application.repository.interface.ts
export interface IApplicationRepository {
  create(
    application: ParticipantApplication,
    tx?: PrismaTransactionClient
  ): Promise<ParticipantApplication>;
  
  update(
    application: ParticipantApplication,
    tx?: PrismaTransactionClient
  ): Promise<ParticipantApplication>;
}

// application.repository.ts
@Injectable()
export class ApplicationRepository implements IApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}
  
  async create(
    application: ParticipantApplication,
    tx?: any
  ): Promise<ParticipantApplication> {
    const prisma = tx || this.prisma;
    const data = this.mapper.toPrismaCreate(application);
    
    const created = await prisma.participantApplication.create({ data });
    return this.mapper.toDomain(created);
  }
  
  async update(
    application: ParticipantApplication,
    tx?: any
  ): Promise<ParticipantApplication> {
    const prisma = tx || this.prisma;
    const data = this.mapper.toPrismaUpdate(application);
    
    const updated = await prisma.participantApplication.update({
      where: { id: application.id },
      data,
    });
    return this.mapper.toDomain(updated);
  }
}
```

#### Handler Usage
```typescript
// With transaction
await this.prisma.$transaction(async (tx) => {
  const application = await this.applicationRepo.create(app, tx);
  const invoice = await this.invoiceRepo.create(inv, tx);
  return { application, invoice };
});

// Without transaction (normal usage)
const application = await this.applicationRepo.create(app);
```

#### Pros
✅ Maintains repository abstraction  
✅ Reusable across handlers  
✅ Backward compatible (optional parameter)  
✅ Flexible for both transactional and non-transactional use  

#### Cons
❌ Leaks Prisma transaction concept through interfaces  
❌ Every repository method needs `tx` parameter  
❌ TypeScript typing can be tricky (`any` for transaction client)  

### Approach 3: Unit of Work Pattern (Future)

Implement a Unit of Work to manage transaction scope and coordinate multiple repositories.

#### When to Use
- Large applications with many entities
- Need sophisticated transaction management
- Want to decouple transaction logic completely

#### Example: Unit of Work Service

```typescript
// unit-of-work.service.ts
@Injectable()
export class UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}
  
  async execute<T>(
    work: (repositories: TransactionalRepositories) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      const repositories = new TransactionalRepositories(tx);
      return await work(repositories);
    });
  }
}

// transactional-repositories.ts
export class TransactionalRepositories {
  public readonly users: UserRepository;
  public readonly participants: ParticipantRepository;
  public readonly applications: ApplicationRepository;
  
  constructor(tx: PrismaTransactionClient) {
    this.users = new UserRepository(tx);
    this.participants = new ParticipantRepository(tx);
    this.applications = new ApplicationRepository(tx);
  }
}

// Handler usage
await this.unitOfWork.execute(async (repos) => {
  const user = await repos.users.create(userData);
  const participant = await repos.participants.create(participantData);
  return { user, participant };
});
```

#### Pros
✅ Clean separation of concerns  
✅ Repositories don't need `tx` parameter  
✅ Easy to mock for testing  
✅ Scalable for large applications  

#### Cons
❌ More complex setup  
❌ Requires Repository factory pattern  
❌ Overkill for small applications  
❌ More classes to maintain  

## Current Implementation Strategy

### Phase 1: Handler-Level Transactions (Current)
For critical operations (registration, login, onboarding), we use **Approach 1** - direct Prisma operations in handlers.

**Files Implemented**:
- ✅ `register.handler.ts` - User + Participant + Referral
- ✅ `firebase-login.handler.ts` - Participant + Referral
- ✅ `verify-email.handler.ts` - User + Participant sync
- ✅ `complete-onboarding.handler.ts` - Already had transactions

### Phase 2: Repository Transaction Support (Future)
When operations need to be reused across multiple handlers, migrate to **Approach 2**.

**Candidates**:
- Application creation with invoice
- Bulk status updates
- Payment processing with status updates

### Phase 3: Unit of Work (Optional)
If the application grows significantly and transaction management becomes complex, consider **Approach 3**.

## Guidelines by Use Case

### Single Repository, Single Operation
**✅ No Transaction Needed** - Already atomic

```typescript
// Safe - single Prisma operation
await this.applicationRepo.update(application);
```

### Single Repository, Multiple Operations
**✅ Use Handler Transaction** - Simple and clear

```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.participantApplication.update({...});
  await tx.participantApplication.update({...});
});
```

### Multiple Repositories, Simple Operations
**✅ Choice A: Handler Transaction**

```typescript
await this.prisma.$transaction(async (tx) => {
  // Direct operations
  await tx.user.update({...});
  await tx.participant.update({...});
});
```

**✅ Choice B: Repository with TX Parameter** (if reusable)

```typescript
await this.prisma.$transaction(async (tx) => {
  await this.userRepo.update(user, tx);
  await this.participantRepo.update(participant, tx);
});
```

### Complex Multi-Repository Operations
**✅ Recommended: Handler Transaction** first, then refactor to Unit of Work if needed.

## Testing Strategy

### Unit Tests - Handler Level
```typescript
describe('RegisterHandler', () => {
  it('should rollback on participant creation failure', async () => {
    // Mock to throw error on participant creation
    jest.spyOn(prisma.participant, 'create').mockRejectedValue(
      new Error('Database error')
    );
    
    await expect(handler.execute(command)).rejects.toThrow();
    
    // Verify no user was created
    const user = await prisma.user.findUnique({
      where: { email: command.email }
    });
    expect(user).toBeNull();
  });
});
```

### Unit Tests - Repository with TX
```typescript
describe('ApplicationRepository', () => {
  it('should work with transaction client', async () => {
    await prisma.$transaction(async (tx) => {
      const app = await repository.create(application, tx);
      expect(app.id).toBeDefined();
    });
  });
  
  it('should work without transaction client', async () => {
    const app = await repository.create(application);
    expect(app.id).toBeDefined();
  });
});
```

### Integration Tests
```typescript
describe('User Registration Integration', () => {
  it('should create user, participant, and referral atomically', async () => {
    const result = await handler.execute(registerCommand);
    
    const user = await prisma.user.findUnique({
      where: { id: result.userId }
    });
    const participant = await prisma.participant.findUnique({
      where: { userId: result.userId }
    });
    const referral = await prisma.ambassadorReferral.findFirst({
      where: { participantId: participant.id }
    });
    
    expect(user).toBeDefined();
    expect(participant).toBeDefined();
    expect(referral).toBeDefined();
  });
});
```

## Migration Path for Existing Repositories

### Step 1: Identify Operations Needing Transactions
Run this analysis:
```bash
# Find handlers with multiple Prisma operations
grep -r "await.*prisma\." src/modules --include="*.handler.ts" | \
  sort | uniq -c | sort -rn
```

### Step 2: Prioritize by Risk
**High Risk**: Financial operations, user registration, data integrity critical  
**Medium Risk**: Status updates, bulk operations  
**Low Risk**: Single table updates, read operations  

### Step 3: Implement Incrementally
1. Start with high-risk operations
2. Use handler-level transactions first (fastest)
3. Extract to repository methods if reused
4. Consider Unit of Work only if patterns emerge

### Step 4: Add Monitoring
```typescript
this.logger.debug('Transaction started: user-registration');
const result = await this.prisma.$transaction(async (tx) => {
  // operations
});
this.logger.debug('Transaction completed: user-registration');
```

## Best Practices

### ✅ DO

1. **Keep transactions short** - Only database operations
2. **Handle errors explicitly** - Log and wrap in domain exceptions
3. **Document transaction scope** - Comment what's atomic
4. **Test rollback behavior** - Verify nothing persists on failure
5. **Use TransactionService** - For monitoring and retries

```typescript
// Good - Short transaction
await this.transactionService.execute(
  async (tx) => {
    await tx.user.create({...});
    await tx.participant.create({...});
  },
  { name: 'register-user', timeout: 5000 }
);
```

### ❌ DON'T

1. **Don't call external APIs in transactions**
2. **Don't do complex calculations in transactions**
3. **Don't hold transactions open during I/O**
4. **Don't nest transactions** (Prisma doesn't support savepoints)

```typescript
// Bad - External calls in transaction
await this.prisma.$transaction(async (tx) => {
  await tx.user.create({...});
  await this.emailService.send({...}); // ❌ NO!
  await this.stripeAPI.createCustomer({...}); // ❌ NO!
});

// Good - External calls after transaction
const user = await this.prisma.$transaction(async (tx) => {
  return await tx.user.create({...});
});
// Side effects after commit
await this.emailService.send({...});
await this.stripeAPI.createCustomer({...});
```

## Performance Considerations

### Transaction Duration
- **Target**: < 100ms for most operations
- **Warning**: > 500ms (may indicate N+1 queries or external calls)
- **Critical**: > 2 seconds (likely doing too much)

### Connection Pool
Current configuration: 5 connections  
Monitor: `prisma_pool_connections_open`

If seeing timeouts:
1. Reduce transaction duration first
2. Consider increasing pool size (max recommended: 10)
3. Check for connection leaks

### Lock Contention
High-traffic tables need special consideration:
- **Users table**: Most critical, accessed frequently
- **Applications table**: Moderate contention
- **Participant stats**: Consider eventual consistency

## Troubleshooting

### "Transaction already closed"
**Cause**: Trying to use `tx` outside callback scope  
**Solution**: Ensure all operations inside the callback

### "Transaction timeout"
**Cause**: Operations taking too long or external calls  
**Solution**: Reduce transaction scope, move external calls outside

### "Deadlock detected"
**Cause**: Two transactions waiting for each other  
**Solution**: Order operations consistently, use shorter transactions

### "Too many clients"
**Cause**: Connection pool exhausted  
**Solution**: Check for connection leaks, close transactions properly

## Summary

**Current Strategy**: Handler-level transactions for critical operations  
**Fallback**: Repository transaction parameters when needed  
**Future**: Unit of Work if complexity grows  

**Key Principle**: Start simple, evolve as needed. Transactions are important, but over-engineering is worse than under-engineering.

## References

- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [TRANSACTION_STRATEGY.md](./TRANSACTION_STRATEGY.md) - Implementation guide
- [TRANSACTION_IMPLEMENTATION_SUMMARY.md](./TRANSACTION_IMPLEMENTATION_SUMMARY.md) - What's done
