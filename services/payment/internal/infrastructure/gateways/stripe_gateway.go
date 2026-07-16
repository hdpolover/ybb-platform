package gateways

import (
	"context"
	"fmt"
	"log"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

type StripeGateway struct {
	apiKey string
}

func NewStripeGateway(apiKey string) *StripeGateway {
	// Konfigurasi global Stripe
	stripe.Key = apiKey
	return &StripeGateway{
		apiKey: apiKey,
	}
}

func (g *StripeGateway) GetName() string {
	return "stripe"
}

func (g *StripeGateway) ChargePayment(ctx context.Context, req *domainGateways.ChargePaymentRequest) (*domainGateways.ChargePaymentResponse, error) {
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
		CallbackURL:   stripeStringValue(req.PaymentDetails, "callback_url"),
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
			"provider": "stripe",
			"token":    createResp.Token,
		},
	}, nil
}

func (g *StripeGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
	// 1. Setup URL (Defensive)
	successURL := req.CallbackURL
	if successURL == "" {
		successURL = "https://google.com"
	}

	// 2. Setup Nama Produk (Defensive)
	productName := req.Payment.Description
	if productName == "" {
		productName = fmt.Sprintf("Order %s", req.Payment.ID)
	}

	// 3. Konversi Amount ke "Cents" (Satuan Terkecil)
	// PENTING: Stripe menganggap IDR punya 2 desimal.
	// Input 50000 harus dikirim sebagai 5000000 agar terbaca Rp 50.000
	stripeAmount := int64(req.Payment.Amount * 100)

	// 4. Siapkan Parameter Checkout Session
	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(req.Payment.Currency),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(productName),
					},
					// PERBAIKAN: Gunakan nilai yang sudah dikali 100
					UnitAmount: stripe.Int64(stripeAmount),
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode:              stripe.String(string(stripe.CheckoutSessionModePayment)),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(successURL),
		ClientReferenceID: stripe.String(req.Payment.ID),
		CustomerEmail:     stripe.String(req.CustomerEmail),
	}

	// 5. Buat Session
	sess, err := session.New(params)
	if err != nil {
		log.Printf("Stripe Session Creation Failed: %v", err)
		return nil, fmt.Errorf("stripe error: %w", err)
	}

	return &domainGateways.CreatePaymentResponse{
		RedirectURL:    sess.URL,
		Token:          sess.ID,
		GatewayOrderID: sess.ID,
		Raw:            sess,
	}, nil
}

// TODO: Implement Verify, Webhook, Cancel, Refund later
func (g *StripeGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (g *StripeGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (g *StripeGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	return nil
}

func (g *StripeGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	return fmt.Errorf("not implemented yet")
}

func stripeStringValue(values map[string]interface{}, key string) string {
	if values == nil {
		return ""
	}
	if value, ok := values[key].(string); ok {
		return value
	}
	return ""
}
