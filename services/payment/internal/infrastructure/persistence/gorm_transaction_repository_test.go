// services/payment/internal/infrastructure/persistence/gorm_transaction_repository_test.go
package persistence_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/persistence"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTxDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	// Raw DDL: the entity's uuid/jsonb types are Postgres-only (see setupDB).
	require.NoError(t, db.Exec(`CREATE TABLE payment_transactions (
		id TEXT PRIMARY KEY, payment_intent_id TEXT NOT NULL, gateway_reference_id TEXT,
		payment_method_id TEXT NOT NULL, currency TEXT, amount_total REAL NOT NULL,
		amount_subtotal REAL NOT NULL, fee_provider REAL DEFAULT 0, net_amount REAL NOT NULL,
		status TEXT NOT NULL, gateway_response TEXT, error_code TEXT, gateway_config_id TEXT,
		proof_file_url TEXT, admin_notes TEXT, reviewed_by TEXT, reviewed_at DATETIME,
		created_at DATETIME, updated_at DATETIME
	)`).Error)
	return db
}

func TestTransactionRepoRoundTripsGatewayConfigID(t *testing.T) {
	repo := persistence.NewGormPaymentTransactionRepository(setupTxDB(t))
	ctx := context.Background()
	cfgID := "11111111-1111-1111-1111-111111111111"

	pinned := entities.NewPaymentTransaction("intent-1", "xendit_invoice", 100)
	pinned.GatewayConfigID = &cfgID
	global := entities.NewPaymentTransaction("intent-1", "xendit_invoice", 100)

	require.NoError(t, repo.Create(ctx, pinned))
	require.NoError(t, repo.Create(ctx, global))

	gotPinned, err := repo.FindByID(ctx, pinned.ID)
	require.NoError(t, err)
	require.NotNil(t, gotPinned.GatewayConfigID)
	require.Equal(t, cfgID, *gotPinned.GatewayConfigID)

	gotGlobal, err := repo.FindByID(ctx, global.ID)
	require.NoError(t, err)
	require.Nil(t, gotGlobal.GatewayConfigID, "global gateway stays NULL")

	// Update (gorm Save) must not drop the pin.
	gotPinned.AdminNotes = "touched"
	require.NoError(t, repo.Update(ctx, gotPinned))
	again, err := repo.FindByID(ctx, pinned.ID)
	require.NoError(t, err)
	require.NotNil(t, again.GatewayConfigID)
	require.Equal(t, cfgID, *again.GatewayConfigID)
}
