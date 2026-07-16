# Database Transaction Strategy

## Overview
This document outlines our transaction rollback strategy to ensure data integrity and prevent orphaned/incomplete records in the database.

## Prisma Transaction Support

Prisma provides two transaction approaches:

### 1. Sequential Transactions (Array)
```typescript
await prisma.$transaction([
  prisma.user.create({ data: {...} }),
  prisma.participant.create({ data: {...} }),
]);
```
**Use when**: Operations are independent and order-dependent.

### 2. Interactive Transactions (Recommended)
```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: {...} });
  const participant = await tx.participant.create({ 
    data: { userId: user.id, ... } 
  });
  return { user, participant };
});
```
**Use when**: Later operations depend on results from earlier ones.

## Transaction Timeout
Default: 5 seconds. Configure in PrismaService if needed:
```typescript
await prisma.$transaction(async (tx) => {
  // operations
}, {
  maxWait: 5000, // max time to wait for transaction to start
  timeout: 10000, // max execution time
});
```

## Critical Paths Requiring Transactions

### ✅ 1. User Registration (IMPLEMENTED)
**File**: `src/modules/auth/application/commands/handlers/register.handler.ts`

**Operations**:
- Create User + Identity
- Create Participant
- Link Ambassador Referral
- Update Ambassador Stats
- Create Application (if program specified)

**Why**: If participant creation fails after user creation, we'd have a user without a participant profile, breaking the application flow.

**Implementation**:
```typescript
await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.create({...});
  const participant = await tx.participant.create({...});
  if (ambassador) {
    await tx.ambassadorReferral.create({...});
    await tx.ambassador.update({...});
  }
  if (targetProgramId) {
    await tx.participantApplication.create({...});
  }
  return user;
});
```

### ✅ 2. Firebase Login (IMPLEMENTED)
**File**: `src/modules/auth/application/commands/handlers/firebase-login.handler.ts`

**Operations**:
- Create Participant (if not exists)
- Link Ambassador Referral
- Update Ambassador Stats

**Why**: OAuth login should atomically create participant profile with referral tracking.

**Implementation**:
```typescript
participant = await this.prisma.$transaction(async (tx) => {
  const newParticipant = await tx.participant.create({...});
  if (ambassador) {
    await tx.ambassadorReferral.create({...});
    await tx.ambassador.update({...});
  }
  return newParticipant;
});
```

### ✅ 3. Email Verification (IMPLEMENTED)
**File**: `src/modules/auth/application/commands/handlers/verify-email.handler.ts`

**Operations**:
- Update User email verification status
- Update Participant email verification status

**Why**: User and participant email verification must stay in sync.

**Implementation**:
```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.user.update({...});
  await tx.participant.update({...});
});
```

### ✅ 4. Support Ticket Reply (IMPLEMENTED)
**File**: `src/modules/support/application/commands/handlers/reply-support-ticket.handler.ts`

**Operations**:
- Create ticket message
- Update ticket status (conditional)

**Why**: Message creation and status update must be atomic. If status update fails after message is added, we'd have inconsistent state.

**Implementation**:
```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.supportTicketMessage.create({...});
  if (needsStatusUpdate) {
    await tx.supportTicket.update({...});
  }
});
```

### ✅ 2. Complete Onboarding (ALREADY IMPLEMENTED)
**File**: `src/modules/participants/application/commands/handlers/complete-onboarding.handler.ts`

**Operations**:
- Upsert Participant
- Sync User Email Verification
- Create/Validate Ambassador Referral
- Update Ambassador Stats
- Mark User Onboarding Complete

**Status**: Already uses `$transaction` ✅

### ✅ 3. Register Admin (ALREADY IMPLEMENTED)
**File**: `src/modules/auth/application/commands/handlers/register-admin.handler.ts`

**Operations**:
- Create User
- Create Admin Profile

**Status**: Already uses `$transaction` ✅

### 🔄 4. Application Submission
**File**: `src/modules/applications/application/commands/handlers/submit-application.handler.ts`

**Current State**: Single repository update (statusHistory is JSONB, atomic)

