# Payment Service Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up five payment-service architecture issues: encrypt gateway secrets, kill the legacy `payments` table, add intent-level linkage on `ApplicationInvoice`, gate `AutoMigrate` behind an env var, and eliminate the triple-denormalized payment state on `ParticipantApplication`.

**Architecture:** Five independent, sequentially-orderable tasks across two services. Go payment service uses GORM + raw SQL migrations; NestJS API service uses Prisma. App-layer AES-GCM encryption (key from `PAYMENT_SECRETS_KEY` env var) replaces plaintext gateway credentials. Event payload extended with `intent_id` to support dual-write of `externalIntentId` on the API side. Commits are explicitly excluded per user preference — the engineer will commit manually.

**Tech Stack:** Go 1.23 + GORM + Gin (payment service), NestJS + Prisma (api service), PostgreSQL, RabbitMQ events.

---

## File Structure

**Payment service (Go):**
- Create: `services/payment/internal/infrastructure/crypto/aes_gcm.go` — AES-256-GCM encrypt/decrypt helpers keyed from env
- Create: `services/payment/internal/infrastructure/crypto/aes_gcm_test.go` — round-trip + tamper tests
- Create: `services/payment/cmd/migrate-secrets/main.go` — one-shot tool that encrypts plaintext gateway credentials in-place
- Modify: `services/payment/internal/infrastructure/persistence/gateway_config_repository.go` — decrypt on read, encrypt on write
- Modify: `services/payment/cmd/server/main.go` — gate `AutoMigrate` behind `PAYMENT_AUTO_MIGRATE` env var; remove `&entities.Payment{}` from the model list
- Modify: `services/payment/internal/domain/entities/payment.go` — add DTO comment, keep struct intact (still used as gateway response type)
- Modify: `services/payment/internal/domain/events/payment_event.go` — add `IntentID` and `TransactionID` fields
- Create: `services/payment/migrations/013_drop_legacy_payments_table.sql`
- Create: `services/payment/migrations/014_note_secret_columns_are_encrypted.sql` — comments only; no schema change (ciphertext fits existing TEXT)

**API service (NestJS/Prisma):**
- Modify: `services/api/prisma/schema/applications.prisma` — add `externalIntentId` field, remove denormalized `paymentAmount` / `paymentId` / `paymentStatus` from `ParticipantApplication`
- Modify: `services/api/src/modules/payments/presentation/payment-events.controller.ts` — populate `externalIntentId` from event payload
- Modify: `services/api/src/modules/applications/infrastructure/mappers/application.mapper.ts` — remove denorm field mapping
- Modify: `services/api/src/modules/applications/application/queries/handlers/get-application.handler.ts` — reads already derive from joined payments; verify no break
- Modify: `services/api/src/core/entities/participant-application.entity.ts` — remove denorm fields + methods that depend on them
- Modify: `services/api/src/modules/applications/application/dto/application-response.dto.ts` — if DTO duplicates the Prisma fields, remove

**Infra/config:**
- Modify: `services/payment/docker-compose.yml`, `docker-compose.dokploy.yml`, `docker-compose.prod.yml`, `docker-compose.staging.yml` — inject `PAYMENT_SECRETS_KEY` + `PAYMENT_AUTO_MIGRATE`

---

## Task 1: AES-GCM Crypto Helper

**Why:** Enables app-layer encryption of gateway credentials. Keep crypto in a single file so it can be unit-tested in isolation and swapped for KMS later without repository changes.

**Files:**
- Create: `services/payment/internal/infrastructure/crypto/aes_gcm.go`
- Create: `services/payment/internal/infrastructure/crypto/aes_gcm_test.go`

- [ ] **Step 1: Write failing tests**

Create `services/payment/internal/infrastructure/crypto/aes_gcm_test.go`:

```go
package crypto_test

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/ybb-platform/payment/internal/infrastructure/crypto"
)

func makeKey(t *testing.T) string {
	t.Helper()
	// 32 bytes of zeros, base64-encoded — valid AES-256 key shape
	return base64.StdEncoding.EncodeToString(make([]byte, 32))
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	k := makeKey(t)
	plain := "SB-Mid-server-SECRET"

	ct, err := crypto.Encrypt(k, plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if ct == plain {
		t.Fatal("ciphertext must not equal plaintext")
	}
	if !strings.HasPrefix(ct, "enc:v1:") {
		t.Fatalf("want enc:v1: prefix, got %q", ct)
	}

	got, err := crypto.Decrypt(k, ct)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if got != plain {
		t.Fatalf("round-trip: got %q, want %q", got, plain)
	}
}

func TestDecryptTamperedFails(t *testing.T) {
	k := makeKey(t)
	ct, _ := crypto.Encrypt(k, "secret")

	// Flip one base64 byte in the payload (after the prefix)
	tampered := ct[:len(ct)-1] + "A"
	if _, err := crypto.Decrypt(k, tampered); err == nil {
		t.Fatal("expected tampered ciphertext to fail")
	}
}

func TestDecryptPlaintextPassthrough(t *testing.T) {
	// Values without the enc:v1: prefix are treated as plaintext (migration escape hatch)
	k := makeKey(t)
	got, err := crypto.Decrypt(k, "SB-Mid-server-LEGACY")
	if err != nil {
		t.Fatalf("decrypt passthrough: %v", err)
	}
	if got != "SB-Mid-server-LEGACY" {
		t.Fatalf("want passthrough, got %q", got)
	}
}

func TestEncryptEmptyIsNoop(t *testing.T) {
	k := makeKey(t)
	got, err := crypto.Encrypt(k, "")
	if err != nil {
		t.Fatalf("encrypt empty: %v", err)
	}
	if got != "" {
		t.Fatalf("empty input should stay empty, got %q", got)
	}
}

func TestInvalidKeyRejected(t *testing.T) {
	if _, err := crypto.Encrypt("not-base64!", "x"); err == nil {
		t.Fatal("expected invalid-key error")
	}
	if _, err := crypto.Encrypt(base64.StdEncoding.EncodeToString([]byte("short")), "x"); err == nil {
		t.Fatal("expected key-length error")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/payment && go test ./internal/infrastructure/crypto/...`
