package persistence_test

import (
	"context"
	"encoding/base64"
	"testing"

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
		provider TEXT NOT NULL,
		mode TEXT DEFAULT 'sandbox',
		server_key TEXT NOT NULL,
		client_key TEXT NOT NULL,
		webhook_secret TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
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
