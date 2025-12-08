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
	PaymentMethodCreditCard     PaymentMethod = "credit_card"
	PaymentMethodBankTransfer   PaymentMethod = "bank_transfer"
	PaymentMethodEWallet        PaymentMethod = "e_wallet"
	PaymentMethodQRCode         PaymentMethod = "qr_code"
	PaymentMethodManualTransfer PaymentMethod = "manual_transfer"
	PaymentMethodCash           PaymentMethod = "cash"
)

// PaymentType represents whether payment is automatic or manual
type PaymentType string

const (
	PaymentTypeAutomatic PaymentType = "automatic"
	PaymentTypeManual    PaymentType = "manual"
)

// Payment represents a payment transaction in the system
// @Description Data detail sebuah transaksi pembayaran
type Payment struct {
	// --- Primary Key ---
	ID string `gorm:"type:uuid;primaryKey" json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`

	// --- References ---
	ApplicationID   string  `gorm:"type:varchar(255);not null;index:idx_payments_application_id" json:"application_id"    example:"app-123"`
	UserID          string  `gorm:"type:varchar(255);not null;index:idx_payments_user_id"        json:"user_id"           example:"user-456"`
	PaymentMethodID *string `gorm:"type:uuid;index:idx_payments_method_id"                       json:"payment_method_id" example:"uuid-of-method"`

	// --- Transaction Details ---
	Amount        float64       `gorm:"type:decimal(12,2);not null;check:amount > 0"                 json:"amount"         example:"150000"`
	Currency      string        `gorm:"type:varchar(3);not null;default:'IDR'"                       json:"currency"       example:"IDR"`
	Status        PaymentStatus `gorm:"type:varchar(50);not null;index:idx_payments_status"          json:"status"         example:"pending"`
	PaymentType   PaymentType   `gorm:"type:varchar(20);not null;default:'automatic';index"          json:"payment_type"   example:"manual"`
	PaymentMethod PaymentMethod `gorm:"type:varchar(50)"                                             json:"payment_method" example:"manual_transfer"`

	// --- Customer Info ---
	CustomerName  string `gorm:"type:varchar(255)" json:"customer_name"  example:"John Doe"`
	CustomerEmail string `gorm:"type:varchar(255)" json:"customer_email" example:"john@example.com"`
	CustomerPhone string `gorm:"type:varchar(50)"  json:"customer_phone" example:"08123456789"`
	Description   string `gorm:"type:text"         json:"description"    example:"Pembayaran Invoice #1"`
	CallbackURL   string `gorm:"type:text"         json:"callback_url"   example:"https://client.com/callback"`

	// --- Automatic Gateway Fields ---
	GatewayName     string                 `gorm:"type:varchar(50)" json:"gateway_name"     example:"manual"`
	GatewayOrderID  string                 `gorm:"type:varchar(255)" json:"gateway_order_id" example:"order-123"`
	GatewayResponse map[string]interface{} `gorm:"type:jsonb"       json:"gateway_response"  swaggerignore:"true"`
	RedirectURL     string                 `gorm:"type:text"        json:"redirect_url"      example:"https://midtrans.com/redirect"`

	// --- Manual Payment Fields ---
	ProofFileID    *string    `gorm:"type:uuid"          json:"proof_file_id"    example:""`
	ProofFileURL   string     `gorm:"type:text"          json:"proof_file_url"   example:"http://localhost:8081/uploads/bukti.jpg"`
	VerifiedByID   *string    `gorm:"type:varchar(255)"  json:"verified_by_id"   example:"admin-magang"`
	VerifiedAt     *time.Time `json:"verified_at"        example:"2025-12-01T10:00:00Z"`
	RejectedReason string     `gorm:"type:text"          json:"rejected_reason"  example:"Foto buram"`

	// --- Metadata & Timestamps ---
	Metadata  map[string]interface{} `gorm:"type:jsonb" json:"metadata" swaggerignore:"true"`
	CreatedAt time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at" example:"2025-12-01T10:00:00Z"`
	UpdatedAt time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at" example:"2025-12-01T10:00:00Z"`
	PaidAt    *time.Time             `json:"paid_at"     example:"2025-12-01T10:00:00Z"`
	FailedAt  *time.Time             `json:"failed_at"   example:""`
	CancelledAt *time.Time           `json:"cancelled_at" example:""`
	RefundedAt  *time.Time           `json:"refunded_at"  example:""`
}

func (Payment) TableName() string {
	return "payments"
}

func (p *Payment) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

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