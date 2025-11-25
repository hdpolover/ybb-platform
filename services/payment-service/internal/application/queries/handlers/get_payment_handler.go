package handlers

import (
	"context"
	"log"
	"time"

	"github.com/ybb-platform/payment-service/internal/application/dto"
	"github.com/ybb-platform/payment-service/internal/application/queries"
	"github.com/ybb-platform/payment-service/internal/domain/exceptions"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
)

// GetPaymentHandler handles payment query operations
type GetPaymentHandler struct {
	paymentRepo repositories.PaymentRepository
}

// NewGetPaymentHandler creates a new GetPaymentHandler
func NewGetPaymentHandler(paymentRepo repositories.PaymentRepository) *GetPaymentHandler {
	return &GetPaymentHandler{
		paymentRepo: paymentRepo,
	}
}

// HandleGetByID handles the GetPaymentByIDQuery
func (h *GetPaymentHandler) HandleGetByID(ctx context.Context, query *queries.GetPaymentByIDQuery) (*dto.PaymentResponseDTO, error) {
	payment, err := h.paymentRepo.FindByID(ctx, query.PaymentID)
	if err != nil {
		log.Printf("Failed to find payment: %v", err)
		return nil, err
	}

	if payment == nil {
		return nil, exceptions.ErrPaymentNotFound
	}

	return &dto.PaymentResponseDTO{
		ID:             payment.ID,
		ApplicationID:  payment.ApplicationID,
		UserID:         payment.UserID,
		Amount:         payment.Amount,
		Currency:       payment.Currency,
		Status:         string(payment.Status),
		PaymentMethod:  string(payment.PaymentMethod),
		GatewayName:    payment.GatewayName,
		GatewayOrderID: payment.GatewayOrderID,
		CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
	}, nil
}

// HandleGetByUserID handles the GetPaymentsByUserIDQuery
func (h *GetPaymentHandler) HandleGetByUserID(ctx context.Context, query *queries.GetPaymentsByUserIDQuery) ([]*dto.PaymentResponseDTO, error) {
	payments, err := h.paymentRepo.FindByUserID(ctx, query.UserID, query.Limit, query.Offset)
	if err != nil {
		log.Printf("Failed to find payments by user ID: %v", err)
		return nil, err
	}

	result := make([]*dto.PaymentResponseDTO, 0, len(payments))
	for _, payment := range payments {
		result = append(result, &dto.PaymentResponseDTO{
			ID:             payment.ID,
			ApplicationID:  payment.ApplicationID,
			UserID:         payment.UserID,
			Amount:         payment.Amount,
			Currency:       payment.Currency,
			Status:         string(payment.Status),
			PaymentMethod:  string(payment.PaymentMethod),
			GatewayName:    payment.GatewayName,
			GatewayOrderID: payment.GatewayOrderID,
			CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
			UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
		})
	}

	return result, nil
}

// HandleGetByApplicationID handles the GetPaymentsByApplicationIDQuery
func (h *GetPaymentHandler) HandleGetByApplicationID(ctx context.Context, query *queries.GetPaymentsByApplicationIDQuery) ([]*dto.PaymentResponseDTO, error) {
	payments, err := h.paymentRepo.FindByApplicationID(ctx, query.ApplicationID)
	if err != nil {
		log.Printf("Failed to find payments by application ID: %v", err)
		return nil, err
	}

	result := make([]*dto.PaymentResponseDTO, 0, len(payments))
	for _, payment := range payments {
		result = append(result, &dto.PaymentResponseDTO{
			ID:             payment.ID,
			ApplicationID:  payment.ApplicationID,
			UserID:         payment.UserID,
			Amount:         payment.Amount,
			Currency:       payment.Currency,
			Status:         string(payment.Status),
			PaymentMethod:  string(payment.PaymentMethod),
			GatewayName:    payment.GatewayName,
			GatewayOrderID: payment.GatewayOrderID,
			CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
			UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
		})
	}

	return result, nil
}
