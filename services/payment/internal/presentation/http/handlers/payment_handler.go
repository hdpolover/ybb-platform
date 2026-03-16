package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment/internal/application/commands"
	commandHandlers "github.com/ybb-platform/payment/internal/application/commands/handlers"
	"github.com/ybb-platform/payment/internal/application/queries"
	queryHandlers "github.com/ybb-platform/payment/internal/application/queries/handlers"

	"github.com/ybb-platform/payment/internal/application/dto"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/events"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	infraGateways "github.com/ybb-platform/payment/internal/infrastructure/gateways"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
)

type FileServiceResponse struct {
	File struct {
		ID          string `json:"id"`
		StoragePath string `json:"storage_path"`
		Filename    string `json:"filename"`
	} `json:"file"`
	Message string `json:"message"`
}

// PaymentHandler handles payment-related HTTP requests
type PaymentHandler struct {
	createPaymentHandler *commandHandlers.CreatePaymentHandler
	getPaymentHandler    *queryHandlers.GetPaymentHandler

	verifyStatusHandler  *commandHandlers.VerifyStatusHandler
	cancelPaymentHandler *commandHandlers.CancelPaymentHandler
	refundPaymentHandler *commandHandlers.RefundPaymentHandler
	retryPaymentHandler  *commandHandlers.RetryPaymentHandler

	paymentRepo    repositories.PaymentRepository
	intentRepo     repositories.PaymentIntentRepository
	txRepo         repositories.PaymentTransactionRepository
	eventPublisher messaging.EventPublisher
	gatewayFactory *infraGateways.GatewayFactory
}

// NewPaymentHandler creates a new PaymentHandler
func NewPaymentHandler(
	createPaymentHandler *commandHandlers.CreatePaymentHandler,
	getPaymentHandler *queryHandlers.GetPaymentHandler,

	verifyStatusHandler *commandHandlers.VerifyStatusHandler,
	cancelHandler *commandHandlers.CancelPaymentHandler,
	refundPaymentHandler *commandHandlers.RefundPaymentHandler,
	retryHandler *commandHandlers.RetryPaymentHandler,

	paymentRepo repositories.PaymentRepository,
	intentRepo repositories.PaymentIntentRepository,
	txRepo repositories.PaymentTransactionRepository,
	eventPublisher messaging.EventPublisher,
	gatewayFactory *infraGateways.GatewayFactory,
) *PaymentHandler {
	return &PaymentHandler{
		createPaymentHandler: createPaymentHandler,
		getPaymentHandler:    getPaymentHandler,

		verifyStatusHandler:  verifyStatusHandler,
		cancelPaymentHandler: cancelHandler,
		refundPaymentHandler: refundPaymentHandler,
		retryPaymentHandler:  retryHandler,

		paymentRepo:    paymentRepo,
		intentRepo:     intentRepo,
		txRepo:         txRepo,
		eventPublisher: eventPublisher,
		gatewayFactory: gatewayFactory,
	}
}

// CreatePayment godoc
// @Summary      Create Payment Intent
// @Description  Create a new payment intent and get checkout information
// @Tags         Payments
// @Accept       json
// @Produce      json
// @Param        request body dto.CreatePaymentDTO true "Payment Request Data"
// @Success      201  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /payments [post]
func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	// 1. Gunakan DTO untuk menangkap JSON (Pastikan import dto sudah ada)
	var req dto.CreatePaymentDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// 2. MAPPING DARI DTO KE COMMAND (Ini langkah krusial yang sebelumnya hilang/salah)
	cmd := commands.CreatePaymentCommand{
		ApplicationID: req.ApplicationID,
		UserID:        req.UserID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		PaymentMethod: req.PaymentMethod,
		GatewayName:   req.GatewayName,

		// Data yang kemarin kosong, sekarang kita isi manual:
		Description:   req.Description,   // Sekarang Command sudah punya field ini
		CustomerName:  req.CustomerName,  // Pindahkan dari req ke cmd
		CustomerEmail: req.CustomerEmail, // Pindahkan dari req ke cmd
		CustomerPhone: req.CustomerPhone, // Pindahkan dari req ke cmd
		CallbackURL:   req.CallbackURL,   // Pindahkan dari req ke cmd
	}

	// 3. Eksekusi Command
	response, err := h.createPaymentHandler.Handle(c.Request.Context(), &cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create payment",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, response)
}

