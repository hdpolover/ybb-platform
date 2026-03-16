package persistence

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

type GormPaymentTransactionRepository struct {
	db *gorm.DB
}

func NewGormPaymentTransactionRepository(db *gorm.DB) repositories.PaymentTransactionRepository {
	return &GormPaymentTransactionRepository{db: db}
}

func (r *GormPaymentTransactionRepository) Create(ctx context.Context, tx *entities.PaymentTransaction) error {
	if err := r.db.WithContext(ctx).Create(tx).Error; err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}
	return nil
}

func (r *GormPaymentTransactionRepository) FindByID(ctx context.Context, id string) (*entities.PaymentTransaction, error) {
	var tx entities.PaymentTransaction
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&tx).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, exceptions.ErrPaymentNotFound
		}
		return nil, err
	}
	return &tx, nil
}

func (r *GormPaymentTransactionRepository) Update(ctx context.Context, tx *entities.PaymentTransaction) error {
	if err := r.db.WithContext(ctx).Save(tx).Error; err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}
	return nil
}

func (r *GormPaymentTransactionRepository) FindByIntentID(ctx context.Context, intentID string) ([]*entities.PaymentTransaction, error) {
	var txs []*entities.PaymentTransaction
	if err := r.db.WithContext(ctx).Where("payment_intent_id = ?", intentID).Order("created_at desc").Find(&txs).Error; err != nil {
		return nil, err
	}
	return txs, nil
}

func (r *GormPaymentTransactionRepository) FindByGatewayReferenceID(ctx context.Context, refID string) (*entities.PaymentTransaction, error) {
	var tx entities.PaymentTransaction
	if err := r.db.WithContext(ctx).Where("gateway_reference_id = ?", refID).First(&tx).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, exceptions.ErrPaymentNotFound
		}
		return nil, err
	}
	return &tx, nil
}
