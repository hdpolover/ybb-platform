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