**Recommendation**: Currently safe. Single Prisma update is atomic. If future logic adds:
- Payment verification record creation
- Notification creation
- Stats update

Then wrap in transaction.

### 🔄 5. Application Review
**File**: `src/modules/applications/application/commands/handlers/review-application.handler.ts`

**Current State**: Single repository update (statusHistory is JSONB, atomic)

**Future Enhancement**: If adding:
- Notification creation
- Email queue
- Participant stats update

Then wrap in transaction:
```typescript
await this.prisma.$transaction(async (tx) => {
  // Update via repository (needs tx support)
  // Create notification
  // Update stats
});
```

### 🔄 6. Application Creation
**File**: `src/modules/applications/application/commands/handlers/create-application.handler.ts`

**Current State**: Single repository create operation (atomic)

**Recommendation**: Currently safe. If future logic adds invoice creation or fee calculation, wrap in transaction.

### 🎯 7. Payment Processing (NOT YET REVIEWED)
**Location**: Payment Service (Go)

**Critical Operations**:
- Create Payment Intent
- Create Payment Transaction
- Update Application Payment Status
- Create Invoice
- Update Application Status

**Recommendation**: Payment service should use Go database/sql transactions for multi-table operations.

### 🎯 8. Withdrawal Request
Potential use case: Participant withdraws application

**Operations**:
- Update Application Status
- Create Refund Request
- Update Payment Status
- Send Notification

**Recommendation**: Wrap in transaction when implemented.

### 🟡 9. Program Deletion with Activity Log
**File**: `src/modules/programs/application/commands/handlers/delete-program.handler.ts`

**Current State**: Sequential operations
- Delete program
- Create activity log

**Analysis**: Activity logging typically treated as "best effort" - program deletion should succeed even if logging fails.

**Recommendation**: 
- **Option A (Current)**: Keep as-is. Operational priority over audit strictness.
- **Option B (Strict Audit)**: Wrap in transaction if business requires guaranteed audit trail.

```typescript
// Option B: Strict Audit
await this.prisma.$transaction(async (tx) => {
  await tx.program.delete({ where: { id: programId } });
  await tx.userActivityLog.create({
    data: {
      userId, activityType: 'DELETE_PROGRAM',
      activityData: { programId, programName: existingProgram.name }
    }
  });
});
```

**Trade-offs**:
- Without transaction: Program deleted even if log fails (operational resilience)
- With transaction: Program deletion blocked if log fails (audit guarantee)

Choose based on business requirements: operational availability vs audit completeness.

## Repository Pattern & Transactions

### Challenge
Our repositories use abstraction, but Prisma transactions require passing the transaction client.

### Solution Options

#### Option 1: Pass Transaction Client (Recommended for Complex Operations)
```typescript
// Handler
await this.prisma.$transaction(async (tx) => {
  await this.customRepositoryMethod(tx, data);
});

// Repository
async customRepositoryMethod(tx: any, data: any) {
  const user = await tx.user.create({...});
  const participant = await tx.participant.create({...});
}
```

#### Option 2: Keep Transactions in Handlers (Current Pattern)
For operations involving multiple repositories or services:
```typescript
// Handler
await this.prisma.$transaction(async (tx) => {
  // Direct Prisma calls for transaction scope
  // Or inject tx into multiple repository calls
});
```

#### Option 3: Unit of Work Pattern (Future Enhancement)
Create a `UnitOfWork` service that manages transaction scope:
```typescript
await this.unitOfWork.execute(async (repositories) => {
  await repositories.user.create({...});
  await repositories.participant.create({...});
});
```

## Guidelines

### When to Use Transactions

✅ **YES - Use Transactions**:
- Multiple database writes across different tables
- Operations where partial completion creates invalid state
- Referential integrity beyond FK constraints (e.g., stats updates)
- Financial operations (payments, refunds, invoices)
- User registration/onboarding with profile creation

❌ **NO - Skip Transactions**:
- Single `create/update/delete` operation (inherently atomic)
- Read-only operations
- Operations with external API calls (keep transactions short)
- Idempotent operations where retry is safe

### Best Practices

1. **Keep Transactions Short**
   - Include only database operations
   - Move external API calls outside transaction
   - Avoid HTTP requests inside transactions

