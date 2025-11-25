package entities

import (
	"time"

	"gorm.io/gorm"
)

// PaymentMethodType represents the type of payment method
type PaymentMethodType string

const (
	MethodTypeAutomatic PaymentMethodType = "automatic" // Via payment gateway
	MethodTypeManual    PaymentMethodType = "manual"    // Manual verification
)

// PaymentMethodEntity represents a configurable payment method
// Admins can enable/disable methods and configure them
type PaymentMethodEntity struct {
	ID          string            `gorm:"type:uuid;primaryKey"`
	Name        string            `gorm:"type:varchar(100);not null;uniqueIndex"` // e.g., "Bank BCA", "Midtrans", "GoPay"
	Type        PaymentMethodType `gorm:"type:varchar(20);not null;index"`
	Code        string            `gorm:"type:varchar(50);not null;uniqueIndex"` // e.g., "bank_bca", "midtrans", "gopay"
	IsActive    bool              `gorm:"not null;default:true;index"`
	DisplayName string            `gorm:"type:varchar(100);not null"` // User-facing name
	Description string            `gorm:"type:text"`
	Icon        string            `gorm:"type:varchar(255)"` // Icon URL or identifier

	// For automatic methods
	GatewayName string `gorm:"type:varchar(50)"` // "midtrans", "xendit", etc.
	GatewayType string `gorm:"type:varchar(50)"` // Payment type in gateway: "credit_card", "bank_transfer", etc.

	// For manual methods
	AccountNumber     string `gorm:"type:varchar(100)"`      // Bank account number
	AccountName       string `gorm:"type:varchar(255)"`      // Account holder name
	BankName          string `gorm:"type:varchar(100)"`      // Bank name (for transfers)
	Instructions      string `gorm:"type:text"`              // Instructions for users
	RequiresProof     bool   `gorm:"not null;default:false"` // Whether proof upload is required
	AdminInstructions string `gorm:"type:text"`              // Instructions for admins verifying

	// Configuration
	Config    map[string]interface{} `gorm:"type:jsonb"` // Additional config
	SortOrder int                    `gorm:"default:0"`  // Display order

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the table name for GORM
func (PaymentMethodEntity) TableName() string {
	return "payment_methods"
}

// BeforeCreate hook to generate UUID
func (pm *PaymentMethodEntity) BeforeCreate(tx *gorm.DB) error {
	if pm.ID == "" {
		pm.ID = generateUUID()
	}
	return nil
}

func generateUUID() string {
	// Simple UUID generation - in production use proper UUID library
	return time.Now().Format("20060102150405")
}
