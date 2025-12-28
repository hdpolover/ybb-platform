package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/ybb-platform/payment-service/internal/application/dto"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/domain/exceptions"
	"github.com/ybb-platform/payment-service/internal/domain/gateways"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
)

type CancelPaymentHandler struct {
	paymentRepo    repositories.PaymentRepository
	gatewayFactory gateways.GatewayFactory
}

func NewCancelPaymentHandler(repo repositories.PaymentRepository, factory gateways.GatewayFactory) *CancelPaymentHandler {
	return &CancelPaymentHandler{paymentRepo: repo, gatewayFactory: factory}
}

func (h *CancelPaymentHandler) Handle(ctx context.Context, paymentID string) (*dto.PaymentResponseDTO, error) {
	payment, err := h.paymentRepo.FindByID(ctx, paymentID)
	if err != nil {
		return nil, exceptions.ErrPaymentNotFound
	}

	// Validasi: Hanya status Pending yang bisa di-cancel
	if payment.Status != entities.PaymentStatusPending {
		return nil, fmt.Errorf("only pending payments can be cancelled")
	}

	gateway, err := h.gatewayFactory.GetGateway(payment.GatewayName)
	if err != nil {
		return nil, exceptions.ErrUnsupportedGateway
	}

	// Panggil Gateway Cancel
	err = gateway.CancelPayment(ctx, payment.GatewayOrderID)
	if err != nil {
		return nil, fmt.Errorf("gateway cancel failed: %w", err)
	}

	// Update DB
	payment.Status = entities.PaymentStatusFailed
	payment.UpdatedAt = time.Now()
	
	if err := h.paymentRepo.Update(ctx, payment); err != nil {
		return nil, err
	}

	return &dto.PaymentResponseDTO{
		ID:     payment.ID,
		Status: string(payment.Status),
	}, nil
}