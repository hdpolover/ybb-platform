package entities

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PaymentMethodType represents the type of payment method
type PaymentMethodType string

const (
	MethodTypeAutomatic PaymentMethodType = "automatic" // Via payment gateway
	MethodTypeManual    PaymentMethodType = "manual"    // Manual verification
)

// PaymentMethodEntity represents a configurable payment method
type PaymentMethodEntity struct {
	// --- Primary Key ---
	ID string `gorm:"type:uuid;primaryKey" json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`

	// --- Basic Info ---
	Name        string            `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"         example:"Transfer Bank BCA"`
	Type        PaymentMethodType `gorm:"type:varchar(20);not null;index"        json:"type"         example:"manual"`
	Code        string            `gorm:"type:varchar(50);not null;uniqueIndex"  json:"code"         example:"bca_manual"`
	IsActive    bool              `gorm:"not null;default:true;index"            json:"is_active"    example:"true"`
	DisplayName string            `gorm:"type:varchar(100);not null"             json:"display_name" example:"Bank BCA"`
	Description string            `gorm:"type:text"                              json:"description"  example:"Transfer manual ke rekening BCA"`
	Icon        string            `gorm:"type:varchar(255)"                      json:"icon"         example:"https://logo.com/bca.png"`

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
	// swaggertype digunakan agar Swagger tidak bingung membaca map[string]interface{}
	Config map[string]interface{} `gorm:"type:jsonb;serializer:json" json:"config" 		swaggerignore:"true"`
	SortOrder int                 `gorm:"default:0"                  json:"sort_order"  example:"1"`

	// --- Timestamps ---
	CreatedAt time.Time      `json:"created_at" example:"2025-12-01T10:00:00Z"`
	UpdatedAt time.Time      `json:"updated_at" example:"2025-12-01T10:00:00Z"`
	DeletedAt gorm.DeletedAt `gorm:"index"      json:"-" swaggerignore:"true"`
}

// TableName specifies the table name for GORM
func (PaymentMethodEntity) TableName() string {
	return "payment_methods"
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
