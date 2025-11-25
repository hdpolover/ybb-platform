package events

import (
	"encoding/json"
	"time"
)

// EventType represents the type of payment event
type EventType string

const (
	PaymentCreatedEvent   EventType = "payment.created"
	PaymentSucceededEvent EventType = "payment.succeeded"
	PaymentFailedEvent    EventType = "payment.failed"
	PaymentCancelledEvent EventType = "payment.cancelled"
	PaymentRefundedEvent  EventType = "payment.refunded"
)

// PaymentEvent represents a domain event related to payment
type PaymentEvent struct {
	ID            string                 `json:"id"`
	Type          EventType              `json:"type"`
	PaymentID     string                 `json:"payment_id"`
	ApplicationID string                 `json:"application_id"`
	UserID        string                 `json:"user_id"`
	Amount        float64                `json:"amount"`
	Currency      string                 `json:"currency"`
	Status        string                 `json:"status"`
	GatewayName   string                 `json:"gateway_name"`
	Timestamp     time.Time              `json:"timestamp"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// NewPaymentEvent creates a new payment event
func NewPaymentEvent(eventType EventType, paymentID, applicationID, userID string, amount float64, currency, status, gatewayName string) *PaymentEvent {
	return &PaymentEvent{
		ID:            "", // Will be set by event publisher
		Type:          eventType,
		PaymentID:     paymentID,
		ApplicationID: applicationID,
		UserID:        userID,
		Amount:        amount,
		Currency:      currency,
		Status:        status,
		GatewayName:   gatewayName,
		Timestamp:     time.Now(),
		Metadata:      make(map[string]interface{}),
	}
}

// ToJSON converts the event to JSON
func (e *PaymentEvent) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

// FromJSON creates an event from JSON
func FromJSON(data []byte) (*PaymentEvent, error) {
	var event PaymentEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, err
	}
	return &event, nil
}
