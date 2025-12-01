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

	commandHandlers "github.com/ybb-platform/payment-service/internal/application/commands/handlers"
	queryHandlers "github.com/ybb-platform/payment-service/internal/application/queries/handlers"
	"github.com/ybb-platform/payment-service/internal/domain/entities"
	"github.com/ybb-platform/payment-service/internal/infrastructure/config"
	infraGateways "github.com/ybb-platform/payment-service/internal/infrastructure/gateways"
	"github.com/ybb-platform/payment-service/internal/infrastructure/messaging"
	"github.com/ybb-platform/payment-service/internal/infrastructure/persistence"
	"github.com/ybb-platform/payment-service/internal/presentation/http/handlers"
)

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
	if err := db.AutoMigrate(&entities.Payment{}, &entities.PaymentMethodEntity{}	); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Initialize event publisher
	// TODO for intern: Replace with actual RabbitMQ implementation
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

	// Manual Payment Gateway
    // Register Manual Gateway
    manualGateway := infraGateways.NewManualGateway()
    gatewayFactory.Register(manualGateway)
    
    log.Println("Registered payment gateways: Manual")

	// Initialize repository with GORM
	paymentRepo := persistence.NewGormPaymentRepository(db)
	// (BARU) Inisialisasi Repo Payment Method
	paymentMethodRepo := persistence.NewPaymentMethodRepository(db)

	// Initialize handlers
	createPaymentHandler := commandHandlers.NewCreatePaymentHandler(
		paymentRepo,
		gatewayFactory,
		eventPublisher,
	)
	getPaymentHandler := queryHandlers.NewGetPaymentHandler(paymentRepo)

	// Initialize HTTP handler
	paymentHandler := handlers.NewPaymentHandler(
		createPaymentHandler,
		getPaymentHandler,

		paymentRepo,
		eventPublisher,
	)

	// (BARU) Inisialisasi Payment Method Handler
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

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

func setupRouter(paymentHandler *handlers.PaymentHandler, paymentMethodHandler *handlers.PaymentMethodHandler,		) *gin.Engine {
	router := gin.Default()

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

		// (BARU) Group Payment Methods (CRUD)
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
	// Configure GORM logger
	gormLogger := logger.Default.LogMode(logger.Info)

	// Connect with GORM
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: gormLogger,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL DB for connection pool settings
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
