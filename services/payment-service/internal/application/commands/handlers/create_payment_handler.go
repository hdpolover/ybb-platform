package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ybb-platform/payment-service/internal/application/commands"
	"github.com/ybb-platform/payment-service/internal/application/dto"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/domain/events"
	"github.com/ybb-platform/payment-service/internal/domain/exceptions"
	"github.com/ybb-platform/payment-service/internal/domain/gateways"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
	"github.com/ybb-platform/payment-service/internal/infrastructure/messaging"
)

// CreatePaymentHandler handles the CreatePaymentCommand
type CreatePaymentHandler struct {
	paymentRepo    repositories.PaymentRepository
	gatewayFactory gateways.GatewayFactory
	eventPublisher messaging.EventPublisher
}

// NewCreatePaymentHandler creates a new CreatePaymentHandler
func NewCreatePaymentHandler(
	paymentRepo repositories.PaymentRepository,
	gatewayFactory gateways.GatewayFactory,
	eventPublisher messaging.EventPublisher,
) *CreatePaymentHandler {
	return &CreatePaymentHandler{
		paymentRepo:    paymentRepo,
		gatewayFactory: gatewayFactory,
		eventPublisher: eventPublisher,
	}
}

// Handle executes the CreatePaymentCommand
func (h *CreatePaymentHandler) Handle(ctx context.Context, cmd *commands.CreatePaymentCommand) (*dto.PaymentResponseDTO, error) {
	// 1. Validate amount and currency
	if cmd.Amount <= 0 {
		return nil, exceptions.ErrInvalidAmount
	}

	if len(cmd.Currency) != 3 {
		return nil, exceptions.ErrInvalidCurrency
	}

	// 2. Get payment gateway
	gateway, err := h.gatewayFactory.GetGateway(cmd.GatewayName)
	if err != nil {
		log.Printf("Failed to get gateway: %v", err)
		return nil, exceptions.ErrUnsupportedGateway
	}

	// 3. TENTUKAN PAYMENT TYPE (Automatic vs Manual)
	// Defaultnya "automatic", tapi jika gatewaynya "manual", kita ubah.
	determinedPaymentType := "automatic"
	if cmd.GatewayName == "manual" {
		determinedPaymentType = "manual"
	}

	// 4. Create payment entity
	// PERBAIKAN: Masukkan Description di sini (bukan string kosong)
	payment := entities.NewPayment(
		cmd.ApplicationID,
		cmd.UserID,
		cmd.Amount,
		cmd.Currency,
		cmd.Description, // Menggunakan deskripsi dari request
	)

	// Set Type & Method
	payment.PaymentType = entities.PaymentType(determinedPaymentType) // Set Manual/Automatic
	payment.PaymentMethod = entities.PaymentMethod(cmd.PaymentMethod)
	payment.GatewayName = cmd.GatewayName

	// PERBAIKAN: Mapping data Customer & URL agar tersimpan di Database (Tidak NULL)
	payment.CustomerName = cmd.CustomerName
	payment.CustomerEmail = cmd.CustomerEmail
	payment.CustomerPhone = cmd.CustomerPhone
	payment.CallbackURL = cmd.CallbackURL

	// 5. Save payment to database (status: pending)
	if err := h.paymentRepo.Create(ctx, payment); err != nil {
		log.Printf("Failed to create payment: %v", err)
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	// 6. Create payment with gateway
	gatewayReq := &gateways.CreatePaymentRequest{
		Payment:       payment,
		PaymentMethod: entities.PaymentMethod(cmd.PaymentMethod),
		CallbackURL:   cmd.CallbackURL,
		CustomerName:  cmd.CustomerName,
		CustomerEmail: cmd.CustomerEmail,
		CustomerPhone: cmd.CustomerPhone,
	}

	gatewayResp, err := gateway.CreatePayment(ctx, gatewayReq)
	if err != nil {
		log.Printf("Gateway payment creation failed: %v", err)

		// Mark payment as failed
		payment.MarkAsFailed()
		if updateErr := h.paymentRepo.Update(ctx, payment); updateErr != nil {
			log.Printf("Failed to update payment status: %v", updateErr)
		}

		// Publish payment failed event
		event := events.NewPaymentEvent(
			events.PaymentFailedEvent,
			payment.ID,
			payment.ApplicationID,
			payment.UserID,
			payment.Amount,
			payment.Currency,
			string(payment.Status),
			payment.GatewayName,
		)
		event.Metadata["error"] = err.Error()

		if pubErr := h.eventPublisher.Publish(ctx, event); pubErr != nil {
			log.Printf("Failed to publish payment failed event: %v", pubErr)
		}

		return nil, fmt.Errorf("gateway payment creation failed: %w", err)
	}

	// 7. Update payment with gateway order ID (dan status jika perlu)
	payment.MarkAsProcessing(gatewayResp.GatewayOrderID)

	if err := h.paymentRepo.Update(ctx, payment); err != nil {
		log.Printf("Failed to update payment: %v", err)
		return nil, fmt.Errorf("failed to update payment: %w", err)
	}

	// 8. Publish payment created event
	event := events.NewPaymentEvent(
		events.PaymentCreatedEvent,
		payment.ID,
		payment.ApplicationID,
		payment.UserID,
		payment.Amount,
		payment.Currency,
		string(payment.Status),
		payment.GatewayName,
	)
	
	// Tambahkan metadata lengkap untuk kebutuhan notifikasi/log
	event.Metadata["payment_type"] = string(payment.PaymentType)
	event.Metadata["customer_email"] = payment.CustomerEmail
	event.Metadata["customer_name"] = payment.CustomerName
	event.Metadata["description"] = payment.Description

	if err := h.eventPublisher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish payment created event: %v", err)
	}

	// 9. Return response (Mapping Entity ke DTO)
	return &dto.PaymentResponseDTO{
		ID:             payment.ID,
		ApplicationID:  payment.ApplicationID,
		UserID:         payment.UserID,
		Amount:         payment.Amount,
		Currency:       payment.Currency,
		Status:         string(payment.Status),
		
		// PERBAIKAN: Kembalikan payment_type dari entity (manual/automatic)
		PaymentType:    string(payment.PaymentType), 
		
		PaymentMethod:  string(payment.PaymentMethod),
		GatewayName:    payment.GatewayName,
		GatewayOrderID: payment.GatewayOrderID,
		Description:    payment.Description, // Deskripsi sudah tidak kosong
		RedirectURL:    gatewayResp.RedirectURL,
		CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
	}, nil
}