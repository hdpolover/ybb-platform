// services/payment/internal/infrastructure/grpc/process_payment_description_test.go
package grpc

import (
	"context"
	"errors"
	"testing"

	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
)

// capturingGateway records the ChargePaymentRequest and fails the charge so
// ProcessPayment returns right after the gateway call.
type capturingGateway struct {
	domainGateways.PaymentGateway
	got *domainGateways.ChargePaymentRequest
}

func (g *capturingGateway) GetName() string { return "xendit" }
func (g *capturingGateway) ChargePayment(_ context.Context, req *domainGateways.ChargePaymentRequest) (*domainGateways.ChargePaymentResponse, error) {
	g.got = req
	return nil, errors.New("stop after capture")
}

type singleGatewayFactory struct{ gw domainGateways.PaymentGateway }

func (f singleGatewayFactory) GetGateway(string) (domainGateways.PaymentGateway, error) {
	return f.gw, nil
}
func (f singleGatewayFactory) Resolve(string, string, string) (domainGateways.PaymentGateway, *string, error) {
	return f.gw, nil, nil
}
func (f singleGatewayFactory) GetGatewayByConfigID(string) (domainGateways.PaymentGateway, string, error) {
	return f.gw, "", nil
}

type stubIntentByID struct {
	stubIntentRepository
	intent *entities.PaymentIntent
}

func (r *stubIntentByID) FindByID(context.Context, string) (*entities.PaymentIntent, error) {
	return r.intent, nil
}

type stubTxRepository struct{}

func (stubTxRepository) Create(context.Context, *entities.PaymentTransaction) error { return nil }
func (stubTxRepository) Update(context.Context, *entities.PaymentTransaction) error { return nil }
func (stubTxRepository) FindByID(context.Context, string) (*entities.PaymentTransaction, error) {
	return nil, nil
}
func (stubTxRepository) FindByIntentID(context.Context, string) ([]*entities.PaymentTransaction, error) {
	return nil, nil
}
func (stubTxRepository) FindByGatewayReferenceID(context.Context, string) (*entities.PaymentTransaction, error) {
	return nil, nil
}

type stubMethodRepository struct {
	method *entities.PaymentMethodEntity
}

func (r stubMethodRepository) FindByCode(context.Context, string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (stubMethodRepository) FindAll(context.Context) ([]entities.PaymentMethodEntity, error) {
	return nil, nil
}
func (stubMethodRepository) FindByID(context.Context, string) (*entities.PaymentMethodEntity, error) {
	return nil, nil
}
func (stubMethodRepository) FindByCodeOrID(context.Context, string) (*entities.PaymentMethodEntity, error) {
	return nil, nil
}
func (stubMethodRepository) CountByGatewayName(context.Context, string) (int64, error)   { return 0, nil }
func (stubMethodRepository) Create(context.Context, *entities.PaymentMethodEntity) error { return nil }
func (stubMethodRepository) Update(context.Context, *entities.PaymentMethodEntity) error { return nil }
func (stubMethodRepository) Delete(context.Context, string) error                        { return nil }

func TestProcessPayment_PassesIntentDescriptionToGateway(t *testing.T) {
	t.Parallel()

	const fullDesc = "Registration Fee (Fully Funded) - Middle East Youth Summit 7th (USD 10.00)"

	tests := []struct {
		name     string
		metadata string
		want     string
	}{
		{"uses metadata description", `{"description":"` + fullDesc + `"}`, fullDesc},
		{"trims surrounding whitespace", `{"description":"  ` + fullDesc + ` \n"}`, fullDesc},
		{"empty when metadata has none so gateway falls back", `{"customer_name":"A"}`, ""},
		{"empty when description is blank", `{"description":"   "}`, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gw := &capturingGateway{}
			intent := &entities.PaymentIntent{
				ID:            "intent-1",
				UserID:        "user-1",
				ReferenceType: "invoice",
				ReferenceID:   "inv-1",
				Amount:        150000,
				Currency:      "IDR",
				Metadata:      []byte(tc.metadata),
			}
			srv := NewPaymentGrpcServer(
				&stubIntentByID{intent: intent},
				stubTxRepository{},
				stubMethodRepository{method: &entities.PaymentMethodEntity{
					Code:        "xendit_invoice",
					Type:        entities.MethodTypeAutomatic,
					GatewayName: "xendit",
				}},
				nil,
				singleGatewayFactory{gw: gw},
				nil,
				"xendit",
				nil,
			)

			_, err := srv.ProcessPayment(context.Background(), &pb.ProcessPaymentRequest{
				IntentId:        "intent-1",
				UserId:          "user-1",
				PaymentMethodId: "xendit_invoice",
			})
			if err == nil {
				t.Fatal("expected gateway error from capturing stub")
			}
			if gw.got == nil {
				t.Fatal("gateway ChargePayment was not called")
			}
			if gw.got.Description != tc.want {
				t.Fatalf("Description = %q, want %q", gw.got.Description, tc.want)
			}
		})
	}
}
