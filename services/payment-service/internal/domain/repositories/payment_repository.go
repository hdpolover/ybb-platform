package repositories

import (
	"context"

	"github.com/ybb-platform/payment-service/internal/domain/entities"
)

// PaymentRepository defines the interface for payment data persistence
// TODO for intern: Implement this interface with PostgreSQL
type PaymentRepository interface {
	// Create saves a new payment to the database
	Create(ctx context.Context, payment *entities.Payment) error

	// FindByID retrieves a payment by its ID
	FindByID(ctx context.Context, id string) (*entities.Payment, error)

	// FindByApplicationID retrieves all payments for a specific application
	FindByApplicationID(ctx context.Context, applicationID string) ([]*entities.Payment, error)

	// FindByUserID retrieves all payments for a specific user
	FindByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Payment, error)

	// Update updates an existing payment
	Update(ctx context.Context, payment *entities.Payment) error

	// FindByGatewayOrderID finds a payment by the gateway's order ID
	FindByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*entities.Payment, error)
}