2. **Handle Errors Gracefully**
   ```typescript
   try {
     await this.prisma.$transaction(async (tx) => {
       // operations
     });
   } catch (error) {
     this.logger.error('Transaction failed', error);
     throw new InternalServerErrorException('...');
   }
   ```

3. **Avoid Nested Transactions**
   Prisma doesn't support savepoints. Design operations to use single transaction scope.

4. **External Side Effects After Success**
   ```typescript
   const result = await this.prisma.$transaction(async (tx) => {
     // DB operations only
   });
   
   // After commit success
   await this.rabbitmqProducer.emit('user.created', result);
   await this.cacheService.invalidate(...);
   ```

5. **Document Transaction Scope**
   Add comments explaining what operations are atomic:
   ```typescript
   // ========================================
   // CRITICAL: Use Transaction for Atomicity
   // All user creation and profile setup must succeed together
   // ========================================
   await this.prisma.$transaction(async (tx) => {
     // ...
   });
   ```

## Testing Transactions

### Unit Tests
Mock PrismaService.$transaction:
```typescript
mockPrismaService.$transaction.mockImplementation((callback) => 
  callback(mockPrismaService)
);
```

### Integration Tests
Test rollback behavior:
```typescript
it('should rollback all changes on failure', async () => {
  // Trigger a failure in the middle of transaction
  // Verify no partial data exists
});
```

### End-to-End Tests
Test concurrent requests to verify isolation levels.

## Performance Considerations

1. **Connection Pooling**: Configured in PrismaService (currently 5 connections via `connection_limit=5`)
2. **Transaction Timeout**: Default 5s, increase for complex operations
3. **Lock Contention**: Be aware of row-level locks on high-traffic tables
4. **Monitoring**: Track transaction duration via MetricsService

## Migration Path

### Phase 1 (Completed ✅)
- User Registration transactions
- Onboarding transactions
- Admin Registration transactions

### Phase 2 (Current Focus)
- Application Review with notifications
- Payment processing with status updates
- Invoice generation

### Phase 3 (Future)
- Complex multi-service operations
- Saga pattern for distributed transactions
- Unit of Work implementation

## Examples from Codebase

### Example 1: Complete Onboarding (Already Implemented)
```typescript
// complete-onboarding.handler.ts
const result = await this.prisma.$transaction(async (tx) => {
  let participant = await tx.participant.upsert({...});
  
  if (dto.referralCode) {
    const ambassador = await tx.ambassador.findUnique({...});
    if (ambassador) {
      await tx.ambassadorReferral.create({...});
      await tx.ambassador.update({...});
    }
  }
  
  await tx.user.update({...});
  return participant;
});
```

### Example 2: User Registration (Just Implemented)
```typescript
// register.handler.ts
const newUser = await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: {
      email, passwordHash, brandId,
      identities: { create: {...} }
    }
  });
  
  const participant = await tx.participant.create({
    data: { userId: user.id, ... }
  });
  
  if (ambassador) {
    await tx.ambassadorReferral.create({...});
    await tx.ambassador.update({...});
  }
  
  if (targetProgramId) {
    await tx.participantApplication.create({...});
  }
  
  return user;
});
```

## Troubleshooting

### Common Issues

**Issue**: `Transaction already closed`
**Solution**: Don't use transaction client outside the callback scope

**Issue**: `Transaction timeout`
**Solution**: Increase timeout or optimize queries

**Issue**: `Deadlock detected`
**Solution**: Order operations consistently, use shorter transactions

**Issue**: `Too many clients already`
**Solution**: Increase connection pool size or reduce transaction duration

## Monitoring

Add metrics for transaction monitoring:
```typescript
const transactionTimer = this.metrics.transactionDuration.startTimer();
try {
  await this.prisma.$transaction(async (tx) => {
    // operations
  });
  this.metrics.transactionTotal.inc({ status: 'success' });
} catch (error) {
  this.metrics.transactionTotal.inc({ status: 'failed' });
  throw error;
} finally {
  transactionTimer();
}
```

## References

- [Prisma Transactions Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- Clean Architecture: Keep domain logic separate from transaction management
