// services/payment/internal/infrastructure/grpc/manual_needs_review_dedupe_test.go
package grpc

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
)

// memTxRepo is a stateful in-memory transaction repo. It mimics the 024 partial
// unique index (one NEEDS_REVIEW per intent) the way the gorm repo surfaces it:
// a wrapped exceptions.ErrDuplicateNeedsReview.
type memTxRepo struct {
	stubTxRepository
	rows       []*entities.PaymentTransaction
	createErr  error              // returned by Create when set
	beforeFail func(r *memTxRepo) // runs before createErr is returned (simulates the race winner landing)
	creates    int
}

func (r *memTxRepo) Create(_ context.Context, tx *entities.PaymentTransaction) error {
	r.creates++
	if r.createErr != nil {
		if r.beforeFail != nil {
			r.beforeFail(r)
		}
		return fmt.Errorf("failed to create transaction: %w", r.createErr)
	}
	if tx.Status == entities.TransactionStatusNeedsReview {
		for _, row := range r.rows {
			if row.IntentID == tx.IntentID && row.Status == entities.TransactionStatusNeedsReview {
				return fmt.Errorf("failed to create transaction: %w", exceptions.ErrDuplicateNeedsReview)
			}
		}
	}
	r.rows = append(r.rows, tx)
	return nil
}

func (r *memTxRepo) FindByIntentID(_ context.Context, intentID string) ([]*entities.PaymentTransaction, error) {
	var out []*entities.PaymentTransaction
	for _, row := range r.rows {
		if row.IntentID == intentID {
			out = append(out, row)
		}
	}
	return out, nil
}

func needsReviewTx(id, intentID string, st entities.TransactionStatus) *entities.PaymentTransaction {
	tx := entities.NewPaymentTransaction(intentID, "manual_transfer", 100)
	tx.ID = id
	tx.Status = st
	return tx
}

