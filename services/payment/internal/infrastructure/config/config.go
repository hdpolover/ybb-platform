package config

import (
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

	MidtransServerKey    string
	MidtransClientKey    string
	MidtransIsProduction bool

	XenditSecretKey string

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

	return &Config{
		Port:               getEnv("PORT", "8002"),
		Environment:        getEnv("ENVIRONMENT", "development"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgresql://ybb_user:ybb_pass@localhost:5432/ybb_payments_db"),
		RabbitMQURL:        getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		RabbitMQExchange:   getEnv("RABBITMQ_EXCHANGE", "payment-events"),
		DefaultGateway:     getEnv("DEFAULT_PAYMENT_GATEWAY", ""),
		InternalServiceKey: getEnv("INTERNAL_SERVICE_KEY", ""),

		MidtransServerKey:    getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:    getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransIsProduction: getEnv("MIDTRANS_IS_PRODUCTION", "false") == "true",

		XenditSecretKey: getEnv("XENDIT_SECRET_KEY", ""),

		StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),

		PayPalClientID: getEnv("PAYPAL_CLIENT_ID", ""),
		PayPalSecret:   getEnv("PAYPAL_SECRET", ""),
		PayPalMode:     getEnv("PAYPAL_MODE", "sandbox"),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
