package entities

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type TransactionStatus string

const (
	TransactionStatusPending TransactionStatus = "PENDING"
	TransactionStatusSuccess TransactionStatus = "SUCCESS"
	TransactionStatusFailed  TransactionStatus = "FAILED"
	TransactionStatusVoid    TransactionStatus = "VOID"
)

type PaymentTransaction struct {
	ID                 string            `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	IntentID           string            `gorm:"type:uuid;not null;index" json:"intent_id"`
	GatewayReferenceID string            `gorm:"type:varchar(100);index" json:"gateway_reference_id"`
	PaymentMethodID    string            `gorm:"type:varchar(50);not null" json:"payment_method_id"` // e.g. "bca_va", "credit_card"
	Amount             float64           `gorm:"type:decimal(15,2);not null" json:"amount"`
	Status             TransactionStatus `gorm:"type:varchar(20);not null" json:"status"`
	GatewayResponse    json.RawMessage   `gorm:"type:jsonb" json:"gateway_response"`
	ErrorCode          string            `gorm:"type:varchar(50)" json:"error_code"`

	CreatedAt time.Time `json:"created_at"`
}

func NewPaymentTransaction(intentID, methodID string, amount float64) *PaymentTransaction {
	return &PaymentTransaction{
		ID:              uuid.NewString(),
		IntentID:        intentID,
		PaymentMethodID: methodID,
		Amount:          amount,
		Status:          TransactionStatusPending,
		CreatedAt:       time.Now(),
	}
}
