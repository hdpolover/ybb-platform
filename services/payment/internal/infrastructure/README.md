# Infrastructure Layer

This directory contains technical implementations for the Payment Service.

## Structure

- **persistence/** - Database implementations
  - **postgres/** - PostgreSQL repository implementations
- **services/** - External service integrations
  - Stripe API client
  - Notification service
- **grpc/** - gRPC server setup
- **http/** - HTTP handlers (webhooks)

## Rules

1. **Implements domain interfaces** - Concrete implementations of repository interfaces
2. **Framework-specific code** - Database drivers, HTTP frameworks
3. **External integrations** - Third-party APIs (Stripe, etc.)

## Example

```go
// persistence/postgres/payment_repository.go
package postgres

type PostgresPaymentRepository struct {
    db *sql.DB
}

func NewPaymentRepository(db *sql.DB) repositories.PaymentRepository {
    return &PostgresPaymentRepository{db: db}
}

func (r *PostgresPaymentRepository) FindByID(id string) (*entities.Payment, error) {
    var payment entities.Payment
    err := r.db.QueryRow(
        "SELECT id, user_id, amount, currency, status FROM payments WHERE id = $1",
        id,
    ).Scan(&payment.ID, &payment.UserID, &payment.Amount, &payment.Currency, &payment.Status)
    
    if err != nil {
        return nil, err
    }
    return &payment, nil
}

// services/stripe_service.go
package services

type StripeService struct {
    client *stripe.Client
}

func (s *StripeService) CreatePaymentIntent(payment *entities.Payment) (*stripe.PaymentIntent, error) {
    params := &stripe.PaymentIntentParams{
        Amount:   stripe.Int64(payment.Amount),
        Currency: stripe.String(payment.Currency),
    }
    return s.client.PaymentIntents.New(params)
}
```
