package gateways

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

func TestMidtransHandleWebhookRejectsInvalidSignature(t *testing.T) {
	gateway := NewMidtransGateway("server-key", "client-key", "sandbox")
	payload := []byte(`{"order_id":"order-1","status_code":"200","gross_amount":"150000.00","signature_key":"invalid","transaction_status":"settlement","fraud_status":"accept"}`)

	_, err := gateway.HandleWebhook(context.Background(), payload)
	if err == nil {
		t.Fatal("expected invalid signature error")
	}
}

func TestMidtransHandleWebhookReturnsMappedSuccessStatus(t *testing.T) {
	serverKey := "server-key"
	gateway := NewMidtransGateway(serverKey, "client-key", "sandbox")
	orderID := "order-1"
	statusCode := "200"
	grossAmount := "150000.00"
	hash := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	signature := hex.EncodeToString(hash[:])
	payload := []byte(fmt.Sprintf(`{"order_id":"%s","status_code":"%s","gross_amount":"%s","signature_key":"%s","transaction_status":"settlement","fraud_status":"accept"}`,
		orderID, statusCode, grossAmount, signature,
	))

	payment, err := gateway.HandleWebhook(context.Background(), payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payment.Status != entities.PaymentStatusSuccess {
		t.Fatalf("expected success status, got %s", payment.Status)
	}
	if payment.GatewayOrderID != orderID {
		t.Fatalf("expected gateway order id %q, got %q", orderID, payment.GatewayOrderID)
	}
}
