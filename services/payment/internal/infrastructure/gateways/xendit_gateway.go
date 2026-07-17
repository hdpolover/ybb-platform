package gateways

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/xendit/xendit-go/v3"
	"github.com/xendit/xendit-go/v3/invoice"
	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

// XenditCallbackTokenKey is the context key used to pass the x-callback-token header
// into the HandleWebhook method for signature verification.
type xenditContextKey string

const XenditCallbackTokenKey xenditContextKey = "xendit_callback_token"

type XenditGateway struct {
	client        *xendit.APIClient
	callbackToken string
}

func NewXenditGateway(apiKey, callbackToken string) *XenditGateway {
	client := xendit.NewClient(apiKey)
	return &XenditGateway{
		client:        client,
		callbackToken: callbackToken,
	}
}

func (g *XenditGateway) GetName() string {
	return "xendit"
}

// CreatePayment creates a Xendit Invoice (redirect/link flow).
func (g *XenditGateway) CreatePayment(ctx context.Context, req *domainGateways.CreatePaymentRequest) (*domainGateways.CreatePaymentResponse, error) {
	createInvoiceRequest := *invoice.NewCreateInvoiceRequest(
		req.Payment.ID,
		float32(req.Payment.Amount),
	)
	if req.Payment.Currency != "" {
		createInvoiceRequest.SetCurrency(strings.ToUpper(req.Payment.Currency))
	}

	if req.CustomerEmail != "" {
		createInvoiceRequest.SetPayerEmail(req.CustomerEmail)
	}
	if req.Payment.Description != "" {
		createInvoiceRequest.SetDescription(req.Payment.Description)
	}
	if req.CustomerName != "" {
		customer := invoice.NewCustomerObject()
		customer.SetGivenNames(req.CustomerName)
		if req.CustomerEmail != "" {
			customer.SetEmail(req.CustomerEmail)
		}
		createInvoiceRequest.SetCustomer(*customer)
	}
	if req.CallbackURL != "" {
		createInvoiceRequest.SetSuccessRedirectUrl(req.CallbackURL)
		createInvoiceRequest.SetFailureRedirectUrl(req.CallbackURL)
	}
	if methods := mapXenditInvoicePaymentMethods(req.PaymentMethod); len(methods) > 0 {
		createInvoiceRequest.SetPaymentMethods(methods)
	}

	resp, _, err := g.client.InvoiceApi.CreateInvoice(ctx).CreateInvoiceRequest(createInvoiceRequest).Execute()
	if err != nil {
		log.Printf("Xendit CreateInvoice Error: %v\n", err)
		return nil, fmt.Errorf("xendit create invoice failed: %w", err)
	}

	return &domainGateways.CreatePaymentResponse{
		RedirectURL:    resp.InvoiceUrl,
		Token:          *resp.Id,
		GatewayOrderID: req.Payment.ID,
		Raw:            resp,
	}, nil
}

// ChargePayment initiates an invoice-based payment (redirect flow) for Xendit.
func (g *XenditGateway) ChargePayment(ctx context.Context, req *domainGateways.ChargePaymentRequest) (*domainGateways.ChargePaymentResponse, error) {
	description := req.Description
	if description == "" {
		// Fallback so we never regress to an empty description.
		description = req.IntentID
	}

	payment := &entities.Payment{
		ID:            req.TransactionID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Description:   description,
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
		GatewayReferenceID: createResp.Token,
		ActionType:         "redirect",
		ActionURL:          createResp.RedirectURL,
		Metadata: map[string]interface{}{
			"provider":    "xendit",
			"token":       createResp.Token,
			"invoice_url": createResp.RedirectURL,
		},
	}, nil
}

// VerifyPayment fetches the current invoice status from Xendit by invoice ID.
func (g *XenditGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	resp, _, err := g.client.InvoiceApi.GetInvoiceById(ctx, gatewayOrderID).Execute()
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "404") || strings.Contains(strings.ToUpper(errStr), "NOT_FOUND") {
			return &entities.Payment{
				ID:              gatewayOrderID,
				Status:          entities.PaymentStatusPending,
				GatewayOrderID:  gatewayOrderID,
				GatewayResponse: map[string]interface{}{"status_message": "Invoice not found in Xendit"},
			}, nil
		}
		return nil, fmt.Errorf("xendit get invoice failed: %w", err)
	}

	var rawResponse map[string]interface{}
	if data, marshalErr := json.Marshal(resp); marshalErr == nil {
		_ = json.Unmarshal(data, &rawResponse)
	}

	statusStr, _ := rawResponse["status"].(string)
	externalID, _ := rawResponse["external_id"].(string)
	if externalID == "" {
		externalID = gatewayOrderID
	}

	return &entities.Payment{
		ID:              externalID,
		Status:          mapXenditInvoiceStatus(statusStr),
		GatewayOrderID:  gatewayOrderID,
		GatewayResponse: rawResponse,
	}, nil
}

