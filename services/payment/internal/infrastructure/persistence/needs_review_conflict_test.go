// services/payment/internal/infrastructure/persistence/needs_review_conflict_test.go
package persistence

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/ybb-platform/payment/internal/domain/exceptions"
)

func TestWrapTxWriteError(t *testing.T) {
	t.Parallel()

	pg := func(code, constraint string) error {
		return fmt.Errorf("gorm: %w", &pgconn.PgError{Code: code, ConstraintName: constraint})
	}

	tests := []struct {
		name         string
		err          error
		wantConflict bool
	}{
		{"needs-review index violation", pg("23505", needsReviewIndexName), true},
		{"other unique violation is not misreported", pg("23505", "payment_transactions_pkey"), false},
		{"non-unique pg error", pg("23503", needsReviewIndexName), false},
		{"plain error", errors.New("boom"), false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := wrapTxWriteError("create", tc.err)
			if errors.Is(got, exceptions.ErrDuplicateNeedsReview) != tc.wantConflict {
				t.Fatalf("conflict = %v, want %v (err: %v)", !tc.wantConflict, tc.wantConflict, got)
			}
		})
	}
}
