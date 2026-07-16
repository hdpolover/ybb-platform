package entities

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type TransactionStatus string

const (
	TransactionStatusPending     TransactionStatus = "PENDING"
	TransactionStatusNeedsReview TransactionStatus = "NEEDS_REVIEW"
	TransactionStatusSuccess     TransactionStatus = "SUCCESS"
	TransactionStatusFailed      TransactionStatus = "FAILED"
	TransactionStatusVoid        TransactionStatus = "VOID"
	TransactionStatusRejected    TransactionStatus = "REJECTED"
)

type PaymentTransaction struct {
	ID                 string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	IntentID           string `gorm:"column:payment_intent_id;type:uuid;not null;index" json:"intent_id"`
	GatewayReferenceID string `gorm:"type:varchar(100);index" json:"gateway_reference_id"`
	PaymentMethodID    string `gorm:"column:payment_method_id;type:varchar(50);not null" json:"payment_method_id"` // e.g. "bca_va", "credit_card"

	// Financial Breakdown
	Currency       string  `gorm:"type:varchar(3)" json:"currency"`
	AmountTotal    float64 `gorm:"type:decimal(15,2);not null" json:"amount"`          // What user was charged
	AmountSubtotal float64 `gorm:"type:decimal(15,2);not null" json:"amount_subtotal"` // The original intent amount
	FeeProvider    float64 `gorm:"type:decimal(15,2);default:0" json:"fee_provider"`
	NetAmount      float64 `gorm:"type:decimal(15,2);not null" json:"net_amount"`

	Amount float64 `gorm:"-" json:"-"` // Deprecated: kept in-memory only; DB uses amount_total

	Status          TransactionStatus `gorm:"type:varchar(20);not null" json:"status"`
	GatewayResponse json.RawMessage   `gorm:"type:jsonb" json:"gateway_response"`
	ErrorCode       string            `gorm:"type:varchar(50)" json:"error_code"`
	ProofFileURL    string            `gorm:"type:text" json:"proof_file_url"`
	AdminNotes      string            `gorm:"type:text" json:"admin_notes"`
	ReviewedBy      *string           `gorm:"type:uuid" json:"reviewed_by"`
	ReviewedAt      *time.Time        `json:"reviewed_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func NewPaymentTransaction(intentID, methodID string, amount float64) *PaymentTransaction {
	now := time.Now()
	return &PaymentTransaction{
		ID:              uuid.NewString(),
		IntentID:        intentID,
		PaymentMethodID: methodID,
		AmountTotal:     amount,
		AmountSubtotal:  amount, // Default: Assume Absorb, so Total = Subtotal
		NetAmount:       amount, // Default: Will be updated after fee calc
		Status:          TransactionStatusPending,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}
