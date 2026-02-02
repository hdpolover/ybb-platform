package handlers

import (
	"context"
	"fmt"
	"log"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/entities"
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
	// 1. Create Entity
	intent := entities.NewPaymentIntent(
		cmd.UserID,
		cmd.Amount,
		cmd.Currency,
		cmd.ReferenceType,
		cmd.ReferenceID,
		cmd.Metadata,
	)

	intent.ParticipantID = cmd.ParticipantID

	// 2. Save to DB
	if err := h.intentRepo.Create(ctx, intent); err != nil {
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
