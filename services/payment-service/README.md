# Payment Service - YBB Platform

A scalable payment microservice built with Go, designed to support both **automatic** (Midtrans, Xendit, Stripe) and **manual** (bank transfer with proof upload) payment methods following Clean Architecture principles.

## ✨ Features

- ✅ **Multiple Payment Types**: Automatic (gateway) + Manual (verification)
- ✅ **Admin-Configurable Methods**: Enable/disable payment methods via dashboard
- ✅ **Proof Upload Support**: Manual payments require payment proof verification
- ✅ **Multiple Gateways**: Midtrans, Xendit, Stripe, PayPal (extensible)
- ✅ **GORM ORM**: Type-safe database operations with auto-migrations
- ✅ **Event-Driven**: RabbitMQ integration for payment events
- ✅ **Clean Architecture**: Domain-driven design with CQRS pattern
- ✅ **Separate Database**: Independent PostgreSQL database (ybb_payments_db)

## 🏗️ Architecture

This service follows **Clean Architecture** with clear separation of concerns:

```
internal/
├── domain/              # Business logic (entities, interfaces)
│   ├── entities/        # Payment & PaymentMethod domain models
│   ├── repositories/    # Repository interfaces
│   ├── gateways/        # Payment gateway interfaces
│   ├── events/          # Domain events (payment.created, etc.)
│   └── exceptions/      # Domain errors
│
├── application/         # Use cases (CQRS pattern)
│   ├── commands/        # Write operations (CreatePayment)
│   ├── queries/         # Read operations (GetPayment)
│   └── dto/             # Data transfer objects
│
├── infrastructure/      # External dependencies
│   ├── config/          # Configuration management
│   ├── gateways/        # Payment gateway implementations
│   │   ├── midtrans_gateway.go
│   │   ├── gateway_factory.go
│   │   └── [add new gateways here]
│   ├── persistence/     # Database implementation (GORM)
│   │   └── gorm_payment_repository.go
│   └── messaging/       # Event publishing (RabbitMQ)
│
└── presentation/        # HTTP/API layer
    └── http/
        ├── handlers/    # HTTP request handlers
        └── main.go      # Router definitions
```

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- PostgreSQL 14+
- RabbitMQ (optional, for events)
- Docker & Docker Compose

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=8080
ENVIRONMENT=development

# Database (Separate database for payment service)
DATABASE_URL=postgresql://ybb_user:ybb_pass@postgres:5432/ybb_payments_db

# RabbitMQ (for event publishing)
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
RABBITMQ_EXCHANGE=payment-events

# Midtrans
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false

# Xendit (optional)
XENDIT_API_KEY=your-xendit-api-key
```

### Running with Docker

```bash
# Start all services
docker-compose up payment-service

# View logs
docker logs -f ybb-payment-service

# Access the service
curl http://localhost:8080/health
```

### Running Locally

```bash
# Install dependencies
go mod download

# Install air for hot reload (optional)
go install github.com/cosmtrek/air@latest

# Run with hot reload
air

# Or run directly
go run cmd/server/main.go
```

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Create Automatic Payment (via Gateway)
```bash
POST /api/v1/payments
Content-Type: application/json

{
  "application_id": "app-123",
  "user_id": "user-456",
  "amount": 150000,
  "currency": "IDR",
  "payment_method": "credit_card",
  "gateway_name": "midtrans",
  "description": "Application fee",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+628123456789",
  "callback_url": "https://yourapp.com/payment/callback"
}
```

**Response:**
```json
{
  "id": "pay-uuid",
  "application_id": "app-123",
  "user_id": "user-456",
  "amount": 150000,
  "currency": "IDR",
  "status": "processing",
  "payment_type": "automatic",
  "payment_method": "credit_card",
  "gateway_name": "midtrans",
  "gateway_order_id": "pay-uuid",
  "redirect_url": "https://app.midtrans.com/snap/v2/...",
  "token": "snap-token-123",
  "created_at": "2025-11-25T10:00:00Z"
}
```

### Create Manual Payment (with Proof Upload)
```bash
POST /api/v1/payments
Content-Type: application/json

{
  "application_id": "app-123",
  "user_id": "user-456",
  "amount": 150000,
  "currency": "IDR",
  "payment_method_id": "method-uuid",  // References payment_methods table
  "payment_type": "manual",
  "customer_name": "John Doe",
  "customer_email": "john@example.com"
}
```

### Upload Payment Proof
```bash
POST /api/v1/payments/:id/proof
Content-Type: multipart/form-data

