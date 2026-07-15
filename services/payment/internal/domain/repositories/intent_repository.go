package repositories

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

type PaymentIntentFilter struct {
	UserID    string
	Status    string
	ProgramID string // Matches metadata->'program_id' or similar if needed, or purely 'program_id' column if added.
	FromDate  string
	ToDate    string
	Page      int
	Limit     int
}

type PaymentIntentRepository interface {
	Create(ctx context.Context, intent *entities.PaymentIntent) error
	FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error)
	FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error)
	// FindOpenByReference returns the open (REQUIRES_PAYMENT_METHOD, not deleted)
	// intent for a reference, or (nil, nil) if none exists.
	FindOpenByReference(ctx context.Context, referenceType, referenceID string) (*entities.PaymentIntent, error)
	Update(ctx context.Context, intent *entities.PaymentIntent) error
	FindAll(ctx context.Context, filter PaymentIntentFilter) ([]*entities.PaymentIntent, int64, error)
}

type PaymentTransactionRepository interface {
	Create(ctx context.Context, tx *entities.PaymentTransaction) error
	FindByID(ctx context.Context, id string) (*entities.PaymentTransaction, error)
	Update(ctx context.Context, tx *entities.PaymentTransaction) error
	FindByIntentID(ctx context.Context, intentID string) ([]*entities.PaymentTransaction, error)
	FindByGatewayReferenceID(ctx context.Context, refID string) (*entities.PaymentTransaction, error)
}
