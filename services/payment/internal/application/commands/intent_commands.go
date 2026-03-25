package commands

import "encoding/json"

type CreateIntentCommand struct {
	UserID        string
	ParticipantID string
	ReferenceType string
	ReferenceID   string
	Amount        float64
	Currency      string
	Metadata      map[string]interface{}
	ExchangeRate  *float64
}

type ConfirmIntentCommand struct {
	IntentID        string
	PaymentMethodID string
	GatewayToken    string
	IdempotencyKey  string
	PaymentDetails  json.RawMessage
	IpAddress       string
	UserAgent       string
	// Customer Info (Required for some Gateways)
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
}
