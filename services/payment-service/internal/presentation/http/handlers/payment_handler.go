package handlers

import (
	"context"
	"fmt"
	"net/http"
	"net/textproto"
	"time"
	"bytes"
	"io"
	"mime/multipart"
	"encoding/json"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment-service/internal/application/commands"
	commandHandlers "github.com/ybb-platform/payment-service/internal/application/commands/handlers"
	"github.com/ybb-platform/payment-service/internal/application/queries"
	queryHandlers "github.com/ybb-platform/payment-service/internal/application/queries/handlers"

	"github.com/ybb-platform/payment-service/internal/application/dto"

	"github.com/ybb-platform/payment-service/internal/domain/events"
	"github.com/ybb-platform/payment-service/internal/domain/repositories"
	infraGateways "github.com/ybb-platform/payment-service/internal/infrastructure/gateways"
	"github.com/ybb-platform/payment-service/internal/infrastructure/messaging"
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

	paymentRepo          repositories.PaymentRepository
	eventPublisher       messaging.EventPublisher
	gatewayFactory *infraGateways.GatewayFactory
}

// NewPaymentHandler creates a new PaymentHandler
func NewPaymentHandler(
	createPaymentHandler *commandHandlers.CreatePaymentHandler,
	getPaymentHandler *queryHandlers.GetPaymentHandler,

	verifyStatusHandler *commandHandlers.VerifyStatusHandler,
	cancelHandler *commandHandlers.CancelPaymentHandler,
	refundPaymentHandler *commandHandlers.RefundPaymentHandler,

	paymentRepo repositories.PaymentRepository,
	eventPublisher messaging.EventPublisher,
	gatewayFactory *infraGateways.GatewayFactory,
) *PaymentHandler {
	return &PaymentHandler{
		createPaymentHandler: createPaymentHandler,
		getPaymentHandler:    getPaymentHandler,

		verifyStatusHandler:  verifyStatusHandler,
		cancelPaymentHandler: cancelHandler,
		refundPaymentHandler: refundPaymentHandler,

		paymentRepo:          paymentRepo,
		eventPublisher:       eventPublisher,
		gatewayFactory:       gatewayFactory,
	}
}

// CreatePayment handles payment creation requests
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
	// (Otomatis memilih MidtransGateway atau XenditGateway sesuai URL)
	gateway, err := h.gatewayFactory.GetGateway(gatewayName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported gateway"})
		return
	}

	// 4. Suruh Gateway Memproses Data
	// (Di sini letak 'Generic'-nya. Gateway akan validasi signature & parsing status sendiri-sendiri)
	updatedData, err := gateway.HandleWebhook(c.Request.Context(), payload)
	if err != nil {
		// Log error di server, tapi jangan kasih detail error sensitif ke public response
		fmt.Printf("[WEBHOOK ERROR] Gateway: %s, Error: %v\n", gatewayName, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook processing failed", "details": err.Error()})
		return
	}

	// 5. Cari Data Asli di Database berdasarkan ID yang didapat dari gateway
	payment, err := h.paymentRepo.FindByID(c.Request.Context(), updatedData.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order ID not found"})
		return
	}

	// 6. Cek apakah status berubah? (Supaya tidak spam update/notifikasi jika gateway kirim berkali-kali)
	if payment.Status != updatedData.Status {
		// Update data di object memory
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

		// Simpan perubahan ke Database
		if err := h.paymentRepo.Update(c.Request.Context(), payment); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment status"})
			return
		}

		// KIRIM NOTIFIKASI (RabbitMQ)
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

			// Kirim ke RabbitMQ (Gunakan context.Background karena request HTTP utama mungkin sudah selesai)
			err := h.eventPublisher.Publish(context.Background(), event)
			if err != nil {
				fmt.Printf("[RABBITMQ] ERROR sending webhook event: %v\n", err)
			} else {
				fmt.Printf("[RABBITMQ] Webhook Event Sent: %s -> %s\n", eventType, payment.ID)
			}
		}()
	}

	// 8. Return 200 OK ke Gateway (Midtrans/dll) agar mereka tahu kita sudah terima datanya
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// UploadProof godoc
// @Summary      Upload Bukti Transfer
// @Description  User mengupload foto bukti transfer untuk pembayaran manual
// @Tags         Manual Payment
// @Accept       multipart/form-data
// @Produce      json
// @Param        id   path      string  true  "Transaction ID (UUID)"
// @Param        file formData  file    true  "File Gambar Bukti Transfer (JPG/PNG)"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /payments/{id}/proof [post]
// UploadProof handles manual payment proof upload
func (h *PaymentHandler) UploadProof(c *gin.Context) {
	paymentID := c.Param("id")

	// 1. Ambil File dari User
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File bukti transfer wajib diupload"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuka file"})
		return
	}
	defer file.Close()

	// 2. Siapkan Multipart Request (Versi Lengkap)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// A. Buat Part File dengan Content-Type yang Benar
	mh := make(textproto.MIMEHeader)
	mh.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, "file", fileHeader.Filename))
	mh.Set("Content-Type", fileHeader.Header.Get("Content-Type")) // Oper Content-Type asli

	part, err := writer.CreatePart(mh)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat part file"})
		return
	}
	_, err = io.Copy(part, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyalin file"})
		return
	}

	// B. Isi Field-Field Wajib (Sesuai Dokumentasi File Service)
	// Pastikan bucket "payment-proofs" sudah dibuat di MinIO console!
	_ = writer.WriteField("bucket", "payment-proofs")
	_ = writer.WriteField("brand_id", "ybb")
	_ = writer.WriteField("user_id", "payment-system")

	writer.Close() // Tutup writer

	// 3. Tentukan URL File Service
	// Menggunakan nama service docker "file-service"
	fileServiceHost := os.Getenv("FILE_SERVICE_URL")
	if fileServiceHost == "" {
		// Default untuk komunikasi antar container di Docker network yang sama
		fileServiceHost = "http://file-service:8001/api/v1/files/upload"
	}

	req, err := http.NewRequest("POST", fileServiceHost, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat request"})
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// 4. Kirim Request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "File Service tidak merespon", "details": err.Error()})
		return
	}
	defer resp.Body.Close()

	// 5. Cek Response
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("[FILE SERVICE ERROR] Status: %d, Body: %s\n", resp.StatusCode, string(respBody))

		c.JSON(resp.StatusCode, gin.H{
			"error":       "Gagal upload ke File Service",
			"status_code": resp.StatusCode,
			"details":     string(respBody),
		})
		return
	}

	// 6. Parsing Sukses
	var fileResp FileServiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&fileResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Format response tidak valid"})
		return
	}

	// 7. Update Database
	err = h.paymentRepo.UpdateProof(c.Request.Context(), paymentID, fileResp.File.ID, fileResp.File.StoragePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Bukti transfer berhasil diupload",
		"data":    fileResp.File,
	})
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

func (h *PaymentHandler) CancelPayment(c *gin.Context) {
	id := c.Param("id")
	resp, err := h.cancelPaymentHandler.Handle(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Payment cancelled", "data": resp})
}

func (h *PaymentHandler) VerifyPaymentStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
        "message": "Fitur verify status otomatis dinonaktifkan (Silakan cek Dashboard Midtrans)",
    })
}