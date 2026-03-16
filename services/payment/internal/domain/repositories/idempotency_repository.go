package repositories

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

type PaymentIdempotencyRepository interface {
	Create(ctx context.Context, record *entities.PaymentIdempotencyKey) error
	FindByKey(ctx context.Context, key, scope string) (*entities.PaymentIdempotencyKey, error)
	Update(ctx context.Context, record *entities.PaymentIdempotencyKey) error
}
