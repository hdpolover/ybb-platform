package grpc

import (
	"context"
	"testing"

	"github.com/ybb-platform/payment/internal/application/commands/handlers"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
)

// stubIntentRepository is a minimal repositories.PaymentIntentRepository used
// to prove CreateIntent goes through CreateIntentHandler's find-or-create
// logic instead of calling Create directly (the bug that caused the outage:
// server.go used to construct the entity and call Create inline, bypassing
// the handler entirely).
type stubIntentRepository struct {
	findOpenResult *entities.PaymentIntent
	findOpenCalls  int
	createCalls    int
}

func (r *stubIntentRepository) Create(ctx context.Context, intent *entities.PaymentIntent) error {
	r.createCalls++
	return nil
}
func (r *stubIntentRepository) FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error) {
	return nil, nil
}
func (r *stubIntentRepository) FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error) {
	return nil, nil
}
func (r *stubIntentRepository) FindOpenByReference(ctx context.Context, referenceType, referenceID string) (*entities.PaymentIntent, error) {
	r.findOpenCalls++
	return r.findOpenResult, nil
}
func (r *stubIntentRepository) Update(ctx context.Context, intent *entities.PaymentIntent) error {
	return nil
}
func (r *stubIntentRepository) FindAll(ctx context.Context, filter repositories.PaymentIntentFilter) ([]*entities.PaymentIntent, int64, error) {
	return nil, 0, nil
}

func TestCreateIntent_ReusesExistingOpenIntentViaHandler(t *testing.T) {
	t.Parallel()

	existing := &entities.PaymentIntent{
		ID:            "intent-existing",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
		Status:        entities.PaymentIntentStatusRequiresMethod,
		ClientSecret:  "secret-existing",
	}
	repo := &stubIntentRepository{findOpenResult: existing}

	srv := NewPaymentGrpcServer(
		repo,
		nil,
		nil,
		nil,
		nil,
		nil,
		"",
		handlers.NewCreateIntentHandler(repo),
	)

	resp, err := srv.CreateIntent(context.Background(), &pb.CreateIntentRequest{
		UserId:        "user-1",
		Amount:        150000,
		Currency:      "IDR",
		ReferenceType: "invoice",
		ReferenceId:   "inv-1",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.IntentId != existing.ID {
		t.Fatalf("expected existing intent id %q, got %q", existing.ID, resp.IntentId)
	}
	if resp.ClientSecret != existing.ClientSecret {
		t.Fatalf("expected existing client secret %q, got %q", existing.ClientSecret, resp.ClientSecret)
	}
	// The whole point: no new intent should be created when an open one
	// already exists for this reference. If gRPC bypassed the handler and
	// called intentRepo.Create directly (the original bug), this would be 1.
	if repo.createCalls != 0 {
		t.Fatalf("expected no create calls (find-or-create should reuse), got %d", repo.createCalls)
	}
	if repo.findOpenCalls == 0 {
		t.Fatal("expected FindOpenByReference to be called, proving the handler's find-or-create path ran")
	}
}