file: [payment proof image]
```

### Verify/Reject Manual Payment (Admin Only)
```bash
POST /api/v1/payments/:id/verify
Content-Type: application/json

{
  "action": "approve",  // or "reject"
  "rejected_reason": "Amount mismatch" // if rejected
}
```

### Get Payment
```bash
GET /api/v1/payments/:id
```

### Get Payment Methods (Available for Users)
```bash
GET /api/v1/payment-methods?active=true
```

### Webhook (for payment gateway callbacks)
```bash
POST /api/v1/payments/webhook/:gateway
```

## 🎯 For Interns: Adding a New Payment Gateway

### Step 1: Implement the Gateway Interface

Create a new file: `internal/infrastructure/gateways/stripe_gateway.go`

```go
package gateways

import (
    "context"
    "github.com/ybb-platform/payment-service/internal/domain/entities"
    domainGateways "github.com/ybb-platform/payment-service/internal/domain/gateways"
)

type StripeGateway struct {
    apiKey string
}

func NewStripeGateway(apiKey string) *StripeGateway {
    return &StripeGateway{apiKey: apiKey}
}

func (s *StripeGateway) GetName() string {
    return "stripe"
}

func (s *StripeGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
    // TODO: Implement Stripe payment creation
    // 1. Initialize Stripe client
    // 2. Create payment intent
    // 3. Return redirect URL or client secret
    return nil, nil
}

func (s *StripeGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
    // TODO: Implement payment verification
    return nil, nil
}

func (s *StripeGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
    // TODO: Implement webhook handling
    // 1. Verify webhook signature
    // 2. Parse payload
    // 3. Update payment status
    return nil, nil
}

func (s *StripeGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
    // TODO: Implement cancellation
    return nil
}

func (s *StripeGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
    // TODO: Implement refund
    return nil
}
```

### Step 2: Register in Gateway Factory

Edit `internal/infrastructure/gateways/gateway_factory.go`:

```go
func NewGatewayFactory(cfg *config.Config) *GatewayFactory {
    factory := &GatewayFactory{
        config:   cfg,
        gateways: make(map[string]domainGateways.PaymentGateway),
    }

    // Register Midtrans
    if cfg.MidtransServerKey != "" {
        factory.gateways["midtrans"] = NewMidtransGateway(...)
    }

    // Register Stripe (NEW!)
    if cfg.StripeSecretKey != "" {
        factory.gateways["stripe"] = NewStripeGateway(cfg.StripeSecretKey)
    }

    return factory
}
```

### Step 3: Add Configuration

Edit `internal/infrastructure/config/config.go`:

```go
type Config struct {
    // ... existing config
    StripeSecretKey    string
    StripeWebhookSecret string
}

func LoadConfig() (*Config, error) {
    return &Config{
        // ... existing fields
        StripeSecretKey:    getEnv("STRIPE_SECRET_KEY", ""),
        StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
    }, nil
}
```

### Step 4: Update Environment Variables

Add to `.env`:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 5: Test Your Implementation

```bash
# Create payment with Stripe
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "gateway_name": "stripe",
    ...
  }'
