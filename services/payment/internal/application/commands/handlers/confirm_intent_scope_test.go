// services/payment/internal/application/commands/handlers/confirm_intent_scope_test.go
package handlers

import (
	"context"
	"errors"
	"testing"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/gateways"
)

// scopeFactory records what Resolve was asked and returns a canned result.
type scopeFactory struct {
	stubGatewayFactory
	configID   *string
	err        error
	gotProgram string
	gotBrand   string
}

func (f *scopeFactory) Resolve(_, programID, brandID string) (gateways.PaymentGateway, *string, error) {
	f.gotProgram, f.gotBrand = programID, brandID
	return f.gateway, f.configID, f.err
}

func newScopeConfirmHandler(factory gateways.GatewayFactory, metadata string, txRepo *stubTransactionRepository) (*ConfirmIntentHandler, *entities.PaymentIntent) {
	intent := &entities.PaymentIntent{
		ID: "intent-1", Amount: 150000, Currency: "IDR",
		Status:   entities.PaymentIntentStatusRequiresMethod,
		Metadata: []byte(metadata),
	}
	method := &entities.PaymentMethodEntity{
		ID: "method-1", Code: "xendit_invoice", IsActive: true,
		Type: entities.MethodTypeAutomatic, GatewayName: "xendit",
	}
	return NewConfirmIntentHandler(
		&stubIntentRepository{intent: intent}, txRepo,
		&stubPaymentMethodRepository{method: method}, nil, factory, "xendit",
	), intent
}

func TestConfirmIntentHandler_PinsScopedGatewayConfig(t *testing.T) {
	t.Parallel()

	cfgID := "cfg-prog"
	gw := &stubPaymentGateway{}
	factory := &scopeFactory{stubGatewayFactory: stubGatewayFactory{gateway: gw}, configID: &cfgID}
	txRepo := &stubTransactionRepository{}
	handler, intent := newScopeConfirmHandler(factory, `{"program_id":"p1","brand_id":"b1"}`, txRepo)

	if _, err := handler.Handle(context.Background(), &commands.ConfirmIntentCommand{IntentID: intent.ID, PaymentMethodID: "xendit_invoice"}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if factory.gotProgram != "p1" || factory.gotBrand != "b1" {
		t.Fatalf("Resolve got (%q,%q), want (p1,b1)", factory.gotProgram, factory.gotBrand)
	}
	if txRepo.created == nil || txRepo.created.GatewayConfigID == nil || *txRepo.created.GatewayConfigID != cfgID {
		t.Fatalf("expected tx pinned to %q, got %+v", cfgID, txRepo.created)
	}
	if gw.chargeCalls != 1 {
		t.Fatalf("expected resolved gateway charged once, got %d", gw.chargeCalls)
	}
}

func TestConfirmIntentHandler_GlobalGatewayLeavesConfigIDNil(t *testing.T) {
	t.Parallel()

	factory := &scopeFactory{stubGatewayFactory: stubGatewayFactory{gateway: &stubPaymentGateway{}}}
	txRepo := &stubTransactionRepository{}
	handler, intent := newScopeConfirmHandler(factory, `{"customer_name":"A"}`, txRepo)

	if _, err := handler.Handle(context.Background(), &commands.ConfirmIntentCommand{IntentID: intent.ID, PaymentMethodID: "xendit_invoice"}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if txRepo.created == nil || txRepo.created.GatewayConfigID != nil {
		t.Fatalf("expected nil GatewayConfigID, got %+v", txRepo.created)
	}
}

func TestConfirmIntentHandler_ResolveErrorCreatesNoTransaction(t *testing.T) {
	t.Parallel()

	factory := &scopeFactory{stubGatewayFactory: stubGatewayFactory{gateway: &stubPaymentGateway{}}, err: errors.New("no gateway")}
	txRepo := &stubTransactionRepository{}
	handler, intent := newScopeConfirmHandler(factory, `{"program_id":"p1"}`, txRepo)

	if _, err := handler.Handle(context.Background(), &commands.ConfirmIntentCommand{IntentID: intent.ID, PaymentMethodID: "xendit_invoice"}); err == nil {
		t.Fatal("expected resolve error")
	}
	if txRepo.createCalls != 0 {
		t.Fatalf("expected no transaction created, got %d", txRepo.createCalls)
	}
}