// GetPayment godoc
// @Summary      Get Payment Details
// @Description  Get payment details by its ID
// @Tags         Payments
// @Produce      json
// @Param        id   path      string  true  "Payment ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]interface{}
// @Router       /payments/{id} [get]
func (h *PaymentHandler) GetPayment(c *gin.Context) {
	paymentID := c.Param("id")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Payment ID is required",
		})
		return
	}

	query := queries.NewGetPaymentByIDQuery(paymentID)
	response, err := h.getPaymentHandler.HandleGetByID(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Payment not found",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetPaymentsByUser godoc
// @Summary      Get User's Payments
// @Description  Get list of payments for a user with pagination
// @Tags         Payments
// @Produce      json
// @Param        userId  path      string  true  "User UUID"
// @Param        limit   query     int     false "Limit (default 10)"
// @Param        offset  query     int     false "Offset (default 0)"
// @Success      200     {object}  map[string]interface{}
// @Failure      400     {object}  map[string]interface{}
// @Failure      500     {object}  map[string]interface{}
// @Router       /payments/user/{userId} [get]
func (h *PaymentHandler) GetPaymentsByUser(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "User ID is required",
		})
		return
	}

	// Get pagination parameters
	limit := 10
	offset := 0
	if l := c.Query("limit"); l != "" {
		// Parse limit
	}
	if o := c.Query("offset"); o != "" {
		// Parse offset
	}

	query := queries.NewGetPaymentsByUserIDQuery(userID, limit, offset)
	response, err := h.getPaymentHandler.HandleGetByUserID(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get payments",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"payments": response,
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}

