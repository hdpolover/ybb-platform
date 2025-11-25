package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment-service/internal/application/commands"
	commandHandlers "github.com/ybb-platform/payment-service/internal/application/commands/handlers"
	"github.com/ybb-platform/payment-service/internal/application/queries"
	queryHandlers "github.com/ybb-platform/payment-service/internal/application/queries/handlers"
)

// PaymentHandler handles payment-related HTTP requests
type PaymentHandler struct {
	createPaymentHandler *commandHandlers.CreatePaymentHandler
	getPaymentHandler    *queryHandlers.GetPaymentHandler
}

// NewPaymentHandler creates a new PaymentHandler
func NewPaymentHandler(
	createPaymentHandler *commandHandlers.CreatePaymentHandler,
	getPaymentHandler *queryHandlers.GetPaymentHandler,
) *PaymentHandler {
	return &PaymentHandler{
		createPaymentHandler: createPaymentHandler,
		getPaymentHandler:    getPaymentHandler,
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

	c.JSON(http.StatusOK, gin.H{
		"status": "received",
	})
}
