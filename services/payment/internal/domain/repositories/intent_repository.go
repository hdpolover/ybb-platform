package repositories

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

type PaymentIntentRepository interface {
	Create(ctx context.Context, intent *entities.PaymentIntent) error
	FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error)
	FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error)
	Update(ctx context.Context, intent *entities.PaymentIntent) error
}

type PaymentTransactionRepository interface {
	Create(ctx context.Context, tx *entities.PaymentTransaction) error
	FindByID(ctx context.Context, id string) (*entities.PaymentTransaction, error)
	Update(ctx context.Context, tx *entities.PaymentTransaction) error
	FindByIntentID(ctx context.Context, intentID string) ([]*entities.PaymentTransaction, error)
	FindByGatewayReferenceID(ctx context.Context, refID string) (*entities.PaymentTransaction, error)
}
