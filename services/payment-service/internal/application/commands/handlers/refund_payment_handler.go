package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ybb-platform/payment-service/internal/application/dto"
	"github.com/ybb-platform/payment-service/internal/domain/events"
	"github.com/ybb-platform/payment-service/internal/domain/exceptions"
	"github.com/ybb-platform/payment-service/internal/domain/gateways"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
	"github.com/ybb-platform/payment-service/internal/infrastructure/messaging"
)

// RefundPaymentHandler handles the refund logic
type RefundPaymentHandler struct {
	paymentRepo    repositories.PaymentRepository
	gatewayFactory gateways.GatewayFactory
	eventPublisher messaging.EventPublisher
}

// NewRefundPaymentHandler creates a new instance
func NewRefundPaymentHandler(
	paymentRepo repositories.PaymentRepository,
	gatewayFactory gateways.GatewayFactory,
	eventPublisher messaging.EventPublisher, // Optional: Bagus untuk notifikasi email "Dana dikembalikan"
) *RefundPaymentHandler {
	return &RefundPaymentHandler{
		paymentRepo:    paymentRepo,
		gatewayFactory: gatewayFactory,
		eventPublisher: eventPublisher,
	}
}

// Handle executes the refund logic
func (h *RefundPaymentHandler) Handle(ctx context.Context, paymentID string) (*dto.PaymentResponseDTO, error) {
	// 1. Ambil data payment dari DB
	payment, err := h.paymentRepo.FindByID(ctx, paymentID)
	if err != nil {
		return nil, exceptions.ErrPaymentNotFound
	}

	// 2. Validasi: Hanya status SUCCESS yang bisa di-refund
	// Pending -> Cancel, Success -> Refund
	if string(payment.Status) != "success" {
		return nil, exceptions.ErrPaymentNotRefundable
	}

	// 3. Ambil Gateway yang sesuai (Midtrans/PayPal/dll)
	gateway, err := h.gatewayFactory.GetGateway(payment.GatewayName)
	if err != nil {
		log.Printf("Failed to get gateway for refund: %v", err)
		return nil, exceptions.ErrUnsupportedGateway
	}

	// 4. Eksekusi Refund di Gateway
	// Kita refund sejumlah Amount awal (Full Refund)
	// Jika ingin partial refund, perlu logic tambahan di command struct
	err = gateway.RefundPayment(ctx, payment.GatewayOrderID, payment.Amount)
	if err != nil {
		log.Printf("Gateway refund failed: %v", err)
		return nil, fmt.Errorf("gateway refund failed: %w", err)
	}

	// 5. Update Status di Database
	payment.Status = "refunded"
	now := time.Now()
	payment.UpdatedAt = now
	// Idealnya ada field RefundedAt di entity, tapi UpdatedAt cukup untuk sekarang

	if err := h.paymentRepo.Update(ctx, payment); err != nil {
		log.Printf("Failed to update payment status to refunded: %v", err)
		return nil, fmt.Errorf("failed to update payment: %w", err)
	}

	// 6. Publish Event (PENTING: Agar notifikasi service tahu dana dikembalikan)
	event := events.NewPaymentEvent(
		events.PaymentRefundedEvent, // Pastikan event type ini ada di domain/events
		payment.ID,
		payment.ApplicationID,
		payment.UserID,
		payment.Amount,
		payment.Currency,
		string(payment.Status),
		payment.GatewayName,
	)
	
	if err := h.eventPublisher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish payment refunded event: %v", err)
		// Jangan return error, karena refund sudah sukses secara teknis
	}

	// 7. Return Response
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
		CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
	}, nil
}