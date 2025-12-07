package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment-service/internal/application/commands"
	commandHandlers "github.com/ybb-platform/payment-service/internal/application/commands/handlers"
	"github.com/ybb-platform/payment-service/internal/application/queries"
	queryHandlers "github.com/ybb-platform/payment-service/internal/application/queries/handlers"

	"github.com/ybb-platform/payment-service/internal/domain/repositories"
	"github.com/ybb-platform/payment-service/internal/infrastructure/messaging"
	infraGateways "github.com/ybb-platform/payment-service/internal/infrastructure/gateways" // <--- TAMBAH INI
	"github.com/ybb-platform/payment-service/internal/domain/events"
)

// PaymentHandler handles payment-related HTTP requests
type PaymentHandler struct {
	createPaymentHandler *commandHandlers.CreatePaymentHandler
	getPaymentHandler    *queryHandlers.GetPaymentHandler

	paymentRepo          repositories.PaymentRepository
	eventPublisher       messaging.EventPublisher
	gatewayFactory *infraGateways.GatewayFactory
}

// NewPaymentHandler creates a new PaymentHandler
func NewPaymentHandler(
	createPaymentHandler *commandHandlers.CreatePaymentHandler,
	getPaymentHandler *queryHandlers.GetPaymentHandler,

	paymentRepo repositories.PaymentRepository,
	eventPublisher messaging.EventPublisher,
	gatewayFactory *infraGateways.GatewayFactory,
) *PaymentHandler {
	return &PaymentHandler{
		createPaymentHandler: createPaymentHandler,
		getPaymentHandler:    getPaymentHandler,

		paymentRepo:          paymentRepo,
		eventPublisher:       eventPublisher,
		gatewayFactory:       gatewayFactory,
	}
}

// CreatePayment handles payment creation requests
func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var cmd commands.CreatePaymentCommand
	if err := c.ShouldBindJSON(&cmd); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Execute command
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

// GetPayment handles get payment by ID requests
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

// GetPaymentsByUser handles get payments by user ID requests
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
// TODO for intern: Implement webhook handling with signature verification
func (h *PaymentHandler) HandleWebhook(c *gin.Context) {
	// TODO: Verify webhook signature
	// TODO: Parse webhook payload
	// TODO: Update payment status
	// TODO: Publish event

	// c.JSON(http.StatusOK, gin.H{
	// 	"status": "received",
	// })

	// 1. Ambil nama gateway dari URL (misal: /webhook/midtrans)
	gatewayName := c.Param("gateway")

	// 2. Baca Body Request (Payload dari Midtrans)
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

	// 4. Suruh Gateway Memproses Data (Verifikasi Signature & Parsing Status)
	updatedData, err := gateway.HandleWebhook(c.Request.Context(), payload)
	if err != nil {
		// Log error untuk debug, tapi jangan kasih detail ke user luar
		fmt.Printf("[WEBHOOK ERROR] Gateway: %s, Error: %v\n", gatewayName, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook processing failed", "details": err.Error()})
		return
	}

	// 5. Cari Data Asli di Database
	payment, err := h.paymentRepo.FindByID(c.Request.Context(), updatedData.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order ID not found"})
		return
	}

	// 6. Cek apakah status berubah? (Supaya tidak spam notifikasi)
	if payment.Status != updatedData.Status {
		// Update data di memori
		payment.Status = updatedData.Status
		payment.GatewayResponse = updatedData.GatewayResponse
		payment.UpdatedAt = time.Now()

		if payment.Status == "success" {
			now := time.Now()
			payment.PaidAt = &now
		} else if payment.Status == "failed" {
			now := time.Now()
			payment.FailedAt = &now
		}

		// Simpan ke Database
		if err := h.paymentRepo.Update(c.Request.Context(), payment); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment status"})
			return
		}

		// 7. KIRIM NOTIFIKASI (RabbitMQ)
		// Kita gunakan logic yang sama persis seperti di VerifyPayment
		go func() {
			eventType := events.PaymentSucceededEvent
			if string(payment.Status) == "failed" {
				eventType = events.PaymentFailedEvent
			}

			// Buat Event object
			event := events.NewPaymentEvent(
				eventType,
				payment.ID,
				payment.ApplicationID,
				payment.UserID,
				payment.Amount,
				payment.Currency,
				string(payment.Status),
				payment.GatewayName,
			)

			// Tambahkan Metadata
			event.Metadata["customer_email"] = payment.CustomerEmail
			event.Metadata["customer_name"] = payment.CustomerName
			event.Metadata["source"] = "webhook"

			// Kirim ke RabbitMQ
			err := h.eventPublisher.Publish(context.Background(), event)
			if err != nil {
				fmt.Printf("[RABBITMQ] ERROR sending webhook event: %v\n", err)
			} else {
				fmt.Printf("[RABBITMQ] Webhook Event Sent: %s -> %s\n", eventType, payment.ID)
			}
		}()
	}

	// Return 200 OK ke Midtrans agar tidak dikirim ulang
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// FITUR MANUAL PAYMENT
func (h *PaymentHandler) UploadProof(c *gin.Context) {
    transactionID := c.Param("id")

    file, err := c.FormFile("file")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "File bukti transfer wajib diupload"})
        return
    }

    // --- KODE BARU: SIMPAN FILE KE FOLDER ---
    // Pastikan folder "uploads" sudah dibuat manual di VS Code
    filePath := "./uploads/" + file.Filename
    
    // Simpan file dari memori ke harddisk
    if err := c.SaveUploadedFile(file, filePath); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file", "details": err.Error()})
        return
    }
    // ----------------------------------------

    fmt.Printf("[LOG] File Tersimpan di: %s\n", filePath)

    c.JSON(http.StatusOK, gin.H{
        "status":         "success",
        "message":        "Bukti transfer berhasil disimpan",
        "file_path":      filePath,
        "transaction_id": transactionID,
    })
}

// VerifyPaymentRequest represents the admin verification payload
type VerifyPaymentRequest struct {
    Action  string `json:"action"`   // "approve" or "reject"
    Reason  string `json:"reason"`   // Required if rejected
    AdminID string `json:"admin_id"` // Simulated Admin ID
}

// VerifyPayment handles the admin approval or rejection process
func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
    paymentID := c.Param("id")

    var req VerifyPaymentRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
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