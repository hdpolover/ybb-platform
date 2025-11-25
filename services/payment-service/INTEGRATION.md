# Payment Service Integration Guide

## Database Architecture

### Separate Concerns
- **Payment Service DB**: Stores payment transaction details (amount, status, gateway info)
- **API Service DB**: Stores application payment records (links to payment service)

### Why Not Share Database?
1. **Service Independence**: Each service can scale independently
2. **Data Ownership**: Payment service owns payment data
3. **Technology Freedom**: Can use different DB technologies later
4. **Failure Isolation**: Payment service DB issues don't affect main app

---

## Integration Pattern: Event-Driven

### Flow Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  API Service│         │ Payment Service  │         │  RabbitMQ   │
└──────┬──────┘         └────────┬─────────┘         └──────┬──────┘
       │                         │                          │
       │ 1. Create Payment       │                          │
       │────────────────────────>│                          │
       │                         │                          │
       │ 2. Return Payment ID    │                          │
       │<────────────────────────│                          │
       │                         │                          │
       │                         │ 3. Process with Gateway  │
       │                         │────────────────┐         │
       │                         │                │         │
       │                         │<───────────────┘         │
       │                         │                          │
       │                         │ 4. Publish Event         │
       │                         │─────────────────────────>│
       │                         │  (payment.succeeded)     │
       │                         │                          │
       │ 5. Consume Event        │                          │
       │<──────────────────────────────────────────────────│
       │                         │                          │
       │ 6. Update Application   │                          │
       │    Payment Status       │                          │
       │────────────┐            │                          │
       │            │            │                          │
       │<───────────┘            │                          │
```

---

## Implementation Steps

### Step 1: API Service Creates Payment Request

**API Service (NestJS)**
```typescript
// modules/applications/application/commands/handlers/create-payment.handler.ts

async execute(command: CreatePaymentCommand): Promise<PaymentDto> {
  // 1. Create payment record in API DB (pending status)
  const payment = await this.paymentRepo.create({
    applicationId: command.applicationId,
    userId: command.userId,
    amount: command.amount,
    status: 'pending',
  });

  // 2. Call Payment Service API
  const paymentServiceResponse = await this.httpClient.post(
    'http://payment-service:8080/api/v1/payments',
    {
      application_id: command.applicationId,
      user_id: command.userId,
      amount: command.amount,
      currency: 'IDR',
      payment_method: command.paymentMethod,
      gateway_name: 'midtrans',
      customer_name: command.customerName,
      customer_email: command.customerEmail,
    }
  );

  // 3. Update with payment service reference
  await this.paymentRepo.update(payment.id, {
    paymentServiceId: paymentServiceResponse.id,
    gatewayOrderId: paymentServiceResponse.gateway_order_id,
    redirectUrl: paymentServiceResponse.redirect_url,
  });

  return paymentServiceResponse;
}
```

### Step 2: Payment Service Publishes Events

**Payment Service (Go)**
```go
// When payment succeeds (webhook callback)
func (h *CreatePaymentHandler) Handle(ctx context.Context, cmd *commands.CreatePaymentCommand) error {
    // ... process payment with gateway ...
    
    payment.MarkAsSuccess(gatewayOrderID, time.Now())
    h.paymentRepo.Update(ctx, payment)
    
    // Publish event to RabbitMQ
    event := &events.PaymentEvent{
        EventID:        uuid.New().String(),
        EventType:      events.PaymentSucceeded,
        Timestamp:      time.Now(),
        PaymentID:      payment.ID,
        ApplicationID:  payment.ApplicationID,
        UserID:         payment.UserID,
        Amount:         payment.Amount,
        Currency:       payment.Currency,
        Status:         string(payment.Status),
        GatewayName:    payment.GatewayName,
        GatewayOrderID: payment.GatewayOrderID,
    }
    
    return h.eventPublisher.Publish(ctx, event)
}
```

### Step 3: API Service Listens to Events

**API Service (NestJS)**
```typescript
// modules/payments/infrastructure/messaging/payment-event.consumer.ts