// HandleWebhook handles payment gateway webhook notifications
func (h *PaymentHandler) HandleWebhook(c *gin.Context) {
	// 1. Ambil nama gateway dari URL (contoh: /webhook/midtrans)
	gatewayName := c.Param("gateway")

	// 2. Baca Body Request (Payload Mentah dari Midtrans/Gateway lain)
	payload, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// 3. Ambil Gateway yang sesuai dari Factory
	gateway, err := h.gatewayFactory.GetGateway(gatewayName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported gateway"})
		return
	}

	// 4. Suruh Gateway Memproses Data (Returns Legacy Entity 'Payment')
	// updatedData.ID here corresponds to Order ID sent to gateway
	updatedData, err := gateway.HandleWebhook(c.Request.Context(), payload)
	if err != nil {
		fmt.Printf("[WEBHOOK ERROR] Gateway: %s, Error: %v\n", gatewayName, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook processing failed", "details": err.Error()})
		return
	}

	// 5. Try to handle as NEW FLOW (Transaction) first
	tx, err := h.txRepo.FindByID(c.Request.Context(), updatedData.ID)
	if err == nil {
		// Found in Transaction Repo! Use new flow.
		h.handleTransactionWebhook(c, tx, updatedData)
		return
	}

	// 6. Fallback: Legacy Flow (Find in 'payments' table)
	payment, err := h.paymentRepo.FindByID(c.Request.Context(), updatedData.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order ID not found in transactions or legacy payments"})
		return
	}

	// 7. Legacy Logic (Unchanged)
	if payment.Status != updatedData.Status {
		payment.Status = updatedData.Status
		payment.GatewayResponse = updatedData.GatewayResponse
		payment.UpdatedAt = time.Now()

		switch payment.Status {
		case "success":
			now := time.Now()
			payment.PaidAt = &now
		case "failed":
			now := time.Now()
			payment.FailedAt = &now
		}

		if err := h.paymentRepo.Update(c.Request.Context(), payment); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment status"})
			return
		}

		// Publish Legacy Event
		go func() {
			eventType := events.PaymentSucceededEvent
			if string(payment.Status) == "failed" {
				eventType = events.PaymentFailedEvent
			}

			event := events.NewPaymentEvent(
				eventType,
				payment.ID,
				payment.ApplicationID,
				payment.UserID,
				payment.CustomerEmail,
				payment.Amount,
				payment.Currency,
				string(payment.Status),
				payment.GatewayName,
			)

			event.Metadata["customer_email"] = payment.CustomerEmail
			event.Metadata["customer_name"] = payment.CustomerName
			event.Metadata["source"] = "webhook"

			err := h.eventPublisher.Publish(context.Background(), event)
			if err != nil {
				fmt.Printf("[RABBITMQ] ERROR sending webhook event: %v\n", err)
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) handleTransactionWebhook(c *gin.Context, tx *entities.PaymentTransaction, updatedData *entities.Payment) {
	// Map Status
	var newStatus entities.TransactionStatus
	switch updatedData.Status {
	case entities.PaymentStatusSuccess:
		newStatus = entities.TransactionStatusSuccess
	case entities.PaymentStatusFailed, entities.PaymentStatusCancelled:
		newStatus = entities.TransactionStatusFailed
	default:
		newStatus = entities.TransactionStatusPending
	}

	// Check change
	if tx.Status == newStatus {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "no change"})
		return
	}

	// Update Transaction
	tx.Status = newStatus
	if rawBytes, err := json.Marshal(updatedData.GatewayResponse); err == nil {
		tx.GatewayResponse = rawBytes
	}
	if err := h.txRepo.Update(c.Request.Context(), tx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update transaction"})
		return
	}

	// Find associated Intent
	intent, err := h.intentRepo.FindByID(c.Request.Context(), tx.IntentID)
	if err != nil {
		// Log error but assume success for gateway
		fmt.Printf("Intent not found for tx %s: %v\n", tx.ID, err)
		c.JSON(http.StatusOK, gin.H{"status": "ok", "warning": "intent not found"})
		return
	}

	// Update Intent if Success
	if newStatus == entities.TransactionStatusSuccess {
		intent.Status = entities.PaymentIntentStatusSucceeded
		h.intentRepo.Update(c.Request.Context(), intent)

		// Publish Succeeded Event (New Format)
		go h.publishIntentEvent(intent, tx, events.PaymentSucceededEvent)
	} else if newStatus == entities.TransactionStatusFailed {
		// We don't fail the INTENT immediately, because user might retry (create new transaction).
		// But we publish a transaction failure event.
		// h.intentRepo.Update(c.Request.Context(), intent) // Keep intent as PROCESSING
		go h.publishIntentEvent(intent, tx, events.PaymentFailedEvent)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) publishIntentEvent(intent *entities.PaymentIntent, tx *entities.PaymentTransaction, eventType events.EventType) {
	// Extract email
	email := ""
	if len(intent.Metadata) > 0 {
		var meta map[string]interface{}
		if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
			if e, ok := meta["email"].(string); ok {
				email = e
			}
			if e, ok := meta["customer_email"].(string); ok && email == "" {
				email = e
			}
		}
	}

	event := events.NewPaymentEvent(
		eventType,
		tx.ID,
		intent.ReferenceID,
		intent.UserID,
		email,
		intent.Amount,
		intent.Currency,
		string(tx.Status),
		tx.PaymentMethodID,
	)

	// Populate metadata
	if len(intent.Metadata) > 0 {
		var meta map[string]interface{}
		if err := json.Unmarshal(intent.Metadata, &meta); err == nil {
			event.Metadata = meta
		}
	}
	event.Metadata["source"] = "webhook"
	event.Metadata["intent_id"] = intent.ID

	if err := h.eventPublisher.Publish(context.Background(), event); err != nil {
		fmt.Printf("[RABBITMQ] Failed to publish intent event: %v\n", err)
	}
}

// UploadProof godoc
// @Summary      Upload Bukti Transfer (Submit URL)
// @Description  Menerima URL Bukti Transfer yang sudah diupload oleh API/File Service
// @Tags         Manual Payment
// @Accept       json
// @Produce      json
// @Param        id   path      string          true  "Transaction ID (UUID)"
// @Param        body body      UploadProofReq  true  "Data File (ID & URL)"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /payments/{id}/proof [post]
func (h *PaymentHandler) UploadProof(c *gin.Context) {
	paymentID := c.Param("id")

	var req UploadProofReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	if req.FileID == "" || req.FileURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "file_id and file_url are required",
		})
		return
	}

	// New flow: proof is attached to a payment transaction.
	if tx, err := h.txRepo.FindByID(c.Request.Context(), paymentID); err == nil {
		tx.ProofFileURL = req.FileURL
		tx.Status = entities.TransactionStatusNeedsReview
		tx.UpdatedAt = time.Now()

		responsePayload := map[string]interface{}{
			"file_id":  req.FileID,
			"file_url": req.FileURL,
		}
		if len(tx.GatewayResponse) > 0 {
			var existing map[string]interface{}
			if err := json.Unmarshal(tx.GatewayResponse, &existing); err == nil {
				for key, value := range existing {
					responsePayload[key] = value
				}
			}
		}
		if rawBytes, marshalErr := json.Marshal(responsePayload); marshalErr == nil {
			tx.GatewayResponse = rawBytes
		}

		if err := h.txRepo.Update(c.Request.Context(), tx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update transaction proof"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Proof uploaded successfully. Waiting for admin review.",
			"data": gin.H{
				"transaction_id": tx.ID,
				"status":         tx.Status,
				"file_id":        req.FileID,
				"file_url":       req.FileURL,
			},
		})
		return
	}

	// Update Database
	err := h.paymentRepo.UpdateProof(c.Request.Context(), paymentID, req.FileID, req.FileURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Bukti transfer berhasil disubmit",
		"data": gin.H{
			"payment_id": paymentID,
			"file_id":    req.FileID,
			"file_url":   req.FileURL,
		},
	})
}

