# Application Layer

This directory contains use cases (commands and queries) for the Payment Service.

## Structure

- **commands/** - Write operations (Create, Update, Delete)
  - **handlers/** - Command handler implementations
- **queries/** - Read operations (Get, List)
  - **handlers/** - Query handler implementations
- **dto/** - Data Transfer Objects

## CQRS Pattern

We separate commands (writes) and queries (reads) for:
- Clear separation of concerns
- Independent scaling
- Easier testing

## Example

```go
// commands/create_payment.go
package commands

type CreatePaymentCommand struct {
    UserID          string
    ApplicationID   string
    Amount          int64
    Currency        string
    PaymentMethod   string
}

// commands/handlers/create_payment_handler.go
package handlers

type CreatePaymentHandler struct {
    repo repositories.PaymentRepository
    stripeService services.StripeService
}

func (h *CreatePaymentHandler) Handle(cmd CreatePaymentCommand) (*dto.PaymentResponse, error) {
    // 1. Create payment entity
    payment := entities.NewPayment(cmd.UserID, cmd.Amount, cmd.Currency)
    
    // 2. Process with Stripe
    intent, err := h.stripeService.CreatePaymentIntent(payment)
    if err != nil {
        return nil, err
    }
    
    // 3. Save to database
    if err := h.repo.Save(payment); err != nil {
        return nil, err
    }
    
    return dto.ToPaymentResponse(payment), nil
}
```
