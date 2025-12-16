package gateways

import (
	"context"
	"fmt"
	"log"
	"crypto/sha512"
	"encoding/hex" 
	"encoding/json"

	// "github.com/midtrans/midtrans-go/coreapi"
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
	// 1. Parse JSON Payload
	var notification map[string]interface{}
	if err := json.Unmarshal(payload, &notification); err != nil {
		return nil, fmt.Errorf("failed to unmarshal notification: %w", err)
	}

	// 2. Ambil data penting
	orderID, _ := notification["order_id"].(string)
	statusCode, _ := notification["status_code"].(string)
	grossAmount, _ := notification["gross_amount"].(string)
	signatureKey, _ := notification["signature_key"].(string)
	transactionStatus, _ := notification["transaction_status"].(string)
	fraudStatus, _ := notification["fraud_status"].(string)

	// 3. Verifikasi Signature (Security Check)
	// Rumus Midtrans: SHA512(order_id + status_code + gross_amount + ServerKey)
	rawString := orderID + statusCode + grossAmount + g.serverKey
	hasher := sha512.New()
	hasher.Write([]byte(rawString))
	expectedSignature := hex.EncodeToString(hasher.Sum(nil))

	// Jika signature tidak cocok, tolak request
	if signatureKey != expectedSignature {
		return nil, fmt.Errorf("invalid signature key")
	}

	// 4. Translate Status Midtrans ke Status Aplikasi
	var paymentStatus entities.PaymentStatus

	switch transactionStatus {
	case "capture":
		switch fraudStatus {
		case "challenge":
			paymentStatus = entities.PaymentStatusProcessing
		case "accept":
			paymentStatus = entities.PaymentStatusSuccess
		}
	case "settlement":
		paymentStatus = entities.PaymentStatusSuccess
	case "deny", "cancel", "expire":
		paymentStatus = entities.PaymentStatusFailed
	case "pending":
		paymentStatus = entities.PaymentStatusPending
	default:
		paymentStatus = entities.PaymentStatusProcessing
	}

	// 5. Return struct payment yang berisi status baru
	return &entities.Payment{
		ID:              orderID,
		Status:          paymentStatus,
		GatewayOrderID:  orderID,
		GatewayResponse: notification,
	}, nil
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
