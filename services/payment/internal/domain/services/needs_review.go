package services

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

// FindNeedsReviewTransaction returns the intent's transaction awaiting manual
// review, or nil if none. Migration 024 guarantees at most one.
func FindNeedsReviewTransaction(ctx context.Context, repo repositories.PaymentTransactionRepository, intentID string) (*entities.PaymentTransaction, error) {
	txs, err := repo.FindByIntentID(ctx, intentID)
	if err != nil {
		return nil, err
	}
	for _, tx := range txs {
		if tx.Status == entities.TransactionStatusNeedsReview {
			return tx, nil
		}
	}
	return nil, nil
}
