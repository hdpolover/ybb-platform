package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/application/requestcontext"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/domain/services"
)

type ConfirmIntentHandler struct {
	intentRepo      repositories.PaymentIntentRepository
	txRepo          repositories.PaymentTransactionRepository
	methodRepo      repositories.PaymentMethodRepository
	idempotencyRepo repositories.PaymentIdempotencyRepository
	gatewayFactory  gateways.GatewayFactory
	defaultGateway  string
	// eventPublisher messaging.EventPublisher
}

func NewConfirmIntentHandler(
	intentRepo repositories.PaymentIntentRepository,
	txRepo repositories.PaymentTransactionRepository,
	methodRepo repositories.PaymentMethodRepository,
	idempotencyRepo repositories.PaymentIdempotencyRepository,
	gatewayFactory gateways.GatewayFactory,
	defaultGateway string,
) *ConfirmIntentHandler {
	return &ConfirmIntentHandler{
		intentRepo:      intentRepo,
		txRepo:          txRepo,
		methodRepo:      methodRepo,
		idempotencyRepo: idempotencyRepo,
		gatewayFactory:  gatewayFactory,
		defaultGateway:  defaultGateway,
	}
}

func (h *ConfirmIntentHandler) Handle(ctx context.Context, cmd *commands.ConfirmIntentCommand) (*dto.ConfirmPaymentResponse, error) {
	requestID := requestcontext.RequestIDFromContext(ctx)
	log.Printf("confirm_intent_handler request_id=%s intent_id=%s payment_method=%s", requestID, cmd.IntentID, cmd.PaymentMethodID)
	// 1. Fetch Intent
	intent, err := h.intentRepo.FindByID(ctx, cmd.IntentID)
	if err != nil {
		return nil, fmt.Errorf("intent not found: %w", err)
	}

	// 2. Validate Status
	if intent.Status == entities.PaymentIntentStatusSucceeded {
		return nil, fmt.Errorf("intent already succeeded")
	}

	method, err := h.methodRepo.FindByCodeOrID(ctx, cmd.PaymentMethodID)
	if err != nil {
		return nil, fmt.Errorf("payment method not found: %w", err)
	}
	if !method.IsActive {
		return nil, fmt.Errorf("payment method %q is disabled", method.Code)
	}

	var idempotencyRecord *entities.PaymentIdempotencyKey
	if cmd.IdempotencyKey != "" && h.idempotencyRepo != nil {
		requestHash, hashErr := services.BuildIdempotencyRequestHash(map[string]interface{}{
			"payment_method_id": method.Code,
			"gateway_token":     cmd.GatewayToken,
			"payment_details":   json.RawMessage(cmd.PaymentDetails),
			"customer_name":     cmd.CustomerName,
			"customer_email":    cmd.CustomerEmail,
			"customer_phone":    cmd.CustomerPhone,
		})
		if hashErr != nil {
			return nil, hashErr
		}

		idempotencyRecord, err = h.idempotencyRepo.FindByKey(ctx, cmd.IdempotencyKey, "confirm_intent")
		if err != nil {
			return nil, err
		}
		if validationErr := services.ValidateIdempotencyRecord(idempotencyRecord, intent.ID, requestHash); validationErr != nil {
			return nil, validationErr
		}
		if idempotencyRecord != nil {
			if idempotencyRecord.Status == entities.PaymentIdempotencyStatusCompleted && len(idempotencyRecord.ResponseBody) > 0 {
				var resp dto.ConfirmPaymentResponse
				if err := json.Unmarshal(idempotencyRecord.ResponseBody, &resp); err == nil {
					return &resp, nil
				}
			}
			if idempotencyRecord.Status == entities.PaymentIdempotencyStatusFailed {
				return nil, errors.New(idempotencyRecord.ErrorMessage)
			}
		}

		if idempotencyRecord == nil {
			idempotencyRecord = entities.NewPaymentIdempotencyKey(cmd.IdempotencyKey, "confirm_intent", intent.ID, requestHash)
			if err := h.idempotencyRepo.Create(ctx, idempotencyRecord); err != nil {
				idempotencyRecord, findErr := h.idempotencyRepo.FindByKey(ctx, cmd.IdempotencyKey, "confirm_intent")
				if findErr != nil {
					return nil, err
				}
				if validationErr := services.ValidateIdempotencyRecord(idempotencyRecord, intent.ID, requestHash); validationErr != nil {
					return nil, validationErr
				}
				if idempotencyRecord != nil && idempotencyRecord.Status == entities.PaymentIdempotencyStatusCompleted && len(idempotencyRecord.ResponseBody) > 0 {
					var resp dto.ConfirmPaymentResponse
					if unmarshalErr := json.Unmarshal(idempotencyRecord.ResponseBody, &resp); unmarshalErr == nil {
						return &resp, nil
					}
				}
				return nil, exceptions.ErrIdempotencyInProgress
			}
		}
	}

	gatewayName, err := services.ResolveGatewayName(method, h.defaultGateway)
	if err != nil {
		h.failIdempotency(ctx, idempotencyRecord, err)
		return nil, err
	}

	gateway, err := h.gatewayFactory.GetGateway(gatewayName)
	if err != nil {
		h.failIdempotency(ctx, idempotencyRecord, err)
		return nil, fmt.Errorf("gateway not found: %v", err)
	}

	tx := entities.NewPaymentTransaction(intent.ID, method.Code, intent.Amount)
	tx.Currency = intent.Currency
	tx.GatewayReferenceID = ""
	tx.Status = entities.TransactionStatusPending

	// Save Initial Transaction
	if err := h.txRepo.Create(ctx, tx); err != nil {
		h.failIdempotency(ctx, idempotencyRecord, err)
		return nil, fmt.Errorf("failed to create transaction record: %w", err)
	}

	// 4. Call Gateway Charge
	// Unmarshal PaymentDetails
	var detailsMap map[string]interface{}
	if len(cmd.PaymentDetails) > 0 {
		_ = json.Unmarshal(cmd.PaymentDetails, &detailsMap)
	}

	// Description shown on the gateway dashboard (e.g. Xendit invoice list).
	// Sourced from intent metadata, populated upstream by the API service.
	var description string
	if len(intent.Metadata) > 0 {
		var metaMap map[string]interface{}
		if err := json.Unmarshal(intent.Metadata, &metaMap); err == nil {
			if d, ok := metaMap["description"].(string); ok {
				description = d
			}
		}
	}

	chargeReq := &gateways.ChargePaymentRequest{
		TransactionID:   tx.ID,
		IntentID:        intent.ID,
		Description:     description,
		Amount:          intent.Amount,
		Currency:        intent.Currency,
		PaymentMethodID: method.Code,
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
		tx.AdminNotes = err.Error()
		_ = h.txRepo.Update(ctx, tx)
		h.failIdempotency(ctx, idempotencyRecord, err)
		return nil, fmt.Errorf("charge failed: %w", err)
	}

	// 5. Update Transaction Success/Pending
	tx.GatewayReferenceID = chargeResp.GatewayReferenceID
	if chargeResp.Metadata != nil {
		if rawBytes, marshalErr := json.Marshal(chargeResp.Metadata); marshalErr == nil {
			tx.GatewayResponse = rawBytes
		}
	}
	if chargeResp.Status == "SUCCESS" {
		tx.Status = entities.TransactionStatusSuccess
		intent.Status = entities.PaymentIntentStatusSucceeded
		_ = h.intentRepo.Update(ctx, intent)
	} else if chargeResp.Status == "PENDING" {
		if method.Type.IsManual() {
			tx.Status = entities.TransactionStatusNeedsReview
			intent.Status = entities.PaymentIntentStatusRequiresMethod
		} else {
			tx.Status = entities.TransactionStatusPending
			intent.Status = entities.PaymentIntentStatusProcessing
		}
		_ = h.intentRepo.Update(ctx, intent)
	} else {
		tx.Status = entities.TransactionStatusFailed
	}

	// Save Updates
	if err := h.txRepo.Update(ctx, tx); err != nil {
		log.Printf("Failed to update transaction: %v", err)
	}

	// 6. Return Response
	response := &dto.ConfirmPaymentResponse{
		TransactionID: tx.ID,
		Status:        string(tx.Status),
		Action: &dto.PaymentActionDTO{
			Type:   chargeResp.ActionType,
			URL:    chargeResp.ActionURL,
			QRCode: chargeResp.QRCodeString,
		},
		GatewayResp: chargeResp.Metadata, // or raw
	}
	log.Printf("confirm_intent_handler completed request_id=%s intent_id=%s transaction_id=%s status=%s", requestID, cmd.IntentID, tx.ID, tx.Status)
	h.completeIdempotency(ctx, idempotencyRecord, tx.ID, response)
	return response, nil
}

