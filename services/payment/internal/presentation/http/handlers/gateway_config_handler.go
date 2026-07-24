package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

// GatewayConfigHandler handles admin CRUD for payment gateway configurations.
type GatewayConfigHandler struct {
	repo              repositories.GatewayConfigRepository
	paymentMethodRepo repositories.PaymentMethodRepository
}

// NewGatewayConfigHandler creates a new GatewayConfigHandler. The payment
// method repo is required so Delete can block removal of a config still
// referenced by one or more payment methods.
func NewGatewayConfigHandler(
	repo repositories.GatewayConfigRepository,
	paymentMethodRepo repositories.PaymentMethodRepository,
) *GatewayConfigHandler {
	return &GatewayConfigHandler{repo: repo, paymentMethodRepo: paymentMethodRepo}
}

// GetAll godoc
// @Summary      List Gateway Configs
// @Description  Returns all payment gateway configurations including inactive ones
// @Tags         Gateway Config
// @Produce      json
// @Success      200  {object}  map[string][]entities.GatewayConfig
// @Router       /gateway-configs [get]
func (h *GatewayConfigHandler) GetAll(c *gin.Context) {
	configs, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		log.Printf("gateway_config_get_all error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": configs})
}

// GetByID godoc
// @Summary      Get Gateway Config
// @Description  Returns a specific gateway configuration by ID
// @Tags         Gateway Config
// @Produce      json
// @Param        id  path  string  true  "Gateway Config ID (UUID)"
// @Success      200  {object}  map[string]entities.GatewayConfig
// @Failure      404  {object}  map[string]interface{}
// @Router       /gateway-configs/{id} [get]
func (h *GatewayConfigHandler) GetByID(c *gin.Context) {
	cfg, err := h.repo.FindByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gateway config not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": cfg})
}

