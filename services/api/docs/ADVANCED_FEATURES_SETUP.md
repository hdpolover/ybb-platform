# Advanced Features Setup Guide

This guide explains how to configure and use the advanced features of the Unit of Work pattern.

## Table of Contents
1. [Read Replica Routing](#read-replica-routing)
2. [Circuit Breaker](#circuit-breaker)
3. [Distributed Tracing](#distributed-tracing)
4. [Query Batching](#query-batching)
5. [Monitoring](#monitoring)

---

## 1. Read Replica Routing

### Overview
Automatically routes read-only queries to read replica databases, reducing load on the primary database and improving performance.

### Configuration

#### Step 1: Add Read Replica to Environment

```bash
# .env
DATABASE_URL=postgresql://user:pass@primary-host:5432/ybb_platform
READ_REPLICA_URL=postgresql://user:pass@replica-host:5432/ybb_platform
```

#### Step 2: No Code Changes Required!

The `executeReadOnly()` method automatically detects and uses the read replica when configured:

```typescript
// Automatically routed to replica
const users = await this.unitOfWork.executeReadOnly(
  async (repos) => {
    return await repos.users.findMany({ where: { status: 'active' } });
  },
  { name: 'list-active-users' }
);
```

### When to Use

✅ **Use `executeReadOnly()` for:**
- List operations (findMany)
- Count queries
- Dashboard statistics
- Reports and analytics
- Any read-only operation

❌ **Don't use for:**
- Write operations (create, update, delete)
- Operations that modify state

### Benefits

- **50-70% reduced load** on primary database
- **Improved read performance** (replicas can be optimized for reads)
- **Automatic fallback** to primary if replica is unavailable
- **Zero downtime** - works with or without replica

---

## 2. Circuit Breaker

### Overview
Automatically protects your application from cascade failures during database outages by "opening" the circuit and fast-failing requests.

### Configuration

You can customize circuit breaker behavior via environment variables:

```bash
# .env

# Number of consecutive failures before circuit opens (default: 5)
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5

# Number of successful requests to close circuit from half-open (default: 3)
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3

# Milliseconds before attempting to close circuit (default: 60000 = 60 seconds)
CIRCUIT_BREAKER_TIMEOUT=60000
```

### How It Works

```
CLOSED (Normal)
  ↓ (failures >= FAILURE_THRESHOLD)
OPEN (Rejecting requests, wait TIMEOUT ms)
  ↓ (timeout elapsed)
HALF_OPEN (Testing recovery)
  ↓ (successes >= SUCCESS_THRESHOLD)
CLOSED (Recovered)
```

### No Code Changes Required!

The circuit breaker is **enabled by default** and automatically configured from environment variables (or uses defaults if not set).

### Monitoring Circuit State

```typescript
// In your health check endpoint
@Get('health/circuit-breaker')
async getCircuitState() {
  return this.unitOfWork.getCircuitState();
}

// Returns:
// {
//   state: 'closed',      // 'closed' | 'open' | 'half_open'
//   failureCount: 0,
//   successCount: 0
// }
```

### What Happens When Circuit Opens?

When the circuit opens (after 5 failures), all subsequent requests will **immediately fail** with:

```
Error: Circuit breaker is OPEN for database operations.
Please try again in 45s
```

This prevents:
- Resource exhaustion (connection pools, memory)
- Cascade failures across services
- Long wait times for users

### Production Alerts

Set up alerts for circuit state changes:

```yaml
# Example Prometheus alert
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state == 1  # 0=closed, 1=open, 2=half_open
  for: 1m
  annotations:
    summary: "Database circuit breaker is OPEN"
    description: "Database operations are being rejected due to failures"
```

---

## 3. Distributed Tracing

### Overview
Track transactions across services with trace IDs and span names for better observability.

### Usage

#### Basic Tracing

```typescript
@Post('users')
async createUser(@Body() dto: CreateUserDto, @Headers('x-trace-id') traceId: string) {
  const command = new CreateUserCommand(...);
  
  return this.createUserHandler.execute(command, traceId);
}

// In handler
async execute(command: CreateUserCommand, traceId?: string): Promise<UserDto> {
  return this.unitOfWork.execute(
    async (repos) => {
      // Transaction logic
    },
    {
      name: 'user-registration',
      timeout: 10000,
      traceId,                           // Correlate with other services
      spanName: 'db-create-user-profile' // APM span name
    }
  );
}
```

#### Integration with APM Tools

**For DataDog:**
```typescript
import { trace } from 'dd-trace';

const span = trace.scope().active();
const traceId = span?.context().toTraceId();

await this.unitOfWork.execute(
  async (repos) => { /* ... */ },
  { name: 'operation', traceId, spanName: 'db-operation' }
);
```

**For New Relic:**
```typescript
import newrelic from 'newrelic';

const traceId = newrelic.getTransaction()?.id;

await this.unitOfWork.execute(
  async (repos) => { /* ... */ },
  { name: 'operation', traceId, spanName: 'db-operation' }
);
```

### Log Correlation

All logs will include the trace ID:

```
[Trace: req-abc-123] Transaction started: user-registration (db-create-user-profile)
[Trace: req-abc-123] Transaction completed: user-registration (145ms)
```

This makes it easy to:
- Track requests across microservices
- Debug issues in distributed systems
- Measure end-to-end latency

---

## 4. Query Batching

### Overview
Execute multiple operations in a single transaction with optimized performance.

### Usage

#### Bulk Creation

```typescript
async bulkCreateUsers(users: CreateUserDto[]): Promise<UserDto[]> {
  // Create array of operations
  const operations = users.map(userData => 
    async (repos: TransactionalRepositories) => {
      const user = await repos.users.create({
        data: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        }
      });
      
      await repos.participants.create({
        data: {
          userId: user.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
        }
      });
      
      return user;
    }
  );
  
  // Execute all in batch
  const createdUsers = await this.unitOfWork.batchExecute(
    operations,
    { 
      name: 'bulk-create-users', 
      timeout: 15000  // Longer timeout for bulk ops
    }
  );
  
  return createdUsers.map(UserMapper.toDto);
}
```

#### Bulk Updates

```typescript
async updateApplicationStatuses(updates: ApplicationUpdate[]): Promise<void> {
  const operations = updates.map(update => 
    async (repos: TransactionalRepositories) => {
      await repos.applications.update({
        where: { id: update.id },
        data: { status: update.status, updatedAt: new Date() }
      });
    }
  );
  
  await this.unitOfWork.batchExecute(operations, {
    name: 'bulk-update-applications',
    timeout: 10000
  });
}
```

### Benefits

- **Single transaction** - All operations succeed or all fail
- **Better performance** - Fewer round trips to database
- **Simpler code** - No manual transaction management
- **Atomic guarantees** - All-or-nothing semantics

### Best Practices

✅ **Good use cases:**
- Bulk imports from CSV/Excel
- Mass updates (e.g., status changes)
- Batch data migrations
- Processing queued operations

❌ **Avoid for:**
- Extremely large batches (>1000 operations)
- Operations with external API calls
- Long-running computations

**Recommendation:** Keep batches under 500 operations. For larger datasets, process in chunks.

---

## 5. Monitoring

> **📊 For comprehensive monitoring documentation, see [MONITORING_GUIDE.md](./MONITORING_GUIDE.md)**

The Unit of Work automatically records metrics for all advanced features:

### Available Metrics

#### Circuit Breaker
- `circuit_breaker_state` - Current state (0=closed, 1=open, 2=half_open)
- `circuit_breaker_failures_total` - Total failures
- `circuit_breaker_successes_total` - Total successes
- `circuit_breaker_opened_total` - Times circuit opened
- `circuit_breaker_transitions_total` - State transitions

#### Read Replica
- `read_replica_queries_total` - Queries to replica vs primary
- `read_replica_fallback_total` - Fallback events by reason
- `read_replica_duration_seconds` - Query duration by source

#### Batch Operations
- `batch_operations_total` - Batch operation count
- `batch_operation_size` - Operations per batch
- `batch_operation_duration_seconds` - Batch duration

#### Distributed Tracing
- `traced_transactions_total` - Transactions with trace IDs

#### Transaction Metrics (Existing)
- `db_transaction_duration_seconds` - Transaction duration
- `db_transaction_total` - Transaction count by status

### Quick Monitoring Queries

#### Check Circuit Breaker Health
```bash
# Via metrics endpoint
curl http://localhost:4000/metrics | grep circuit_breaker_state

# Via health endpoint
curl http://localhost:4000/health/circuit-breaker
```

#### Read Replica Usage
```promql
# Percentage of queries using replica
rate(read_replica_queries_total{status="success"}[5m]) / 
rate(read_replica_queries_total[5m]) * 100
```

#### Batch Operation Efficiency
```promql
# Average operations per batch
rate(batch_operation_size_sum[5m]) / 
rate(batch_operation_size_count[5m])
```

#### Tracing Coverage
```promql
# Percentage of transactions with trace IDs
rate(traced_transactions_total{has_trace_id="true"}[5m]) / 
rate(traced_transactions_total[5m]) * 100
```

### Grafana Dashboard

Example dashboard panels:

**Transaction Latency (p50, p95, p99)**
```promql
histogram_quantile(0.50, rate(db_transaction_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(db_transaction_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(db_transaction_duration_seconds_bucket[5m]))
```

**Transaction Throughput**
```promql
sum(rate(db_transaction_total[5m])) by (name)
```

**Error Rate**
```promql
sum(rate(db_transaction_total{status="failed"}[5m])) 
/ 
sum(rate(db_transaction_total[5m])) * 100
```

**Top 10 Slowest Transactions**
```promql
topk(10, avg(rate(db_transaction_duration_seconds_sum[5m])) by (name))
```

### Alerts

**High Latency Alert**
```yaml
- alert: TransactionHighLatency
  expr: histogram_quantile(0.95, rate(db_transaction_duration_seconds_bucket[5m])) > 2
  for: 5m
  annotations:
    summary: "95th percentile transaction latency > 2s"
```

**High Error Rate Alert**
```yaml
- alert: TransactionHighErrorRate
  expr: |
    sum(rate(db_transaction_total{status="failed"}[5m])) 
    / 
    sum(rate(db_transaction_total[5m])) > 0.05
  for: 5m
  annotations:
    summary: "Transaction error rate > 5%"
```

**Circuit Breaker Open Alert**
```yaml
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state == 1
  for: 1m
  annotations:
    summary: "Circuit breaker is OPEN - database operations failing"
```

---

## Environment Variables Reference

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@primary:5432/db
READ_REPLICA_URL=postgresql://user:pass@replica:5432/db  # Optional

# Logging
LOG_LEVEL=debug  # Set to 'info' in production

# APM Integration (Optional)
DATADOG_TRACE_ENABLED=true
DATADOG_SERVICE_NAME=ybb-api
NEW_RELIC_ENABLED=true
NEW_RELIC_APP_NAME=ybb-api
```

---

## Performance Tuning

### Connection Pool Settings

```bash
# .env
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
```

**Recommendations:**
- Primary database: 20-50 connections per instance
- Read replica: 50-100 connections per instance (read-heavy)

### Transaction Timeouts

Adjust based on operation complexity:

```typescript
// Simple (2-3 tables): 3s
{ name: 'verify-email', timeout: 3000 }

// Standard (3-5 tables): 5s
{ name: 'create-order', timeout: 5000 }

// Complex (5+ tables): 10s
{ name: 'user-registration', timeout: 10000 }

// Bulk operations: 15-30s
{ name: 'bulk-import', timeout: 30000 }
```

### Circuit Breaker Tuning

Customize if needed (rare):

```typescript
// In unit-of-work.service.ts
private readonly circuitConfig = {
  failureThreshold: 10,    // More lenient
  successThreshold: 2,     // Faster recovery
  timeout: 30000,          // Shorter backoff
};
```

---

## Troubleshooting

### Read Replica Issues

**Problem:** Queries still hitting primary database

**Solution:**
1. Verify `READ_REPLICA_URL` is set in environment
2. Check replica is reachable: `psql $READ_REPLICA_URL`
3. Ensure using `executeReadOnly()` not `execute()`
4. Check logs for "Routing read-only query to replica"

### Circuit Breaker False Positives

**Problem:** Circuit opening due to transient errors

**Solution:**
1. Increase `failureThreshold` to 10
2. Check for network issues
3. Verify database connection pool sizing
4. Add retry logic before circuit breaker

### Tracing Not Appearing

**Problem:** Trace IDs not in logs

**Solution:**
1. Ensure passing `traceId` parameter
2. Check log formatter includes trace context
3. Verify APM agent is initialized

---

## Next Steps

1. ✅ Enable read replica routing for production
2. ✅ Set up monitoring dashboard
3. ✅ Configure alerts for circuit breaker
4. ✅ Integrate distributed tracing with APM
5. ✅ Test circuit breaker behavior in staging

## References

- [Unit of Work Implementation](./UNIT_OF_WORK_IMPLEMENTATION.md)
- [Transaction Patterns](../.github/docs/transaction-patterns.md)
- [Monitoring Guide](../docs/monitoring.md)
