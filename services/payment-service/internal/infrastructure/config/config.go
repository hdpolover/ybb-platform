package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds application configuration
type Config struct {
	Port                 string
	Environment          string
	DatabaseURL          string
	RabbitMQURL          string
	RabbitMQExchange     string

	MidtransServerKey    string
	MidtransClientKey    string
	MidtransIsProduction bool

	XenditSecretKey      string
}

// LoadConfig loads configuration from environment variables
// TODO for intern: Add validation and defaults
func LoadConfig() (*Config, error) {
	// Load .env file if exists (for local development)
	_ = godotenv.Load()

	return &Config{
		Port:                 getEnv("PORT", "8002"),
		Environment:          getEnv("ENVIRONMENT", "development"),
		DatabaseURL:          getEnv("DATABASE_URL", "postgresql://ybb_user:ybb_pass@localhost:5432/ybb_payments_db"),
		RabbitMQURL:          getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		RabbitMQExchange:     getEnv("RABBITMQ_EXCHANGE", "payment-events"),
		
		MidtransServerKey:    getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:    getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransIsProduction: getEnv("MIDTRANS_IS_PRODUCTION", "false") == "true",

		XenditSecretKey:      getEnv("XENDIT_SECRET_KEY", ""),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
