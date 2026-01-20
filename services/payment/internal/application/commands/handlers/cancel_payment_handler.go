package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
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

	// Cek jika sudah selesai (Success/Failed/Cancelled)
    if payment.Status == entities.PaymentStatusSuccess || 
       payment.Status == entities.PaymentStatusFailed || 
       payment.Status == entities.PaymentStatusCancelled {
        return nil, fmt.Errorf("payment is already finished with status %s", payment.Status)
    }

    // Validasi Khusus MANUAL
    if payment.PaymentType == entities.PaymentTypeManual {
        // Manual hanya boleh cancel jika masih PENDING (Belum upload bukti)
        if payment.Status != entities.PaymentStatusPending {
            return nil, fmt.Errorf("cannot cancel manual payment that is being processed (proof uploaded). please contact admin")
        }
    }

    // Validasi Khusus AUTOMATIC
    if payment.PaymentType == entities.PaymentTypeAutomatic {
        // Automatic boleh cancel selama belum final (Pending/Processing oke)
        if payment.Status != entities.PaymentStatusPending && payment.Status != entities.PaymentStatusProcessing {
             return nil, fmt.Errorf("cannot cancel automatic payment with status %s", payment.Status)
        }
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
	payment.Status = entities.PaymentStatusCancelled
	payment.UpdatedAt = time.Now()
	
	if err := h.paymentRepo.Update(ctx, payment); err != nil {
		return nil, err
	}

	return &dto.PaymentResponseDTO{
		ID:             payment.ID,
		ApplicationID:  payment.ApplicationID,
		UserID:         payment.UserID,
		Amount:         payment.Amount,
		Currency:       payment.Currency,
		Status:         string(payment.Status),
		PaymentType:    string(payment.PaymentType),
		PaymentMethod:  string(payment.PaymentMethod),
		GatewayName:    payment.GatewayName,
		GatewayOrderID: payment.GatewayOrderID,
		Description:    payment.Description,
		RedirectURL:    payment.RedirectURL, // Jika ada
		CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
	}, nil
}