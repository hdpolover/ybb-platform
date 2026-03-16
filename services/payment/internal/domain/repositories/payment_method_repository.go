package repositories

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

type PaymentMethodRepository interface {
	FindAll(ctx context.Context) ([]entities.PaymentMethodEntity, error)
	FindByCode(ctx context.Context, code string) (*entities.PaymentMethodEntity, error)
	FindByID(ctx context.Context, id string) (*entities.PaymentMethodEntity, error)
	FindByCodeOrID(ctx context.Context, value string) (*entities.PaymentMethodEntity, error)
	Create(ctx context.Context, pm *entities.PaymentMethodEntity) error
	Update(ctx context.Context, pm *entities.PaymentMethodEntity) error
	Delete(ctx context.Context, id string) error
}