type UploadProofReq struct {
	FileID  string `json:"file_id"`
	FileURL string `json:"file_url"`
}

// VerifyPayment godoc
// @Summary      Verifikasi Pembayaran (Admin)
// @Description  Admin menyetujui (Approve) atau menolak (Reject) pembayaran manual
// @Tags         Manual Payment
// @Accept       json
// @Produce      json
// @Param        id      path  string                true  "Transaction ID (UUID)"
// @Param        request body  VerifyPaymentRequest  true  "Data Verifikasi (Action & Admin ID)"
// @Success      200     {object}  map[string]interface{}
// @Failure      400     {object}  map[string]interface{}
// @Failure      404     {object}  map[string]interface{}
// @Router       /payments/{id}/verify [post]
func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	paymentID := c.Param("id")

	var req VerifyPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if tx, err := h.txRepo.FindByID(c.Request.Context(), paymentID); err == nil {
		intent, intentErr := h.intentRepo.FindByID(c.Request.Context(), tx.IntentID)
		if intentErr != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Intent not found"})
			return
		}

		now := time.Now()
		tx.ReviewedAt = &now
		tx.UpdatedAt = now
		if req.AdminID != "" {
			adminID := req.AdminID
			tx.ReviewedBy = &adminID
		}

		switch req.Action {
		case "approve":
			tx.Status = entities.TransactionStatusSuccess
			intent.Status = entities.PaymentIntentStatusSucceeded
			tx.AdminNotes = ""
		case "reject":
			if req.Reason == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is required for rejection"})
				return
			}
			tx.Status = entities.TransactionStatusRejected
			tx.AdminNotes = req.Reason
			tx.ErrorCode = "MANUAL_REJECTED"
			intent.Status = entities.PaymentIntentStatusRequiresMethod
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action. Use 'approve' or 'reject'"})
			return
		}

		if err := h.txRepo.Update(c.Request.Context(), tx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update transaction"})
			return
		}
		if err := h.intentRepo.Update(c.Request.Context(), intent); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment intent"})
			return
		}

		go func() {
			eventType := events.PaymentSucceededEvent
			if tx.Status == entities.TransactionStatusRejected {
				eventType = events.PaymentFailedEvent
			}
			h.publishIntentEvent(intent, tx, eventType)
		}()

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Manual transaction verification processed successfully",
			"data": gin.H{
				"transaction_id":     tx.ID,
				"transaction_status": tx.Status,
				"intent_id":          intent.ID,
				"intent_status":      intent.Status,
			},
		})
		return
	}

	payment, err := h.paymentRepo.FindByID(c.Request.Context(), paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	status := string(payment.Status)
	if status != "pending" && status != "processing" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Payment status is not pending or processing. Current status: " + status,
		})
		return
	}

	// if payment.PaymentType != "manual" {
	//     c.JSON(http.StatusBadRequest, gin.H{
	//         "error": "This endpoint is for manual payment verification only. For automatic gateways, use verify-status.",
	//     })
	//     return
	// }

	switch req.Action {
	case "approve":
		payment.VerifyManual(req.AdminID)
	case "reject":
		if req.Reason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is required for rejection"})
			return
		}
		payment.RejectManual(req.AdminID, req.Reason)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action. Use 'approve' or 'reject'"})
		return
	}

	if err := h.paymentRepo.Update(c.Request.Context(), payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment"})
		return
	}

	// --- FITUR NOTIFIKASI (RABBITMQ) ---
	go func() {
		eventType := events.PaymentSucceededEvent
		if string(payment.Status) == "failed" {
			eventType = events.PaymentFailedEvent
		}

		event := events.NewPaymentEvent(
			eventType,
			payment.ID,
			payment.ApplicationID,
			payment.UserID,
			payment.CustomerEmail,
			payment.Amount,
			payment.Currency,
			string(payment.Status),
			payment.GatewayName,
		)

		event.Metadata["customer_email"] = payment.CustomerEmail
		event.Metadata["customer_name"] = payment.CustomerName

		if payment.RejectedReason != "" {
			event.Metadata["reason"] = payment.RejectedReason
		}

		err := h.eventPublisher.Publish(context.Background(), event)

		if err != nil {
			fmt.Printf("[RABBITMQ] ERROR sending event: %v\n", err)
		} else {
			fmt.Printf("[RABBITMQ] Success! Sent event type: %s for Payment ID: %s\n", eventType, payment.ID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Payment verification processed successfully",
		"data":    payment,
	})
}

