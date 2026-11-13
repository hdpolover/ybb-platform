package grpc

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/events"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
)

type capturingPublisher struct {
	published []*events.PaymentEvent
}

func (p *capturingPublisher) Publish(ctx context.Context, event *events.PaymentEvent) error {
	p.published = append(p.published, event)
	return nil
}
func (p *capturingPublisher) Close() error { return nil }

// The API's payment.created bridge resolves the invoice from
// metadata.application_id/invoice_id; without metadata the "proof received"
// email was silently skipped for every manual transfer.
func TestSubmitManualPaymentEventCarriesIntentMetadata(t *testing.T) {
	t.Parallel()

	meta, _ := json.Marshal(map[string]interface{}{
		"application_id": "app-1",
		"invoice_id":     "inv-1",
		"email":          "p@example.com",
	})
	intent := &entities.PaymentIntent{ID: "intent-1", ReferenceID: "inv-1", Metadata: meta}
	intentRepo := &varcharGuardIntentRepo{byID: map[string]*entities.PaymentIntent{intent.ID: intent}}
	txRepo := &varcharGuardTxRepo{byID: map[string]*entities.PaymentTransaction{}}
	pub := &capturingPublisher{}

	srv := NewPaymentGrpcServer(intentRepo, txRepo, nil, nil, nil, pub, "", nil)

	if _, err := srv.SubmitManualPayment(context.Background(), &pb.SubmitManualPaymentRequest{
		IntentId:     intent.ID,
		ProofFileUrl: "https://files.example.com/proof.jpg",
	}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published event, got %d", len(pub.published))
	}
	ev := pub.published[0]
	if ev.Type != events.PaymentCreatedEvent || ev.Status != "PENDING_REVIEW" {
		t.Fatalf("unexpected event type/status: %s/%s", ev.Type, ev.Status)
	}
	if ev.Email != "p@example.com" {
		t.Fatalf("expected email from intent metadata, got %q", ev.Email)
	}
	if ev.Metadata["application_id"] != "app-1" || ev.Metadata["invoice_id"] != "inv-1" {
		t.Fatalf("expected intent metadata on event, got %v", ev.Metadata)
	}
}
