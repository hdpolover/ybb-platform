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

// pgUniqueViolationCode is the Postgres SQLSTATE for unique_violation (23505).
const pgUniqueViolationCode = "23505"

// isUniqueViolation reports whether err is a unique-constraint violation,
// checking both GORM's translated sentinel (if error translation is ever
// enabled) and the raw Postgres error code so detection doesn't depend on
// that config.
func isUniqueViolation(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == pgUniqueViolationCode
	}
	return false
}

type GormPaymentIntentRepository struct {
	db *gorm.DB
}

func NewGormPaymentIntentRepository(db *gorm.DB) repositories.PaymentIntentRepository {
	return &GormPaymentIntentRepository{db: db}
}

func (r *GormPaymentIntentRepository) Create(ctx context.Context, intent *entities.PaymentIntent) error {
	if err := r.db.WithContext(ctx).Create(intent).Error; err != nil {
		if isUniqueViolation(err) {
			return fmt.Errorf("failed to create payment intent: %w", exceptions.ErrDuplicateOpenIntent)
		}
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

func (r *GormPaymentIntentRepository) FindOpenByReference(ctx context.Context, referenceType, referenceID string) (*entities.PaymentIntent, error) {
	var intent entities.PaymentIntent
	err := r.db.WithContext(ctx).
		Where("reference_type = ? AND reference_id = ? AND status = ?", referenceType, referenceID, entities.PaymentIntentStatusRequiresMethod).
		Order("created_at desc").
		First(&intent).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find open payment intent by reference: %w", err)
	}
	return &intent, nil
}

func (r *GormPaymentIntentRepository) Update(ctx context.Context, intent *entities.PaymentIntent) error {
	if err := r.db.WithContext(ctx).Save(intent).Error; err != nil {
		return fmt.Errorf("failed to update payment intent: %w", err)
	}
	return nil
}

func (r *GormPaymentIntentRepository) FindAll(ctx context.Context, filter repositories.PaymentIntentFilter) ([]*entities.PaymentIntent, int64, error) {
	var intents []*entities.PaymentIntent
	var total int64

	query := r.db.WithContext(ctx).Model(&entities.PaymentIntent{})

	if filter.UserID != "" {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.ProgramID != "" {
		// Postgres JSONB query
		query = query.Where("metadata ->> 'program' = ? OR metadata ->> 'program_id' = ?", filter.ProgramID, filter.ProgramID)
	}
	if filter.FromDate != "" {
		query = query.Where("created_at >= ?", filter.FromDate)
	}
	if filter.ToDate != "" {
		query = query.Where("created_at <= ?", filter.ToDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count intents: %w", err)
	}

	offset := (filter.Page - 1) * filter.Limit
	if err := query.Order("created_at desc").Limit(filter.Limit).Offset(offset).Find(&intents).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to find intents: %w", err)
	}

	return intents, total, nil
}
