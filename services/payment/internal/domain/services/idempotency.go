package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
)

func BuildIdempotencyRequestHash(value interface{}) (string, error) {
	payload, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("failed to encode idempotency payload: %w", err)
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:]), nil
}

func ValidateIdempotencyRecord(record *entities.PaymentIdempotencyKey, resourceID, requestHash string) error {
	if record == nil {
		return nil
	}
	if record.ResourceID != resourceID || record.RequestHash != requestHash {
		return exceptions.ErrIdempotencyConflict
	}
	if record.Status == entities.PaymentIdempotencyStatusProcessing {
		return exceptions.ErrIdempotencyInProgress
	}
	return nil
}