func TestSubmitManualPayment_OneNeedsReviewPerIntent(t *testing.T) {
	t.Parallel()

	raceWinner := needsReviewTx("winner", "intent-1", entities.TransactionStatusNeedsReview)

	tests := []struct {
		name        string
		seed        []*entities.PaymentTransaction
		createErr   error
		beforeFail  func(r *memTxRepo)
		calls       int
		wantIDs     func(t *testing.T, ids []string)
		wantRows    int
		wantPublish int
		wantCode    codes.Code
	}{
		{
			name:        "first submit creates one row and publishes once",
			calls:       1,
			wantRows:    1,
			wantPublish: 1,
		},
		{
			name:        "second submit returns the existing id and publishes nothing",
			calls:       2,
			wantRows:    1,
			wantPublish: 1,
			wantIDs: func(t *testing.T, ids []string) {
				if ids[0] != ids[1] {
					t.Fatalf("expected same transaction id on repeat submit, got %v", ids)
				}
			},
		},
		{
			name:        "burst of six keeps a single row and a single event",
			calls:       6,
			wantRows:    1,
			wantPublish: 1,
		},
		{
			name:        "existing NEEDS_REVIEW row is returned without creating",
			seed:        []*entities.PaymentTransaction{raceWinner},
			calls:       1,
			wantRows:    1,
			wantPublish: 0,
			wantIDs: func(t *testing.T, ids []string) {
				if ids[0] != "winner" {
					t.Fatalf("expected existing id, got %v", ids)
				}
			},
		},
		{
			name:        "rejected earlier attempt does not block a fresh submit",
			seed:        []*entities.PaymentTransaction{needsReviewTx("old", "intent-1", entities.TransactionStatusRejected)},
			calls:       1,
			wantRows:    2,
			wantPublish: 1,
		},
		{
			name:      "unique violation from Create resolves to the race winner without publishing",
			createErr: exceptions.ErrDuplicateNeedsReview,
			beforeFail: func(r *memTxRepo) {
				r.rows = append(r.rows, raceWinner)
			},
			calls:       1,
			wantRows:    1,
			wantPublish: 0,
			wantIDs: func(t *testing.T, ids []string) {
				if ids[0] != "winner" {
					t.Fatalf("expected winner id, got %v", ids)
				}
			},
		},
		{
			name:        "other Create errors still surface as Internal",
			createErr:   errors.New("connection reset"),
			calls:       1,
			wantRows:    0,
			wantPublish: 0,
			wantCode:    codes.Internal,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			intent := &entities.PaymentIntent{ID: "intent-1", ReferenceID: "inv-1", Amount: 100}
			txRepo := &memTxRepo{rows: append([]*entities.PaymentTransaction(nil), tc.seed...), createErr: tc.createErr, beforeFail: tc.beforeFail}
			pub := &capturingPublisher{}
			srv := NewPaymentGrpcServer(&stubIntentByID{intent: intent}, txRepo, nil, nil, nil, pub, "", nil)

			var ids []string
			var lastErr error
			for i := 0; i < tc.calls; i++ {
				resp, err := srv.SubmitManualPayment(context.Background(), &pb.SubmitManualPaymentRequest{
					IntentId:     intent.ID,
					ProofFileUrl: "https://files.example.com/proof.jpg",
				})
				lastErr = err
				if err == nil {
					if resp.Status != "PENDING_REVIEW" {
						t.Fatalf("status = %q, want PENDING_REVIEW", resp.Status)
					}
					ids = append(ids, resp.TransactionId)
				}
			}

			if tc.wantCode != codes.OK {
				if status.Code(lastErr) != tc.wantCode {
					t.Fatalf("code = %v (err %v), want %v", status.Code(lastErr), lastErr, tc.wantCode)
				}
			} else if lastErr != nil {
				t.Fatalf("unexpected error: %v", lastErr)
			}
			if tc.wantIDs != nil {
				tc.wantIDs(t, ids)
			}
			if len(txRepo.rows) != tc.wantRows {
				t.Fatalf("rows = %d, want %d", len(txRepo.rows), tc.wantRows)
			}
			if len(pub.published) != tc.wantPublish {
				t.Fatalf("published = %d, want %d", len(pub.published), tc.wantPublish)
			}
		})
	}
}

func TestProcessPayment_ManualReturnsExistingNeedsReview(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		seed     []*entities.PaymentTransaction
		wantRows int
		wantID   string // empty: a freshly created row is expected
	}{
		{name: "first manual call creates one NEEDS_REVIEW row", wantRows: 1},
		{
			name:     "repeat manual call returns the existing row",
			seed:     []*entities.PaymentTransaction{needsReviewTx("existing", "intent-1", entities.TransactionStatusNeedsReview)},
			wantRows: 1,
			wantID:   "existing",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			intent := &entities.PaymentIntent{ID: "intent-1", UserID: "user-1", Amount: 100, Currency: "IDR"}
			txRepo := &memTxRepo{rows: append([]*entities.PaymentTransaction(nil), tc.seed...)}
			srv := NewPaymentGrpcServer(
				&stubIntentByID{intent: intent}, txRepo,
				stubMethodRepository{method: &entities.PaymentMethodEntity{Code: "bank_manual", Type: entities.MethodTypeManual, BankName: "BCA"}},
				nil, nil, nil, "", nil,
			)

			resp, err := srv.ProcessPayment(context.Background(), &pb.ProcessPaymentRequest{
				IntentId: "intent-1", UserId: "user-1", PaymentMethodId: "bank_manual",
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp.Status != string(entities.TransactionStatusNeedsReview) || resp.Metadata["bank_name"] != "BCA" {
				t.Fatalf("unexpected response: %+v", resp)
			}
			if tc.wantID != "" && resp.TransactionId != tc.wantID {
				t.Fatalf("transaction id = %q, want %q", resp.TransactionId, tc.wantID)
			}
			if len(txRepo.rows) != tc.wantRows {
				t.Fatalf("rows = %d, want %d", len(txRepo.rows), tc.wantRows)
			}
		})
	}
}
