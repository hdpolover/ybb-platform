package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

type CreateIntentHandler struct {
	intentRepo repositories.PaymentIntentRepository
}

func NewCreateIntentHandler(intentRepo repositories.PaymentIntentRepository) *CreateIntentHandler {
	return &CreateIntentHandler{
		intentRepo: intentRepo,
	}
}

func (h *CreateIntentHandler) Handle(ctx context.Context, cmd *commands.CreateIntentCommand) (*dto.CreateIntentResponse, error) {
	// 0. Find-or-create: reuse an existing open intent for this reference
	// instead of always creating a new one (checkout confirm is called on
	// every retry/reload).
	existing, err := h.intentRepo.FindOpenByReference(ctx, cmd.ReferenceType, cmd.ReferenceID)
	if err != nil {
		return nil, fmt.Errorf("failed to look up existing payment intent: %w", err)
	}

	if existing != nil {
		if existing.Amount == cmd.Amount && existing.Currency == cmd.Currency {
			if err := h.patchGatewayScope(ctx, existing, cmd.Metadata); err != nil {
				return nil, err
			}
			return &dto.CreateIntentResponse{
				IntentID:     existing.ID,
				ClientSecret: existing.ClientSecret,
				Status:       string(existing.Status),
			}, nil
		}

		// Invoice changed since the open intent was created; it's stale.
		existing.Status = entities.PaymentIntentStatusCanceled
		if err := h.intentRepo.Update(ctx, existing); err != nil {
			return nil, fmt.Errorf("failed to cancel stale payment intent: %w", err)
		}
	}

	// 1. Create Entity
	intent := entities.NewPaymentIntent(
		cmd.UserID,
		cmd.Amount,
		cmd.Currency,
		cmd.ReferenceType,
		cmd.ReferenceID,
		cmd.Metadata,
		cmd.ExchangeRate,
	)

	if cmd.ParticipantID != "" {
		intent.ParticipantID = &cmd.ParticipantID
	}

	// 2. Save to DB
	if err := h.intentRepo.Create(ctx, intent); err != nil {
		if errors.Is(err, exceptions.ErrDuplicateOpenIntent) {
			// Lost the race to a concurrent request; the other request's
			// intent is now the open one for this reference. Only adopt it when
			// it bills the same thing we were asked for — never hand back an
			// intent the caller would charge for a different amount.
			raced, findErr := h.intentRepo.FindOpenByReference(ctx, cmd.ReferenceType, cmd.ReferenceID)
			if findErr == nil && raced != nil && raced.Amount == cmd.Amount && raced.Currency == cmd.Currency {
				if err := h.patchGatewayScope(ctx, raced, cmd.Metadata); err != nil {
					return nil, err
				}
				return &dto.CreateIntentResponse{
					IntentID:     raced.ID,
					ClientSecret: raced.ClientSecret,
					Status:       string(raced.Status),
				}, nil
			}
		}
		log.Printf("Failed to create payment intent: %v", err)
		return nil, fmt.Errorf("failed to create payment intent: %w", err)
	}

	// 3. Return DTO
	return &dto.CreateIntentResponse{
		IntentID:     intent.ID,
		ClientSecret: intent.ClientSecret,
		Status:       string(intent.Status),
	}, nil
}

// patchGatewayScope copies program_id/brand_id from the incoming request into a
// reused intent's metadata. Older intents were created before brand_id was sent,
// and the scope decides which gateway config charges them. Only non-empty values
// that differ are written; everything else in the metadata is left alone.
func (h *CreateIntentHandler) patchGatewayScope(ctx context.Context, intent *entities.PaymentIntent, incoming map[string]interface{}) error {
	current := map[string]interface{}{}
	if len(intent.Metadata) > 0 {
		if err := json.Unmarshal(intent.Metadata, &current); err != nil || current == nil {
			current = map[string]interface{}{}
		}
	}

	changed := false
	for _, key := range []string{"program_id", "brand_id"} {
		v, ok := incoming[key].(string)
		if !ok || v == "" || current[key] == v {
			continue
		}
		current[key] = v
		changed = true
	}
	if !changed {
		return nil
	}

	raw, err := json.Marshal(current)
	if err != nil {
		return fmt.Errorf("failed to encode payment intent metadata: %w", err)
	}
	intent.Metadata = raw
	if err := h.intentRepo.Update(ctx, intent); err != nil {
		return fmt.Errorf("failed to update payment intent metadata: %w", err)
	}
	return nil
}
