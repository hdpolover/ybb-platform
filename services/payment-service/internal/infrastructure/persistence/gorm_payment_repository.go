package persistence

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/domain/exceptions"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
)

// GormPaymentRepository implements PaymentRepository using GORM
type GormPaymentRepository struct {
	db *gorm.DB
}

// NewGormPaymentRepository creates a new GORM payment repository
func NewGormPaymentRepository(db *gorm.DB) repositories.PaymentRepository {
	return &GormPaymentRepository{
		db: db,
	}
}

// Create saves a new payment to the database
func (r *GormPaymentRepository) Create(ctx context.Context, payment *entities.Payment) error {
	if err := r.db.WithContext(ctx).Create(payment).Error; err != nil {
		log.Printf("Failed to create payment: %v", err)
		return fmt.Errorf("failed to create payment: %w", err)
	}
	return nil
}

// FindByID retrieves a payment by its ID
func (r *GormPaymentRepository) FindByID(ctx context.Context, id string) (*entities.Payment, error) {
	var payment entities.Payment
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&payment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, exceptions.ErrPaymentNotFound
		}
		log.Printf("Failed to find payment: %v", err)
		return nil, fmt.Errorf("failed to find payment: %w", err)
	}
	return &payment, nil
}

// Update updates an existing payment
func (r *GormPaymentRepository) Update(ctx context.Context, payment *entities.Payment) error {
	if err := r.db.WithContext(ctx).Save(payment).Error; err != nil {
		log.Printf("Failed to update payment: %v", err)
		return fmt.Errorf("failed to update payment: %w", err)
	}
	return nil
}

func (r *GormPaymentRepository) UpdateProof(ctx context.Context, id string, fileID string, fileURL string) error {
    return r.db.WithContext(ctx).
        Model(&entities.Payment{}).
        Where("id = ?", id).
        Updates(map[string]interface{}{
            "proof_file_id":  fileID,
            "proof_file_url": fileURL,
            "status":         "processing", // Opsional: Ubah status jadi processing agar Admin tahu ada yg perlu dicek
            "updated_at":     time.Now(),
        }).Error
}

// FindByGatewayOrderID finds a payment by the gateway's order ID
func (r *GormPaymentRepository) FindByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	var payment entities.Payment
	if err := r.db.WithContext(ctx).Where("gateway_order_id = ?", gatewayOrderID).First(&payment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, exceptions.ErrPaymentNotFound
		}
		log.Printf("Failed to find payment by gateway order ID: %v", err)
		return nil, fmt.Errorf("failed to find payment: %w", err)
	}
	return &payment, nil
}

// FindByApplicationID retrieves all payments for a specific application
func (r *GormPaymentRepository) FindByApplicationID(ctx context.Context, applicationID string) ([]*entities.Payment, error) {
	var payments []*entities.Payment
	if err := r.db.WithContext(ctx).
		Where("application_id = ?", applicationID).
		Order("created_at DESC").
		Find(&payments).Error; err != nil {
		log.Printf("Failed to find payments by application ID: %v", err)
		return nil, fmt.Errorf("failed to find payments: %w", err)
	}
	return payments, nil
}

// FindByUserID retrieves all payments for a specific user with pagination
func (r *GormPaymentRepository) FindByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Payment, error) {
	var payments []*entities.Payment
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&payments).Error; err != nil {
		log.Printf("Failed to find payments by user ID: %v", err)
		return nil, fmt.Errorf("failed to find payments: %w", err)
	}
	return payments, nil
}
