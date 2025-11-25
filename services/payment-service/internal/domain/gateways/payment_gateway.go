package gateways

import (
	"context"

	"github.com/ybb-platform/payment-service/internal/domain/entities"
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

// PaymentGateway defines the interface that all payment gateways must implement
// This allows easy addition of new payment gateways (Stripe, PayPal, etc.)
// TODO for intern: Implement this interface for each payment gateway
type PaymentGateway interface {
	// GetName returns the name of the payment gateway (e.g., "midtrans", "stripe")
	GetName() string

	// CreatePayment initiates a payment transaction
	CreatePayment(ctx context.Context, req *CreatePaymentRequest) (*CreatePaymentResponse, error)

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
