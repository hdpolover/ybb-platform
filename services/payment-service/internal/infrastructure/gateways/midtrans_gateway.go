package gateways

import (
	"context"
	"fmt"
	"log"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment-service/internal/domain/gateways"
)

// MidtransGateway implements PaymentGateway for Midtrans
type MidtransGateway struct {
	client    snap.Client
	serverKey string
	env       string
}

// NewMidtransGateway creates a new Midtrans payment gateway
func NewMidtransGateway(serverKey, clientKey, env string) *MidtransGateway {
	var midtransEnv midtrans.EnvironmentType
	if env == "production" {
		midtransEnv = midtrans.Production
	} else {
		midtransEnv = midtrans.Sandbox
	}

	client := snap.Client{}
	client.New(serverKey, midtransEnv)

	return &MidtransGateway{
		client:    client,
		serverKey: serverKey,
		env:       env,
	}
}

// GetName returns the gateway name
func (g *MidtransGateway) GetName() string {
	return "midtrans"
}

// CreatePayment creates a payment with Midtrans Snap
func (g *MidtransGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
	// Build Snap request
	snapReq := &snap.Request{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  req.Payment.ID,
			GrossAmt: int64(req.Payment.Amount),
		},
		CustomerDetail: &midtrans.CustomerDetails{
			FName: req.CustomerName,
			Email: req.CustomerEmail,
			Phone: req.CustomerPhone,
		},
		EnabledPayments: []snap.SnapPaymentType{
			snap.SnapPaymentType(req.PaymentMethod),
		},
		Callbacks: &snap.Callbacks{
			Finish: req.CallbackURL,
		},
	}

	// Create transaction
	// TODO for intern: Handle this properly with error handling
	snapResp, err := g.client.CreateTransaction(snapReq)
	if err != nil {
		log.Printf("Midtrans CreateTransaction failed: %v", err)
		return nil, fmt.Errorf("midtrans create transaction failed: %w", err)
	}

	return &domainGateways.CreatePaymentResponse{
		RedirectURL:    snapResp.RedirectURL,
		Token:          snapResp.Token,
		GatewayOrderID: req.Payment.ID, // Midtrans uses our order ID
		Raw:            snapResp,
	}, nil
}

// VerifyPayment verifies payment status with Midtrans
// TODO for intern: Implement this using Midtrans Core API
func (g *MidtransGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	// TODO: Use Midtrans Core API to get transaction status
	// coreapi := coreapi.Client{}
	// coreapi.New(g.serverKey, midtransEnv)
	// transactionStatusResp, err := coreapi.CheckTransaction(gatewayOrderID)

	log.Printf("TODO: Verify payment with Midtrans for order ID: %s", gatewayOrderID)
	return nil, fmt.Errorf("not implemented")
}

// HandleWebhook processes Midtrans webhook notification
// TODO for intern: Implement webhook handling with signature verification
func (g *MidtransGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	// TODO: Parse webhook payload
	// TODO: Verify signature
	// TODO: Update payment status based on transaction_status

	log.Printf("TODO: Handle Midtrans webhook")
	return nil, fmt.Errorf("not implemented")
}

// CancelPayment cancels a payment
// TODO for intern: Implement cancellation
func (g *MidtransGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	log.Printf("TODO: Cancel payment with Midtrans for order ID: %s", gatewayOrderID)
	return fmt.Errorf("not implemented")
}

// RefundPayment refunds a payment
// TODO for intern: Implement refund
func (g *MidtransGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	log.Printf("TODO: Refund payment with Midtrans for order ID: %s, amount: %.2f", gatewayOrderID, amount)
	return fmt.Errorf("not implemented")
}
