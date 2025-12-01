package entities

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "pending"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusSuccess    PaymentStatus = "success"
	PaymentStatusFailed     PaymentStatus = "failed"
	PaymentStatusCancelled  PaymentStatus = "cancelled"
	PaymentStatusRefunded   PaymentStatus = "refunded"
)

// PaymentMethod represents the payment method type
type PaymentMethod string

const (
	// Automatic methods (via gateway)
	PaymentMethodCreditCard   PaymentMethod = "credit_card"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodEWallet      PaymentMethod = "e_wallet"
	PaymentMethodQRCode       PaymentMethod = "qr_code"

	// Manual methods (requires proof upload)
	PaymentMethodManualTransfer PaymentMethod = "manual_transfer"
	PaymentMethodCash           PaymentMethod = "cash"
)

// PaymentType represents whether payment is automatic or manual
type PaymentType string

const (
	PaymentTypeAutomatic PaymentType = "automatic" // Via payment gateway
	PaymentTypeManual    PaymentType = "manual"    // Requires proof upload & admin verification
)

// Payment represents a payment transaction in the system
type Payment struct {
	ID              string        `gorm:"type:uuid;primaryKey"`
	ApplicationID   string        `gorm:"type:varchar(255);not null;index:idx_payments_application_id"`
	UserID          string        `gorm:"type:varchar(255);not null;index:idx_payments_user_id,idx_payments_user_status"`
	Amount          float64       `gorm:"type:decimal(12,2);not null;check:amount > 0"`
	Currency        string        `gorm:"type:varchar(3);not null;default:'IDR'"`
	Status          PaymentStatus `gorm:"type:varchar(50);not null;index:idx_payments_status,idx_payments_user_status"`
	PaymentType     PaymentType   `gorm:"type:varchar(20);not null;default:'automatic';index:idx_payments_type"`
	PaymentMethod   PaymentMethod `gorm:"type:varchar(50)"`
	PaymentMethodID *string       `gorm:"type:uuid;index:idx_payments_method_id"` // References payment_methods table

	// Automatic payment fields (gateway-based)
	GatewayName     string                 `gorm:"type:varchar(50);index:idx_payments_gateway_name"`
	GatewayOrderID  string                 `gorm:"type:varchar(255);index:idx_payments_gateway_order_id"`
	GatewayResponse map[string]interface{} `gorm:"type:jsonb"`
	RedirectURL     string                 `gorm:"type:text"` // For automatic payments

	// Manual payment fields
	ProofFileID    *string    `gorm:"type:uuid"`         // Reference to uploaded proof file
	ProofFileURL   string     `gorm:"type:text"`         // URL to proof image
	VerifiedByID   *string    `gorm:"type:varchar(255)"` // Admin who verified
	VerifiedAt     *time.Time // When admin verified
	RejectedReason string     `gorm:"type:text"` // If rejected, why

	Description   string                 `gorm:"type:text"`
	CustomerName  string                 `gorm:"type:varchar(255)"`
	CustomerEmail string                 `gorm:"type:varchar(255)"`
	CustomerPhone string                 `gorm:"type:varchar(50)"`
	CallbackURL   string                 `gorm:"type:text"`
	Metadata      map[string]interface{} `gorm:"type:jsonb"`
	CreatedAt     time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_payments_created_at,sort:desc"`
	UpdatedAt     time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP"`
	PaidAt        *time.Time
	FailedAt      *time.Time
	CancelledAt   *time.Time
	RefundedAt    *time.Time
}

// TableName specifies the table name for GORM
func (Payment) TableName() string {
	return "payments"
}

// BeforeCreate hook to generate UUID
func (p *Payment) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// NewPayment creates a new payment instance
func NewPayment(applicationID, userID string, amount float64, currency, description string) *Payment {
	return &Payment{
		ID:            uuid.New().String(),
		ApplicationID: applicationID,
		UserID:        userID,
		Amount:        amount,
		Currency:      currency,
		Status:        PaymentStatusPending,
		Description:   description,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

// MarkAsSuccess marks the payment as successful
func (p *Payment) MarkAsSuccess(gatewayOrderID string, paidAt time.Time) {
	p.Status = PaymentStatusSuccess
	p.GatewayOrderID = gatewayOrderID
	p.PaidAt = &paidAt
	p.UpdatedAt = time.Now()
}

// MarkAsFailed marks the payment as failed
func (p *Payment) MarkAsFailed() {
	p.Status = PaymentStatusFailed
	now := time.Now()
	p.FailedAt = &now
	p.UpdatedAt = now
}

// MarkAsCancelled marks the payment as cancelled
func (p *Payment) MarkAsCancelled() {
	p.Status = PaymentStatusCancelled
	now := time.Now()
	p.CancelledAt = &now
	p.UpdatedAt = now
}

// MarkAsProcessing marks the payment as processing
func (p *Payment) MarkAsProcessing(gatewayOrderID string) {
	p.Status = PaymentStatusProcessing
	p.GatewayOrderID = gatewayOrderID
	p.UpdatedAt = time.Now()
}

// --- MANUAL VERIFICATION LOGIC

// VerifyManual marks the manual payment as SUCCESS
func (p *Payment) VerifyManual(adminID string) {
    now := time.Now()
    p.Status = PaymentStatusSuccess
    p.VerifiedAt = &now
    p.VerifiedByID = &adminID
    p.PaidAt = &now
    p.UpdatedAt = now
}

// RejectManual marks the manual payment as FAILED
func (p *Payment) RejectManual(adminID, reason string) {
    now := time.Now()
    p.Status = PaymentStatusFailed
    p.VerifiedAt = &now
    p.VerifiedByID = &adminID
    p.RejectedReason = reason
    p.FailedAt = &now
    p.UpdatedAt = now
}