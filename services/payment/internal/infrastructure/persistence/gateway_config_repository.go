package persistence

import (
	"context"
	"errors"
	"fmt"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/crypto"
	"gorm.io/gorm"
)

// GatewayConfigRepository persists GatewayConfig with at-rest encryption
// of the credential fields. The caller supplies a base64-encoded 32-byte key;
// passing "" causes every read/write to error — fail loud on misconfig.
type GatewayConfigRepository struct {
	db        *gorm.DB
	secretKey string
}

func NewGatewayConfigRepository(db *gorm.DB, secretKey string) *GatewayConfigRepository {
	return &GatewayConfigRepository{db: db, secretKey: secretKey}
}

func (r *GatewayConfigRepository) FindAll(ctx context.Context) ([]entities.GatewayConfig, error) {
	var configs []entities.GatewayConfig
	if err := r.db.WithContext(ctx).Order("provider asc").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch gateway configs: %w", err)
	}
	for i := range configs {
		if err := r.decryptInPlace(&configs[i]); err != nil {
			return nil, err
		}
	}
	return configs, nil
}

func (r *GatewayConfigRepository) FindActive(ctx context.Context) ([]entities.GatewayConfig, error) {
	var configs []entities.GatewayConfig
	if err := r.db.WithContext(ctx).Where("is_active = true").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch active gateway configs: %w", err)
	}
	for i := range configs {
		if err := r.decryptInPlace(&configs[i]); err != nil {
			return nil, err
		}
	}
	return configs, nil
}

func (r *GatewayConfigRepository) FindByProvider(ctx context.Context, provider string) (*entities.GatewayConfig, error) {
	var cfg entities.GatewayConfig
	err := r.db.WithContext(ctx).
		Where("provider = ? AND is_active = true", provider).
		First(&cfg).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("no active config found for provider %q", provider)
		}
		return nil, fmt.Errorf("failed to find gateway config: %w", err)
	}
	if err := r.decryptInPlace(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *GatewayConfigRepository) FindByID(ctx context.Context, id string) (*entities.GatewayConfig, error) {
	var cfg entities.GatewayConfig
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&cfg).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("gateway config not found")
		}
		return nil, fmt.Errorf("failed to find gateway config: %w", err)
	}
	if err := r.decryptInPlace(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *GatewayConfigRepository) Create(ctx context.Context, cfg *entities.GatewayConfig) error {
	encrypted, err := r.encryptCopy(cfg)
	if err != nil {
		return err
	}
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if encrypted.IsActive {
			if err := deactivateOtherActive(tx, encrypted.Provider, ""); err != nil {
				return err
			}
		}
		return tx.Create(encrypted).Error
	})
	if err != nil {
		return fmt.Errorf("failed to create gateway config: %w", err)
	}
	// Propagate DB-assigned fields (ID, timestamps) back to the caller's struct,
	// but keep their credential fields as-is (plaintext).
	cfg.ID = encrypted.ID
	cfg.CreatedAt = encrypted.CreatedAt
	cfg.UpdatedAt = encrypted.UpdatedAt
	return nil
}

func (r *GatewayConfigRepository) Update(ctx context.Context, cfg *entities.GatewayConfig) error {
	encrypted, err := r.encryptCopy(cfg)
	if err != nil {
		return err
	}
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if encrypted.IsActive {
			if err := deactivateOtherActive(tx, encrypted.Provider, encrypted.ID); err != nil {
				return err
			}
		}
		return tx.Save(encrypted).Error
	})
	if err != nil {
		return fmt.Errorf("failed to update gateway config: %w", err)
	}
	cfg.UpdatedAt = encrypted.UpdatedAt
	return nil
}

// deactivateOtherActive flips is_active=false on every row for `provider`
// except `exceptID` (pass "" when creating a new row). Called inside a
// transaction so the partial unique index never sees two active rows at once.
func deactivateOtherActive(tx *gorm.DB, provider, exceptID string) error {
	q := tx.Model(&entities.GatewayConfig{}).
		Where("provider = ? AND is_active = true", provider)
	if exceptID != "" {
		q = q.Where("id <> ?", exceptID)
	}
	if err := q.Update("is_active", false).Error; err != nil {
		return fmt.Errorf("deactivate other active configs for %q: %w", provider, err)
	}
	return nil
}

func (r *GatewayConfigRepository) Delete(ctx context.Context, id string) error {
	if err := r.db.WithContext(ctx).Where("id = ?", id).Delete(&entities.GatewayConfig{}).Error; err != nil {
		return fmt.Errorf("failed to delete gateway config: %w", err)
	}
	return nil
}

// encryptCopy returns a shallow copy of c with the three credential fields
// replaced by their ciphertext. The original pointer is never mutated — even
// if one field fails to encrypt, the caller's struct stays whole.
func (r *GatewayConfigRepository) encryptCopy(c *entities.GatewayConfig) (*entities.GatewayConfig, error) {
	out := *c // shallow copy
	sk, err := crypto.Encrypt(r.secretKey, c.ServerKey)
	if err != nil {
		return nil, fmt.Errorf("encrypt server_key: %w", err)
	}
	ck, err := crypto.Encrypt(r.secretKey, c.ClientKey)
	if err != nil {
		return nil, fmt.Errorf("encrypt client_key: %w", err)
	}
	ws, err := crypto.Encrypt(r.secretKey, c.WebhookSecret)
	if err != nil {
		return nil, fmt.Errorf("encrypt webhook_secret: %w", err)
	}
	out.ServerKey, out.ClientKey, out.WebhookSecret = sk, ck, ws
	return &out, nil
}

// decryptInPlace decrypts the three credential fields on an already-loaded
// struct. Read paths own decryption, so the caller sees plaintext.
func (r *GatewayConfigRepository) decryptInPlace(c *entities.GatewayConfig) error {
	sk, err := crypto.Decrypt(r.secretKey, c.ServerKey)
	if err != nil {
		return fmt.Errorf("decrypt server_key for config %s (%s): %w", c.ID, c.Provider, err)
	}
	ck, err := crypto.Decrypt(r.secretKey, c.ClientKey)
	if err != nil {
		return fmt.Errorf("decrypt client_key for config %s (%s): %w", c.ID, c.Provider, err)
	}
	ws, err := crypto.Decrypt(r.secretKey, c.WebhookSecret)
	if err != nil {
		return fmt.Errorf("decrypt webhook_secret for config %s (%s): %w", c.ID, c.Provider, err)
	}
	c.ServerKey, c.ClientKey, c.WebhookSecret = sk, ck, ws
	return nil
}
