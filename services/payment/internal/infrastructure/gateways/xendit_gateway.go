package gateways

import (
	"context"
	"fmt"
	"log"

	"github.com/xendit/xendit-go/v3"
	"github.com/xendit/xendit-go/v3/invoice"
	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

type XenditGateway struct {
	client *xendit.APIClient
}

func NewXenditGateway(apiKey string) *XenditGateway {
	client := xendit.NewClient(apiKey)
	return &XenditGateway{
		client: client,
	}
}

func (g *XenditGateway) GetName() string {
	return "xendit"
}

func (g *XenditGateway) ChargePayment(ctx context.Context, req *domainGateways.ChargePaymentRequest) (*domainGateways.ChargePaymentResponse, error) {
	payment := &entities.Payment{
		ID:            req.TransactionID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Description:   req.IntentID,
		CustomerEmail: req.CustomerDetails.Email,
	}

	createResp, err := g.CreatePayment(ctx, &domainGateways.CreatePaymentRequest{
		Payment:       payment,
		PaymentMethod: entities.PaymentMethod(req.PaymentMethodID),
		CallbackURL:   stringValue(req.PaymentDetails, "callback_url"),
		CustomerName:  req.CustomerDetails.Name,
		CustomerEmail: req.CustomerDetails.Email,
		CustomerPhone: req.CustomerDetails.Phone,
	})
	if err != nil {
		return nil, err
	}

	return &domainGateways.ChargePaymentResponse{
		Status:             "PENDING",
		GatewayReferenceID: createResp.GatewayOrderID,
		ActionType:         "redirect",
		ActionURL:          createResp.RedirectURL,
		Metadata: map[string]interface{}{
			"provider": "xendit",
			"token":    createResp.Token,
		},
	}, nil
}

// CreatePayment membuat Invoice Xendit
func (g *XenditGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
	// 1. Buat Request Invoice (Hanya Data Wajib)
	createInvoiceRequest := *invoice.NewCreateInvoiceRequest(
		req.Payment.ID,
		float32(req.Payment.Amount),
	)

	// 2. Set Data Optional (HANYA JIKA TIDAK KOSONG)
	// Xendit akan error jika kita maksa kirim string kosong "" sebagai email
	if req.CustomerEmail != "" {
		createInvoiceRequest.SetPayerEmail(req.CustomerEmail)
	}

	if req.Payment.Description != "" {
		createInvoiceRequest.SetDescription(req.Payment.Description)
	}

	// Cek Callback URL juga
	if req.CallbackURL != "" {
		createInvoiceRequest.SetSuccessRedirectUrl(req.CallbackURL)
		createInvoiceRequest.SetFailureRedirectUrl(req.CallbackURL)
	}

	// 3. Kirim ke Xendit
	resp, _, err := g.client.InvoiceApi.CreateInvoice(ctx).CreateInvoiceRequest(createInvoiceRequest).Execute()
	if err != nil {
		log.Printf("Xendit CreateInvoice Error: %v\n", err)
		return nil, fmt.Errorf("xendit error: %w", err)
	}

	// 4. Kembalikan URL Pembayaran
	return &domainGateways.CreatePaymentResponse{
		RedirectURL:    resp.InvoiceUrl,
		Token:          *resp.Id,
		GatewayOrderID: req.Payment.ID,
		Raw:            resp,
	}, nil
}

// ... (Fungsi Verify, Webhook, Cancel, Refund biarkan seperti yang kita bahas sebelumnya) ...
func (g *XenditGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (g *XenditGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (g *XenditGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	return nil
}

func (g *XenditGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	return fmt.Errorf("xendit invoice does not support direct refund via API")
}

func stringValue(values map[string]interface{}, key string) string {
	if values == nil {
		return ""
	}
	if value, ok := values[key].(string); ok {
		return value
	}
	return ""
}
