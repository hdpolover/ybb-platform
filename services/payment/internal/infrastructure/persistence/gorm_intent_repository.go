package persistence

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

type GormPaymentIntentRepository struct {
	db *gorm.DB
}

func NewGormPaymentIntentRepository(db *gorm.DB) repositories.PaymentIntentRepository {
	return &GormPaymentIntentRepository{db: db}
}

func (r *GormPaymentIntentRepository) Create(ctx context.Context, intent *entities.PaymentIntent) error {
	if err := r.db.WithContext(ctx).Create(intent).Error; err != nil {
		return fmt.Errorf("failed to create payment intent: %w", err)
	}
	return nil
}

func (r *GormPaymentIntentRepository) FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error) {
	var intent entities.PaymentIntent
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&intent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, exceptions.ErrPaymentNotFound // Or create ErrIntentNotFound
		}
		return nil, err
	}
	return &intent, nil
}

func (r *GormPaymentIntentRepository) FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error) {
	var intents []*entities.PaymentIntent
	if err := r.db.WithContext(ctx).
		Where("reference_type = ? AND reference_id = ?", refType, refID).
		Order("created_at desc").
		Find(&intents).Error; err != nil {
		return nil, fmt.Errorf("failed to find intents by reference: %w", err)
	}
	return intents, nil
}

func (r *GormPaymentIntentRepository) Update(ctx context.Context, intent *entities.PaymentIntent) error {
	if err := r.db.WithContext(ctx).Save(intent).Error; err != nil {
		return fmt.Errorf("failed to update payment intent: %w", err)
	}
	return nil
}
