package repositories

import (
	"context"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

// GatewayConfigRepository defines persistence operations for payment gateway configurations.
// Stored configs take priority over environment variables at runtime.
type GatewayConfigRepository interface {
	// FindAll returns all gateway configs (active and inactive).
	FindAll(ctx context.Context) ([]entities.GatewayConfig, error)

	// FindActive returns only active configs — used at startup to build the gateway factory.
	FindActive(ctx context.Context) ([]entities.GatewayConfig, error)

	// FindByProvider returns the active config for a specific provider name (e.g. "xendit").
	FindByProvider(ctx context.Context, provider string) (*entities.GatewayConfig, error)

	// FindByID returns a single config by primary key.
	FindByID(ctx context.Context, id string) (*entities.GatewayConfig, error)

	// Create persists a new gateway config.
	Create(ctx context.Context, cfg *entities.GatewayConfig) error

	// Update saves changes to an existing gateway config.
	Update(ctx context.Context, cfg *entities.GatewayConfig) error

	// Delete soft-deletes a gateway config by ID.
	Delete(ctx context.Context, id string) error
}
