package config

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds application configuration
type Config struct {
	Port               string
	Environment        string
	DatabaseURL        string
	RabbitMQURL        string
	RabbitMQExchange   string
	DefaultGateway     string
	InternalServiceKey string
	PaymentSecretsKey  string

	MidtransServerKey    string
	MidtransClientKey    string
	MidtransIsProduction bool

	XenditSecretKey     string
	XenditCallbackToken string

	StripeSecretKey     string
	StripeWebhookSecret string

	PayPalClientID string
	PayPalSecret   string
	PayPalMode     string
}

// LoadConfig loads configuration from environment variables
// TODO for intern: Add validation and defaults
func LoadConfig() (*Config, error) {
	// Load .env file if exists (for local development)
	_ = godotenv.Load()

	cfg := &Config{
		Port:               getEnv("PORT", "8002"),
		Environment:        getEnv("ENVIRONMENT", "development"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgresql://ybb_user:ybb_pass@localhost:5432/ybb_payments_db"),
		RabbitMQURL:        getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		RabbitMQExchange:   getEnv("RABBITMQ_EXCHANGE", "payment-events"),
		DefaultGateway:     getEnv("DEFAULT_PAYMENT_GATEWAY", ""),
		InternalServiceKey: getEnv("INTERNAL_SERVICE_KEY", ""),
		PaymentSecretsKey:  getEnv("PAYMENT_SECRETS_KEY", ""),

		MidtransServerKey:    getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:    getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransIsProduction: getEnv("MIDTRANS_IS_PRODUCTION", "false") == "true",

		XenditSecretKey:     getEnv("XENDIT_SECRET_KEY", ""),
		XenditCallbackToken: getEnv("XENDIT_CALLBACK_TOKEN", ""),

		StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),

		PayPalClientID: getEnv("PAYPAL_CLIENT_ID", ""),
		PayPalSecret:   getEnv("PAYPAL_SECRET", ""),
		PayPalMode:     getEnv("PAYPAL_MODE", "sandbox"),
	}

	if err := validatePaymentSecretsKey(cfg.PaymentSecretsKey); err != nil {
		return nil, err
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func validatePaymentSecretsKey(b64Key string) error {
	if b64Key == "" {
		return fmt.Errorf("PAYMENT_SECRETS_KEY is required and must be base64-encoded 32 bytes (run: openssl rand -base64 32)")
	}

	key, err := base64.StdEncoding.DecodeString(b64Key)
	if err != nil {
		return fmt.Errorf("PAYMENT_SECRETS_KEY must be valid base64: %w", err)
	}
	if len(key) != 32 {
		return fmt.Errorf("PAYMENT_SECRETS_KEY must decode to exactly 32 bytes (got %d)", len(key))
	}
	return nil
}