// VerifyPaymentRequest represents the admin verification payload
type VerifyPaymentRequest struct {
	Action  string `json:"action"`   // "approve" or "reject"
	Reason  string `json:"reason"`   // Required if rejected
	AdminID string `json:"admin_id"` // Simulated Admin ID
}

// RefundPayment handles payment refund requests
// @Summary      Refund Payment
// @Description  Refunds a successful payment
// @Tags         Payments
// @Param        id   path      string  true  "Payment ID"
// @Success      200  {object}  dto.PaymentResponseDTO
// @Router       /payments/{id}/refund [post]
func (h *PaymentHandler) RefundPayment(c *gin.Context) {
	// TODO: Implement refund logic with Midtrans Core API.
	// Currently disabled due to unfinished testing and error handling.
	// See: payment_service/issues/refund-bug
	c.JSON(http.StatusOK, gin.H{
		"message": "Fitur refund dinonaktifkan sementara (silakan cek Dashboard Midtrans)",
	})
}

// CancelPayment godoc
// @Summary      Cancel Payment
// @Description  Cancel a pending payment
// @Tags         Payments
// @Param        id   path      string  true  "Payment ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /payments/{id}/cancel [post]
func (h *PaymentHandler) CancelPayment(c *gin.Context) {
	id := c.Param("id")
	resp, err := h.cancelPaymentHandler.Handle(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Payment cancelled", "data": resp})
}

// VerifyPaymentStatus godoc
// @Summary      Verify Payment Status
// @Description  Check payment status from Gateway (now disabled/noop)
// @Tags         Payments
// @Param        id   path      string  true  "Payment ID"
// @Success      200  {object}  map[string]interface{}
// @Router       /payments/{id}/verify-status [post]
func (h *PaymentHandler) VerifyPaymentStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Fitur verify status otomatis dinonaktifkan (Silakan cek Dashboard Midtrans)",
	})
}

// RetryPayment godoc
// @Summary      Retry Payment
// @Description  Create a new transaction based on failed/expired payment
// @Tags         Payments
// @Accept       json
// @Produce      json
// @Param        id   path      string  true  "Old Transaction ID"
// @Success      200  {object}  dto.PaymentResponseDTO
// @Failure      400  {object}  map[string]interface{}
// @Router       /payments/{id}/retry [post]
func (h *PaymentHandler) RetryPayment(c *gin.Context) {
	id := c.Param("id")

	// Panggil Application Layer
	resp, err := h.retryPaymentHandler.Handle(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment retried successfully",
		"data":    resp,
	})
}
