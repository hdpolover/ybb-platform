package persistence

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

type GormPaymentIdempotencyRepository struct {
	db *gorm.DB
}

func NewGormPaymentIdempotencyRepository(db *gorm.DB) repositories.PaymentIdempotencyRepository {
	return &GormPaymentIdempotencyRepository{db: db}
}

func (r *GormPaymentIdempotencyRepository) Create(ctx context.Context, record *entities.PaymentIdempotencyKey) error {
	if err := r.db.WithContext(ctx).Create(record).Error; err != nil {
		return fmt.Errorf("failed to create idempotency key: %w", err)
	}
	return nil
}

func (r *GormPaymentIdempotencyRepository) FindByKey(ctx context.Context, key, scope string) (*entities.PaymentIdempotencyKey, error) {
	var record entities.PaymentIdempotencyKey
	if err := r.db.WithContext(ctx).
		Where("idempotency_key = ? AND scope = ?", key, scope).
		First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find idempotency key: %w", err)
	}
	return &record, nil
}

func (r *GormPaymentIdempotencyRepository) Update(ctx context.Context, record *entities.PaymentIdempotencyKey) error {
	record.UpdatedAt = record.UpdatedAt.UTC()
	if err := r.db.WithContext(ctx).Save(record).Error; err != nil {
		return fmt.Errorf("failed to update idempotency key: %w", err)
	}
	return nil
}
