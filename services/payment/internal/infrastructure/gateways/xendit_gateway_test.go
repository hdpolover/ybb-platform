package gateways

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

type xenditRoundTripFunc func(*http.Request) (*http.Response, error)

func (f xenditRoundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

const xenditInvoiceResponse = `{
	"id": "xendit-inv-123",
	"external_id": "captured-by-test",
	"user_id": "user-1",
	"status": "PENDING",
	"merchant_name": "YBB",
	"merchant_profile_picture_url": "https://example.test/logo.png",
	"amount": 15,
	"expiry_date": "2027-01-01T00:00:00Z",
	"invoice_url": "https://checkout.xendit.co/web/abc",
	"available_banks": [],
	"available_retail_outlets": [],
	"available_ewallets": [],
	"available_qr_codes": [],
	"available_direct_debits": [],
	"available_paylaters": [],
	"should_send_email": false,
	"created": "2026-01-01T00:00:00Z",
	"updated": "2026-01-01T00:00:00Z"
}`

// captureXenditRequest swaps the transport the Xendit SDK uses (it builds on
// http.DefaultClient) so the outgoing invoice payload can be asserted.
func captureXenditRequest(t *testing.T, captured *map[string]interface{}) {
	t.Helper()

	original := http.DefaultClient.Transport
	t.Cleanup(func() { http.DefaultClient.Transport = original })

	http.DefaultClient.Transport = xenditRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(body, captured); err != nil {
			return nil, err
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(xenditInvoiceResponse)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Request:    r,
		}, nil
	})
}

func chargeRequest() *domainGateways.ChargePaymentRequest {
	return &domainGateways.ChargePaymentRequest{
		TransactionID:   "1430cc0d-085d-46c3-9dfa-a3681075106d",
		IntentID:        "e6d69d6a-efc0-4c43-93f7-2f2ea97d587f",
		Description:     "Registration Fee (Fully Funded) - Istanbul Youth Summit 2027 (USD 15.00)",
		Amount:          15,
		Currency:        "USD",
		PaymentMethodID: "credit_card",
		CustomerDetails: domainGateways.CustomerDetails{
			Name:  "Natnael Mesfin Mengistu",
			Email: "payer@example.test",
		},
	}
}

// The webhook resolves a transaction with FindByID(external_id) against a uuid
// column, so external_id must stay the raw transaction UUID. Anything else
// errors the lookup and silently strands the payment as unpaid.
func TestXenditChargePaymentSendsTransactionIDAsExternalID(t *testing.T) {
	var captured map[string]interface{}
	captureXenditRequest(t, &captured)

	req := chargeRequest()
	if _, err := NewXenditGateway("test-key", "cb-token").ChargePayment(context.Background(), req); err != nil {
		t.Fatalf("ChargePayment returned error: %v", err)
	}

	if got := captured["external_id"]; got != req.TransactionID {
		t.Fatalf("external_id must be the raw transaction UUID, got %v want %v", got, req.TransactionID)
	}
}

func TestXenditChargePaymentSendsHumanReadableDescription(t *testing.T) {
	var captured map[string]interface{}
	captureXenditRequest(t, &captured)

	req := chargeRequest()
	if _, err := NewXenditGateway("test-key", "cb-token").ChargePayment(context.Background(), req); err != nil {
		t.Fatalf("ChargePayment returned error: %v", err)
	}

	if got := captured["description"]; got != req.Description {
		t.Fatalf("description = %v, want %v", got, req.Description)
	}
	if captured["description"] == req.IntentID {
		t.Fatal("description must not fall back to the intent UUID when one is supplied")
	}

	customer, ok := captured["customer"].(map[string]interface{})
	if !ok {
		t.Fatalf("customer object missing from payload: %v", captured["customer"])
	}
	if got := customer["given_names"]; got != req.CustomerDetails.Name {
		t.Fatalf("customer.given_names = %v, want %v", got, req.CustomerDetails.Name)
	}
}

func TestXenditChargePaymentFallsBackToIntentIDWhenDescriptionEmpty(t *testing.T) {
	var captured map[string]interface{}
	captureXenditRequest(t, &captured)

	req := chargeRequest()
	req.Description = ""
	if _, err := NewXenditGateway("test-key", "cb-token").ChargePayment(context.Background(), req); err != nil {
		t.Fatalf("ChargePayment returned error: %v", err)
	}

	if got := captured["description"]; got != req.IntentID {
		t.Fatalf("description fallback = %v, want %v", got, req.IntentID)
	}
}

// gateway_reference_id must hold Xendit's own invoice id so the webhook's
// FindByGatewayReferenceID fallback can resolve a transaction.
func TestXenditChargePaymentReturnsXenditInvoiceIDAsGatewayReference(t *testing.T) {
	var captured map[string]interface{}
	captureXenditRequest(t, &captured)

	resp, err := NewXenditGateway("test-key", "cb-token").ChargePayment(context.Background(), chargeRequest())
	if err != nil {
		t.Fatalf("ChargePayment returned error: %v", err)
	}

	if resp.GatewayReferenceID != "xendit-inv-123" {
		t.Fatalf("GatewayReferenceID = %q, want the Xendit invoice id %q", resp.GatewayReferenceID, "xendit-inv-123")
	}
	if resp.Metadata["token"] != "xendit-inv-123" {
		t.Fatalf("metadata token = %v, want the Xendit invoice id", resp.Metadata["token"])
	}
}

// Without a configured callback token there is nothing to authenticate the
// caller against, so the webhook must be rejected instead of trusted.
func TestXenditHandleWebhookRejectsWhenCallbackTokenNotConfigured(t *testing.T) {
	ctx := context.WithValue(context.Background(), XenditCallbackTokenKey, "whatever")

	payment, err := NewXenditGateway("test-key", "").HandleWebhook(ctx, []byte(`{"id":"inv-1","status":"PAID"}`))
	if err == nil {
		t.Fatalf("expected an error for an unconfigured callback token, got payment %+v", payment)
	}
}
