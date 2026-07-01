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
	IntentID      string                 `json:"intent_id,omitempty"`
	TransactionID string                 `json:"transaction_id,omitempty"`
	ApplicationID string                 `json:"application_id"`
	UserID        string                 `json:"user_id"`
	Email         string                 `json:"email"` // Added for Notification Service
	Amount        float64                `json:"amount"`
	Currency      string                 `json:"currency"`
	Status        string                 `json:"status"`
	GatewayName   string                 `json:"gateway_name"`
	Timestamp     time.Time              `json:"timestamp"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`

	// Settled financial breakdown, sourced from the PaymentTransaction row
	// (not the intent). AmountTotal is what the payer was actually charged;
	// Amount above stays intent-gross for backward compatibility with
	// existing consumers. TransactionCurrency is kept separate from
	// Currency because gateway settlement can convert currency (e.g. a USD
	// intent charged in IDR), so the two are not always equal.
	AmountTotal         float64 `json:"amount_total"`
	FeeProvider         float64 `json:"fee_provider"`
	NetAmount           float64 `json:"net_amount"`
	TransactionCurrency string  `json:"transaction_currency"`

	// PaymentMethodID is the specific method the transaction settled with
	// (e.g. "midtrans_cc", "manual_transfer", "bca_va"), sourced from
	// PaymentTransaction.PaymentMethodID. Distinct from GatewayName, which
	// historically has been (mis)populated with this same value by callers -
	// this field is the one consumers should read for the invoice's
	// payment_method column.
	PaymentMethodID string `json:"payment_method_id,omitempty"`
}

// NewPaymentEvent creates a new payment event. intentID and transactionID are
// optional; callers without an intent/transaction context should pass "".
// amountTotal, feeProvider, netAmount, transactionCurrency and
// paymentMethodID should be sourced from the settled PaymentTransaction
// entity; pass zero/empty values only when a genuine settled transaction is
// unavailable at the call site.
func NewPaymentEvent(
	eventType EventType,
	paymentID, intentID, transactionID, applicationID, userID, email string,
	amount float64,
	currency, status, gatewayName string,
	amountTotal, feeProvider, netAmount float64,
	transactionCurrency string,
	paymentMethodID string,
) *PaymentEvent {
	return &PaymentEvent{
		Type:                eventType,
		PaymentID:           paymentID,
		IntentID:            intentID,
		TransactionID:       transactionID,
		ApplicationID:       applicationID,
		UserID:              userID,
		Email:               email,
		Amount:              amount,
		Currency:            currency,
		Status:              status,
		GatewayName:         gatewayName,
		AmountTotal:         amountTotal,
		FeeProvider:         feeProvider,
		NetAmount:           netAmount,
		TransactionCurrency: transactionCurrency,
		PaymentMethodID:     paymentMethodID,
		Timestamp:           time.Now(),
		Metadata:            make(map[string]interface{}),
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
