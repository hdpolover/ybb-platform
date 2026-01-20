package gateways

import (
    "context"
    "fmt"

    "github.com/ybb-platform/payment/internal/domain/entities"
    domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

// ManualGateway handles manual bank transfers
type ManualGateway struct{}

func NewManualGateway() *ManualGateway {
    return &ManualGateway{}
}

// GetName returns the gateway identifier
func (g *ManualGateway) GetName() string {
    return "manual"
}

// CreatePayment handles the creation of a manual payment
func (g *ManualGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
    // Return instruksi transfer sederhana
    return &domainGateways.CreatePaymentResponse{
        RedirectURL:    "", // Tidak ada redirect untuk manual
        Token:          "",
        GatewayOrderID: req.Payment.ID,
        Raw: map[string]string{
            "instructions": "Silakan transfer ke Bank BCA 1234567890 a.n YBB, lalu upload bukti transfer.",
        },
    }, nil
}

// Fungsi-fungsi di bawah ini hanya pelengkap (Stub) agar tidak error
func (g *ManualGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
    return nil, fmt.Errorf("manual verification is done by admin")
}

func (g *ManualGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
    return nil, fmt.Errorf("manual payment has no webhook")
}

func (g *ManualGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
    fmt.Printf("[ManualGateway] Cancel request received for %s. No external action needed.\n", gatewayOrderID)
    return nil
}

func (g *ManualGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
    fmt.Printf("[ManualGateway] Refund request received for %s. Admin must transfer manually.\n", gatewayOrderID)
    return nil
}