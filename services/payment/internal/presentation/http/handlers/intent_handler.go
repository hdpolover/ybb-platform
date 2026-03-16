package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment/internal/application/commands"
	commandHandlers "github.com/ybb-platform/payment/internal/application/commands/handlers"
	"github.com/ybb-platform/payment/internal/application/dto"
)

type IntentHandler struct {
	createIntentHandler  *commandHandlers.CreateIntentHandler
	confirmIntentHandler *commandHandlers.ConfirmIntentHandler
}

func NewIntentHandler(
	create *commandHandlers.CreateIntentHandler,
	confirm *commandHandlers.ConfirmIntentHandler,
) *IntentHandler {
	return &IntentHandler{
		createIntentHandler:  create,
		confirmIntentHandler: confirm,
	}
}

// CreateIntent godoc
// @Summary Create a new payment intent
// @Description Creates a payment intent representing an order to be paid
// @Tags intents
// @Accept json
// @Produce json
// @Param request body dto.CreateIntentRequest true "Intent Request"
// @Success 201 {object} dto.CreateIntentResponse
// @Router /intents [post]
func (h *IntentHandler) CreateIntent(c *gin.Context) {
	var req dto.CreateIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd := &commands.CreateIntentCommand{
		UserID:        req.UserID,
		ParticipantID: req.ParticipantID,
		ReferenceType: req.ReferenceType,
		ReferenceID:   req.ReferenceID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Metadata:      req.Metadata,
	}

	resp, err := h.createIntentHandler.Handle(c.Request.Context(), cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// ConfirmIntent godoc
// @Summary Confirm a payment intent
// @Description Confirm/Process a payment for an existing intent using a specific method
// @Tags intents
// @Accept json
// @Produce json
// @Param id path string true "Intent ID"
// @Param request body dto.ConfirmPaymentRequest true "Confirm Request"
// @Success 200 {object} dto.ConfirmPaymentResponse
// @Router /intents/{id}/confirm [post]
func (h *IntentHandler) ConfirmIntent(c *gin.Context) {
	intentID := c.Param("id")
	var req dto.ConfirmPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	detailsJSON, _ := json.Marshal(req.PaymentDetails)

	// In a real scenario, Customer Details should come from the User Service or Context
	// For now, we assume frontend sends them in metadata or separate fields if needed,
	// OR we might want to fetch the User info here.
	// Let's assume for this MVP upgrade, we allow empty customer details or extract from token?
	// The user_id is in the Intent. We really should fetch User info.
	// But `PaymentIntent` entity only has `UserID`.

	// Hack for now: Allow passing customer info in PaymentDetails or headers?
	// or just Stub it? Payment Gateway checks usually fail if email validation is strict.
	// We'll proceed with basic execution.

	cmd := &commands.ConfirmIntentCommand{
		IntentID:        intentID,
		PaymentMethodID: req.PaymentMethodID,
		GatewayToken:    req.GatewayToken,
		IdempotencyKey:  c.GetHeader("Idempotency-Key"),
		PaymentDetails:  detailsJSON,
		IpAddress:       c.ClientIP(),
		UserAgent:       c.Request.UserAgent(),
	}

	if req.CustomerDetails != nil {
		cmd.CustomerName = req.CustomerDetails.Name
		cmd.CustomerEmail = req.CustomerDetails.Email
		cmd.CustomerPhone = req.CustomerDetails.Phone
	}

	resp, err := h.confirmIntentHandler.Handle(c.Request.Context(), cmd)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}
