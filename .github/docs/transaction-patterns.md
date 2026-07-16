# Transaction Patterns - Quick Reference

> Complete reference for transaction management in YBB Platform using the Unit of Work pattern.

## Table of Contents
1. [When to Use Transactions](#when-to-use-transactions)
2. [Unit of Work Quick Start](#unit-of-work-quick-start)
3. [Common Patterns](#common-patterns)
4. [Transaction Naming](#transaction-naming)
5. [Timeout Guidelines](#timeout-guidelines)
6. [Helper Methods](#helper-methods)
7. [Error Handling](#error-handling)
8. [Anti-Patterns](#anti-patterns)

---

## When to Use Transactions

### ✅ Use UnitOfWork For:
- Operations involving **2+ tables**
- Operations that must be **atomic** (all-or-nothing)
- Creating related entities (User + Participant + Application)
- Financial operations (Payment + Invoice + Status Update)
- Operations with referential integrity requirements

### ❌ Don't Use Transactions For:
- **Single table** operations
- **Read-only** queries (use `executeReadOnly` for complex queries)
- Operations without atomicity requirements
- Simple CRUD on one entity

---

## Unit of Work Quick Start

### Basic Pattern

```typescript
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';

@Injectable()
export class MyHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}
  
  async execute(command: MyCommand): Promise<ResultDto> {
    return this.unitOfWork.execute(
      async (repos) => {
        // All operations here share the same transaction
        const user = await repos.users.create({ ... });
        const participant = await repos.participants.create({ ... });
        
        return { userId: user.id, participantId: participant.id };
      },
      { 
        name: 'operation-name',  // For monitoring
        timeout: 5000            // 5 seconds
      }
    );
  }
}
```

### Available Repositories

Within the transaction callback, you have access to:

```typescript
repos.users          // User repository
repos.participants   // Participant repository
repos.ambassadors    // Ambassador repository
repos.applications   // Application repository
repos.supportTickets // Support Ticket repository
repos.tx             // Raw Prisma transaction client (for any table)
```

---

## Common Patterns

### 1. User Registration (Complex Multi-Table)

```typescript
async execute(command: RegisterCommand): Promise<UserDto> {
  return this.unitOfWork.execute(
    async (repos) => {
      // 1. Create user
      const user = await repos.users.create({
        data: {
          email: command.email,
          password: hashedPassword,
          emailVerified: false,
        }
      });
      
      // 2. Create identity
      await repos.tx.identity.create({
        data: {
          userId: user.id,
          provider: 'local',
          providerId: user.email,
        }
      });
      
      // 3. Create participant
      await repos.participants.create({
        data: {
          userId: user.id,
          firstName: command.firstName,
          lastName: command.lastName,
        }
      });
      
      // 4. Handle referral (helper method)
      if (command.referralCode) {
        await repos.createAmbassadorReferral(user.id, command.referralCode);
      }
      
      // 5. Create initial application
      await repos.applications.create({
        data: {
          participantId: participant.id,
          programId: command.programId,
          status: 'draft',
        }
      });
      
      return UserMapper.toDto(user);
    },
    { name: 'user-registration', timeout: 10000 } // Complex = 10s
  );
}
```

### 2. Payment Processing (Financial Operation)

```typescript
async execute(command: ProcessPaymentCommand): Promise<void> {
  return this.unitOfWork.execute(
    async (repos) => {
      // 1. Update application payment status (helper)
      await repos.updateApplicationPaymentStatus(
        command.applicationId,
        'paid'
      );
      
      // 2. Create invoice
      await repos.tx.applicationInvoice.create({
        data: {
          applicationId: command.applicationId,
          pricingTierId: command.pricingTierId,
          amount: command.amount,
          currency: command.currency,
          status: 'paid',
          paidAt: new Date(),
          externalTransactionId: command.transactionId,
          paymentMethod: command.method,
        }
      });
      
      // 3. Update payment record
      await repos.tx.payment.update({
        where: { id: command.paymentId },
        data: { status: 'completed', completedAt: new Date() }
      });
    },
    { name: 'payment-success-application-update', timeout: 5000 }
  );
}
```

### 3. Email Verification (Simple Sync)

```typescript
async execute(command: VerifyEmailCommand): Promise<void> {
  return this.unitOfWork.execute(
    async (repos) => {
      // Update user
      await repos.users.update({
        where: { id: command.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() }
      });
      
      // Sync to participant
      await repos.participants.update({
        where: { userId: command.userId },
        data: { emailVerified: true }
      });
    },
    { name: 'verify-email-sync', timeout: 3000 } // Simple = 3s
  );
}
```

### 4. Support Ticket Reply (Conditional Update)

```typescript
async execute(command: ReplyTicketCommand): Promise<MessageDto> {
  return this.unitOfWork.execute(
    async (repos) => {
      // 1. Create message
      const message = await repos.tx.supportMessage.create({
        data: {
          ticketId: command.ticketId,
          senderId: command.senderId,
          content: command.content,
        }
      });
      
      // 2. Conditionally update ticket status
      const ticket = await repos.supportTickets.findUnique({
        where: { id: command.ticketId }
      });
      
      if (ticket.status === 'pending' && command.isAdminReply) {
        await repos.supportTickets.update({
          where: { id: command.ticketId },
          data: { status: 'in_progress', lastReplyAt: new Date() }
        });
      }
      
      return MessageMapper.toDto(message);
    },
    { name: 'support-ticket-reply', timeout: 3000 }
  );
}
```

### 5. Read-Only Complex Query

```typescript
async execute(query: GetDashboardStatsQuery): Promise<StatsDto> {
  // Use executeReadOnly for queries that don't modify data
  // Automatically routes to read replica if configured
  return this.unitOfWork.executeReadOnly(
    async (repos) => {
      const [userCount, participantCount, applicationCount] = await Promise.all([
        repos.users.count(),
        repos.participants.count(),
        repos.applications.count({ where: { status: 'submitted' } })
      ]);
      
      return { userCount, participantCount, applicationCount };
    },
    { name: 'dashboard-stats' }
  );
}
```

### 6. Bulk Operations with Batching

```typescript
async execute(command: BulkCreateUsersCommand): Promise<UserDto[]> {
  // Use batchExecute for bulk operations
  // All operations share a single transaction
  const operations = command.users.map(userData => 
    async (repos: any) => repos.users.create({ data: userData })
  );
  
  const users = await this.unitOfWork.batchExecute(
    operations,
    { name: 'bulk-create-users', timeout: 15000 }
  );
  
  return users.map(UserMapper.toDto);
}
```

### 7. Distributed Tracing Example

```typescript
async execute(command: CreateOrderCommand, traceId: string): Promise<OrderDto> {
  // Pass traceId for end-to-end request tracking
  return this.unitOfWork.execute(
    async (repos) => {
      const order = await repos.tx.order.create({ ... });
      await repos.tx.orderItems.createMany({ ... });
      await repos.tx.payment.create({ ... });
      
      return OrderMapper.toDto(order);
    },
    {
      name: 'create-order',
      timeout: 10000,
      traceId,                    // Request ID from context
      spanName: 'db-create-order' // APM span name
    }
  );
}
```

---

## Transaction Naming

### Naming Convention

Use descriptive names following this pattern:
```
{entity}-{action}-{context}
```

### Examples

| Transaction Name | Purpose | Timeout |
|-----------------|---------|---------|
| `user-registration` | User signup with full profile | 10s |
| `firebase-login-participant-creation` | OAuth login with participant | 5s |
| `verify-email-sync` | Email verification sync | 3s |
| `complete-onboarding` | Finish onboarding flow | 5s |
| `register-admin` | Admin account creation | 5s |
| `payment-success-application-update` | Payment confirmation | 5s |
| `support-ticket-reply` | Support message creation | 3s |

### Why Transaction Names Matter

1. **Monitoring**: Track performance per transaction type
2. **Debugging**: Identify slow transactions in logs
3. **Alerting**: Set up alerts for specific operations
4. **Optimization**: Find bottlenecks and optimize

---

## Timeout Guidelines

Configure timeouts based on operation complexity:

### Simple Operations (2-3 tables)
**Timeout: 3000ms (3 seconds)**

Examples:
- Email verification sync (User + Participant)
- Support ticket reply (Message + Ticket status)
- Simple status updates

```typescript
{ name: 'verify-email-sync', timeout: 3000 }
```

### Medium Operations (3-4 tables)
**Timeout: 5000ms (5 seconds)**

Examples:
- Payment processing (Application + Invoice + Payment)
- OAuth login with profile (Participant + Referral + Stats)
- Admin registration (User + Admin + Brands)

```typescript
{ name: 'payment-processing', timeout: 5000 }
```

### Complex Operations (5+ tables)
**Timeout: 10000ms (10 seconds)**

Examples:
- User registration (User + Identity + Participant + Referral + Application)
- Complete onboarding with essays (Participant + User + Essays + Referral)
- Bulk operations with validation

```typescript
{ name: 'user-registration', timeout: 10000 }
```

### Performance Targets

Monitor these thresholds:
- **< 100ms**: Target for most operations
- **< 500ms**: Warning threshold
- **< 2000ms**: Critical threshold
- **> timeout**: Error (operation cancelled)

---

## Helper Methods

The `TransactionalRepositories` class provides helper methods for common operations.

### createAmbassadorReferral()

Creates a referral link and updates ambassador stats atomically.

```typescript
await repos.createAmbassadorReferral(userId: string, referralCode: string);
```

**Use when:**
- User signs up with a referral code
- Linking participant to ambassador

**Example:**
```typescript
if (command.referralCode) {
  await repos.createAmbassadorReferral(user.id, command.referralCode);
}
```

### incrementAmbassadorReferrals()

Increments referral count for an ambassador.

```typescript
await repos.incrementAmbassadorReferrals(ambassadorId: string);
```

**Use when:**
- A referred user completes an action
- Manually adjusting referral counts

### createAdmin()

Creates admin profile with brand assignments.

```typescript
await repos.createAdmin(
  userId: string,
  email: string,
  fullName: string,
  brandIds: string[],
  primaryBrandId?: string
);
```

**Use when:**
- Registering new admin user
- Converting user to admin

**Example:**
```typescript
await repos.createAdmin(
  user.id,
  command.email,
  `${command.firstName} ${command.lastName}`,
  command.brandIds,
  command.primaryBrandId
);
```

### updateApplicationPaymentStatus()

Updates application payment status (registration or program).

```typescript
await repos.updateApplicationPaymentStatus(
  applicationId: string,
  status: 'paid' | 'pending' | 'failed',
  category?: 'registration' | 'program'
);
```

**Use when:**
- Processing payment webhooks
- Manual payment status updates

**Example:**
```typescript
await repos.updateApplicationPaymentStatus(
  applicationId,
  'paid',
  'registration'
);
```

---

## Error Handling

### Automatic Retry on Deadlock

The UnitOfWork automatically retries on database deadlocks (3 attempts with exponential backoff).

```typescript
// No special handling needed - automatic retry
await this.unitOfWork.execute(
  async (repos) => {
    // If deadlock occurs, this will retry automatically
  },
  { name: 'operation' }
);
```

### Manual Retry Control

Use `executeWithRetry()` for custom retry logic:

```typescript
await this.unitOfWork.executeWithRetry(
  async (repos) => {
    // Your transaction
  },
  {
    name: 'critical-operation',
    timeout: 5000,
    maxRetries: 5,           // Default: 3
    retryDelayMs: 200        // Default: 100
  }
);
```

### Error Types

```typescript
try {
  await this.unitOfWork.execute(/* ... */);
} catch (error) {
  if (error.code === 'P2034') {
    // Deadlock - will be retried automatically
  } else if (error.code === 'P2002') {
    // Unique constraint violation - business logic error
    throw new ConflictException('User already exists');
  } else if (error.code === 'P2025') {
    // Record not found
    throw new NotFoundException('User not found');
  } else {
    // Unknown error
    this.logger.error('Transaction failed', error);
    throw error;
  }
}
```

---

## Anti-Patterns

### ❌ Don't: Use Prisma.$transaction Directly

```typescript
// ❌ BAD
async execute(command: CreateUserCommand) {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ ... });
    const participant = await tx.participant.create({ ... });
    return { user, participant };
  });
}
```

**Why:** No centralized monitoring, metrics, or retry logic.

**Do Instead:**
```typescript
// ✅ GOOD
async execute(command: CreateUserCommand) {
  return this.unitOfWork.execute(
    async (repos) => {
      const user = await repos.users.create({ ... });
      const participant = await repos.participants.create({ ... });
      return { user, participant };
    },
    { name: 'create-user', timeout: 5000 }
  );
}
```

### ❌ Don't: Transaction for Single Operation

```typescript
// ❌ BAD - Unnecessary transaction overhead
await this.unitOfWork.execute(
  async (repos) => {
    return repos.users.findUnique({ where: { id } });
  },
  { name: 'get-user' }
);
```

**Do Instead:**
```typescript
// ✅ GOOD - Direct access for single operation
const user = await this.prisma.user.findUnique({ where: { id } });
```

### ❌ Don't: Mix Transaction and Non-Transaction Ops

```typescript
// ❌ BAD - Non-atomic operation
async execute(command: CreateUserCommand) {
  // This is outside transaction - could succeed even if transaction fails
  await this.emailService.sendWelcome(command.email);
  
  await this.unitOfWork.execute(
    async (repos) => {
      await repos.users.create({ ... });
    },
    { name: 'create-user' }
  );
}
```

**Do Instead:**
```typescript
// ✅ GOOD - External calls after transaction succeeds
async execute(command: CreateUserCommand) {
  const user = await this.unitOfWork.execute(
    async (repos) => {
      return repos.users.create({ ... });
    },
    { name: 'create-user', timeout: 5000 }
  );
  
  // Send email AFTER transaction committed
  await this.emailService.sendWelcome(user.email);
}
```

### ❌ Don't: Forget Transaction Name

```typescript
// ❌ BAD - No monitoring
await this.unitOfWork.execute(
  async (repos) => { /* ... */ },
  { timeout: 5000 }  // Missing name!
);
```

**Do Instead:**
```typescript
// ✅ GOOD - Named for monitoring
await this.unitOfWork.execute(
  async (repos) => { /* ... */ },
  { name: 'create-user', timeout: 5000 }
);
```

### ❌ Don't: Use Wrong Timeout

```typescript
// ❌ BAD - Timeout too short for complex operation
await this.unitOfWork.execute(
  async (repos) => {
    // 5 table operations
    await repos.users.create({ ... });
    await repos.participants.create({ ... });
    await repos.applications.create({ ... });
    await repos.createAmbassadorReferral(...);
    await repos.tx.essay.create({ ... });
  },
  { name: 'user-registration', timeout: 3000 } // Too short!
);
```

**Do Instead:**
```typescript
// ✅ GOOD - Appropriate timeout for complexity
await this.unitOfWork.execute(
  async (repos) => {
    // 5+ tables = 10s timeout
  },
  { name: 'user-registration', timeout: 10000 }
);
```

---

## Quick Reference Checklist

When implementing a new transaction:

- [ ] Operation involves 2+ tables or requires atomicity
- [ ] Using `unitOfWork.execute()` (not `prisma.$transaction`)
- [ ] Transaction has descriptive name for monitoring
- [ ] Timeout is appropriate for complexity (3s/5s/10s)
- [ ] Helper methods used where applicable
- [ ] Error handling implemented (try-catch)
- [ ] Metrics recorded for critical operations
- [ ] External calls (email, webhooks) happen AFTER transaction
- [ ] Unit tests mock UnitOfWork
- [ ] Integration tests verify rollback behavior

---

## See Also

- [Unit of Work Implementation Guide](../../services/api/docs/UNIT_OF_WORK_IMPLEMENTATION.md)
- [CQRS Patterns](./cqrs-patterns.md)
- [Testing Patterns](./testing-patterns.md)
- [Code Review Checklist](./code-review-checklist.md)
