package handlers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/services"
)

func TestCreateIntentHandler_ReusesExistingOpenIntent(t *testing.T) {
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
	repo := &stubIntentRepository{
		findOpenResults: []*entities.PaymentIntent{existing},
	}
	handler := NewCreateIntentHandler(repo)

	resp, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.IntentID != existing.ID {
		t.Fatalf("expected existing intent id %q, got %q", existing.ID, resp.IntentID)
	}
	if resp.ClientSecret != existing.ClientSecret {
		t.Fatalf("expected existing client secret %q, got %q", existing.ClientSecret, resp.ClientSecret)
	}
	if repo.createCalls != 0 {
		t.Fatalf("expected no create calls, got %d", repo.createCalls)
	}
}

func TestCreateIntentHandler_CancelsStaleIntentOnAmountMismatch(t *testing.T) {
	t.Parallel()

	stale := &entities.PaymentIntent{
		ID:            "intent-stale",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        100000,
		Currency:      "IDR",
		Status:        entities.PaymentIntentStatusRequiresMethod,
	}
	repo := &stubIntentRepository{
		findOpenResults: []*entities.PaymentIntent{stale},
	}
	handler := NewCreateIntentHandler(repo)

	resp, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        200000, // invoice amount changed
		Currency:      "IDR",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if repo.updates != 1 {
		t.Fatalf("expected stale intent to be updated once, got %d updates", repo.updates)
	}
	if stale.Status != entities.PaymentIntentStatusCanceled {
		t.Fatalf("expected stale intent status CANCELED, got %s", stale.Status)
	}
	if repo.createCalls != 1 {
		t.Fatalf("expected exactly one create call, got %d", repo.createCalls)
	}
	if len(repo.createdIntents) != 1 {
		t.Fatalf("expected one created intent, got %d", len(repo.createdIntents))
	}
	newIntent := repo.createdIntents[0]
	if resp.IntentID != newIntent.ID {
		t.Fatalf("expected response id %q to match created intent %q", resp.IntentID, newIntent.ID)
	}
	if newIntent.ID == stale.ID {
		t.Fatal("expected a new intent id, not the stale one")
	}
	if newIntent.Amount != 200000 {
		t.Fatalf("expected new intent amount 200000, got %v", newIntent.Amount)
	}
}

func TestCreateIntentHandler_CancelsStaleIntentOnCurrencyMismatch(t *testing.T) {
	t.Parallel()

	stale := &entities.PaymentIntent{
		ID:            "intent-stale",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "USD",
		Status:        entities.PaymentIntentStatusRequiresMethod,
	}
	repo := &stubIntentRepository{
		findOpenResults: []*entities.PaymentIntent{stale},
	}
	handler := NewCreateIntentHandler(repo)

	_, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if stale.Status != entities.PaymentIntentStatusCanceled {
		t.Fatalf("expected stale intent status CANCELED, got %s", stale.Status)
	}
	if repo.createCalls != 1 {
		t.Fatalf("expected exactly one create call, got %d", repo.createCalls)
	}
}

func TestCreateIntentHandler_RaceOnCreate_RefetchesAndReturnsExisting(t *testing.T) {
	t.Parallel()

	winner := &entities.PaymentIntent{
		ID:            "intent-winner",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
		Status:        entities.PaymentIntentStatusRequiresMethod,
		ClientSecret:  "secret-winner",
	}
	repo := &stubIntentRepository{
		// First FindOpenByReference (pre-create check): nothing yet.
		// Second FindOpenByReference (post-race refetch): the concurrent
		// request's intent has landed.
		findOpenResults: []*entities.PaymentIntent{nil, winner},
		createErr:       exceptions.ErrDuplicateOpenIntent,
	}
	handler := NewCreateIntentHandler(repo)

	resp, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp.IntentID != winner.ID {
		t.Fatalf("expected winner intent id %q, got %q", winner.ID, resp.IntentID)
	}
	if resp.ClientSecret != winner.ClientSecret {
		t.Fatalf("expected winner client secret %q, got %q", winner.ClientSecret, resp.ClientSecret)
	}
	if repo.findOpenCalls != 2 {
		t.Fatalf("expected two FindOpenByReference calls, got %d", repo.findOpenCalls)
	}
}

func TestCreateIntentHandler_RaceOnCreate_RefetchAmountMismatchReturnsError(t *testing.T) {
	t.Parallel()

	// The concurrent request won with a different amount, so its intent bills
	// something else. Adopting it would charge the caller the wrong amount.
	winner := &entities.PaymentIntent{
		ID:            "intent-winner",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        999000,
		Currency:      "IDR",
		Status:        entities.PaymentIntentStatusRequiresMethod,
		ClientSecret:  "secret-winner",
	}
	repo := &stubIntentRepository{
		findOpenResults: []*entities.PaymentIntent{nil, winner},
		createErr:       exceptions.ErrDuplicateOpenIntent,
	}
	handler := NewCreateIntentHandler(repo)

	_, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
	})
	if err == nil {
		t.Fatal("expected an error when the raced intent bills a different amount")
	}
}