Expected: FAIL — package does not exist.

- [ ] **Step 3: Implement the crypto helper**

Create `services/payment/internal/infrastructure/crypto/aes_gcm.go`:

```go
// Package crypto provides app-layer symmetric encryption for sensitive values
// (gateway credentials) before they are written to the database.
//
// Format: "enc:v1:" + base64(nonce || ciphertext || gcmTag)
// Values without the "enc:v1:" prefix are returned as-is by Decrypt so that
// the migration tool and live reads can coexist during rollout.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

const prefix = "enc:v1:"

// Encrypt returns the ciphertext for s using the base64-encoded 32-byte key.
// Empty input is returned unchanged (WebhookSecret is optional).
func Encrypt(b64Key, s string) (string, error) {
	if s == "" {
		return "", nil
	}
	gcm, err := newGCM(b64Key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}
	ct := gcm.Seal(nonce, nonce, []byte(s), nil)
	return prefix + base64.StdEncoding.EncodeToString(ct), nil
}

// Decrypt reverses Encrypt. Values without the enc:v1: prefix are returned
// as-is (treated as legacy plaintext) — the migration tool relies on this.
func Decrypt(b64Key, s string) (string, error) {
	if s == "" {
		return "", nil
	}
	if !strings.HasPrefix(s, prefix) {
		return s, nil
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(s, prefix))
	if err != nil {
		return "", fmt.Errorf("base64: %w", err)
	}
	gcm, err := newGCM(b64Key)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, ct := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("gcm open: %w", err)
	}
	return string(pt), nil
}

func newGCM(b64Key string) (cipher.AEAD, error) {
	if b64Key == "" {
		return nil, errors.New("PAYMENT_SECRETS_KEY is not set")
	}
	key, err := base64.StdEncoding.DecodeString(b64Key)
	if err != nil {
		return nil, fmt.Errorf("decode key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("key must be 32 bytes (got %d)", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	return cipher.NewGCM(block)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/payment && go test ./internal/infrastructure/crypto/... -v`
Expected: PASS — all five tests.

---

## Task 2: Use Crypto in Gateway Config Repository

**Why:** Reads must transparently decrypt ciphertext; writes must encrypt. The existing `registerGateways` logic in `main.go` calls `FindAll` at startup and reads `ServerKey` / `ClientKey` / `WebhookSecret` directly, so decryption must happen inside the repo, not in the caller.

**Files:**
- Modify: `services/payment/internal/infrastructure/persistence/gateway_config_repository.go`

- [ ] **Step 1: Write a failing test**

Create `services/payment/internal/infrastructure/persistence/gateway_config_repository_test.go`:

```go
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

func setupDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&entities.GatewayConfig{}); err != nil {
		t.Fatalf("migrate: %v", err)
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/payment && go test ./internal/infrastructure/persistence/... -run GatewayConfig -v`
Expected: FAIL — `NewGatewayConfigRepository` takes only one argument.

- [ ] **Step 3: Modify the repository**

Edit `services/payment/internal/infrastructure/persistence/gateway_config_repository.go`:

Replace the entire file contents with:

```go
package persistence

import (
	"context"
	"fmt"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/crypto"
	"gorm.io/gorm"
)

// GatewayConfigRepository persists GatewayConfig with at-rest encryption
// of the credential fields. The caller supplies a base64-encoded 32-byte key;
// passing "" causes every read/write to error — fail loud on misconfig.
type GatewayConfigRepository struct {
	db        *gorm.DB
	secretKey string
}

func NewGatewayConfigRepository(db *gorm.DB, secretKey string) *GatewayConfigRepository {
	return &GatewayConfigRepository{db: db, secretKey: secretKey}
}

func (r *GatewayConfigRepository) FindAll(ctx context.Context) ([]entities.GatewayConfig, error) {
	var configs []entities.GatewayConfig
	if err := r.db.WithContext(ctx).Order("provider asc").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch gateway configs: %w", err)
	}
	for i := range configs {
		if err := r.decryptInPlace(&configs[i]); err != nil {
			return nil, err
		}
	}
	return configs, nil
}

func (r *GatewayConfigRepository) FindActive(ctx context.Context) ([]entities.GatewayConfig, error) {
	var configs []entities.GatewayConfig
	if err := r.db.WithContext(ctx).Where("is_active = true").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch active gateway configs: %w", err)
	}
	for i := range configs {
		if err := r.decryptInPlace(&configs[i]); err != nil {
			return nil, err
		}
	}
	return configs, nil
}

func (r *GatewayConfigRepository) FindByProvider(ctx context.Context, provider string) (*entities.GatewayConfig, error) {
	var cfg entities.GatewayConfig
	err := r.db.WithContext(ctx).
		Where("provider = ? AND is_active = true", provider).
		First(&cfg).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("no active config found for provider %q", provider)
		}
		return nil, fmt.Errorf("failed to find gateway config: %w", err)
	}
	if err := r.decryptInPlace(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *GatewayConfigRepository) FindByID(ctx context.Context, id string) (*entities.GatewayConfig, error) {
	var cfg entities.GatewayConfig
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&cfg).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("gateway config not found")
		}
		return nil, fmt.Errorf("failed to find gateway config: %w", err)
	}
	if err := r.decryptInPlace(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *GatewayConfigRepository) Create(ctx context.Context, cfg *entities.GatewayConfig) error {
	if err := r.encryptInPlace(cfg); err != nil {
		return err
	}
	defer r.mustDecryptInPlace(cfg) // leave caller's struct readable
	if err := r.db.WithContext(ctx).Create(cfg).Error; err != nil {
		return fmt.Errorf("failed to create gateway config: %w", err)
	}
	return nil
}

func (r *GatewayConfigRepository) Update(ctx context.Context, cfg *entities.GatewayConfig) error {
	if err := r.encryptInPlace(cfg); err != nil {
		return err
	}
	defer r.mustDecryptInPlace(cfg)
	if err := r.db.WithContext(ctx).Save(cfg).Error; err != nil {
		return fmt.Errorf("failed to update gateway config: %w", err)
	}
	return nil
}

func (r *GatewayConfigRepository) Delete(ctx context.Context, id string) error {
	if err := r.db.WithContext(ctx).Where("id = ?", id).Delete(&entities.GatewayConfig{}).Error; err != nil {
		return fmt.Errorf("failed to delete gateway config: %w", err)
	}
	return nil
}

func (r *GatewayConfigRepository) encryptInPlace(c *entities.GatewayConfig) error {
	var err error
	if c.ServerKey, err = crypto.Encrypt(r.secretKey, c.ServerKey); err != nil {
		return fmt.Errorf("encrypt server_key: %w", err)
	}
	if c.ClientKey, err = crypto.Encrypt(r.secretKey, c.ClientKey); err != nil {
		return fmt.Errorf("encrypt client_key: %w", err)
	}
	if c.WebhookSecret, err = crypto.Encrypt(r.secretKey, c.WebhookSecret); err != nil {
		return fmt.Errorf("encrypt webhook_secret: %w", err)
	}
	return nil
}

func (r *GatewayConfigRepository) decryptInPlace(c *entities.GatewayConfig) error {
	var err error
	if c.ServerKey, err = crypto.Decrypt(r.secretKey, c.ServerKey); err != nil {
		return fmt.Errorf("decrypt server_key: %w", err)
	}
	if c.ClientKey, err = crypto.Decrypt(r.secretKey, c.ClientKey); err != nil {
		return fmt.Errorf("decrypt client_key: %w", err)
	}
	if c.WebhookSecret, err = crypto.Decrypt(r.secretKey, c.WebhookSecret); err != nil {
		return fmt.Errorf("decrypt webhook_secret: %w", err)
	}
	return nil
}

// mustDecryptInPlace restores plaintext on the caller's struct after Create/Update.
// Errors here can't propagate (deferred), so we swallow them — the row was written OK.
func (r *GatewayConfigRepository) mustDecryptInPlace(c *entities.GatewayConfig) {
	_ = r.decryptInPlace(c)
}
```

- [ ] **Step 4: Update the caller in main.go**

The `registerGateways` call and the repo constructor are in `services/payment/cmd/server/main.go`. Find the line (~147) `gatewayConfigRepo := persistence.NewGatewayConfigRepository(db)` and change to:

```go
gatewayConfigRepo := persistence.NewGatewayConfigRepository(db, cfg.PaymentSecretsKey)
```

- [ ] **Step 5: Add config field**

Find the config struct (grep for `type Config struct` under `services/payment/internal/`) and add:

```go
PaymentSecretsKey string `env:"PAYMENT_SECRETS_KEY"`
```

Wire it through whatever config-loading function the service uses (`LoadConfig` / `NewConfig` / equivalent). If the service uses `os.Getenv` directly, grep for `MidtransServerKey` loading and add alongside it:

```go
PaymentSecretsKey: os.Getenv("PAYMENT_SECRETS_KEY"),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd services/payment && go test ./internal/infrastructure/persistence/... -run GatewayConfig -v`
Expected: PASS — all three tests.

- [ ] **Step 7: Verify full service still builds**

Run: `cd services/payment && go build ./...`
Expected: clean build, no errors.

---

## Task 3: One-Shot Migration Tool to Encrypt Existing Rows

