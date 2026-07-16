package entities

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GatewayConfig represents configuration for a payment gateway (Midtrans/Xendit keys)
// Maps to table: payment_gateway_configs
type GatewayConfig struct {
	ID            string  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BrandID       *string `gorm:"type:uuid;column:brand_id" json:"brand_id"` // Nullable for Global Config
	Provider      string  `gorm:"type:varchar(50);not null" json:"provider"` // 'midtrans', 'xendit'
	Mode          string  `gorm:"type:varchar(20);default:'sandbox'" json:"mode"`
	ServerKey     string  `gorm:"type:text;not null" json:"server_key"`
	ClientKey     string  `gorm:"type:text;not null" json:"client_key"`
	WebhookSecret string  `gorm:"type:text" json:"webhook_secret"`

	IsActive bool `gorm:"not null;default:true" json:"is_active"`

	CreatedAt time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (GatewayConfig) TableName() string {
	return "payment_gateway_configs"
}

func (gc *GatewayConfig) BeforeCreate(tx *gorm.DB) error {
	if gc.ID == "" {
		gc.ID = uuid.New().String()
	}
	return nil
}
