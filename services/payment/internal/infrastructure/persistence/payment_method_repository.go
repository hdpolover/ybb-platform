package persistence

import (
	"context"
	"fmt"
	"log"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"gorm.io/gorm"
)

// PaymentMethodRepository menangani database untuk Payment Methods menggunakan GORM
type PaymentMethodRepository struct {
	db *gorm.DB
}

// NewPaymentMethodRepository creates a new repository instance
func NewPaymentMethodRepository(db *gorm.DB) *PaymentMethodRepository {
	return &PaymentMethodRepository{
		db: db,
	}
}

// Create: Menambah metode pembayaran baru
func (r *PaymentMethodRepository) Create(ctx context.Context, pm *entities.PaymentMethodEntity) error {
	if err := r.db.WithContext(ctx).Create(pm).Error; err != nil {
		log.Printf("Failed to create payment method: %v", err)
		return fmt.Errorf("failed to create payment method: %w", err)
	}
	return nil
}

// FindAll: Mengambil semua metode pembayaran (diurutkan berdasarkan SortOrder)
func (r *PaymentMethodRepository) FindAll(ctx context.Context) ([]entities.PaymentMethodEntity, error) {
	var methods []entities.PaymentMethodEntity
	// Kita urutkan asc (0, 1, 2...) supaya tampilan di frontend rapi
	if err := r.db.WithContext(ctx).Order("sort_order asc").Find(&methods).Error; err != nil {
		log.Printf("Failed to fetch payment methods: %v", err)
		return nil, fmt.Errorf("failed to fetch payment methods: %w", err)
	}
	return methods, nil
}

// FindByID: Mencari satu metode pembayaran berdasarkan ID
func (r *PaymentMethodRepository) FindByID(ctx context.Context, id string) (*entities.PaymentMethodEntity, error) {
	var method entities.PaymentMethodEntity
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&method).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("payment method not found")
		}
		log.Printf("Failed to find payment method: %v", err)
		return nil, fmt.Errorf("failed to find payment method: %w", err)
	}
	return &method, nil
}

// Update: Menyimpan perubahan data
func (r *PaymentMethodRepository) Update(ctx context.Context, pm *entities.PaymentMethodEntity) error {
	if err := r.db.WithContext(ctx).Save(pm).Error; err != nil {
		log.Printf("Failed to update payment method: %v", err)
		return fmt.Errorf("failed to update payment method: %w", err)
	}
	return nil
}

// FindByCode finds a payment method by its unique code (e.g., "bca_va", "credit_card")
func (r *PaymentMethodRepository) FindByCode(ctx context.Context, code string) (*entities.PaymentMethodEntity, error) {
	var method entities.PaymentMethodEntity
	if err := r.db.WithContext(ctx).Where("code = ?", code).First(&method).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("payment method not found")
		}
		return nil, fmt.Errorf("failed to find payment method by code: %w", err)
	}
	return &method, nil
}

func (r *PaymentMethodRepository) FindByCodeOrID(ctx context.Context, value string) (*entities.PaymentMethodEntity, error) {
	var method entities.PaymentMethodEntity
	if err := r.db.WithContext(ctx).
		Where("code = ? OR id = ?", value, value).
		First(&method).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("payment method not found")
		}
		return nil, fmt.Errorf("failed to find payment method by code or id: %w", err)
	}

	return &method, nil
}

// Delete: Menghapus data (Soft Delete karena ada gorm.DeletedAt di entity)
func (r *PaymentMethodRepository) Delete(ctx context.Context, id string) error {
	if err := r.db.WithContext(ctx).Delete(&entities.PaymentMethodEntity{}, "id = ?", id).Error; err != nil {
		log.Printf("Failed to delete payment method: %v", err)
		return fmt.Errorf("failed to delete payment method: %w", err)
	}
	return nil
}