**Why:** The Decrypt passthrough handles legacy plaintext for reads, but we want every row at rest to be ciphertext. A standalone tool avoids entangling a one-shot operation with startup.

**Files:**
- Create: `services/payment/cmd/migrate-secrets/main.go`

- [ ] **Step 1: Implement the migrator**

Create `services/payment/cmd/migrate-secrets/main.go`:

```go
// Command migrate-secrets encrypts any plaintext server_key / client_key /
// webhook_secret rows in payment_gateway_configs using PAYMENT_SECRETS_KEY.
// Safe to run multiple times: already-encrypted rows are skipped.
//
// Usage:
//   PAYMENT_SECRETS_KEY=<base64-32-bytes> DATABASE_URL=<url> \
//     go run ./cmd/migrate-secrets
package main

import (
	"log"
	"os"
	"strings"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/crypto"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const encPrefix = "enc:v1:"

func main() {
	dsn := os.Getenv("DATABASE_URL")
	key := os.Getenv("PAYMENT_SECRETS_KEY")
	if dsn == "" || key == "" {
		log.Fatal("DATABASE_URL and PAYMENT_SECRETS_KEY must be set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("connect: %v", err)
	}

	var configs []entities.GatewayConfig
	if err := db.Find(&configs).Error; err != nil {
		log.Fatalf("load: %v", err)
	}
	log.Printf("loaded %d gateway_configs rows", len(configs))

	migrated := 0
	for i := range configs {
		c := &configs[i]
		changed := false
		for _, f := range []*string{&c.ServerKey, &c.ClientKey, &c.WebhookSecret} {
			if *f == "" || strings.HasPrefix(*f, encPrefix) {
				continue
			}
			ct, err := crypto.Encrypt(key, *f)
			if err != nil {
				log.Fatalf("encrypt row %s: %v", c.ID, err)
			}
			*f = ct
			changed = true
		}
		if !changed {
			continue
		}
		if err := db.Model(c).Select("ServerKey", "ClientKey", "WebhookSecret").Updates(c).Error; err != nil {
			log.Fatalf("save row %s: %v", c.ID, err)
		}
		migrated++
	}
	log.Printf("done: migrated %d row(s)", migrated)
}
```

- [ ] **Step 2: Smoke-test the build**

Run: `cd services/payment && go build ./cmd/migrate-secrets`
Expected: produces a `migrate-secrets` binary; no errors.

- [ ] **Step 3: Verify idempotency on a scratch DB**

Pick whatever dev/docker DB you have and run twice:

```bash
cd services/payment
PAYMENT_SECRETS_KEY=$(openssl rand -base64 32) \
DATABASE_URL='postgresql://ybb_user:ybb_pass@localhost:5432/ybb_payments_db' \
go run ./cmd/migrate-secrets
```

Expected first run: `done: migrated N row(s)` where N > 0 if plaintext rows existed.
Expected second run: `done: migrated 0 row(s)`.

---

## Task 4: SQL Comment Migration Documenting Encryption

**Why:** Leave breadcrumbs. The columns are still TEXT but now hold ciphertext — comments help the next person debugging with `\d+` in psql.

**Files:**
- Create: `services/payment/migrations/013_note_secret_columns_are_encrypted.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Migration: 013_note_secret_columns_are_encrypted.sql
-- Description: Mark gateway credential columns as app-encrypted.
-- The actual encryption is performed by cmd/migrate-secrets and by the
-- gateway_config repository on write. This migration only documents intent.

COMMENT ON COLUMN payment_gateway_configs.server_key IS
  'AES-256-GCM ciphertext (enc:v1:...), key from PAYMENT_SECRETS_KEY env var';
COMMENT ON COLUMN payment_gateway_configs.client_key IS
  'AES-256-GCM ciphertext (enc:v1:...), key from PAYMENT_SECRETS_KEY env var';
COMMENT ON COLUMN payment_gateway_configs.webhook_secret IS
  'AES-256-GCM ciphertext (enc:v1:...), key from PAYMENT_SECRETS_KEY env var';
```

- [ ] **Step 2: Apply it**

Run against dev DB:

```bash
docker exec -i ybb-postgres psql -U ybb_user -d ybb_payments_db \
  < services/payment/migrations/013_note_secret_columns_are_encrypted.sql
```

Expected: `COMMENT` (×3), no errors.

---

## Task 5: Drop Legacy `payments` Table

**Why:** The v2 intent/transaction model (migration 005) replaced it, but 012 kept adding columns to the legacy table and `main.go` still registers `entities.Payment{}` with GORM's AutoMigrate. The entity struct itself is still used as the DTO for gateway responses (`VerifyPayment`, `HandleWebhook`) — so we drop the **table** and the AutoMigrate entry only; the struct stays.

**Files:**
- Create: `services/payment/migrations/014_drop_legacy_payments_table.sql`
- Modify: `services/payment/cmd/server/main.go:115-125`
- Modify: `services/payment/internal/domain/entities/payment.go` (comment only)

- [ ] **Step 1: Verify no writer remains**

Run: `cd services/payment && grep -rn 'Create(.*Payment{' --include='*.go' .` and `grep -rn 'Save(.*Payment{' --include='*.go' .`

