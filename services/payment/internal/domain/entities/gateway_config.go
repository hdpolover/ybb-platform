package entities

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GatewayConfig represents configuration for a payment gateway
type GatewayConfig struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	GatewayName  string         `gorm:"type:varchar(50);not null;unique" json:"gateway_name" example:"midtrans"`
	IsActive     bool           `gorm:"not null;default:true" json:"is_active" example:"true"`
	IsProduction bool           `gorm:"not null;default:false" json:"is_production" example:"false"`
	Config       map[string]any `gorm:"type:jsonb;serializer:json;not null" json:"config"`
	
	CreatedAt time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (GatewayConfig) TableName() string {
	return "gateway_configs"
}

func (gc *GatewayConfig) BeforeCreate(tx *gorm.DB) error {
	if gc.ID == "" {
		gc.ID = uuid.New().String()
	}
	return nil
}
