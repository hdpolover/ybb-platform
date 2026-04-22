package gateways

import (
	"context"
	"fmt"
	"log"

	"github.com/plutov/paypal/v4"
	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

type PayPalGateway struct {
	client *paypal.Client
}

func NewPayPalGateway(clientID, secret, mode string) (*PayPalGateway, error) {
	// Tentukan Base URL (Sandbox atau Live)
	apiBase := paypal.APIBaseSandBox
	if mode == "live" {
		apiBase = paypal.APIBaseLive
	}

	// Inisialisasi Client
	c, err := paypal.NewClient(clientID, secret, apiBase)
	if err != nil {
		return nil, fmt.Errorf("create PayPal client: %w", err)
	}

	// Ambil Access Token pertama kali
	_, err = c.GetAccessToken(context.Background())
	if err != nil {
		log.Printf("Error getting PayPal access token: %v", err)
	}

	return &PayPalGateway{
		client: c,
	}, nil
}

func (g *PayPalGateway) GetName() string {
	return "paypal"
}

func (g *PayPalGateway) ChargePayment(ctx context.Context, req *domainGateways.ChargePaymentRequest) (*domainGateways.ChargePaymentResponse, error) {
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
		CallbackURL:   paypalStringValue(req.PaymentDetails, "callback_url"),
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
			"provider": "paypal",
			"token":    createResp.Token,
		},
	}, nil
}

func (g *PayPalGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
	// 1. Setup URL
	returnURL := req.CallbackURL
	if returnURL == "" {
		returnURL = "https://google.com"
	}
	cancelURL := returnURL // Sederhananya kita arahkan ke tempat sama dulu

	// 2. Format Amount
	// PayPal butuh string decimal. Contoh: 50000 -> "50000.00"
	// BEDA DENGAN STRIPE. Jangan dikali 100.
	amountStr := fmt.Sprintf("%.2f", req.Payment.Amount)

	// 3. Buat Purchase Unit
	purchaseUnit := paypal.PurchaseUnitRequest{
		ReferenceID: req.Payment.ID,
		Description: req.Payment.Description,
		Amount: &paypal.PurchaseUnitAmount{
			Currency: req.Payment.Currency, // "USD" atau "IDR" (Perhatian: PayPal kadang membatasi IDR di akun luar)
			Value:    amountStr,
		},
	}

	// 4. Buat Order
	order, err := g.client.CreateOrder(ctx, paypal.OrderIntentCapture, []paypal.PurchaseUnitRequest{purchaseUnit}, &paypal.PaymentSource{
		Paypal: &paypal.PaymentSourcePaypal{
			// PERBAIKAN: Isi field optional dengan nilai default agar tidak error validasi
			ExperienceContext: paypal.PaymentSourcePaypalExperienceContext{
				ReturnURL:               returnURL,
				CancelURL:               cancelURL,
				UserAction:              "PAY_NOW",
				PaymentMethodPreference: "IMMEDIATE_PAYMENT_REQUIRED",
				BrandName:               "YBB Platform", // Ganti dengan nama aplikasi Anda
				Locale:                  "en-US",        // Wajib format xx-YY
				LandingPage:             "LOGIN",
				ShippingPreference:      "NO_SHIPPING", // Agar user tidak ditanya alamat pengiriman
			},
		},
	}, nil)

	if err != nil {
		log.Printf("PayPal CreateOrder Failed: %v", err)
		return nil, fmt.Errorf("paypal error: %w", err)
	}

	// 5. Cari Link Approval (HREF untuk user redirect)
	var redirectURL string
	for _, link := range order.Links {
		if link.Rel == "payer-action" || link.Rel == "approve" {
			redirectURL = link.Href
			break
		}
	}

	if redirectURL == "" {
		return nil, fmt.Errorf("paypal error: no approval link found")
	}

	return &domainGateways.CreatePaymentResponse{
		RedirectURL:    redirectURL,
		Token:          order.ID, // Order ID PayPal
		GatewayOrderID: order.ID,
		Raw:            order,
	}, nil
}

// TODO: Implement Verify, Webhook later
func (g *PayPalGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (g *PayPalGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (g *PayPalGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	return nil
}

func (g *PayPalGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	return fmt.Errorf("not implemented yet")
}

func paypalStringValue(values map[string]interface{}, key string) string {
	if values == nil {
		return ""
	}
	if value, ok := values[key].(string); ok {
		return value
	}
	return ""
}