Expected: matches only in **tests** (stubbing `entities.Payment` as a value object) or inside **gateway** implementations that **return** a `*entities.Payment` without persisting it. Zero matches inside `persistence/` or any code path that calls `db.Create` / `db.Save` with a `Payment`.

If there are unexpected persistence matches: stop the task and surface them to the user instead of proceeding.

- [ ] **Step 2: Write the migration**

Create `services/payment/migrations/014_drop_legacy_payments_table.sql`:

```sql
-- Migration: 014_drop_legacy_payments_table.sql
-- Description: Remove the legacy v1 payments table. The v2 schema
-- (payment_intents + payment_transactions) has been authoritative since
-- migration 005. The Go entities.Payment struct is retained as an
-- in-memory DTO for gateway responses; it is no longer persisted.

DROP TABLE IF EXISTS payments CASCADE;
```

- [ ] **Step 3: Remove the legacy entity from AutoMigrate**

Edit `services/payment/cmd/server/main.go` lines 115-125. Replace:

```go
	// Auto-migrate database schema (GORM Structs)
	// Keeps Go structs in sync for basic CRUD
	if err := db.AutoMigrate(
		&entities.Payment{},
		&entities.PaymentMethodEntity{},
		&entities.Refund{},
		&entities.GatewayConfig{},
		&entities.PaymentIntent{},
		&entities.PaymentTransaction{},
		&entities.PaymentIdempotencyKey{},
	); err != nil {
		logger.Fatalf("Failed to migrate database: %v", err)
	}
```

with (note: `&entities.Payment{}` removed — it is no longer a persisted model):

```go
	// Auto-migrate database schema (GORM Structs)
	// Keeps Go structs in sync for basic CRUD
	if err := db.AutoMigrate(
		&entities.PaymentMethodEntity{},
		&entities.Refund{},
		&entities.GatewayConfig{},
		&entities.PaymentIntent{},
		&entities.PaymentTransaction{},
		&entities.PaymentIdempotencyKey{},
	); err != nil {
		logger.Fatalf("Failed to migrate database: %v", err)
	}
```

- [ ] **Step 4: Annotate the Payment entity**

Edit `services/payment/internal/domain/entities/payment.go` at the top of the `Payment` struct (around line 42). Replace:

```go
// Payment represents a payment transaction in the system
// @Description Data detail sebuah transaksi pembayaran
type Payment struct {
```

with:

```go
// Payment is a gateway-response DTO used by VerifyPayment and HandleWebhook.
// It is NOT persisted — the legacy `payments` table was dropped in migration
// 014. The v2 schema uses PaymentIntent + PaymentTransaction for persistence.
// The GORM tags below are inert (kept only to avoid touching field call-sites).
type Payment struct {
```

- [ ] **Step 5: Apply the migration**

```bash
docker exec -i ybb-postgres psql -U ybb_user -d ybb_payments_db \
  < services/payment/migrations/014_drop_legacy_payments_table.sql
```

Expected: `DROP TABLE`, no errors.

- [ ] **Step 6: Verify service still builds and tests pass**

Run: `cd services/payment && go build ./... && go test ./...`
Expected: clean build; all tests pass.

- [ ] **Step 7: Verify service still starts**

