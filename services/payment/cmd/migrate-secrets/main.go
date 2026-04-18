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