// Create godoc
// @Summary      Create Gateway Config
// @Description  Add a new payment gateway configuration (API keys, mode, etc.)
// @Tags         Gateway Config
// @Accept       json
// @Produce      json
// @Param        request  body  entities.GatewayConfig  true  "Gateway Config Data"
// @Success      201  {object}  map[string]entities.GatewayConfig
// @Failure      400  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /gateway-configs [post]
func (h *GatewayConfigHandler) Create(c *gin.Context) {
	var req entities.GatewayConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateGatewayConfigRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.Create(c.Request.Context(), &req); err != nil {
		log.Printf("gateway_config_create error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "success", "data": req})
}

// Update godoc
// @Summary      Update Gateway Config
// @Description  Update an existing gateway configuration (API keys, mode, active status)
// @Tags         Gateway Config
// @Accept       json
// @Produce      json
// @Param        id       path  string                  true  "Gateway Config ID (UUID)"
// @Param        request  body  entities.GatewayConfig  true  "Update Data"
// @Success      200  {object}  map[string]entities.GatewayConfig
// @Failure      400  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /gateway-configs/{id} [put]
func (h *GatewayConfigHandler) Update(c *gin.Context) {
	existing, err := h.repo.FindByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gateway config not found"})
		return
	}

	var req entities.GatewayConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Map only mutable fields to prevent ID or audit field overwrites
	existing.Provider = req.Provider
	existing.Mode = req.Mode
	existing.ServerKey = req.ServerKey
	existing.ClientKey = req.ClientKey
	existing.WebhookSecret = req.WebhookSecret
	existing.IsActive = req.IsActive
	existing.BrandID = req.BrandID
	if err := validateGatewayConfigRequest(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		log.Printf("gateway_config_update error id=%s: %v", existing.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": existing})
}

// SetActive godoc
// @Summary      Toggle Gateway Active Status
// @Description  Enable or disable a payment provider without deleting its config
// @Tags         Gateway Config
// @Accept       json
// @Produce      json
// @Param        id       path  string  true   "Gateway Config ID (UUID)"
// @Param        request  body  object  true   "Active flag" SchemaExample({"is_active": true})
// @Success      200  {object}  map[string]entities.GatewayConfig
// @Failure      404  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]interface{}
// @Router       /gateway-configs/{id}/active [patch]
func (h *GatewayConfigHandler) SetActive(c *gin.Context) {
	existing, err := h.repo.FindByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gateway config not found"})
		return
	}

	var body struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing.IsActive = body.IsActive
	if err := validateGatewayConfigRequest(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		log.Printf("gateway_config_set_active error id=%s: %v", existing.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": existing})
}

// Delete godoc
// @Summary      Delete Gateway Config
// @Description  Soft-delete a gateway configuration by ID
// @Tags         Gateway Config
// @Produce      json
// @Param        id  path  string  true  "Gateway Config ID (UUID)"
// @Success      200  {object}  map[string]string
// @Failure      500  {object}  map[string]interface{}
// @Router       /gateway-configs/{id} [delete]
func (h *GatewayConfigHandler) Delete(c *gin.Context) {
	ctx := c.Request.Context()
	existing, err := h.repo.FindByID(ctx, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gateway config not found"})
		return
	}

	// Referential guard: refuse to delete while any payment method still uses
	// this provider, otherwise payments using those methods would fail at
	// charge time with a confusing "no active config" error.
	count, err := h.paymentMethodRepo.CountByGatewayName(ctx, existing.Provider)
	if err != nil {
		log.Printf("gateway_config_delete check_refs error id=%s: %v", existing.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error":         "Cannot delete: gateway is still referenced by payment methods",
			"provider":      existing.Provider,
			"referenced_by": count,
		})
		return
	}

	if err := h.repo.Delete(ctx, c.Param("id")); err != nil {
		log.Printf("gateway_config_delete error id=%s: %v", c.Param("id"), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Deleted successfully"})
}

func validateGatewayConfigRequest(cfg *entities.GatewayConfig) error {
	provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
	mode := strings.ToLower(strings.TrimSpace(cfg.Mode))
	serverKey := strings.TrimSpace(cfg.ServerKey)
	clientKey := strings.TrimSpace(cfg.ClientKey)
	webhookSecret := strings.TrimSpace(cfg.WebhookSecret)

	if provider == "" {
		return badRequestError("provider is required")
	}
	if mode != "sandbox" && mode != "production" {
		return badRequestError("mode must be sandbox or production")
	}
	if serverKey == "" {
		return badRequestError("server_key is required")
	}
	if clientKey == "" {
		return badRequestError("client_key is required")
	}

	// Provider allow-list must run unconditionally (active or not). The column is
	// varchar(50); without this, an inactive config carrying an unrecognized or
	// oversized provider string skips validation here and 500s as a Postgres
	// "value too long" error at the DB write instead of a clean 400.
	switch provider {
	case "midtrans", "xendit", "stripe", "paypal":
	default:
		return badRequestError("unsupported provider")
	}

	// Strict credential-shape checks are enforced only when activating the config.
	// Inactive configs can be staged first and completed later.
	if !cfg.IsActive {
		return nil
	}

	switch provider {
	case "midtrans":
		if mode == "sandbox" {
			if !strings.HasPrefix(serverKey, "SB-Mid-server-") {
				return badRequestError("invalid Midtrans sandbox server_key format")
			}
			if !strings.HasPrefix(clientKey, "SB-Mid-client-") {
				return badRequestError("invalid Midtrans sandbox client_key format")
			}
		} else {
			if !strings.HasPrefix(serverKey, "Mid-server-") {
				return badRequestError("invalid Midtrans production server_key format")
			}
			if !strings.HasPrefix(clientKey, "Mid-client-") {
				return badRequestError("invalid Midtrans production client_key format")
			}
		}
	case "xendit":
		if mode == "sandbox" {
			if !strings.HasPrefix(serverKey, "xnd_development_") {
				return badRequestError("invalid Xendit sandbox server_key format")
			}
		} else if !strings.HasPrefix(serverKey, "xnd_production_") {
			return badRequestError("invalid Xendit production server_key format")
		}
		if webhookSecret == "" {
			return badRequestError("webhook_secret is required for active Xendit configs")
		}
	case "stripe":
		if mode == "sandbox" {
			if !strings.HasPrefix(serverKey, "sk_test_") {
				return badRequestError("invalid Stripe sandbox server_key format")
			}
		} else if !strings.HasPrefix(serverKey, "sk_live_") {
			return badRequestError("invalid Stripe production server_key format")
		}
	case "paypal":
		// PayPal keys vary by account and don't have stable prefixes; enforce
		// non-empty credentials only.
	}

	return nil
}

func badRequestError(message string) error {
	return &gatewayConfigValidationError{message: message}
}

type gatewayConfigValidationError struct {
	message string
}

func (e *gatewayConfigValidationError) Error() string {
	return e.message
}