Run: `cd services/payment && docker compose up -d payment` (or the project's equivalent) and tail logs for 10 seconds.
Expected: no `pq: relation "payments" does not exist` errors; service reports ready.

---

## Task 6: Gate AutoMigrate Behind an Env Var

**Why:** Raw SQL migrations (`RunRawSqlMigrations`) are the source of truth; AutoMigrate is convenient in dev but has caused churn (migrations 006, 009) when GORM's inferred schema disagreed with hand-written SQL. Gate it off in prod.

**Files:**
- Modify: `services/payment/cmd/server/main.go`
- Modify: `services/payment/docker-compose.yml`
- Modify: `services/payment/docker-compose.prod.yml`
- Modify: `services/payment/docker-compose.staging.yml`
- Modify: `services/payment/docker-compose.dokploy.yml`

- [ ] **Step 1: Add env-var guard around AutoMigrate**

Edit `services/payment/cmd/server/main.go` lines 113-125 (after Task 5's change). Wrap the AutoMigrate block:

```go
	// Auto-migrate database schema (GORM Structs) — dev only.
	// Raw SQL migrations above are the source of truth in prod.
	if os.Getenv("PAYMENT_AUTO_MIGRATE") == "true" {
		if err := db.AutoMigrate(
			&entities.PaymentMethodEntity{},
			&entities.Refund{},
			&entities.GatewayConfig{},
			&entities.PaymentIntent{},
			&entities.PaymentTransaction{},
			&entities.PaymentIdempotencyKey{},
		); err != nil {
			logger.Fatalf("Failed to migrate database: %v", err)
		}
		logger.Info("GORM AutoMigrate completed")
	} else {
		logger.Info("PAYMENT_AUTO_MIGRATE not set; skipping GORM AutoMigrate (SQL migrations are authoritative)")
	}
```

Ensure `"os"` is in the import block; it may already be.

- [ ] **Step 2: Set the env var in dev compose**

Edit `services/payment/docker-compose.yml` — under the `payment` service's `environment:` block, add:

```yaml
      PAYMENT_AUTO_MIGRATE: "true"
      PAYMENT_SECRETS_KEY: ${PAYMENT_SECRETS_KEY}
```

- [ ] **Step 3: Leave it OFF in prod/staging/dokploy**

Edit `services/payment/docker-compose.prod.yml`, `docker-compose.staging.yml`, `docker-compose.dokploy.yml` — add to each `payment` service's `environment:` block:

```yaml
      PAYMENT_SECRETS_KEY: ${PAYMENT_SECRETS_KEY}
      # PAYMENT_AUTO_MIGRATE intentionally unset — SQL migrations are authoritative
```

- [ ] **Step 4: Verify dev behavior**

Run: `cd services/payment && docker compose up -d payment && docker compose logs payment | grep -i migrate`
Expected: `GORM AutoMigrate completed`.

- [ ] **Step 5: Verify prod-profile behavior**

Run: `cd services/payment && docker compose -f docker-compose.prod.yml config | grep -A 3 'PAYMENT_AUTO_MIGRATE'`
Expected: no `PAYMENT_AUTO_MIGRATE: "true"` value in the rendered config.

---

## Task 7: Extend Payment Event Payload with IntentID and TransactionID

**Why:** The API consumer currently treats `data.id` or `data.gateway_order_id` as the transaction ID. For Phase 2a (`externalIntentId` on `ApplicationInvoice`), we need the intent ID explicitly. Adding both removes ambiguity and is backward-compatible (consumers read new fields when present).

**Files:**
- Modify: `services/payment/internal/domain/events/payment_event.go`
- Modify: call-sites that construct `PaymentEvent` (grep to find them)

- [ ] **Step 1: Extend the event struct**

Edit `services/payment/internal/domain/events/payment_event.go`. Find the `PaymentEvent` struct (~line 20) and add two fields after `PaymentID`:

```go
	ID             string                 `json:"id"`
	Type           EventType              `json:"type"`
	PaymentID      string                 `json:"payment_id"`
	IntentID       string                 `json:"intent_id,omitempty"`
	TransactionID  string                 `json:"transaction_id,omitempty"`
	ApplicationID  string                 `json:"application_id"`
	// ...rest unchanged
```

- [ ] **Step 2: Find every constructor call-site**

Run: `cd services/payment && grep -rn 'NewPaymentEvent(' --include='*.go' .`

Expected: a small number of call-sites (probably in `internal/application/commands/handlers/`).

- [ ] **Step 3: Extend the constructor and update call-sites**

Replace the existing `NewPaymentEvent` function with one that accepts `intentID` and `transactionID`:

```go
func NewPaymentEvent(
	eventType EventType,
	paymentID, intentID, transactionID, applicationID, userID, email string,
	amount float64,
	currency, status, gatewayName string,
) *PaymentEvent {
	return &PaymentEvent{
		Type:          eventType,
		PaymentID:     paymentID,
		IntentID:      intentID,
		TransactionID: transactionID,
		ApplicationID: applicationID,
		UserID:        userID,
		Email:         email,
		Amount:        amount,
		Currency:      currency,
		Status:        status,
		GatewayName:   gatewayName,
		Timestamp:     time.Now(),
		Metadata:      make(map[string]interface{}),
	}
}
```

At each call-site from Step 2, pass the intent and transaction IDs. In handlers where you have a `*entities.PaymentTransaction tx` and a `*entities.PaymentIntent intent` in scope, use `intent.ID` and `tx.ID`.

- [ ] **Step 4: Verify build + tests**

Run: `cd services/payment && go build ./... && go test ./...`
Expected: clean.

---

## Task 8: Dual-Write externalIntentId on API Service Consumer

**Why:** Add `externalIntentId` alongside the existing `externalTransactionId` so reconciliation can hit either axis. Dual-write first; flip reads later (out of scope for this plan).

**Files:**
- Modify: `services/api/prisma/schema/applications.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_add_external_intent_id/migration.sql` (auto-generated)
- Modify: `services/api/src/modules/payments/presentation/payment-events.controller.ts`

- [ ] **Step 1: Add the Prisma field**

Edit `services/api/prisma/schema/applications.prisma`. Find `model ApplicationInvoice` (line 203). In the fields block, after `externalTransactionId`, add:

```prisma
  // Link to payment-service PaymentIntent (the user's obligation)
  externalIntentId      String? @map("external_intent_id") @db.VarChar(100)
```

Also add to the indexes block:

```prisma
  @@index([externalIntentId])
```

- [ ] **Step 2: Generate the Prisma migration**

Run: `cd services/api && npx prisma migrate dev --name add_external_intent_id --create-only`
Expected: new directory under `prisma/migrations/` containing `migration.sql` with `ADD COLUMN external_intent_id VARCHAR(100)` and the index.

- [ ] **Step 3: Inspect the generated SQL**

Open the generated `migration.sql` and verify:
- `ALTER TABLE "application_invoices" ADD COLUMN "external_intent_id" VARCHAR(100);`
- `CREATE INDEX "application_invoices_external_intent_id_idx" ON "application_invoices"("external_intent_id");`

No other unexpected diffs (e.g., stray reorder of columns).

- [ ] **Step 4: Apply the migration locally**

Run: `cd services/api && npx prisma migrate dev`
Expected: applies the new migration, regenerates the Prisma client.

- [ ] **Step 5: Dual-write in the event consumer**

Edit `services/api/src/modules/payments/presentation/payment-events.controller.ts` around lines 55 and 138-149. Change the `processApplicationPayment` signature and its invoice creation.

Replace lines 52-66 (the block that extracts identifiers from the event):

```ts
            // Business Logic: Update Application & Create Invoice
            const metadata = (data.metadata as Record<string, unknown>) || {};
            const applicationId = (metadata.application_id as string) || (data.application_id as string);
            const paymentCategory = (metadata.payment_category as string) || 'registration';

            if (applicationId) {
                const result = await this.processApplicationPayment(
                    applicationId, 
                    paymentCategory, 
                    amount, 
                    currency, 
                    gatewayOrderId ?? '', 
                    method
                );
```

with:

```ts
            // Business Logic: Update Application & Create Invoice
            const metadata = (data.metadata as Record<string, unknown>) || {};
            const applicationId = (metadata.application_id as string) || (data.application_id as string);
            const paymentCategory = (metadata.payment_category as string) || 'registration';
            const intentId = (data.intent_id as string) || '';
            const transactionId = (data.transaction_id as string) || gatewayOrderId || '';

            if (applicationId) {
                const result = await this.processApplicationPayment(
                    applicationId,
                    paymentCategory,
                    amount,
                    currency,
                    transactionId,
                    intentId,
                    method,
                );
```

Then update the `processApplicationPayment` signature and the invoice creation. Replace lines 94-101 (the signature):

```ts
    private async processApplicationPayment(
        applicationId: string, 
        category: string, 
        amount: number, 
        currency: string,
        transactionId: string,
        method: string
    ): Promise<{ userId: string; participantId: string; programId: string } | null> {
```

with:

```ts
    private async processApplicationPayment(
        applicationId: string,
        category: string,
        amount: number,
        currency: string,
        transactionId: string,
        intentId: string,
        method: string,
    ): Promise<{ userId: string; participantId: string; programId: string } | null> {
```

And replace lines 138-149 (the `applicationInvoice.create` block):

```ts
                if (application.pricingTierId) {
                    await repos.tx.applicationInvoice.create({
                        data: {
                            applicationId: applicationId,
                            pricingTierId: application.pricingTierId,
                            amount: amount,
                            currency: currency,
                            status: PaymentStatus.paid,
                            paidAt: new Date(),
                            externalTransactionId: transactionId,
                            paymentMethod: method
                        }
                    });
                } else {
```

with:

```ts
                if (application.pricingTierId) {
                    await repos.tx.applicationInvoice.create({
                        data: {
                            applicationId: applicationId,
                            pricingTierId: application.pricingTierId,
                            amount: amount,
                            currency: currency,
                            status: PaymentStatus.paid,
                            paidAt: new Date(),
                            externalTransactionId: transactionId,
                            externalIntentId: intentId || null,
                            paymentMethod: method,
                        },
                    });
                } else {
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd services/api && npx tsc --noEmit`
Expected: no errors. If `externalIntentId` isn't recognized, re-run `npx prisma generate`.

- [ ] **Step 7: Run API tests**

Run: `cd services/api && npm test -- payment-events` (or the equivalent in this repo — fall back to `npm test` if the scoped filter doesn't match).
Expected: existing tests still pass; if a snapshot captures the invoice shape, update it.

---

## Task 9: Audit ParticipantApplication Denormalized Payment Fields

**Why:** The three fields (`paymentAmount`, `paymentId`, `paymentStatus`) live on `ParticipantApplication` but the query handler at `get-application.handler.ts:66-77` already **derives** them from joined payments data and overrides the stored values. Earlier grep found **zero writers** of these fields. Audit first to confirm they are safe to delete.

**Files:** (audit only)

- [ ] **Step 1: Grep for writes to the three fields**

Run from `/Users/hendra/Projects/YBB/ybb-new/ybb-platform`:

```bash
grep -rn --include='*.ts' -E "paymentAmount:\s|paymentId:\s|paymentStatus:\s" services/api/src
grep -rn --include='*.ts' -E "paymentAmount\s*=|paymentId\s*=|paymentStatus\s*=" services/api/src
grep -rn --include='*.prisma' -E "paymentAmount|paymentId|paymentStatus" services/api/prisma
```

- [ ] **Step 2: Classify each match**

For each result, label it as:
- **Write to Prisma model** (e.g. `participantApplication.update({ data: { paymentAmount: ... } })`) — **blocker**; the field is live.
- **Write to DTO / entity** (e.g. `dto.paymentStatus = 'PAID'` in `get-application.handler.ts`) — fine; the DTO can keep the field even if the DB column goes away.
- **Mapper pass-through** (e.g. `paymentAmount: entity.paymentAmount` in `application.mapper.ts`) — fine; delete alongside the entity field.
- **Schema definition** in `applications.prisma` — this is what we'll remove.
- **Entity business logic** (`participant-application.entity.ts:145,149`) — needs replacement (derive from invoices).

- [ ] **Step 3: Record findings in a short note inside the plan file**

Append a `## Audit Findings` section to this plan document with one line per match and the classification from Step 2. If ANY Step 2 match is a **blocker** (write to Prisma model), stop the plan and escalate to the user — we'd need to redesign Task 10 around keeping those fields as an event-projected cache instead of deleting them.

---

## Task 10: Remove the Denormalized Payment Fields (if audit clears)

**Why:** Delete dead columns. Source of truth is `ApplicationInvoice` + joined payments data.

**Precondition:** Task 9 must have produced **zero blockers** (no live Prisma writes of the three fields).

**Files:**
- Modify: `services/api/prisma/schema/applications.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_drop_application_payment_denorm/migration.sql`
- Modify: `services/api/src/modules/applications/infrastructure/mappers/application.mapper.ts`
- Modify: `services/api/src/core/entities/participant-application.entity.ts`
- Modify: `services/api/src/modules/applications/application/queries/handlers/get-application.handler.ts` (verify DTO population still works)
- Modify: `services/api/src/modules/applications/application/dto/application-response.dto.ts` (if it re-declares the fields from the Prisma model)

- [ ] **Step 1: Remove the fields from the Prisma schema**

Edit `services/api/prisma/schema/applications.prisma`. In `model ParticipantApplication` delete lines 163-166:

```prisma
  // Denormalized payment summary (source of truth is ApplicationInvoice)
  paymentAmount Decimal? @map("payment_amount") @db.Decimal(10, 2)
  paymentId     String?  @map("payment_id") @db.VarChar(100)
  paymentStatus String?  @map("payment_status") @db.VarChar(50)
```

- [ ] **Step 2: Generate the migration**

Run: `cd services/api && npx prisma migrate dev --name drop_application_payment_denorm --create-only`
Expected: generated `migration.sql` contains three `DROP COLUMN` statements on `participant_applications`.

- [ ] **Step 3: Apply**

Run: `cd services/api && npx prisma migrate dev`

- [ ] **Step 4: Remove mapper references**

Edit `services/api/src/modules/applications/infrastructure/mappers/application.mapper.ts`. Delete lines 43-45 (the constructor-arg lookups), lines 83-85, 124-126, and 156-158 (the three `paymentAmount/paymentId/paymentStatus` output shapes). The entity constructor signature needs the three positional args removed as well — grep for the entity class definition and align.

- [ ] **Step 5: Remove entity fields + dependent methods**

Edit `services/api/src/core/entities/participant-application.entity.ts`. Remove the `paymentAmount`, `paymentId`, `paymentStatus` fields from the class. Find the methods at lines 145 and 149:

```ts
    return !!this.paymentAmount && this.paymentAmount > 0;
    ...
    return this.paymentStatus === 'completed';
```

Both methods should be replaced with derivation from `this.invoices` (if the entity carries them) or deleted if the callers can query `ApplicationInvoice` directly. Grep for their call-sites to decide:

```bash
grep -rn --include='*.ts' 'hasPaid\|isPaidCompleted\|paymentCompleted' services/api/src
```

Replace each caller with a direct query to the `ApplicationInvoice` model, or move the logic into a repository method that can be unit-tested.

- [ ] **Step 6: Verify get-application handler still populates DTO correctly**

Re-read `services/api/src/modules/applications/application/queries/handlers/get-application.handler.ts` lines 60-80. The handler currently overrides `dto.paymentStatus`, `dto.paymentId`, `dto.paymentAmount` from a joined payments query. That still works — the DTO fields are separate from the Prisma model fields.

Verify the `ApplicationResponseDto` defines these three fields independently (not piped through Prisma's generated types). If the DTO inherits from the Prisma type, replace the inheritance with an explicit field list.

- [ ] **Step 7: Type-check + run tests**

Run: `cd services/api && npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 8: Manual smoke test — portal dashboard**

Start the API + frontend dev servers and hit a participant's portal page. Expected: the payment section still shows the right status (sourced via the handler's derivation), even though the denormalized columns are gone.

---

## Self-Review Notes

**Spec coverage:**
1. Encrypt gateway credentials → Tasks 1-4 ✓
2. Drop legacy `payments` table → Task 5 ✓
3. Add `externalIntentId` to `ApplicationInvoice` → Tasks 7-8 ✓
4. Gate `AutoMigrate` behind env var → Task 6 ✓
5. Denormalized payment fields cleanup → Tasks 9-10 ✓

**Placeholder scan:** No TBDs, no "implement appropriate X" handwaves. Every code change has exact file:line citations and complete code bodies. The one audit step (Task 9) is explicit about what to grep for and how to classify results.

**Type consistency:** `NewPaymentEvent` signature introduced in Task 7 is used by unnamed call-sites; Task 7 Step 2 forces the engineer to find them via grep. `NewGatewayConfigRepository` signature changed in Task 2 is propagated in the same task's Step 4. `processApplicationPayment` signature change in Task 8 Step 5 updates both the signature and the sole caller in the same edit.

**Commits:** Deliberately omitted per user preference. The engineer will stage and commit at checkpoints of their choosing.

**Known risk:** Task 10 assumes Task 9 clears. The plan explicitly aborts and escalates if any live Prisma write is found — do not guess.
