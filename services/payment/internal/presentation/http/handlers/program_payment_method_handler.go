package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/infrastructure/gateways"
	"github.com/ybb-platform/payment/internal/infrastructure/persistence"
)

type ProgramPaymentMethodHandler struct {
	repo           *persistence.ProgramPaymentMethodRepository
	gatewayFactory *gateways.GatewayFactory
}

func NewProgramPaymentMethodHandler(
	repo *persistence.ProgramPaymentMethodRepository,
	gatewayFactory *gateways.GatewayFactory,
) *ProgramPaymentMethodHandler {
	return &ProgramPaymentMethodHandler{repo: repo, gatewayFactory: gatewayFactory}
}

// upsertProgramMethodRequest is the body for a single per-program override.
// Pointer fields distinguish "not sent" from zero values; this is a PUT so a
// field left nil clears any previous override for that field.
type upsertProgramMethodRequest struct {
	IsEnabled                 *bool   `json:"is_enabled"`
	DescriptionOverride       *string `json:"description_override"`
	InstructionsOverride      *string `json:"instructions_override"`
	AdminInstructionsOverride *string `json:"admin_instructions_override"`
	SortOrder                 *int    `json:"sort_order"`
}

func (r upsertProgramMethodRequest) toPatch(methodID string) repositories.OverridePatch {
	return repositories.OverridePatch{
		PaymentMethodID:           methodID,
		IsEnabled:                 r.IsEnabled,
		DescriptionOverride:       r.DescriptionOverride,
		InstructionsOverride:      r.InstructionsOverride,
		AdminInstructionsOverride: r.AdminInstructionsOverride,
		SortOrder:                 r.SortOrder,
	}
}

// bulkUpsertProgramMethodsRequest is the body for materializing the full
// visible set on first save (see fallback contract).
type bulkUpsertProgramMethodsRequest struct {
	Methods []struct {
		PaymentMethodID string `json:"payment_method_id" binding:"required"`
		upsertProgramMethodRequest
	} `json:"methods" binding:"required,dive"`
}

// GetByProgram godoc
// @Summary      Get Program Payment Methods
// @Description  Get the merged (fallback-aware) payment method list for a program
// @Tags         Program Payment Methods
// @Produce      json
// @Param        programId  path      string  true  "Program ID (UUID)"
// @Success      200  {object}  map[string][]repositories.ProgramMethodView
// @Failure      400  {object}  map[string]interface{}
// @Router       /programs/{programId}/payment-methods [get]
func (h *ProgramPaymentMethodHandler) GetByProgram(c *gin.Context) {
	programID := c.Param("programId")
	if _, err := uuid.Parse(programID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid program id"})
		return
	}

	// include_disabled=true is the admin-console read: every active master
	// method, with is_enabled reflecting whether this program has turned it on.
	// The participant-facing callers must never set it — they would start
	// offering methods the program deliberately disabled.
	var views []repositories.ProgramMethodView
	var err error
	if c.Query("include_disabled") == "true" {
		views, err = h.repo.FindAllForAdminByProgram(c.Request.Context(), programID)
	} else {
		views, err = h.repo.FindMergedByProgram(c.Request.Context(), programID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch program payment methods"})
		return
	}

	// Same `available_only=true` gateway-liveness filter as the global
	// GetAll endpoint (see isGatewayAvailable) — the merged program view
	// must not surface an automatic method whose gateway is dead.
	if c.Query("available_only") == "true" && h.gatewayFactory != nil {
		filtered := make([]repositories.ProgramMethodView, 0, len(views))
		for _, v := range views {
			if isGatewayAvailable(h.gatewayFactory, v.Type, v.GatewayName) {
				filtered = append(filtered, v)
			}
		}
		views = filtered
	}

	c.JSON(http.StatusOK, gin.H{"data": views})
}

// GetMethodUsage godoc
// @Summary      Report how many programs use a shared payment method
// @Description  Counts programs with the method enabled, and how many of those
// @Description  still render the shared master instructions (no override).
// @Tags         Payment Methods
// @Produce      json
// @Param        id  path  string  true  "Payment Method ID (UUID)"
// @Success      200  {object}  map[string]interface{}
// @Router       /payment-methods/{id}/usage [get]
func (h *ProgramPaymentMethodHandler) GetMethodUsage(c *gin.Context) {
	methodID := c.Param("id")
	if _, err := uuid.Parse(methodID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment method id"})
		return
	}

	enabled, inheriting, err := h.repo.CountInheritingPrograms(c.Request.Context(), methodID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count payment method usage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"enabled_program_count":    enabled,
		"inheriting_program_count": inheriting,
	}})
}

// UpsertOne godoc
// @Summary      Upsert One Program Payment Method Override
// @Description  Create or update a single per-program override (enable, text, sort)
// @Tags         Program Payment Methods
// @Accept       json
// @Produce      json
// @Param        programId  path  string                      true  "Program ID (UUID)"
// @Param        methodId   path  string                      true  "Payment Method ID (UUID)"
// @Param        request    body  upsertProgramMethodRequest  true  "Override Data"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Router       /programs/{programId}/payment-methods/{methodId} [put]
func (h *ProgramPaymentMethodHandler) UpsertOne(c *gin.Context) {
	programID := c.Param("programId")
	if _, err := uuid.Parse(programID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid program id"})
		return
	}

	methodID := c.Param("methodId")
	if _, err := uuid.Parse(methodID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment method id"})
		return
	}

	var req upsertProgramMethodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.UpsertOverride(c.Request.Context(), programID, methodID, req.toPatch(methodID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save program payment method override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// BulkUpsert godoc
// @Summary      Bulk Upsert Program Payment Method Overrides
// @Description  Materialize the full visible set of overrides for a program in one transaction (first-save)
// @Tags         Program Payment Methods
// @Accept       json
// @Produce      json
// @Param        programId  path  string                           true  "Program ID (UUID)"
// @Param        request    body  bulkUpsertProgramMethodsRequest  true  "Override Rows"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Router       /programs/{programId}/payment-methods [put]
func (h *ProgramPaymentMethodHandler) BulkUpsert(c *gin.Context) {
	programID := c.Param("programId")
	if _, err := uuid.Parse(programID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid program id"})
		return
	}

	var req bulkUpsertProgramMethodsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	patches := make([]repositories.OverridePatch, 0, len(req.Methods))
	for _, row := range req.Methods {
		if _, err := uuid.Parse(row.PaymentMethodID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment method id: " + row.PaymentMethodID})
			return
		}
		patches = append(patches, row.upsertProgramMethodRequest.toPatch(row.PaymentMethodID))
	}

	if err := h.repo.UpsertFullSet(c.Request.Context(), programID, patches); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save program payment method overrides"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
