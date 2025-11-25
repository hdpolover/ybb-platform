# Payment Service - YBB Platform

A scalable payment microservice built with Go, designed to support multiple payment gateways (Midtrans, Stripe, PayPal, etc.) following Clean Architecture principles.

## 🏗️ Architecture

This service follows **Clean Architecture** with clear separation of concerns:

```
internal/
├── domain/              # Business logic (entities, interfaces)
│   ├── entities/        # Payment domain model
│   ├── repositories/    # Repository interfaces
│   ├── gateways/        # Payment gateway interfaces
│   └── exceptions.go    # Domain errors
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
│   └── persistence/     # Database implementation
│       └── postgres_payment_repository.go
│
└── presentation/        # HTTP/API layer
    └── http/
        ├── handlers/    # HTTP request handlers
        └── router.go    # Route definitions
```

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- PostgreSQL 14+
- Docker & Docker Compose

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=8080
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://ybb_user:ybb_pass@postgres:5432/ybb_db

# Midtrans
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false
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

### Create Payment
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
  "payment_method": "credit_card",
  "gateway_name": "midtrans",
  "gateway_order_id": "pay-uuid",
  "redirect_url": "https://app.midtrans.com/snap/v2/...",
  "token": "snap-token-123",
  "created_at": "2025-11-25T10:00:00Z"
}
```

### Get Payment
```bash
GET /api/v1/payments/:id
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
Database operations (already implemented with PostgreSQL):
- `Create()` - Save new payment
- `FindByID()` - Get payment by ID
- `FindByApplicationID()` - Get payments for application
- `FindByUserID()` - Get user's payments
- `Update()` - Update payment status
- `FindByGatewayOrderID()` - Find by gateway's order ID

## 📋 TODO List for Interns

### High Priority
- [ ] Complete Midtrans webhook implementation
- [ ] Add payment status verification
- [ ] Implement cancellation and refund
- [ ] Add comprehensive error handling
- [ ] Add logging with structured logs
- [ ] Complete repository methods (FindByUserID, etc.)

### Medium Priority
- [ ] Add Stripe gateway implementation
- [ ] Add PayPal gateway implementation  
- [ ] Implement retry mechanism for failed payments
- [ ] Add payment expiration handling
- [ ] Create database migrations for payment table

### Low Priority
- [ ] Add metrics and monitoring
- [ ] Write unit tests for handlers
- [ ] Write integration tests for gateways
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement idempotency for payment creation

## 🗄️ Database Schema

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    application_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    gateway_name VARCHAR(50) NOT NULL,
    gateway_order_id VARCHAR(255),
    gateway_response JSONB,
    description TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    INDEX idx_application_id (application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_gateway_order_id (gateway_order_id),
    INDEX idx_status (status)
);
```

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
