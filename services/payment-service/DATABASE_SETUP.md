# Payment Service - Separate Database Setup

## ✅ Separate Database Configured

The payment service now uses **`ybb_payments_db`** - completely isolated from the main API database following microservices best practices.

---

## 🗄️ Database Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   ybb_db            │         │  ybb_payments_db     │
├─────────────────────┤         ├──────────────────────┤
│ • users             │         │ • payments           │
│ • applications      │         │ • payment_events     │
│ • programs          │         │ • refunds            │
│ • program_categories│         │ • gateway_configs    │
│ • admins            │         │                      │
│ • participants      │         │ (Payment Service     │
│ • ambassadors       │         │  owns this data)     │
│                     │         │                      │
│ (API Service        │         └──────────────────────┘
│  owns this data)    │
└─────────────────────┘
```

**Communication:** Services communicate via RabbitMQ events, not direct DB access

---

## 🚀 Setup Instructions

### 1. Restart PostgreSQL Container

The init scripts will create both databases automatically:

```bash
# Stop and remove existing postgres container
docker-compose down postgres

# Start fresh (creates both databases)
docker-compose up -d postgres

# Verify both databases exist
docker exec ybb-postgres psql -U ybb_user -c "\l"
```

You should see:
```
ybb_db           | ybb_user | UTF8     | ...
ybb_payments_db  | ybb_user | UTF8     | ...
```

### 2. Run Payment Service Migrations

```bash
# Copy migration file to postgres container
docker cp services/payment-service/migrations/001_init_payment_schema.sql ybb-postgres:/tmp/

# Run migration
docker exec ybb-postgres psql -U ybb_user -d ybb_payments_db -f /tmp/001_init_payment_schema.sql
```

Or use the setup script:
```bash
cd services/payment-service
./scripts/setup-db.sh
```

### 3. Verify Tables

```bash
# Check payment service tables
docker exec ybb-postgres psql -U ybb_user -d ybb_payments_db -c "\dt"
```

You should see:
```
 payments
 payment_events
 refunds
 gateway_configs
```

### 4. Start Payment Service

```bash
docker-compose up -d payment-service
```

---

## 🔌 Connection Strings

### API Service
```
DATABASE_URL=postgresql://ybb_user:ybb_pass@postgres:5432/ybb_db
```

### Payment Service
```
DATABASE_URL=postgresql://ybb_user:ybb_pass@postgres:5432/ybb_payments_db
```

---

## 📊 Database Schema

### Payments Table
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    application_id VARCHAR(255),  -- Reference to API service
    user_id VARCHAR(255),          -- Reference to API service
    amount DECIMAL(12,2),
    currency VARCHAR(3),
    status VARCHAR(50),
    payment_method VARCHAR(50),
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(255),
    gateway_response JSONB,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP
);
```

### Payment Events Table (Audit Log)
```sql
CREATE TABLE payment_events (
    id UUID PRIMARY KEY,
    payment_id UUID REFERENCES payments(id),
    event_type VARCHAR(50),
    event_data JSONB,
    created_at TIMESTAMP
);
```

### Refunds Table
```sql
CREATE TABLE refunds (
    id UUID PRIMARY KEY,
    payment_id UUID REFERENCES payments(id),
    amount DECIMAL(12,2),
    reason TEXT,
    status VARCHAR(50),
    gateway_refund_id VARCHAR(255),
    created_at TIMESTAMP,
    processed_at TIMESTAMP
);
```

---

## 🔄 Event-Driven Integration

### How Services Stay Synchronized

```
1. User creates payment
   → API Service creates payment record (status: pending)
   → API Service calls Payment Service API

2. Payment Service processes payment
   → Stores in ybb_payments_db
   → Publishes event to RabbitMQ

3. API Service listens to event
   → Updates its payment record
   → Updates application status
```

**Key Point:** Services never directly access each other's databases!

---

## ✅ Benefits of Separate Database

1. **Service Independence**
   - Payment service can scale independently
   - Can optimize payment DB for high transactions
   - API service unaffected by payment DB issues

2. **Data Ownership**
   - Payment service owns payment data
   - Clear boundaries and responsibilities
   - Easier to maintain and debug

3. **Technology Freedom**
   - Could switch to different DB for payments later
   - Can use different backup strategies
   - Independent upgrade cycles

4. **Security & Compliance**
   - Payment data more isolated
   - Easier PCI-DSS compliance
   - Granular access control

---

## 🧪 Testing

### Test Payment Service Database Connection

```bash
# From payment service
docker exec ybb-payment-service go run cmd/server/main.go

# Or via API
curl http://localhost:8080/health
```

### Test Database Isolation

```bash
# API service should NOT see payment tables
docker exec ybb-postgres psql -U ybb_user -d ybb_db -c "\dt payments"
# Should show: Did not find any relation named "payments"

# Payment service should see them
docker exec ybb-postgres psql -U ybb_user -d ybb_payments_db -c "\dt payments"
# Should show: payments table
```

---

## 🐛 Troubleshooting

### Issue: "database ybb_payments_db does not exist"

**Solution:** Recreate postgres container to run init scripts
```bash
docker-compose down postgres
docker volume rm ybb-platform_postgres_data  # Warning: deletes data
docker-compose up -d postgres
```

### Issue: "relation payments does not exist"

**Solution:** Run migrations
```bash
docker cp services/payment-service/migrations/001_init_payment_schema.sql ybb-postgres:/tmp/
docker exec ybb-postgres psql -U ybb_user -d ybb_payments_db -f /tmp/001_init_payment_schema.sql
```

### Issue: Connection refused

**Solution:** Ensure postgres is healthy
```bash
docker ps  # Check status
docker logs ybb-postgres  # Check logs
```

---

## 📝 For Interns

The payment service now has its own database. When implementing features:

1. **Only write to `ybb_payments_db`**
2. **Publish events for status changes**
3. **Never directly query API service database**
4. **Store application_id and user_id as strings** (references to API service)

Example:
```go
// ✅ CORRECT: Store reference to external entity
payment := &Payment{
    ApplicationID: "uuid-from-api-service",
    UserID: "uuid-from-api-service",
}

// ❌ WRONG: Don't try to join with API service tables
// You can't do: SELECT * FROM payments JOIN applications
```

---

## 🎓 Learning Resources

- [Microservices Database Patterns](https://microservices.io/patterns/data/database-per-service.html)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- See `INTEGRATION.md` for complete event-driven integration guide

---

**Status:** ✅ Separate database configured and ready for use!
