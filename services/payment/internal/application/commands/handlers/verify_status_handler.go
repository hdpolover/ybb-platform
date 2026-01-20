package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

// VerifyStatusHandler handles payment status verification with Gateway
type VerifyStatusHandler struct {
	paymentRepo    repositories.PaymentRepository
	gatewayFactory gateways.GatewayFactory
}

func NewVerifyStatusHandler(repo repositories.PaymentRepository, factory gateways.GatewayFactory) *VerifyStatusHandler {
	return &VerifyStatusHandler{paymentRepo: repo, gatewayFactory: factory}
}

func (h *VerifyStatusHandler) Handle(ctx context.Context, paymentID string) (*dto.PaymentResponseDTO, error) {
	// 1. Ambil data payment
	payment, err := h.paymentRepo.FindByID(ctx, paymentID)
	if err != nil {
		return nil, exceptions.ErrPaymentNotFound
	}

	// 2. Ambil Gateway
	gateway, err := h.gatewayFactory.GetGateway(payment.GatewayName)
	if err != nil {
		return nil, exceptions.ErrUnsupportedGateway
	}

	// 3. Panggil Gateway untuk Verifikasi Status (Sesuai SRS: Payment Status Verification)
	updatedPaymentData, err := gateway.VerifyPayment(ctx, payment.GatewayOrderID)
	if err != nil {
		log.Printf("Gateway verification failed: %v", err)
		return nil, fmt.Errorf("gateway verification failed: %w", err)
	}

	// 4. Update Database jika status berubah
	if payment.Status != updatedPaymentData.Status {
		payment.Status = updatedPaymentData.Status
		payment.GatewayResponse = updatedPaymentData.GatewayResponse
		payment.UpdatedAt = time.Now()

		if err := h.paymentRepo.Update(ctx, payment); err != nil {
			return nil, err
		}
	}

	// 5. Return DTO
	return &dto.PaymentResponseDTO{
		ID:             payment.ID,
		Status:         string(payment.Status),
		Amount:         payment.Amount,
		GatewayOrderID: payment.GatewayOrderID,
		UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
	}, nil
}