```

## 🔍 Key Interfaces to Implement

### PaymentGateway Interface
All payment gateways must implement these methods:
- `GetName()` - Return gateway name
- `CreatePayment()` - Initiate payment
- `VerifyPayment()` - Check payment status
- `HandleWebhook()` - Process gateway callbacks
- `CancelPayment()` - Cancel pending payment
- `RefundPayment()` - Refund completed payment

### PaymentRepository Interface
Database operations (implemented with GORM):
- `Create()` - Save new payment
- `FindByID()` - Get payment by ID
- `FindByApplicationID()` - Get payments for application
- `FindByUserID()` - Get user's payments with pagination
- `Update()` - Update payment status
- `FindByGatewayOrderID()` - Find by gateway's order ID

## 💳 Payment Flows

### Automatic Payment Flow
1. User selects payment method (e.g., "Midtrans Credit Card")
2. System creates payment record with `payment_type: "automatic"`
3. Gateway creates transaction → Returns redirect URL
4. User completes payment on gateway site
5. Gateway sends webhook → System updates status automatically
6. Event published: `payment.succeeded`

### Manual Payment Flow
1. User selects manual method (e.g., "Bank BCA Transfer")
2. System shows account details + instructions
3. System creates payment record with `payment_type: "manual"`, `status: "pending"`
4. User transfers money → Uploads proof image
5. File service stores proof → Returns file ID
6. System updates payment with `proof_file_id`
7. Admin reviews payment in dashboard
8. Admin approves → `status: "success"`, `verified_at: now()`, `verified_by_id: admin-id`
9. Or admin rejects → `status: "failed"`, `rejected_reason: "..."`
10. Event published: `payment.succeeded` or `payment.failed`

## 👨‍💼 Admin Operations

Admins can:
- ✅ Enable/disable payment methods
- ✅ Configure manual payment account details
- ✅ Review pending manual payments
- ✅ Approve/reject payments with reasons
- ✅ View payment history and audit trail
- ✅ Add new payment methods (automatic or manual)

## 📋 TODO List for Interns

### High Priority (Manual Payment Support)
- [ ] Implement proof upload endpoint
- [ ] Implement admin verification endpoint (approve/reject)
- [ ] Add file service integration for proof storage
- [ ] Complete payment method CRUD endpoints
- [ ] Add manual payment notification system
- [ ] Complete Midtrans webhook implementation

### Medium Priority (Gateway Expansion)
- [ ] Add Xendit gateway implementation
- [ ] Add Stripe gateway implementation
- [ ] Add PayPal gateway implementation
- [ ] Implement payment status verification
- [ ] Implement cancellation and refund
- [ ] Add comprehensive error handling

### Low Priority (Enhancement)
- [ ] Add RabbitMQ event publishing
- [ ] Implement retry mechanism for failed payments
- [ ] Add payment expiration handling
- [ ] Add metrics and monitoring
- [ ] Write unit tests for handlers
- [ ] Write integration tests for gateways
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement idempotency for payment creation

## 🗄️ Database Schema

### payment_methods (Admin Configuration)
```sql
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,  -- 'automatic' | 'manual'
    code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- For automatic methods
    gateway_name VARCHAR(50),     -- 'midtrans', 'xendit'
    gateway_type VARCHAR(50),     -- 'credit_card', 'bank_transfer'
    
    -- For manual methods
    account_number VARCHAR(100),  -- Bank account
    account_name VARCHAR(255),    -- Account holder
    bank_name VARCHAR(100),       -- Bank name
    instructions TEXT,            -- User instructions
    requires_proof BOOLEAN DEFAULT false,
    admin_instructions TEXT,      -- Verification guide
    
    sort_order INTEGER DEFAULT 0
);
```

### payments (Transactions)
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    application_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_type VARCHAR(20) NOT NULL,  -- 'automatic' | 'manual'
    payment_method VARCHAR(50),
    payment_method_id UUID REFERENCES payment_methods(id),
    
    -- Automatic payment fields
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(255),
    gateway_response JSONB,
    redirect_url TEXT,
    
    -- Manual payment fields
    proof_file_id UUID,           -- Reference to file service
    proof_file_url TEXT,
    verified_by_id VARCHAR(255),  -- Admin who verified
    verified_at TIMESTAMP,
    rejected_reason TEXT,
    
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    
    INDEX idx_application_id (application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_payment_type (payment_type),
    INDEX idx_method_id (payment_method_id)
);
```

### Other Tables
- `payment_events` - Audit trail for payment lifecycle
- `refunds` - Refund transactions
- `gateway_configs` - Gateway configurations

## 🧪 Testing

```bash
# Run tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/domain/...
```

## 📚 Resources

### Midtrans Documentation
- [Snap API](https://docs.midtrans.com/en/snap/overview)
- [Webhook Notification](https://docs.midtrans.com/en/after-payment/http-notification)
- [Go SDK](https://github.com/midtrans/midtrans-go)

### Clean Architecture
- [Clean Architecture Guide](/docs/clean-architecture-guide.md)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)

### Go Best Practices
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)

## 🤝 Contributing

1. Create a feature branch
2. Implement your changes
3. Add tests
4. Update documentation
5. Submit PR for review

## ⚠️ Important Notes

- **Always verify webhook signatures** to prevent fraud
- **Handle payment status asynchronously** via webhooks
- **Implement idempotency** to prevent duplicate charges
- **Never log sensitive data** (API keys, card numbers)
- **Use environment variables** for all secrets
- **Test with sandbox/test mode** before production

## 🆘 Need Help?

- Check existing gateway implementations as reference
- Review the domain interfaces in `internal/domain/`
- Look at test cases for examples
- Ask your mentor for code reviews

Good luck! 🚀
