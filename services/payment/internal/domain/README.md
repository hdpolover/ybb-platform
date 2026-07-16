# Domain Layer

This directory contains the core business entities and domain logic for the Payment Service.

## Structure

- **entities/** - Payment domain entities (Payment, Refund, Transaction)
- **repositories/** - Repository interface definitions
- **services/** - Domain service interfaces
- **errors/** - Domain-specific errors

## Rules

1. **No external dependencies** - Pure Go, no framework dependencies
2. **Business logic only** - Domain rules and validations
3. **Interface definitions** - Contracts that infrastructure implements

## Example

```go
// entities/payment.go
package entities

import "time"

type Payment struct {
    ID        string
    UserID    string
    Amount    int64
    Currency  string
    Status    PaymentStatus
    CreatedAt time.Time
}

type PaymentStatus string

const (
    StatusPending   PaymentStatus = "pending"
    StatusCompleted PaymentStatus = "completed"
    StatusFailed    PaymentStatus = "failed"
)

// repositories/payment_repository.go
package repositories

import "github.com/hdpolover/ybb-platform/services/payment/internal/domain/entities"

type PaymentRepository interface {
    FindByID(id string) (*entities.Payment, error)
    Save(payment *entities.Payment) error
    Update(payment *entities.Payment) error
}
```
