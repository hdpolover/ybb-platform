package entities

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PaymentMethodType represents the type of payment method
type PaymentMethodType string

const (
	MethodTypeAutomatic PaymentMethodType = "AUTOMATIC" // Via payment gateway
	MethodTypeManual    PaymentMethodType = "MANUAL"    // Manual verification
)

type FeeConfig struct {
	FixedFee      float64 `json:"fixed_fee"`
	PercentageFee float64 `json:"percentage_fee"` // 0.029 for 2.9%
	MinFee        float64 `json:"min_fee"`
	Currency      string  `json:"currency"`
	IsSurcharge   bool    `json:"is_surcharge"` // false=absorb, true=customer_pays
}

// PaymentMethodEntity represents a configurable payment method
type PaymentMethodEntity struct {
	ID          string            `gorm:"type:uuid;primaryKey"                json:"id"`
	Name        string            `gorm:"type:varchar(100);not null;unique"   json:"name"`         // e.g., "Bank BCA", "Midtrans", "GoPay"
	Type        PaymentMethodType `gorm:"type:varchar(20);not null;index"     json:"type"`
	Code        string            `gorm:"type:varchar(50);not null;unique"    json:"code"`         // e.g., "bank_bca", "midtrans", "gopay"
	IsActive    bool              `gorm:"not null;default:true;index"         json:"is_active"`
	DisplayName string            `gorm:"type:varchar(100);not null"          json:"display_name"` // User-facing name
	Description string            `gorm:"type:text"                           json:"description"`
	Icon        string            `gorm:"type:varchar(255)"                   json:"icon"`         // Icon URL or identifier

	// --- Automatic Payment Fields ---
	GatewayName string `gorm:"type:varchar(50)" json:"gateway_name" example:""`
	GatewayType string `gorm:"type:varchar(50)" json:"gateway_type" example:""`

	// --- Manual Payment Fields ---
	BankName          string `gorm:"type:varchar(100)"      json:"bank_name"          example:"BCA"`
	AccountNumber     string `gorm:"type:varchar(100)"      json:"account_number"     example:"1234567890"`
	AccountName       string `gorm:"type:varchar(255)"      json:"account_name"       example:"PT YBB Platform"`
	Instructions      string `gorm:"type:text"              json:"instructions"       example:"Silakan transfer sesuai nominal unik"`
	RequiresProof     bool   `gorm:"not null;default:false" json:"requires_proof"     example:"true"`
	AdminInstructions string `gorm:"type:text"              json:"admin_instructions" example:"Cek mutasi bank tanggal sekian"`

	// --- Configuration ---
	// Structure tracking fee logic
	Config    FeeConfig `gorm:"type:jsonb;serializer:json" json:"config" swaggerignore:"true"`
	SortOrder int       `gorm:"default:0" json:"sort_order" example:"1"`

	// --- Timestamps ---
	CreatedAt time.Time      `json:"created_at" example:"2025-12-01T10:00:00Z"`
	UpdatedAt time.Time      `json:"updated_at" example:"2025-12-01T10:00:00Z"`
	DeletedAt gorm.DeletedAt `gorm:"index"      json:"-" swaggerignore:"true"`
}

// TableName specifies the table name for GORM
func (PaymentMethodEntity) TableName() string {
	return "payment_methods"
}

func (t PaymentMethodType) IsManual() bool {
	return strings.EqualFold(string(t), string(MethodTypeManual))
}

func (t PaymentMethodType) IsAutomatic() bool {
	return strings.EqualFold(string(t), string(MethodTypeAutomatic))
}

// // BeforeCreate hook to generate UUID
// func (pm *PaymentMethodEntity) BeforeCreate(tx *gorm.DB) error {
// 	if pm.ID == "" {
// 		pm.ID = generateUUID()
// 	}
// 	return nil
// }

// BeforeCreate hook to generate UUID
func (pm *PaymentMethodEntity) BeforeCreate(tx *gorm.DB) error {
	if pm.ID == "" {
		pm.ID = uuid.New().String()
	}
	return nil
}

// func generateUUID() string {
// 	// Simple UUID generation - in production use proper UUID library
// 	return time.Now().Format("20060102150405")
// }
