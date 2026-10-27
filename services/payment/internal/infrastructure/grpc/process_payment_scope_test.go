// services/payment/internal/infrastructure/grpc/process_payment_scope_test.go
package grpc

import (
	"context"
	"errors"
	"testing"

	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
)

// scopedFactory resolves by program/brand like the real factory: a program hit
// wins over a brand hit, anything else falls back to the global gateway.
type scopedFactory struct {
	global     domainGateways.PaymentGateway
	byProgram  map[string]domainGateways.PaymentGateway
	byBrand    map[string]domainGateways.PaymentGateway
	configIDs  map[string]string // "program:<id>" / "brand:<id>" -> config id
	resolveErr error
	gotProgram string
	gotBrand   string
}

func (f *scopedFactory) GetGateway(string) (domainGateways.PaymentGateway, error) {
	return f.global, nil
}
func (f *scopedFactory) GetGatewayByConfigID(string) (domainGateways.PaymentGateway, string, error) {
	return nil, "", errors.New("unused")
}
func (f *scopedFactory) Resolve(_, programID, brandID string) (domainGateways.PaymentGateway, *string, error) {
	f.gotProgram, f.gotBrand = programID, brandID
	if f.resolveErr != nil {
		return nil, nil, f.resolveErr
	}
	if gw, ok := f.byProgram[programID]; ok {
		id := f.configIDs["program:"+programID]
		return gw, &id, nil
	}
	if gw, ok := f.byBrand[brandID]; ok {
		id := f.configIDs["brand:"+brandID]
		return gw, &id, nil
	}
	return f.global, nil, nil
}

type recordingTxRepository struct {
	stubTxRepository
	created []*entities.PaymentTransaction
}

func (r *recordingTxRepository) Create(_ context.Context, tx *entities.PaymentTransaction) error {
	r.created = append(r.created, tx)
	return nil
}

func TestProcessPayment_GatewayScope(t *testing.T) {
	t.Parallel()

	programGW, brandGW, globalGW := &capturingGateway{}, &capturingGateway{}, &capturingGateway{}
	newFactory := func() *scopedFactory {
		return &scopedFactory{
			global:    globalGW,
			byProgram: map[string]domainGateways.PaymentGateway{"prog-1": programGW},
			byBrand:   map[string]domainGateways.PaymentGateway{"brand-1": brandGW},
			configIDs: map[string]string{"program:prog-1": "cfg-prog", "brand:brand-1": "cfg-brand"},
		}
	}

	tests := []struct {
		name       string
		metadata   string
		resolveErr error
		wantGW     *capturingGateway
		wantID     *string
		wantTxs    int
		wantErr    bool
	}{
		{"program scoped", `{"program_id":"prog-1","brand_id":"brand-1"}`, nil, programGW, strPtr("cfg-prog"), 1, true},
		{"brand scoped", `{"program_id":"other","brand_id":"brand-1"}`, nil, brandGW, strPtr("cfg-brand"), 1, true},
		{"no scoped config uses global with NULL id", `{"program_id":"other","brand_id":"other"}`, nil, globalGW, nil, 1, true},
		{"no scope metadata uses global with NULL id", `{"customer_name":"A"}`, nil, globalGW, nil, 1, true},
		{"resolve error creates no transaction", `{"program_id":"prog-1"}`, errors.New("unsupported gateway"), nil, nil, 0, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			programGW.got, brandGW.got, globalGW.got = nil, nil, nil // subtests run serially below
			factory := newFactory()
			factory.resolveErr = tc.resolveErr
			txRepo := &recordingTxRepository{}
			intent := &entities.PaymentIntent{
				ID: "intent-1", UserID: "user-1", ReferenceType: "invoice", ReferenceID: "inv-1",
				Amount: 150000, Currency: "IDR", Metadata: []byte(tc.metadata),
			}
			srv := NewPaymentGrpcServer(
				&stubIntentByID{intent: intent},
				txRepo,
				stubMethodRepository{method: &entities.PaymentMethodEntity{
					Code: "xendit_invoice", Type: entities.MethodTypeAutomatic, GatewayName: "xendit",
				}},
				nil, factory, nil, "xendit", nil,
			)

			_, err := srv.ProcessPayment(context.Background(), &pb.ProcessPaymentRequest{
				IntentId: "intent-1", UserId: "user-1", PaymentMethodId: "xendit_invoice",
			})
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tc.wantErr)
			}
			if len(txRepo.created) != tc.wantTxs {
				t.Fatalf("transactions created = %d, want %d", len(txRepo.created), tc.wantTxs)
			}
			if tc.wantTxs == 0 {
				return
			}
			gotID := txRepo.created[0].GatewayConfigID
			switch {
			case tc.wantID == nil && gotID != nil:
				t.Fatalf("GatewayConfigID = %q, want nil", *gotID)
			case tc.wantID != nil && (gotID == nil || *gotID != *tc.wantID):
				t.Fatalf("GatewayConfigID = %v, want %q", gotID, *tc.wantID)
			}
			if tc.wantGW.got == nil {
				t.Fatal("expected the resolved gateway to be charged")
			}
			for _, gw := range []*capturingGateway{programGW, brandGW, globalGW} {
				if gw != tc.wantGW && gw.got != nil {
					t.Fatal("a different gateway than the resolved one was charged")
				}
			}
		})
	}
}

func strPtr(s string) *string { return &s }