@Injectable()
export class PaymentEventConsumer {
  constructor(
    private paymentRepo: PaymentRepository,
    private applicationRepo: ApplicationRepository,
  ) {}

  @RabbitSubscribe({
    exchange: 'payment-events',
    routingKey: 'payment.succeeded',
    queue: 'api-service-payment-events',
  })
  async handlePaymentSucceeded(event: PaymentSucceededEvent) {
    // Update payment in API database
    await this.paymentRepo.updateByGatewayOrderId(
      event.gateway_order_id,
      {
        status: 'success',
        paidAt: new Date(event.timestamp),
        metadata: {
          paymentServiceId: event.payment_id,
          gatewayName: event.gateway_name,
        },
      }
    );

    // Update application status (if payment was for application fee)
    await this.applicationRepo.markAsPaid(event.application_id);
    
    // Send notification to user
    await this.notificationService.sendPaymentConfirmation(event.user_id);
  }

  @RabbitSubscribe({
    exchange: 'payment-events',
    routingKey: 'payment.failed',
    queue: 'api-service-payment-events',
  })
  async handlePaymentFailed(event: PaymentFailedEvent) {
    await this.paymentRepo.updateByGatewayOrderId(
      event.gateway_order_id,
      { status: 'failed', failedAt: new Date(event.timestamp) }
    );
  }
}
```

---

## Database Schema Design

### API Service Database (`ybb_db`)

```sql
-- Main payments table (lightweight, references payment service)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id),
    user_id UUID NOT NULL REFERENCES users(id),
    program_category_id UUID NOT NULL REFERENCES program_categories(id),
    
    -- Reference to payment service
    payment_service_id VARCHAR(255), -- ID from payment service
    gateway_order_id VARCHAR(255),   -- Gateway's order ID
    
    -- Basic payment info (cached from payment service)
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL, -- pending, processing, success, failed
    
    -- URLs and metadata
    redirect_url TEXT,
    callback_url TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    INDEX idx_application_id (application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_gateway_order_id (gateway_order_id),
    INDEX idx_payment_service_id (payment_service_id)
);
```

### Payment Service Database (`ybb_payments_db`)

```sql
-- Payment methods configuration
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE,
    type VARCHAR(20),              -- 'automatic' | 'manual'
    code VARCHAR(50) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    display_name VARCHAR(100),
    gateway_name VARCHAR(50),      -- For automatic
    account_number VARCHAR(100),   -- For manual
    bank_name VARCHAR(100),        -- For manual
    requires_proof BOOLEAN,
    sort_order INTEGER
);

-- Detailed payment transactions table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- External references (from API service)
    application_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    -- Payment details
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_type VARCHAR(20) NOT NULL, -- 'automatic' | 'manual'
    payment_method VARCHAR(50),
    payment_method_id UUID REFERENCES payment_methods(id),
    description TEXT,
    
    -- Automatic payment fields
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(255),
    gateway_response JSONB,
    redirect_url TEXT,
    
    -- Manual payment fields
    proof_file_id UUID,            -- Reference to file service
    proof_file_url TEXT,
    verified_by_id VARCHAR(255),   -- Admin who verified
    verified_at TIMESTAMP,
    rejected_reason TEXT,
    
    -- Customer information
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    INDEX idx_application_id (application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_payment_type (payment_type),
    INDEX idx_gateway_order_id (gateway_order_id),
    INDEX idx_status (status)
);
```

---

## RabbitMQ Configuration

### Exchange and Queue Setup

```yaml
# API Service listens to payment events
Exchange: payment-events (type: topic)
Queues:
  - api-service-payment-events
    Bindings:
      - payment.created
      - payment.succeeded
      - payment.failed
      - payment.cancelled
      - payment.refunded

# Payment Service publishes to exchange
Publisher: payment-service
Exchange: payment-events
Routing Keys:
  - payment.created
  - payment.succeeded
  - payment.failed
```

### Docker Compose Configuration

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
```

---

## Alternative Approaches

