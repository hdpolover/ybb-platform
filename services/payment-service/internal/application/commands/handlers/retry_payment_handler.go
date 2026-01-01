package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/ybb-platform/payment-service/internal/application/dto"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/domain/gateways"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
)

type RetryPaymentHandler struct {
	paymentRepo    repositories.PaymentRepository
	gatewayFactory gateways.GatewayFactory
}

func NewRetryPaymentHandler(
	paymentRepo repositories.PaymentRepository,
	gatewayFactory gateways.GatewayFactory,
) *RetryPaymentHandler {
	return &RetryPaymentHandler{
		paymentRepo:    paymentRepo,
		gatewayFactory: gatewayFactory,
	}
}

func (h *RetryPaymentHandler) Handle(ctx context.Context, oldPaymentID string) (*dto.PaymentResponseDTO, error) {
	// 1. Ambil Data Lama
	oldPayment, err := h.paymentRepo.FindByID(ctx, oldPaymentID)
	if err != nil {
		return nil, fmt.Errorf("payment not found")
	}

	if oldPayment.PaymentType != entities.PaymentTypeAutomatic {
        return nil, fmt.Errorf("retry is only available for automatic payments")
    }
	
	// 2. Validasi Status (Hanya boleh retry jika gagal/expired/cancelled)
	if oldPayment.Status == entities.PaymentStatusSuccess {
		return nil, fmt.Errorf("cannot retry a successful payment")
	}
	// Asumsi: pending/processing masih aktif, jadi tidak boleh retry (harus cancel dulu)
	if oldPayment.Status == entities.PaymentStatusPending || oldPayment.Status == "processing" {
		return nil, fmt.Errorf("payment is still active, please cancel it first")
	}

	// 3. Clone Data ke Entity Baru
	newPayment := &entities.Payment{
		ID:            uuid.New().String(),
		ApplicationID: oldPayment.ApplicationID,
		UserID:        oldPayment.UserID,
		Amount:        oldPayment.Amount,
		Currency:      oldPayment.Currency,
		PaymentType:   oldPayment.PaymentType,
		PaymentMethod: oldPayment.PaymentMethod,
		GatewayName:   oldPayment.GatewayName,
		Description:   oldPayment.Description,
		CustomerName:  oldPayment.CustomerName,
		CustomerEmail: oldPayment.CustomerEmail,
		CustomerPhone: oldPayment.CustomerPhone,
		CallbackURL:   oldPayment.CallbackURL,
		Status:        entities.PaymentStatusPending,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// 4. Panggil Gateway (Midtrans/dll)
	gateway, err := h.gatewayFactory.GetGateway(newPayment.GatewayName)
	if err != nil {
		return nil, err
	}

	req := &gateways.CreatePaymentRequest{
		Payment:       newPayment,
		PaymentMethod: newPayment.PaymentMethod,
		CallbackURL:   newPayment.CallbackURL,
		CustomerName:  newPayment.CustomerName,
		CustomerEmail: newPayment.CustomerEmail,
		CustomerPhone: newPayment.CustomerPhone,
	}

	gatewayResp, err := gateway.CreatePayment(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create retry payment: %w", err)
	}

	// 5. Update Entity Baru dengan Respon Gateway
	newPayment.RedirectURL = gatewayResp.RedirectURL
	newPayment.Token = gatewayResp.Token
	newPayment.GatewayOrderID = gatewayResp.GatewayOrderID
	newPayment.Status = "processing" // Midtrans biasanya processing setelah create

	// 6. Simpan ke Database
	if err := h.paymentRepo.Create(ctx, newPayment); err != nil {
		return nil, err
	}

	// 7. Return DTO (Gunakan helper mapping yang seragam)
	return mapToDTO(newPayment), nil
}

// Helper lokal untuk mapping (bisa dipindah ke utils jika perlu)
func mapToDTO(p *entities.Payment) *dto.PaymentResponseDTO {
	return &dto.PaymentResponseDTO{
		ID:             p.ID,
		ApplicationID:  p.ApplicationID,
		UserID:         p.UserID,
		Amount:         p.Amount,
		Currency:       p.Currency,
		Status:         string(p.Status),
		PaymentType:    string(p.PaymentType),
		GatewayName:    p.GatewayName,
		RedirectURL:    p.RedirectURL,
		Token:          p.Token,
		CreatedAt:      p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      p.UpdatedAt.Format(time.RFC3339),
	}
}