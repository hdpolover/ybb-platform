package persistence

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

// needsReviewIndexName is the partial unique index from migration 024.
const needsReviewIndexName = "idx_payment_transactions_one_needs_review_per_intent"

// isNeedsReviewConflict matches the 024 index specifically (by constraint
// name) so no other unique violation is misreported as a duplicate review.
func isNeedsReviewConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolationCode && pgErr.ConstraintName == needsReviewIndexName
}

func wrapTxWriteError(op string, err error) error {
	if isNeedsReviewConflict(err) {
		return fmt.Errorf("failed to %s transaction: %w", op, exceptions.ErrDuplicateNeedsReview)
	}
	return fmt.Errorf("failed to %s transaction: %w", op, err)
}

type GormPaymentTransactionRepository struct {
	db *gorm.DB
}

func NewGormPaymentTransactionRepository(db *gorm.DB) repositories.PaymentTransactionRepository {
	return &GormPaymentTransactionRepository{db: db}
}

func (r *GormPaymentTransactionRepository) Create(ctx context.Context, tx *entities.PaymentTransaction) error {
	if err := r.db.WithContext(ctx).Create(tx).Error; err != nil {
		return wrapTxWriteError("create", err)
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
		return wrapTxWriteError("update", err)
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
