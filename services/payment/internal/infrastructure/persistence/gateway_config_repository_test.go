package persistence_test

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/persistence"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRepoCreateDoesNotMutateCallerCredentials(t *testing.T) {
	db := setupDB(t)
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	repo := persistence.NewGatewayConfigRepository(db, key)

	cfg := &entities.GatewayConfig{
		Provider: "midtrans", Mode: "sandbox",
		ServerKey: "SB-Mid-server-X", ClientKey: "SB-Mid-client-X", WebhookSecret: "hook",
	}
	if err := repo.Create(context.Background(), cfg); err != nil {
		t.Fatalf("create: %v", err)
	}
	if cfg.ServerKey != "SB-Mid-server-X" || cfg.ClientKey != "SB-Mid-client-X" || cfg.WebhookSecret != "hook" {
		t.Fatalf("caller credentials mutated: server=%q client=%q webhook=%q",
			cfg.ServerKey, cfg.ClientKey, cfg.WebhookSecret)
	}
}

func setupDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	// Use raw DDL instead of AutoMigrate: the entity uses PostgreSQL-specific
	// types (uuid, gen_random_uuid()) that SQLite rejects during DDL generation.
	ddl := `CREATE TABLE IF NOT EXISTS payment_gateway_configs (
		id TEXT PRIMARY KEY,
		brand_id TEXT,
		program_id TEXT,
		provider TEXT NOT NULL,
		mode TEXT DEFAULT 'sandbox',
		server_key TEXT NOT NULL,
		client_key TEXT NOT NULL,
		webhook_secret TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
		deactivated_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		deleted_at DATETIME
	)`
	if err := db.Exec(ddl).Error; err != nil {
		t.Fatalf("create table: %v", err)
	}
	return db
}

func TestRepoEncryptsOnCreate(t *testing.T) {
	db := setupDB(t)
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	repo := persistence.NewGatewayConfigRepository(db, key)

	cfg := &entities.GatewayConfig{
		Provider: "midtrans", Mode: "sandbox",
		ServerKey: "SB-Mid-server-X", ClientKey: "SB-Mid-client-X", WebhookSecret: "hook",
	}
	if err := repo.Create(context.Background(), cfg); err != nil {
		t.Fatalf("create: %v", err)
	}

	// Peek at raw row — value on disk must be encrypted
	var raw entities.GatewayConfig
	db.Raw("SELECT * FROM payment_gateway_configs WHERE id = ?", cfg.ID).Scan(&raw)
	if raw.ServerKey == "SB-Mid-server-X" {
		t.Fatal("server_key stored in plaintext")
	}
}

func TestRepoDecryptsOnRead(t *testing.T) {
	db := setupDB(t)
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	repo := persistence.NewGatewayConfigRepository(db, key)

	cfg := &entities.GatewayConfig{
		Provider: "midtrans", ServerKey: "SB-Mid-server-X", ClientKey: "c", WebhookSecret: "w",
	}
	_ = repo.Create(context.Background(), cfg)

	got, err := repo.FindByProvider(context.Background(), "midtrans")
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.ServerKey != "SB-Mid-server-X" {
		t.Fatalf("want plaintext on read, got %q", got.ServerKey)
	}
}

func TestRepoHandlesLegacyPlaintextRow(t *testing.T) {
	db := setupDB(t)
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	// Write a plaintext row directly (simulates pre-migration state)
	db.Exec(`INSERT INTO payment_gateway_configs (id, provider, mode, server_key, client_key, webhook_secret, is_active, created_at, updated_at) VALUES (?, 'midtrans', 'sandbox', 'LEGACY', 'LC', 'LW', 1, datetime('now'), datetime('now'))`, "11111111-1111-1111-1111-111111111111")

	repo := persistence.NewGatewayConfigRepository(db, key)
	got, err := repo.FindByProvider(context.Background(), "midtrans")
	if err != nil {
		t.Fatalf("find legacy: %v", err)
	}
	if got.ServerKey != "LEGACY" {
		t.Fatalf("legacy plaintext should pass through, got %q", got.ServerKey)
	}
}

func newScopedRepo(t *testing.T) (*persistence.GatewayConfigRepository, *gorm.DB) {
	t.Helper()
	db := setupDB(t)
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	return persistence.NewGatewayConfigRepository(db, key), db
}

func activeOf(t *testing.T, db *gorm.DB, id string) bool {
	t.Helper()
	var active bool
	require.NoError(t, db.Raw("SELECT is_active FROM payment_gateway_configs WHERE id = ?", id).Scan(&active).Error)
	return active
}