func (h *ConfirmIntentHandler) completeIdempotency(ctx context.Context, record *entities.PaymentIdempotencyKey, transactionID string, response *dto.ConfirmPaymentResponse) {
	if record == nil || h.idempotencyRepo == nil || response == nil {
		return
	}
	record.Status = entities.PaymentIdempotencyStatusCompleted
	record.TransactionID = transactionID
	record.ErrorMessage = ""
	record.UpdatedAt = time.Now().UTC()
	if rawBytes, err := json.Marshal(response); err == nil {
		record.ResponseBody = rawBytes
	}
	if err := h.idempotencyRepo.Update(ctx, record); err != nil {
		log.Printf("Failed to update idempotency record: %v", err)
	}
}

func (h *ConfirmIntentHandler) failIdempotency(ctx context.Context, record *entities.PaymentIdempotencyKey, idempotencyErr error) {
	if record == nil || h.idempotencyRepo == nil || idempotencyErr == nil {
		return
	}
	record.Status = entities.PaymentIdempotencyStatusFailed
	record.ErrorMessage = idempotencyErr.Error()
	record.UpdatedAt = time.Now().UTC()
	if err := h.idempotencyRepo.Update(ctx, record); err != nil {
		log.Printf("Failed to update idempotency failure: %v", err)
	}
}