// HandleWebhook processes Xendit invoice callback notifications.
// The caller (HTTP handler) must inject the x-callback-token header value into
// the context using XenditCallbackTokenKey before invoking this method.
func (g *XenditGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	// 1. Verify callback token
	if g.callbackToken != "" {
		ctxToken, _ := ctx.Value(XenditCallbackTokenKey).(string)
		if ctxToken != g.callbackToken {
			return nil, fmt.Errorf("invalid xendit callback token")
		}
	}

	// 2. Parse payload
	var notification map[string]interface{}
	if err := json.Unmarshal(payload, &notification); err != nil {
		return nil, fmt.Errorf("failed to parse xendit webhook payload: %w", err)
	}

	invoiceID, _ := notification["id"].(string)
	externalID, _ := notification["external_id"].(string)
	statusStr, _ := notification["status"].(string)

	// external_id is the order ID we sent when creating the invoice
	if externalID == "" {
		externalID = invoiceID
	}

	return &entities.Payment{
		ID:              externalID,
		Status:          mapXenditInvoiceStatus(statusStr),
		GatewayOrderID:  invoiceID,
		GatewayResponse: notification,
	}, nil
}

// CancelPayment expires a pending Xendit invoice so it can no longer be paid.
func (g *XenditGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	_, _, err := g.client.InvoiceApi.ExpireInvoice(ctx, gatewayOrderID).Execute()
	if err != nil {
		return fmt.Errorf("xendit expire invoice failed: %w", err)
	}
	return nil
}

// RefundPayment is not supported via the Xendit Invoice API.
// Refunds for Xendit must be processed manually through the Xendit dashboard.
func (g *XenditGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	return fmt.Errorf("xendit invoice refunds must be processed via the Xendit dashboard; direct API refunds are not supported for invoices")
}

// mapXenditInvoiceStatus maps Xendit invoice statuses to internal PaymentStatus values.
// Xendit statuses: PENDING, PAID, SETTLED, EXPIRED
func mapXenditInvoiceStatus(status string) entities.PaymentStatus {
	switch strings.ToUpper(status) {
	case "PAID", "SETTLED":
		return entities.PaymentStatusSuccess
	case "EXPIRED":
		return entities.PaymentStatusFailed
	default:
		return entities.PaymentStatusPending
	}
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

func mapXenditInvoicePaymentMethods(method entities.PaymentMethod) []string {
	code := strings.ToLower(strings.TrimSpace(string(method)))
	if code == "" {
		return nil
	}

	switch {
	case strings.Contains(code, "credit_card") || strings.HasSuffix(code, "_cc") || strings.Contains(code, "card"):
		return []string{"CREDIT_CARD"}
	case strings.Contains(code, "qris"):
		return []string{"QRIS"}
	case strings.Contains(code, "bca"):
		return []string{"BCA"}
	case strings.Contains(code, "bni"):
		return []string{"BNI"}
	case strings.Contains(code, "bri"):
		return []string{"BRI"}
	case strings.Contains(code, "mandiri"):
		return []string{"MANDIRI"}
	case strings.Contains(code, "permata"):
		return []string{"PERMATA"}
	case strings.Contains(code, "ovo"):
		return []string{"OVO"}
	case strings.Contains(code, "dana"):
		return []string{"DANA"}
	case strings.Contains(code, "linkaja"):
		return []string{"LINKAJA"}
	case strings.Contains(code, "shopeepay"):
		return []string{"SHOPEEPAY"}
	case strings.Contains(code, "alfamart"):
		return []string{"ALFAMART"}
	case strings.Contains(code, "indomaret"):
		return []string{"INDOMARET"}
	default:
		return nil
	}
}
