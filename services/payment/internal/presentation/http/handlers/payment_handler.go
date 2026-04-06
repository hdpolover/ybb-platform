package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
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
	intentRepo     repositories.PaymentIntentRepository
	txRepo         repositories.PaymentTransactionRepository
	eventPublisher messaging.EventPublisher
	gatewayFactory *infraGateways.GatewayFactory
}

// NewPaymentHandler creates a new PaymentHandler
func NewPaymentHandler(
	intentRepo repositories.PaymentIntentRepository,
	txRepo repositories.PaymentTransactionRepository,
	eventPublisher messaging.EventPublisher,
	gatewayFactory *infraGateways.GatewayFactory,
) *PaymentHandler {
	return &PaymentHandler{
		intentRepo:     intentRepo,
		txRepo:         txRepo,
		eventPublisher: eventPublisher,
		gatewayFactory: gatewayFactory,
	}
}

// GetPayment godoc
// @Summary      Get Payment Details
// @Description  Get a payment transaction or payment intent by its ID
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

	if tx, err := h.txRepo.FindByID(c.Request.Context(), paymentID); err == nil {
		c.JSON(http.StatusOK, h.buildTransactionResponse(c.Request.Context(), tx))
		return
	}

	if intent, err := h.intentRepo.FindByID(c.Request.Context(), paymentID); err == nil {
		c.JSON(http.StatusOK, h.buildIntentResponse(c.Request.Context(), intent))
		return
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": "Payment resource not found",
	})
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

	limit := 10
	if value := c.Query("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit query parameter"})
			return
		}
		limit = parsed
	}

	offset := 0
	if value := c.Query("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset query parameter"})
			return
		}
		offset = parsed
	}

	page := 1
	if limit > 0 {
		page = (offset / limit) + 1
	}

	intents, total, err := h.intentRepo.FindAll(c.Request.Context(), repositories.PaymentIntentFilter{
		UserID: userID,
		Page:   page,
		Limit:  limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get payments",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"payments": buildIntentResponses(c.Request.Context(), h.txRepo, intents),
		"pagination": gin.H{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// HandleWebhook handles payment gateway webhook notifications
func (h *PaymentHandler) HandleWebhook(c *gin.Context) {
	// 1. Ambil nama gateway dari URL (contoh: /webhook/midtrans)
	gatewayName := c.Param("gateway")
	requestID := c.GetHeader("X-Request-ID")
	log.Printf("payment_webhook received request_id=%s gateway=%s", requestID, gatewayName)

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

	// 4. Inject gateway-specific headers into context for verification.
	// Xendit uses x-callback-token; other gateways verify via payload signatures.
	webhookCtx := c.Request.Context()
	if callbackToken := c.GetHeader("x-callback-token"); callbackToken != "" {
		webhookCtx = context.WithValue(webhookCtx, infraGateways.XenditCallbackTokenKey, callbackToken)
	}

	// 5. Suruh Gateway Memproses Data (Returns Legacy Entity 'Payment')
	// updatedData.ID here corresponds to Order ID sent to gateway
	updatedData, err := gateway.HandleWebhook(webhookCtx, payload)
	if err != nil {
		log.Printf("payment_webhook failed request_id=%s gateway=%s error=%v", requestID, gatewayName, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook processing failed", "details": err.Error()})
		return
	}

	// Webhooks only target the new transaction flow.
	tx, err := h.txRepo.FindByID(c.Request.Context(), updatedData.ID)
	if err == nil {
		h.handleTransactionWebhook(c, tx, updatedData)
		return
	}

	if updatedData.GatewayOrderID != "" {
		tx, err = h.txRepo.FindByGatewayReferenceID(c.Request.Context(), updatedData.GatewayOrderID)
		if err == nil {
			h.handleTransactionWebhook(c, tx, updatedData)
			return
		}
	}

	log.Printf("payment_webhook transaction_not_found request_id=%s gateway=%s transaction_id=%s gateway_reference=%s", requestID, gatewayName, updatedData.ID, updatedData.GatewayOrderID)
	c.JSON(http.StatusNotFound, gin.H{"error": "Order ID not found in payment transactions"})
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
	event.Metadata["transaction_id"] = tx.ID

	if err := h.eventPublisher.Publish(context.Background(), event); err != nil {
		log.Printf("publish_intent_event failed intent_id=%s transaction_id=%s event=%s error=%v", intent.ID, tx.ID, eventType, err)
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

	c.JSON(http.StatusNotFound, gin.H{"error": "Payment transaction not found"})
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

	c.JSON(http.StatusNotFound, gin.H{"error": "Payment transaction not found"})
}

// VerifyPaymentRequest represents the admin verification payload
type VerifyPaymentRequest struct {
	Action  string `json:"action"`   // "approve" or "reject"
	Reason  string `json:"reason"`   // Required if rejected
	AdminID string `json:"admin_id"` // Simulated Admin ID
}

func buildIntentResponses(ctx context.Context, txRepo repositories.PaymentTransactionRepository, intents []*entities.PaymentIntent) []gin.H {
	responses := make([]gin.H, 0, len(intents))
	for _, intent := range intents {
		responses = append(responses, buildIntentResponse(ctx, txRepo, intent))
	}
	return responses
}

func (h *PaymentHandler) buildIntentResponse(ctx context.Context, intent *entities.PaymentIntent) gin.H {
	return buildIntentResponse(ctx, h.txRepo, intent)
}

func buildIntentResponse(ctx context.Context, txRepo repositories.PaymentTransactionRepository, intent *entities.PaymentIntent) gin.H {
	transactions := []gin.H{}
	if txRepo != nil {
		if txs, err := txRepo.FindByIntentID(ctx, intent.ID); err == nil {
			transactions = make([]gin.H, 0, len(txs))
			for _, tx := range txs {
				transactions = append(transactions, buildTransactionResponse(ctx, txRepo, tx))
			}
		}
	}

	return gin.H{
		"id":             intent.ID,
		"type":           "intent",
		"user_id":        intent.UserID,
		"participant_id": intent.ParticipantID,
		"reference_type": intent.ReferenceType,
		"reference_id":   intent.ReferenceID,
		"amount":         intent.Amount,
		"currency":       intent.Currency,
		"status":         intent.Status,
		"metadata":       json.RawMessage(intent.Metadata),
		"created_at":     intent.CreatedAt,
		"updated_at":     intent.UpdatedAt,
		"transactions":   transactions,
	}
}

func (h *PaymentHandler) buildTransactionResponse(ctx context.Context, tx *entities.PaymentTransaction) gin.H {
	return buildTransactionResponse(ctx, h.txRepo, tx)
}

func buildTransactionResponse(ctx context.Context, txRepo repositories.PaymentTransactionRepository, tx *entities.PaymentTransaction) gin.H {
	var gatewayResponse interface{}
	if len(tx.GatewayResponse) > 0 {
		var raw map[string]interface{}
		if err := json.Unmarshal(tx.GatewayResponse, &raw); err == nil {
			gatewayResponse = raw
		}
	}

	return gin.H{
		"id":                   tx.ID,
		"type":                 "transaction",
		"intent_id":            tx.IntentID,
		"payment_method_id":    tx.PaymentMethodID,
		"gateway_reference_id": tx.GatewayReferenceID,
		"currency":             tx.Currency,
		"amount_total":         tx.AmountTotal,
		"amount_subtotal":      tx.AmountSubtotal,
		"fee_provider":         tx.FeeProvider,
		"net_amount":           tx.NetAmount,
		"status":               tx.Status,
		"gateway_response":     gatewayResponse,
		"error_code":           tx.ErrorCode,
		"proof_file_url":       tx.ProofFileURL,
		"admin_notes":          tx.AdminNotes,
		"reviewed_by":          tx.ReviewedBy,
		"reviewed_at":          tx.ReviewedAt,
		"created_at":           tx.CreatedAt,
		"updated_at":           tx.UpdatedAt,
	}
}
