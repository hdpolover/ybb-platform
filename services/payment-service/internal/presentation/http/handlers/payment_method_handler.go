package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/infrastructure/persistence"
)

type PaymentMethodHandler struct {
	repo *persistence.PaymentMethodRepository
}

func NewPaymentMethodHandler(repo *persistence.PaymentMethodRepository) *PaymentMethodHandler {
	return &PaymentMethodHandler{repo: repo}
}

// Create godoc
// @Summary      Tambah Metode Pembayaran Baru
// @Description  Menambahkan bank atau metode pembayaran baru ke database
// @Tags         Payment Methods
// @Accept       json
// @Produce      json
// @Param        request body entities.PaymentMethodEntity true "Data Payment Method"
// @Success      201  {object}  map[string]interface{}
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
// @Summary      Lihat Semua Metode Pembayaran
// @Description  Mendapatkan daftar semua metode pembayaran yang tersedia
// @Tags         Payment Methods
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /payment-methods [get]
func (h *PaymentMethodHandler) GetAll(c *gin.Context) {
	methods, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch methods"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": methods})
}

// Update Method
func (h *PaymentMethodHandler) Update(c *gin.Context) {
	id := c.Param("id")
	
	existing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment method not found"})
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

// Delete Method
func (h *PaymentMethodHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Deleted successfully"})
}