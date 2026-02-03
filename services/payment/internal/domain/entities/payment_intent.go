package entities

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentIntentStatus string

const (
	PaymentIntentStatusRequiresMethod PaymentIntentStatus = "REQUIRES_PAYMENT_METHOD"
	PaymentIntentStatusProcessing     PaymentIntentStatus = "PROCESSING"
	PaymentIntentStatusSucceeded      PaymentIntentStatus = "SUCCEEDED"
	PaymentIntentStatusCanceled       PaymentIntentStatus = "CANCELED"
)

type PaymentIntent struct {
	ID            string              `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID        string              `gorm:"type:uuid;not null;index" json:"user_id"`
	ParticipantID *string             `gorm:"type:uuid" json:"participant_id"`
	ReferenceType string              `gorm:"type:varchar(50);not null" json:"reference_type"`
	ReferenceID   string              `gorm:"type:varchar(100);not null;index" json:"reference_id"`
	Amount        float64             `gorm:"type:decimal(15,2);not null" json:"amount"`
	Currency      string              `gorm:"type:char(3);not null;default:'IDR'" json:"currency"`
	Status        PaymentIntentStatus `gorm:"type:varchar(30);not null;default:'REQUIRES_PAYMENT_METHOD'" json:"status"`
	Metadata      json.RawMessage     `gorm:"type:jsonb" json:"metadata"`
	ClientSecret  string              `gorm:"type:varchar(255)" json:"client_secret"` // For some gateways

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func NewPaymentIntent(userID string, amount float64, currency, refType, refID string, metadata map[string]interface{}) *PaymentIntent {
	metaJSON, _ := json.Marshal(metadata)
	return &PaymentIntent{
		ID:            uuid.NewString(), // Generate UUID manually if needed or let DB do it
		UserID:        userID,
		Amount:        amount,
		Currency:      currency,
		ReferenceType: refType,
		ReferenceID:   refID,
		Metadata:      metaJSON,
		Status:        PaymentIntentStatusRequiresMethod,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}
