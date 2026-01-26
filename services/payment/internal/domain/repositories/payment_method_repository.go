package repositories

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

type PaymentMethodRepository interface {
	FindAll(ctx context.Context) ([]entities.PaymentMethodEntity, error)
	FindByCode(ctx context.Context, code string) (*entities.PaymentMethodEntity, error)
}
