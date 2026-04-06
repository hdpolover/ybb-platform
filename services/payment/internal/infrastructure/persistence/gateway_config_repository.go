package persistence

import (
	"context"
	"fmt"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"gorm.io/gorm"
)

// GatewayConfigRepository is the GORM implementation for gateway config persistence.
type GatewayConfigRepository struct {
	db *gorm.DB
}

// NewGatewayConfigRepository creates a new GatewayConfigRepository.
func NewGatewayConfigRepository(db *gorm.DB) *GatewayConfigRepository {
	return &GatewayConfigRepository{db: db}
}

// FindAll returns all gateway configs including inactive ones.
func (r *GatewayConfigRepository) FindAll(ctx context.Context) ([]entities.GatewayConfig, error) {
	var configs []entities.GatewayConfig
	if err := r.db.WithContext(ctx).Order("provider asc").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch gateway configs: %w", err)
	}
	return configs, nil
}

// FindActive returns only active (non-deleted, is_active=true) configs.
func (r *GatewayConfigRepository) FindActive(ctx context.Context) ([]entities.GatewayConfig, error) {
	var configs []entities.GatewayConfig
	if err := r.db.WithContext(ctx).Where("is_active = true").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch active gateway configs: %w", err)
	}
	return configs, nil
}

// FindByProvider returns the active config for a given provider name.
func (r *GatewayConfigRepository) FindByProvider(ctx context.Context, provider string) (*entities.GatewayConfig, error) {
	var cfg entities.GatewayConfig
	err := r.db.WithContext(ctx).
		Where("provider = ? AND is_active = true", provider).
		First(&cfg).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("no active config found for provider %q", provider)
		}
		return nil, fmt.Errorf("failed to find gateway config: %w", err)
	}
	return &cfg, nil
}

// FindByID returns a single gateway config by primary key.
func (r *GatewayConfigRepository) FindByID(ctx context.Context, id string) (*entities.GatewayConfig, error) {
	var cfg entities.GatewayConfig
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&cfg).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("gateway config not found")
		}
		return nil, fmt.Errorf("failed to find gateway config: %w", err)
	}
	return &cfg, nil
}

// Create persists a new gateway config.
func (r *GatewayConfigRepository) Create(ctx context.Context, cfg *entities.GatewayConfig) error {
	if err := r.db.WithContext(ctx).Create(cfg).Error; err != nil {
		return fmt.Errorf("failed to create gateway config: %w", err)
	}
	return nil
}

// Update saves all fields of an existing gateway config.
func (r *GatewayConfigRepository) Update(ctx context.Context, cfg *entities.GatewayConfig) error {
	if err := r.db.WithContext(ctx).Save(cfg).Error; err != nil {
		return fmt.Errorf("failed to update gateway config: %w", err)
	}
	return nil
}

// Delete soft-deletes a gateway config by ID.
func (r *GatewayConfigRepository) Delete(ctx context.Context, id string) error {
	if err := r.db.WithContext(ctx).Where("id = ?", id).Delete(&entities.GatewayConfig{}).Error; err != nil {
		return fmt.Errorf("failed to delete gateway config: %w", err)
	}
	return nil
}
