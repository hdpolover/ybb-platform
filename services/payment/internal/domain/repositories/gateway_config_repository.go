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

	// FindAllRuntime returns every non-deleted config, active or not, with
	// credentials decrypted. Rows that fail to decrypt are skipped and logged so
	// one bad row cannot take every gateway down. Used to build the runtime snapshot.
	FindAllRuntime(ctx context.Context) ([]entities.GatewayConfig, error)

	// CountPendingTransactions counts PENDING transactions pinned to the config.
	CountPendingTransactions(ctx context.Context, id string) (int64, error)

	// FindByProvider returns the active config for a specific provider name (e.g. "xendit").
	FindByProvider(ctx context.Context, provider string) (*entities.GatewayConfig, error)

	// FindByID returns a single config by primary key.
	FindByID(ctx context.Context, id string) (*entities.GatewayConfig, error)

	// Create persists a new gateway config. If cfg.IsActive is true, any other
	// active rows for the same provider and scope are flipped to inactive in the same
	// transaction to preserve the one-active-per-(provider, scope) invariant.
	Create(ctx context.Context, cfg *entities.GatewayConfig) error

	// Update saves changes to an existing gateway config. If the post-update
	// row has IsActive=true, other active rows for the same provider and scope are
	// deactivated within the same transaction.
	Update(ctx context.Context, cfg *entities.GatewayConfig) error

	// Delete soft-deletes a gateway config by ID.
	Delete(ctx context.Context, id string) error
}