### 1. Synchronous API Calls (Not Recommended)
Payment Service provides webhook endpoint that directly calls API Service:
- ❌ Tight coupling between services
- ❌ If API service is down, payment updates fail
- ❌ No retry mechanism
- ✅ Simple to implement

### 2. Shared Database with Views (Not Recommended)
Both services access same DB but through views:
- ❌ Breaks microservices principles
- ❌ Difficult to scale independently
- ❌ Schema changes affect both services
- ✅ No eventual consistency issues

### 3. Event Sourcing (Advanced)
Store all payment events, rebuild state from events:
- ✅ Complete audit trail
- ✅ Time travel capabilities
- ✅ Multiple read models
- ❌ Complex to implement
- ❌ Requires event store

---

## Error Handling & Resilience

### Idempotency
Payment service should handle duplicate requests:
```go
// Check if payment already exists
existing, _ := repo.FindByApplicationID(ctx, cmd.ApplicationID)
if existing != nil && existing.Status == entities.PaymentStatusSuccess {
    return existing, nil // Return existing successful payment
}
```

### Retry Logic
API service should retry failed event processing:
```typescript
@RabbitSubscribe({
  exchange: 'payment-events',
  routingKey: 'payment.succeeded',
  queue: 'api-service-payment-events',
  queueOptions: {
    deadLetterExchange: 'payment-events-dlx',
    messageTtl: 60000, // 1 minute
  },
})
```

### Dead Letter Queue
Failed events go to DLQ for manual review:
```yaml
Queues:
  - api-service-payment-events-dlq
    Purpose: Store failed event processing
    Action: Alert admin, retry manually
```

---

## Monitoring & Observability

### Metrics to Track
- Payment creation rate
- Payment success rate
- Event publishing latency
- Event processing latency
- Failed event count

### Logging
Both services should log:
- Payment ID
- Application ID
- User ID
- Gateway Order ID
- Event type
- Timestamp

This allows correlation across services.

---

## Payment Flow Examples

### Automatic Payment Flow (Gateway)
```
1. User selects "Midtrans Credit Card"
2. API Service → POST /api/v1/payments (payment_type: automatic)
3. Payment Service → Creates payment → Calls Midtrans
4. Midtrans → Returns redirect_url
5. User → Redirected to Midtrans → Completes payment
6. Midtrans → Webhook → Payment Service
7. Payment Service → Updates status → Publishes event (payment.succeeded)
8. API Service → Consumes event → Updates application status
```

### Manual Payment Flow (Proof Upload)
```
1. User selects "Bank BCA Transfer"
2. API Service → POST /api/v1/payments (payment_type: manual)
3. Payment Service → Returns account details + instructions
4. User → Transfers money → Uploads proof
5. API Service → POST /api/v1/payments/:id/proof
6. Payment Service → Stores proof_file_id → Status: pending
7. Admin → Reviews proof in dashboard
8. Admin → POST /api/v1/payments/:id/verify {action: approve}
9. Payment Service → Updates: status=success, verified_at, verified_by_id
10. Payment Service → Publishes event (payment.succeeded)
11. API Service → Consumes event → Updates application status
```

## Summary

**Best Practice: Event-Driven Architecture**

1. **API Service** → Creates payment record (pending) → Calls Payment Service API
2. **Payment Service** → Processes payment (automatic or manual) → Publishes event to RabbitMQ
3. **API Service** → Listens to events → Updates its database
4. Both services maintain their own data, communicate through events

**Payment Types:**
- **Automatic**: Gateway processes payment, webhook updates status automatically
- **Manual**: User uploads proof, admin verifies, status updated manually

**Benefits:**
- ✅ Loose coupling
- ✅ Async processing
- ✅ Resilient (retries, DLQ)
- ✅ Scalable independently
- ✅ Clear service boundaries
- ✅ Supports both automatic and manual verification workflows

**For Your Intern:**
The intern can focus on Payment Service without worrying about API Service database. They just need to:
1. Implement proof upload endpoint
2. Implement admin verification endpoint
3. Publish events correctly for both payment types