func TestRepoActivationOnlyDeactivatesSameScope(t *testing.T) {
	repo, db := newScopedRepo(t)
	ctx := context.Background()
	brand, prog := "b1", "p1"
	mk := func(brandID, programID *string) *entities.GatewayConfig {
		c := &entities.GatewayConfig{Provider: "xendit", Mode: "sandbox", ServerKey: "s", ClientKey: "c",
			WebhookSecret: "w", IsActive: true, BrandID: brandID, ProgramID: programID}
		require.NoError(t, repo.Create(ctx, c))
		return c
	}

	global1 := mk(nil, nil)
	brandCfg := mk(&brand, nil)
	progCfg := mk(nil, &prog)
	require.True(t, activeOf(t, db, global1.ID), "scoped creates must not deactivate global")
	require.True(t, activeOf(t, db, brandCfg.ID))
	require.True(t, activeOf(t, db, progCfg.ID))

	global2 := mk(nil, nil)
	require.False(t, activeOf(t, db, global1.ID), "new global replaces old global")
	require.True(t, activeOf(t, db, global2.ID))
	require.True(t, activeOf(t, db, brandCfg.ID))
	require.True(t, activeOf(t, db, progCfg.ID))

	// Update path: re-activating an inactive brand row deactivates only the other brand row.
	brand2 := mk(&brand, nil)
	require.False(t, activeOf(t, db, brandCfg.ID))
	brandCfg.IsActive = true
	require.NoError(t, repo.Update(ctx, brandCfg))
	require.False(t, activeOf(t, db, brand2.ID))
	require.True(t, activeOf(t, db, global2.ID))
}

func TestRepoFindAllRuntimeSkipsUndecryptableAndDeleted(t *testing.T) {
	repo, db := newScopedRepo(t)
	ctx := context.Background()
	good := &entities.GatewayConfig{Provider: "xendit", Mode: "sandbox", ServerKey: "s", ClientKey: "c", WebhookSecret: "w", IsActive: true}
	inactive := &entities.GatewayConfig{Provider: "midtrans", Mode: "sandbox", ServerKey: "s", ClientKey: "c", WebhookSecret: "w", IsActive: false}
	deleted := &entities.GatewayConfig{Provider: "stripe", Mode: "sandbox", ServerKey: "s", ClientKey: "c", WebhookSecret: "w", IsActive: false}
	for _, c := range []*entities.GatewayConfig{good, inactive, deleted} {
		require.NoError(t, repo.Create(ctx, c))
	}
	require.NoError(t, repo.Delete(ctx, deleted.ID))
	// Ciphertext-shaped garbage that cannot be decrypted with the key.
	require.NoError(t, db.Exec(`INSERT INTO payment_gateway_configs (id, provider, mode, server_key, client_key, webhook_secret, is_active)
		VALUES ('bad', 'paypal', 'sandbox', 'enc:v1:AAAA', 'enc:v1:AAAA', 'enc:v1:AAAA', 1)`).Error)

	got, err := repo.FindAllRuntime(ctx)
	require.NoError(t, err)
	ids := []string{}
	for _, c := range got {
		ids = append(ids, c.ID)
	}
	require.ElementsMatch(t, []string{good.ID, inactive.ID}, ids)
}

func TestRepoCountPendingTransactions(t *testing.T) {
	repo, db := newScopedRepo(t)
	require.NoError(t, db.Exec(`CREATE TABLE payment_transactions (id TEXT PRIMARY KEY, gateway_config_id TEXT, status TEXT)`).Error)
	require.NoError(t, db.Exec(`INSERT INTO payment_transactions VALUES ('t1','cfg','PENDING'),('t2','cfg','SUCCESS'),('t3','other','PENDING'),('t4',NULL,'PENDING')`).Error)

	n, err := repo.CountPendingTransactions(context.Background(), "cfg")
	require.NoError(t, err)
	require.EqualValues(t, 1, n)
}

func deactivatedAtOf(t *testing.T, db *gorm.DB, id string) *time.Time {
	t.Helper()
	var cfg entities.GatewayConfig
	require.NoError(t, db.First(&cfg, "id = ?", id).Error)
	return cfg.DeactivatedAt
}

func TestRepoTracksDeactivatedAt(t *testing.T) {
	repo, db := newScopedRepo(t)
	ctx := context.Background()
	brand := "b1"
	mk := func() *entities.GatewayConfig {
		c := &entities.GatewayConfig{Provider: "xendit", Mode: "sandbox", ServerKey: "s", ClientKey: "c",
			WebhookSecret: "w", IsActive: true, BrandID: &brand}
		require.NoError(t, repo.Create(ctx, c))
		return c
	}

	first := mk()
	require.Nil(t, deactivatedAtOf(t, db, first.ID))

	// Replaced by a newer config of the same scope: stamped.
	second := mk()
	stamp := deactivatedAtOf(t, db, first.ID)
	require.NotNil(t, stamp)
	require.Nil(t, deactivatedAtOf(t, db, second.ID))

	// Editing the already-inactive config must not restart its grace window.
	first.IsActive = false
	first.Mode = "production"
	first.DeactivatedAt = stamp
	require.NoError(t, repo.Update(ctx, first))
	require.Equal(t, stamp.Unix(), deactivatedAtOf(t, db, first.ID).Unix())

	// Explicit true -> false flip via Update is stamped.
	second.IsActive = false
	require.NoError(t, repo.Update(ctx, second))
	require.NotNil(t, deactivatedAtOf(t, db, second.ID))

	// Reactivation clears it.
	second.IsActive = true
	require.NoError(t, repo.Update(ctx, second))
	require.Nil(t, deactivatedAtOf(t, db, second.ID))
}
