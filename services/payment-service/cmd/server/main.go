package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/ybb-platform/payment-service/docs" 

	commandHandlers "github.com/ybb-platform/payment-service/internal/application/commands/handlers"
	queryHandlers "github.com/ybb-platform/payment-service/internal/application/queries/handlers"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/infrastructure/config"
	infraGateways "github.com/ybb-platform/payment-service/internal/infrastructure/gateways"
	"github.com/ybb-platform/payment-service/internal/infrastructure/messaging"
	"github.com/ybb-platform/payment-service/internal/infrastructure/persistence"
	"github.com/ybb-platform/payment-service/internal/presentation/http/handlers"
)

// @title           YBB Payment Service API
// @version         1.0
// @description     Ini adalah dokumentasi API untuk layanan pembayaran YBB Platform.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8081
// @BasePath  /api/v1

// @securityDefinitions.basic BasicAuth

// @externalDocs.description  OpenAPI
// @externalDocs.url          https://swagger.io/resources/open-api/
func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting Payment Service on port %s", cfg.Port)
	log.Printf("Environment: %s", cfg.Environment)

	// Connect to database with GORM
	db, err := connectDatabase(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate database schema
	if err := db.AutoMigrate(&entities.Payment{}, &entities.PaymentMethodEntity{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Initialize event publisher
	var eventPublisher messaging.EventPublisher
	if cfg.RabbitMQURL != "" {
		eventPublisher, err = messaging.NewRabbitMQPublisher(cfg.RabbitMQURL, cfg.RabbitMQExchange)
		if err != nil {
			log.Printf("Failed to connect to RabbitMQ, using NoOp publisher: %v", err)
			eventPublisher = messaging.NewNoOpPublisher()
		}
	} else {
		log.Println("RabbitMQ URL not configured, using NoOp publisher")
		eventPublisher = messaging.NewNoOpPublisher()
	}
	defer eventPublisher.Close()

	// Initialize gateway factory
	gatewayFactory := infraGateways.NewGatewayFactory()

	// Register Midtrans gateway
	midtransGateway := infraGateways.NewMidtransGateway(
		cfg.MidtransServerKey,
		cfg.MidtransClientKey,
		cfg.Environment,
	)
	gatewayFactory.Register(midtransGateway)
	log.Println("Registered payment gateways: Midtrans")

	// Register Manual Gateway
	manualGateway := infraGateways.NewManualGateway()
	gatewayFactory.Register(manualGateway)
	log.Println("Registered payment gateways: Manual")

	// Register Xendit Gateway
	if cfg.XenditSecretKey != "" {
		xenditGateway := infraGateways.NewXenditGateway(cfg.XenditSecretKey)
		gatewayFactory.Register(xenditGateway)
		log.Println("Registered payment gateways: Xendit")
	} else {
		log.Println("Warning: Xendit Secret Key is empty, skipping registration")
	}

	if cfg.StripeSecretKey != "" {
        stripeGateway := infraGateways.NewStripeGateway(cfg.StripeSecretKey)
        gatewayFactory.Register(stripeGateway)
        log.Println("Registered payment gateways: Stripe")
    } else {
        log.Println("Warning: Stripe Secret Key is empty, skipping registration")
    }

	if cfg.PayPalClientID != "" {
        paypalGateway := infraGateways.NewPayPalGateway(
            cfg.PayPalClientID,
            cfg.PayPalSecret,
            cfg.PayPalMode,
        )
        gatewayFactory.Register(paypalGateway)
        log.Println("Registered payment gateways: PayPal")
    } else {
        log.Println("Warning: PayPal Client ID is empty, skipping registration")
    }

	// Initialize repositories
	paymentRepo := persistence.NewGormPaymentRepository(db)
	paymentMethodRepo := persistence.NewPaymentMethodRepository(db)

	// Initialize handlers
	createPaymentHandler := commandHandlers.NewCreatePaymentHandler(
		paymentRepo,
		gatewayFactory,
		eventPublisher,
	)
	getPaymentHandler := queryHandlers.NewGetPaymentHandler(paymentRepo)

	paymentHandler := handlers.NewPaymentHandler(
		createPaymentHandler,
		getPaymentHandler,
		paymentRepo,
		eventPublisher,
		gatewayFactory,
	)

	paymentMethodHandler := handlers.NewPaymentMethodHandler(paymentMethodRepo)

	// Setup router
	r := setupRouter(paymentHandler, paymentMethodHandler)

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

// setupRouter sekarang menerima handler dan mendaftarkan route Swagger
func setupRouter(paymentHandler *handlers.PaymentHandler, paymentMethodHandler *handlers.PaymentMethodHandler) *gin.Engine {
	router := gin.Default()

	// Akses via browser: http://localhost:8002/swagger/index.html
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health check
	router.GET("/health", func(c *gin.Context) {	
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "payment-service",
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		payments := v1.Group("/payments")
		{
			payments.POST("", paymentHandler.CreatePayment)
			payments.GET("/:id", paymentHandler.GetPayment)
			payments.GET("/user/:userId", paymentHandler.GetPaymentsByUser)
			payments.POST("/webhook/:gateway", paymentHandler.HandleWebhook)

			// Manual Payment Features
			payments.POST("/:id/proof", paymentHandler.UploadProof)
			payments.POST("/:id/verify", paymentHandler.VerifyPayment)
		}

		// Payment Methods (CRUD)
		methods := v1.Group("/payment-methods")
		{
			methods.GET("", paymentMethodHandler.GetAll)
			methods.POST("", paymentMethodHandler.Create)
			methods.PUT("/:id", paymentMethodHandler.Update)
			methods.DELETE("/:id", paymentMethodHandler.Delete)
		}
	}

	return router
}

func connectDatabase(databaseURL string) (*gorm.DB, error) {
	gormLogger := logger.Default.LogMode(logger.Info)

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger:  gormLogger,
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}