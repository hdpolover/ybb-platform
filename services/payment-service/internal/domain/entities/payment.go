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
	PaymentMethodCreditCard   PaymentMethod = "credit_card"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodEWallet      PaymentMethod = "e_wallet"
	PaymentMethodQRCode       PaymentMethod = "qr_code"
)

// Payment represents a payment transaction in the system
type Payment struct {
	ID              string                 `gorm:"type:uuid;primaryKey"`
	ApplicationID   string                 `gorm:"type:varchar(255);not null;index:idx_payments_application_id"`
	UserID          string                 `gorm:"type:varchar(255);not null;index:idx_payments_user_id,idx_payments_user_status"`
	Amount          float64                `gorm:"type:decimal(12,2);not null;check:amount > 0"`
	Currency        string                 `gorm:"type:varchar(3);not null;default:'IDR'"`
	Status          PaymentStatus          `gorm:"type:varchar(50);not null;index:idx_payments_status,idx_payments_user_status"`
	PaymentMethod   PaymentMethod          `gorm:"type:varchar(50)"`
	GatewayName     string                 `gorm:"type:varchar(50);not null;index:idx_payments_gateway_name"`
	GatewayOrderID  string                 `gorm:"type:varchar(255);index:idx_payments_gateway_order_id"`
	GatewayResponse map[string]interface{} `gorm:"type:jsonb"`
	Description     string                 `gorm:"type:text"`
	CustomerName    string                 `gorm:"type:varchar(255)"`
	CustomerEmail   string                 `gorm:"type:varchar(255)"`
	CustomerPhone   string                 `gorm:"type:varchar(50)"`
	CallbackURL     string                 `gorm:"type:text"`
	RedirectURL     string                 `gorm:"type:text"`
	Metadata        map[string]interface{} `gorm:"type:jsonb"`
	CreatedAt       time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_payments_created_at,sort:desc"`
	UpdatedAt       time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP"`
	PaidAt          *time.Time
	FailedAt        *time.Time
	CancelledAt     *time.Time
	RefundedAt      *time.Time
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
