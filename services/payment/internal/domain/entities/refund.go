package entities

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RefundStatus represents the status of a refund
type RefundStatus string

const (
	RefundStatusPending    RefundStatus = "pending"
	RefundStatusProcessing RefundStatus = "processing"
	RefundStatusSuccess    RefundStatus = "success"
	RefundStatusFailed     RefundStatus = "failed"
)

// Refund represents a payment refund
type Refund struct {
	ID              string                 `gorm:"type:uuid;primaryKey" json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	PaymentID       string                 `gorm:"type:uuid;not null;index:idx_refunds_payment_id" json:"payment_id" example:"550e8400-e29b-41d4-a716-446655440000"`
	Amount          float64                `gorm:"type:decimal(12,2);not null;check:amount > 0" json:"amount" example:"50000"`
	Reason          string                 `gorm:"type:text" json:"reason" example:"Double payment"`
	Status          RefundStatus           `gorm:"type:varchar(50);not null;default:'pending';index:idx_refunds_status" json:"status" example:"pending"`
	GatewayRefundID string                 `gorm:"type:varchar(255)" json:"gateway_refund_id" example:"ref_12345"`
	GatewayResponse map[string]interface{} `gorm:"type:jsonb" json:"gateway_response" swaggerignore:"true"`
	
	CreatedAt   time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_refunds_created_at" json:"created_at" example:"2025-12-01T10:00:00Z"`
	ProcessedAt *time.Time     `json:"processed_at" example:"2025-12-01T10:00:00Z"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty" swaggerignore:"true"`
}

func (Refund) TableName() string {
	return "refunds"
}

func (r *Refund) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}