func TestCreateIntentHandler_RaceOnCreate_RefetchNilReturnsOriginalError(t *testing.T) {
	t.Parallel()

	repo := &stubIntentRepository{
		findOpenResults: []*entities.PaymentIntent{nil, nil},
		createErr:       exceptions.ErrDuplicateOpenIntent,
	}
	handler := NewCreateIntentHandler(repo)

	_, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
	})
	if err == nil {
		t.Fatal("expected an error when refetch also finds nothing")
	}
}

func TestCreateIntentHandler_NoExistingIntent_CreatesNormally(t *testing.T) {
	t.Parallel()

	repo := &stubIntentRepository{
		findOpenResults: []*entities.PaymentIntent{nil},
	}
	handler := NewCreateIntentHandler(repo)

	resp, err := handler.Handle(context.Background(), &commands.CreateIntentCommand{
		UserID:        "user-1",
		ReferenceType: "invoice",
		ReferenceID:   "inv-1",
		Amount:        150000,
		Currency:      "IDR",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if repo.createCalls != 1 {
		t.Fatalf("expected exactly one create call, got %d", repo.createCalls)
	}
	if resp.Status != string(entities.PaymentIntentStatusRequiresMethod) {
		t.Fatalf("expected status REQUIRES_PAYMENT_METHOD, got %s", resp.Status)
	}
}

func TestCreateIntentHandler_ReuseMergesGatewayScopeIntoMetadata(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		stored      string
		incoming    map[string]interface{}
		wantUpdates int
		wantProgram string
		wantBrand   string
	}{
		{"adds brand_id to legacy intent and keeps other keys", `{"program_id":"p1","description":"d"}`,
			map[string]interface{}{"program_id": "p1", "brand_id": "b1"}, 1, "p1", "b1"},
		{"adds both to empty metadata", ``,
			map[string]interface{}{"program_id": "p1", "brand_id": "b1"}, 1, "p1", "b1"},
		{"overwrites a changed program_id", `{"program_id":"old","brand_id":"b1"}`,
			map[string]interface{}{"program_id": "p2", "brand_id": "b1"}, 1, "p2", "b1"},
		{"no write when nothing changed", `{"program_id":"p1","brand_id":"b1"}`,
			map[string]interface{}{"program_id": "p1", "brand_id": "b1"}, 0, "p1", "b1"},
		{"empty incoming never clears stored scope", `{"program_id":"p1","brand_id":"b1"}`,
			map[string]interface{}{"program_id": "", "description": "x"}, 0, "p1", "b1"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			existing := &entities.PaymentIntent{
				ID: "intent-existing", ReferenceType: "invoice", ReferenceID: "inv-1",
				Amount: 150000, Currency: "IDR",
				Status:   entities.PaymentIntentStatusRequiresMethod,
				Metadata: []byte(tc.stored),
			}
			repo := &stubIntentRepository{findOpenResults: []*entities.PaymentIntent{existing}}

			resp, err := NewCreateIntentHandler(repo).Handle(context.Background(), &commands.CreateIntentCommand{
				UserID: "user-1", ReferenceType: "invoice", ReferenceID: "inv-1",
				Amount: 150000, Currency: "IDR", Metadata: tc.incoming,
			})
			if err != nil {
				t.Fatalf("expected nil error, got %v", err)
			}
			if resp.IntentID != existing.ID || repo.createCalls != 0 {
				t.Fatalf("expected reuse of %q without create, got %q / %d creates", existing.ID, resp.IntentID, repo.createCalls)
			}
			if repo.updates != tc.wantUpdates {
				t.Fatalf("updates = %d, want %d", repo.updates, tc.wantUpdates)
			}
			program, brand := services.GatewayScopeFromMetadata(existing.Metadata)
			if program != tc.wantProgram || brand != tc.wantBrand {
				t.Fatalf("scope = (%q,%q), want (%q,%q) in %s", program, brand, tc.wantProgram, tc.wantBrand, existing.Metadata)
			}
		})
	}
}

func TestCreateIntentHandler_ReusePatchKeepsOtherMetadata(t *testing.T) {
	t.Parallel()

	existing := &entities.PaymentIntent{
		ID: "intent-existing", ReferenceType: "invoice", ReferenceID: "inv-1",
		Amount: 150000, Currency: "IDR",
		Status:   entities.PaymentIntentStatusRequiresMethod,
		Metadata: []byte(`{"description":"Registration fee"}`),
	}
	repo := &stubIntentRepository{findOpenResults: []*entities.PaymentIntent{existing}}

	_, err := NewCreateIntentHandler(repo).Handle(context.Background(), &commands.CreateIntentCommand{
		UserID: "user-1", ReferenceType: "invoice", ReferenceID: "inv-1",
		Amount: 150000, Currency: "IDR", Metadata: map[string]interface{}{"brand_id": "b1"},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	var got map[string]interface{}
	if err := json.Unmarshal(existing.Metadata, &got); err != nil {
		t.Fatalf("metadata not valid JSON: %v", err)
	}
	if got["description"] != "Registration fee" || got["brand_id"] != "b1" {
		t.Fatalf("unexpected metadata %v", got)
	}
}
