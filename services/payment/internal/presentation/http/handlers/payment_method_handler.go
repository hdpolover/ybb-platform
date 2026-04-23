package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/persistence"
)

type PaymentMethodHandler struct {
	repo *persistence.PaymentMethodRepository
}

func NewPaymentMethodHandler(repo *persistence.PaymentMethodRepository) *PaymentMethodHandler {
	return &PaymentMethodHandler{repo: repo}
}

// Create godoc
// @Summary      Add New Payment Method
// @Description  Add a new bank or payment method to the database
// @Tags         Payment Methods
// @Accept       json
// @Produce      json
// @Param        request body entities.PaymentMethodEntity true "Payment Method Data"
// @Success      201  {object}  map[string]entities.PaymentMethodEntity
// @Failure      400  {object}  map[string]interface{}
// @Router       /payment-methods [post]
func (h *PaymentMethodHandler) Create(c *gin.Context) {
	var req entities.PaymentMethodEntity
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.Create(c.Request.Context(), &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment method"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "success", "data": req})
}

// GetAll godoc
// @Summary      Get All Payment Methods
// @Description  Get a list of all available payment methods
// @Tags         Payment Methods
// @Produce      json
// @Success      200  {object}  map[string][]entities.PaymentMethodEntity
// @Router       /payment-methods [get]
func (h *PaymentMethodHandler) GetAll(c *gin.Context) {
	methods, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch methods"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": methods})
}

// GetByID godoc
// @Summary      Get Payment Method Detail
// @Description  Get payment method details by ID
// @Tags         Payment Methods
// @Produce      json
// @Param        id   path      string  true  "Payment Method ID (UUID)"
// @Success      200  {object}  map[string]entities.PaymentMethodEntity
// @Failure      404  {object}  map[string]interface{}
// @Router       /payment-methods/{id} [get]
func (h *PaymentMethodHandler) GetByID(c *gin.Context) {
	id := c.Param("id")
	method, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment method not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": method})
}

// Update godoc
// @Summary      Update Payment Method
// @Description  Update bank or payment method details by ID
// @Tags         Payment Methods
// @Accept       json
// @Produce      json
// @Param        id       path  string                      true  "Payment Method ID (UUID)"
// @Param        request  body  entities.PaymentMethodEntity true "Update Data"
// @Success      200      {object}  map[string]entities.PaymentMethodEntity
// @Failure      400      {object}  map[string]interface{}
// @Failure      404      {object}  map[string]interface{}
// @Router       /payment-methods/{id} [put]
func (h *PaymentMethodHandler) Update(c *gin.Context) {
	id := c.Param("id")

	existing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "payment method not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Payment method not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payment method: " + err.Error()})
		}
		return
	}

	var req entities.PaymentMethodEntity
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update Fields (Mapping Manual agar aman)
	existing.Name = req.Name
	existing.DisplayName = req.DisplayName
	existing.Code = req.Code
	existing.Type = req.Type
	existing.IsActive = req.IsActive
	existing.Description = req.Description
	existing.Icon = req.Icon
	existing.SortOrder = req.SortOrder

	// Manual Payment Fields
	existing.BankName = req.BankName
	existing.AccountNumber = req.AccountNumber
	existing.AccountName = req.AccountName
	existing.Instructions = req.Instructions
	existing.RequiresProof = req.RequiresProof

	// Automatic Payment Fields
	existing.GatewayName = req.GatewayName
	existing.GatewayType = req.GatewayType
	existing.Config = req.Config

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment method"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": existing})
}

// Delete godoc
// @Summary      Delete Payment Method
// @Description  Delete (Soft Delete) payment method by ID
// @Tags         Payment Methods
// @Produce      json
// @Param        id   path      string  true  "Payment Method ID (UUID)"
// @Success      200  {object}  map[string]string
// @Failure      500  {object}  map[string]interface{}
// @Router       /payment-methods/{id} [delete]
func (h *PaymentMethodHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Deleted successfully"})
}
