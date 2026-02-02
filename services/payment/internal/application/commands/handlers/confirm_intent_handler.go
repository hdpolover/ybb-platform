package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

type ConfirmIntentHandler struct {
	intentRepo     repositories.PaymentIntentRepository
	txRepo         repositories.PaymentTransactionRepository
	gatewayFactory gateways.GatewayFactory
	// eventPublisher messaging.EventPublisher
}

func NewConfirmIntentHandler(
	intentRepo repositories.PaymentIntentRepository,
	txRepo repositories.PaymentTransactionRepository,
	gatewayFactory gateways.GatewayFactory,
) *ConfirmIntentHandler {
	return &ConfirmIntentHandler{
		intentRepo:     intentRepo,
		txRepo:         txRepo,
		gatewayFactory: gatewayFactory,
	}
}

func (h *ConfirmIntentHandler) Handle(ctx context.Context, cmd *commands.ConfirmIntentCommand) (*dto.ConfirmPaymentResponse, error) {
	// 1. Fetch Intent
	intent, err := h.intentRepo.FindByID(ctx, cmd.IntentID)
	if err != nil {
		return nil, fmt.Errorf("intent not found: %w", err)
	}

	// 2. Validate Status
	if intent.Status == entities.PaymentIntentStatusSucceeded {
		return nil, fmt.Errorf("intent already succeeded")
	}

	// 3. Create Transaction (Attempt)
	// Default to "midtrans" for now, or derive from PaymentMethodID or Config
	// Since we are moving to Core API, we likely use Midtrans for everything in IDR.
	gatewayName := "midtrans" // TODO: logic based on method
	if cmd.PaymentMethodID == "manual_bca" {
		gatewayName = "manual"
	}

	gateway, err := h.gatewayFactory.GetGateway(gatewayName)
	if err != nil {
		return nil, fmt.Errorf("gateway not found: %v", err)
	}

	tx := entities.NewPaymentTransaction(intent.ID, cmd.PaymentMethodID, intent.Amount)
	tx.GatewayReferenceID = "" // Will be set after gateway call
	tx.Status = entities.TransactionStatusPending

	// Save Initial Transaction
	if err := h.txRepo.Create(ctx, tx); err != nil {
		return nil, fmt.Errorf("failed to create transaction record: %w", err)
	}

	// 4. Call Gateway Charge
	// Unmarshal PaymentDetails
	var detailsMap map[string]interface{}
	if len(cmd.PaymentDetails) > 0 {
		_ = json.Unmarshal(cmd.PaymentDetails, &detailsMap)
	}

	chargeReq := &gateways.ChargePaymentRequest{
		TransactionID:   tx.ID,
		IntentID:        intent.ID,
		Amount:          intent.Amount,
		Currency:        intent.Currency,
		PaymentMethodID: cmd.PaymentMethodID,
		GatewayToken:    cmd.GatewayToken,
		PaymentDetails:  detailsMap,
		CustomerDetails: gateways.CustomerDetails{
			Name:  cmd.CustomerName,
			Email: cmd.CustomerEmail,
			Phone: cmd.CustomerPhone,
		},
	}

	chargeResp, err := gateway.ChargePayment(ctx, chargeReq)
	if err != nil {
		// Update Transaction as Failed
		tx.Status = entities.TransactionStatusFailed
		tx.ErrorCode = "GATEWAY_ERROR"
		// Flatten error to string/json if needed
		_ = h.txRepo.Update(ctx, tx)
		return nil, fmt.Errorf("charge failed: %w", err)
	}

	// 5. Update Transaction Success/Pending
	tx.GatewayReferenceID = chargeResp.GatewayReferenceID
	if chargeResp.Status == "SUCCESS" {
		tx.Status = entities.TransactionStatusSuccess
		// Also Update Intent? - Usually wait for Webhook, but if sync success, update intent
		intent.Status = entities.PaymentIntentStatusSucceeded
		_ = h.intentRepo.Update(ctx, intent)
	} else if chargeResp.Status == "PENDING" {
		tx.Status = entities.TransactionStatusPending
		intent.Status = entities.PaymentIntentStatusProcessing
		_ = h.intentRepo.Update(ctx, intent)
	} else {
		tx.Status = entities.TransactionStatusFailed
	}

	// Save Updates
	if err := h.txRepo.Update(ctx, tx); err != nil {
		log.Printf("Failed to update transaction: %v", err)
	}

	// 6. Return Response
	return &dto.ConfirmPaymentResponse{
		TransactionID: tx.ID,
		Status:        string(tx.Status),
		Action: &dto.PaymentActionDTO{
			Type:   chargeResp.ActionType,
			URL:    chargeResp.ActionURL,
			QRCode: chargeResp.QRCodeString,
		},
		GatewayResp: chargeResp.Metadata, // or raw
	}, nil
}
