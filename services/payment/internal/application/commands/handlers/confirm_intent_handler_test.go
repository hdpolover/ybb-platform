package handlers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/domain/services"
)

func TestConfirmIntentHandler_ReplaysCompletedIdempotentResponse(t *testing.T) {
	t.Parallel()

	intent := &entities.PaymentIntent{
		ID:       "intent-1",
		Amount:   150000,
		Currency: "IDR",
		Status:   entities.PaymentIntentStatusRequiresMethod,
	}
	method := &entities.PaymentMethodEntity{
		ID:          "method-1",
		Code:        "midtrans_cc",
		DisplayName: "Credit Card",
		IsActive:    true,
		Type:        entities.MethodTypeAutomatic,
		GatewayName: "midtrans",
	}
	requestHash := mustBuildHash(t, method.Code, "tok-1", nil, "Jane", "jane@example.com", "08123")
	storedResponse := &dto.ConfirmPaymentResponse{
		TransactionID: "txn-1",
		Status:        "PENDING",
		Action: &dto.PaymentActionDTO{
			Type: "redirect",
			URL:  "https://example.test/pay",
		},
	}
	rawResponse, err := json.Marshal(storedResponse)
	if err != nil {
		t.Fatalf("failed to marshal stored response: %v", err)
	}

	idempotencyRepo := &stubIdempotencyRepository{
		record: &entities.PaymentIdempotencyKey{
			IdempotencyKey: "idem-1",
			Scope:          "confirm_intent",
			ResourceID:     intent.ID,
			RequestHash:    requestHash,
			Status:         entities.PaymentIdempotencyStatusCompleted,
			ResponseBody:   rawResponse,
		},
	}
	gateway := &stubPaymentGateway{}
	handler := NewConfirmIntentHandler(
		&stubIntentRepository{intent: intent},
		&stubTransactionRepository{},
		&stubPaymentMethodRepository{method: method},
		idempotencyRepo,
		stubGatewayFactory{gateway: gateway},
		"midtrans",
	)

	resp, err := handler.Handle(context.Background(), &commands.ConfirmIntentCommand{
		IntentID:        intent.ID,
		PaymentMethodID: method.Code,
		GatewayToken:    "tok-1",
		IdempotencyKey:  "idem-1",
		CustomerName:    "Jane",
		CustomerEmail:   "jane@example.com",
		CustomerPhone:   "08123",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.TransactionID != storedResponse.TransactionID {
		t.Fatalf("expected transaction id %q, got %q", storedResponse.TransactionID, resp.TransactionID)
	}
	if gateway.chargeCalls != 0 {
		t.Fatalf("expected gateway not to be called, got %d calls", gateway.chargeCalls)
	}
	if idempotencyRepo.createCalls != 0 {
		t.Fatalf("expected no new idempotency record, got %d create calls", idempotencyRepo.createCalls)
	}
}

func TestConfirmIntentHandler_RejectsIdempotencyConflict(t *testing.T) {
	t.Parallel()

	intent := &entities.PaymentIntent{
		ID:       "intent-1",
		Amount:   150000,
		Currency: "IDR",
		Status:   entities.PaymentIntentStatusRequiresMethod,
	}
	method := &entities.PaymentMethodEntity{
		ID:          "method-1",
		Code:        "midtrans_cc",
		DisplayName: "Credit Card",
		IsActive:    true,
		Type:        entities.MethodTypeAutomatic,
		GatewayName: "midtrans",
	}
	handler := NewConfirmIntentHandler(
		&stubIntentRepository{intent: intent},
		&stubTransactionRepository{},
		&stubPaymentMethodRepository{method: method},
		&stubIdempotencyRepository{
			record: &entities.PaymentIdempotencyKey{
				IdempotencyKey: "idem-1",
				Scope:          "confirm_intent",
				ResourceID:     intent.ID,
				RequestHash:    "different-hash",
				Status:         entities.PaymentIdempotencyStatusCompleted,
			},
		},
		stubGatewayFactory{gateway: &stubPaymentGateway{}},
		"midtrans",
	)

	_, err := handler.Handle(context.Background(), &commands.ConfirmIntentCommand{
		IntentID:        intent.ID,
		PaymentMethodID: method.Code,
		GatewayToken:    "tok-1",
		IdempotencyKey:  "idem-1",
	})
	if err != exceptions.ErrIdempotencyConflict {
		t.Fatalf("expected ErrIdempotencyConflict, got %v", err)
	}
}

func TestConfirmIntentHandler_CompletesIdempotencyRecordOnSuccess(t *testing.T) {
	t.Parallel()

	intent := &entities.PaymentIntent{
		ID:       "intent-1",
		Amount:   150000,
		Currency: "IDR",
		Status:   entities.PaymentIntentStatusRequiresMethod,
	}
	method := &entities.PaymentMethodEntity{
		ID:          "method-1",
		Code:        "midtrans_cc",
		DisplayName: "Credit Card",
		IsActive:    true,
		Type:        entities.MethodTypeAutomatic,
		GatewayName: "midtrans",
	}
	idempotencyRepo := &stubIdempotencyRepository{}
	gateway := &stubPaymentGateway{
		chargeResponse: &gateways.ChargePaymentResponse{
			Status:             "PENDING",
			GatewayReferenceID: "gw-ref-1",
			ActionType:         "redirect",
			ActionURL:          "https://example.test/pay",
		},
	}
	txRepo := &stubTransactionRepository{}
	handler := NewConfirmIntentHandler(
		&stubIntentRepository{intent: intent},
		txRepo,
		&stubPaymentMethodRepository{method: method},
		idempotencyRepo,
		stubGatewayFactory{gateway: gateway},
		"midtrans",
	)

	resp, err := handler.Handle(context.Background(), &commands.ConfirmIntentCommand{
		IntentID:        intent.ID,
		PaymentMethodID: method.Code,
		GatewayToken:    "tok-1",
		IdempotencyKey:  "idem-1",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.TransactionID == "" {
		t.Fatal("expected transaction id to be set")
	}
	if idempotencyRepo.record == nil {
		t.Fatal("expected idempotency record to be created")
	}
	if idempotencyRepo.record.Status != entities.PaymentIdempotencyStatusCompleted {
		t.Fatalf("expected idempotency status completed, got %s", idempotencyRepo.record.Status)
	}
	if idempotencyRepo.record.TransactionID != resp.TransactionID {
		t.Fatalf("expected stored transaction id %q, got %q", resp.TransactionID, idempotencyRepo.record.TransactionID)
	}
	if len(idempotencyRepo.record.ResponseBody) == 0 {
		t.Fatal("expected response body to be stored")
	}
	if txRepo.createCalls != 1 {
		t.Fatalf("expected one transaction create call, got %d", txRepo.createCalls)
	}
}

func mustBuildHash(t *testing.T, methodCode, token string, details interface{}, name, email, phone string) string {
	t.Helper()
	hash, err := services.BuildIdempotencyRequestHash(map[string]interface{}{
		"payment_method_id": methodCode,
		"gateway_token":     token,
		"payment_details":   details,
		"customer_name":     name,
		"customer_email":    email,
		"customer_phone":    phone,
	})
	if err != nil {
		t.Fatalf("failed to build hash: %v", err)
	}
	return hash
}

type stubIntentRepository struct {
	intent  *entities.PaymentIntent
	updates int
}

func (r *stubIntentRepository) Create(ctx context.Context, intent *entities.PaymentIntent) error {
	return nil
}
func (r *stubIntentRepository) FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error) {
	return r.intent, nil
}
func (r *stubIntentRepository) FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error) {
	return nil, nil
}
func (r *stubIntentRepository) Update(ctx context.Context, intent *entities.PaymentIntent) error {
	r.intent = intent
	r.updates++
	return nil
}
func (r *stubIntentRepository) FindAll(ctx context.Context, filter repositories.PaymentIntentFilter) ([]*entities.PaymentIntent, int64, error) {
	return nil, 0, nil
}

type stubTransactionRepository struct {
	created     *entities.PaymentTransaction
	updated     *entities.PaymentTransaction
	createCalls int
	updateCalls int
}

func (r *stubTransactionRepository) Create(ctx context.Context, tx *entities.PaymentTransaction) error {
	r.created = tx
	r.createCalls++
	return nil
}
func (r *stubTransactionRepository) FindByID(ctx context.Context, id string) (*entities.PaymentTransaction, error) {
	return nil, nil
}
func (r *stubTransactionRepository) Update(ctx context.Context, tx *entities.PaymentTransaction) error {
	r.updated = tx
	r.updateCalls++
	return nil
}
func (r *stubTransactionRepository) FindByIntentID(ctx context.Context, intentID string) ([]*entities.PaymentTransaction, error) {
	return nil, nil
}
func (r *stubTransactionRepository) FindByGatewayReferenceID(ctx context.Context, refID string) (*entities.PaymentTransaction, error) {
	return nil, nil
}

type stubPaymentMethodRepository struct {
	method *entities.PaymentMethodEntity
}

func (r *stubPaymentMethodRepository) FindAll(ctx context.Context) ([]entities.PaymentMethodEntity, error) {
	return nil, nil
}
func (r *stubPaymentMethodRepository) FindByCode(ctx context.Context, code string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (r *stubPaymentMethodRepository) FindByID(ctx context.Context, id string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (r *stubPaymentMethodRepository) FindByCodeOrID(ctx context.Context, value string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (r *stubPaymentMethodRepository) Create(ctx context.Context, pm *entities.PaymentMethodEntity) error {
	return nil
}
func (r *stubPaymentMethodRepository) Update(ctx context.Context, pm *entities.PaymentMethodEntity) error {
	return nil
}
func (r *stubPaymentMethodRepository) Delete(ctx context.Context, id string) error { return nil }

type stubIdempotencyRepository struct {
	record      *entities.PaymentIdempotencyKey
	createCalls int
	updateCalls int
}

func (r *stubIdempotencyRepository) Create(ctx context.Context, record *entities.PaymentIdempotencyKey) error {
	r.record = record
	r.createCalls++
	return nil
}
func (r *stubIdempotencyRepository) FindByKey(ctx context.Context, key, scope string) (*entities.PaymentIdempotencyKey, error) {
	return r.record, nil
}
func (r *stubIdempotencyRepository) Update(ctx context.Context, record *entities.PaymentIdempotencyKey) error {
	r.record = record
	r.updateCalls++
	return nil
}

type stubGatewayFactory struct {
	gateway gateways.PaymentGateway
}

func (f stubGatewayFactory) GetGateway(name string) (gateways.PaymentGateway, error) {
	return f.gateway, nil
}

type stubPaymentGateway struct {
	chargeCalls    int
	chargeResponse *gateways.ChargePaymentResponse
	chargeErr      error
}

func (g *stubPaymentGateway) GetName() string { return "stub" }
func (g *stubPaymentGateway) CreatePayment(ctx context.Context, req *gateways.CreatePaymentRequest) (*gateways.CreatePaymentResponse, error) {
	return nil, nil
}
func (g *stubPaymentGateway) ChargePayment(ctx context.Context, req *gateways.ChargePaymentRequest) (*gateways.ChargePaymentResponse, error) {
	g.chargeCalls++
	if g.chargeErr != nil {
		return nil, g.chargeErr
	}
	if g.chargeResponse != nil {
		return g.chargeResponse, nil
	}
	return &gateways.ChargePaymentResponse{Status: "PENDING", GatewayReferenceID: "gw-ref"}, nil
}
func (g *stubPaymentGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	return nil, nil
}
func (g *stubPaymentGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	return nil, nil
}
func (g *stubPaymentGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	return nil
}
func (g *stubPaymentGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	return nil
}
