package gateways

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

// CreatePaymentRequest represents the request to create a payment
type CreatePaymentRequest struct {
	Payment       *entities.Payment
	PaymentMethod entities.PaymentMethod
	CallbackURL   string
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
}

// CreatePaymentResponse represents the response from creating a payment
type CreatePaymentResponse struct {
	RedirectURL    string      // URL to redirect user for payment
	Token          string      // Payment token if applicable
	GatewayOrderID string      // Order ID from the gateway
	Raw            interface{} // Raw response from gateway
}

type PaymentStatusResponse struct {
	Status         string // "success", "failed", "pending"
	GatewayOrderID string
	OriginalStatus string // Status asli dari Midtrans (misal: "settlement")
}

type CustomerDetails struct {
	Name  string
	Email string
	Phone string
}

type ItemDetails struct {
	ID       string
	Name     string
	Price    int64
	Quantity int32
}

type ChargePaymentRequest struct {
	TransactionID   string // Unique ID for this attempt (OrderID in Midtrans)
	IntentID        string
	Description     string // Human-readable description shown on the gateway dashboard
	Amount          float64
	Currency        string
	PaymentMethodID string                 // "bca_va", "credit_card", "gopay"
	GatewayToken    string                 // Token from JS SDK (for CC)
	PaymentDetails  map[string]interface{} // Extra details like bank specific params
	CustomerDetails CustomerDetails
	Items           []ItemDetails
}

type ChargePaymentResponse struct {
	Status             string // "PENDING", "SUCCESS", "FAILED"
	GatewayReferenceID string
	ActionType         string // "redirect", "display_qr", "none"
	ActionURL          string // If redirect
	QRCodeString       string // If QR
	Metadata           map[string]interface{}
}

// PaymentGateway defines the interface that all payment gateways must implement
// This allows easy addition of new payment gateways (Stripe, PayPal, etc.)
// TODO for intern: Implement this interface for each payment gateway
type PaymentGateway interface {
	// GetName returns the name of the payment gateway (e.g., "midtrans", "stripe")
	GetName() string

	// CreatePayment initiates a payment transaction (Snap/Redirect style)
	CreatePayment(ctx context.Context, req *CreatePaymentRequest) (*CreatePaymentResponse, error)

	// ChargePayment processes a direct charge (Core API style)
	ChargePayment(ctx context.Context, req *ChargePaymentRequest) (*ChargePaymentResponse, error)

	// VerifyPayment verifies the payment status with the gateway
	VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error)

	// HandleWebhook processes webhook notifications from the gateway
	HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error)

	// CancelPayment cancels a pending payment
	CancelPayment(ctx context.Context, gatewayOrderID string) error

	// RefundPayment refunds a successful payment
	RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error
}

// GatewayFactory creates payment gateway instances
// TODO for intern: Register new gateways in the factory
type GatewayFactory interface {
	GetGateway(name string) (PaymentGateway, error)
}
