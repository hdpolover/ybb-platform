package entities

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type PaymentIdempotencyStatus string

const (
	PaymentIdempotencyStatusProcessing PaymentIdempotencyStatus = "PROCESSING"
	PaymentIdempotencyStatusCompleted  PaymentIdempotencyStatus = "COMPLETED"
	PaymentIdempotencyStatusFailed     PaymentIdempotencyStatus = "FAILED"
)

type PaymentIdempotencyKey struct {
	ID             string                   `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	IdempotencyKey string                   `gorm:"column:idempotency_key;type:varchar(255);not null;uniqueIndex:idx_payment_idempotency_key_scope" json:"idempotency_key"`
	Scope          string                   `gorm:"type:varchar(100);not null;uniqueIndex:idx_payment_idempotency_key_scope" json:"scope"`
	ResourceID     string                   `gorm:"type:varchar(255);not null" json:"resource_id"`
	RequestHash    string                   `gorm:"type:varchar(64);not null" json:"request_hash"`
	Status         PaymentIdempotencyStatus `gorm:"type:varchar(20);not null" json:"status"`
	TransactionID  string                   `gorm:"type:uuid" json:"transaction_id"`
	ResponseBody   json.RawMessage          `gorm:"type:jsonb" json:"response_body"`
	ErrorMessage   string                   `gorm:"type:text" json:"error_message"`
	CreatedAt      time.Time                `json:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at"`
}

func NewPaymentIdempotencyKey(key, scope, resourceID, requestHash string) *PaymentIdempotencyKey {
	now := time.Now()
	return &PaymentIdempotencyKey{
		ID:             uuid.NewString(),
		IdempotencyKey: key,
		Scope:          scope,
		ResourceID:     resourceID,
		RequestHash:    requestHash,
		Status:         PaymentIdempotencyStatusProcessing,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func (PaymentIdempotencyKey) TableName() string {
	return "payment_idempotency_keys"
}
