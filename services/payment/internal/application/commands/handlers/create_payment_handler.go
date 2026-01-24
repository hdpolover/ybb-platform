package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ybb-platform/payment/internal/application/commands"
	"github.com/ybb-platform/payment/internal/application/dto"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/events"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
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
	// Validate amount and currency
	if cmd.Amount <= 0 {
		return nil, exceptions.ErrInvalidAmount
	}

	if len(cmd.Currency) != 3 {
		return nil, exceptions.ErrInvalidCurrency
	}

	// Get payment gateway
	gateway, err := h.gatewayFactory.GetGateway(cmd.GatewayName)
	if err != nil {
		log.Printf("Failed to get gateway: %v", err)
		return nil, exceptions.ErrUnsupportedGateway
	}

	// TENTUKAN PAYMENT TYPE
	determinedPaymentType := "automatic"
	if cmd.GatewayName == "manual" {
		determinedPaymentType = "manual"
	}

	// Create payment entity
	payment := entities.NewPayment(
		cmd.ApplicationID,
		cmd.UserID,
		cmd.Amount,
		cmd.Currency,
		cmd.Description,
	)

	// Set Type & Method
	payment.PaymentType = entities.PaymentType(determinedPaymentType) // Set Manual/Automatic
	payment.PaymentMethod = entities.PaymentMethod(cmd.PaymentMethod)
	payment.GatewayName = cmd.GatewayName

	payment.CustomerName = cmd.CustomerName
	payment.CustomerEmail = cmd.CustomerEmail
	payment.CustomerPhone = cmd.CustomerPhone
	payment.CallbackURL = cmd.CallbackURL

	// 5. Save payment to database (status: pending)
	if err := h.paymentRepo.Create(ctx, payment); err != nil {
		log.Printf("Failed to create payment: %v", err)
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	// Create payment with gateway
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
			payment.CustomerEmail,
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

	// Update payment with gateway order ID (dan status jika perlu)
	if payment.PaymentType == "manual" {
		payment.GatewayOrderID = gatewayResp.GatewayOrderID
		
		payment.Status = entities.PaymentStatusPending 
	} else {
		// OTOMATIS (Midtrans/Xendit):
		// Biasanya langsung dianggap "Processing" (menunggu callback) atau tetap "Pending".
		payment.MarkAsProcessing(gatewayResp.GatewayOrderID)
	}

	if err := h.paymentRepo.Update(ctx, payment); err != nil {
		log.Printf("Failed to update payment: %v", err)
		return nil, fmt.Errorf("failed to update payment: %w", err)
	}

	// Publish payment created event
	event := events.NewPaymentEvent(
		events.PaymentCreatedEvent,
		payment.ID,
		payment.ApplicationID,
		payment.UserID,
		payment.CustomerEmail,
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

	// Return response (Mapping Entity ke DTO)
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
		RedirectURL:    gatewayResp.RedirectURL,
		Token:          gatewayResp.Token,
		CreatedAt:      payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      payment.UpdatedAt.Format(time.RFC3339),
	}, nil
}