package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/uptrace/opentelemetry-go-extra/otelgorm"
	"google.golang.org/grpc"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/ybb-platform/payment/docs"

	commandHandlers "github.com/ybb-platform/payment/internal/application/commands/handlers"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/infrastructure/config"
	infraGateways "github.com/ybb-platform/payment/internal/infrastructure/gateways"
	grpcServer "github.com/ybb-platform/payment/internal/infrastructure/grpc"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
	"github.com/ybb-platform/payment/internal/infrastructure/persistence"
	"github.com/ybb-platform/payment/internal/presentation/http/handlers"
	httpMiddleware "github.com/ybb-platform/payment/internal/presentation/http/middleware"

	"github.com/ybb-platform/payment/internal/infrastructure/telemetry"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// @title           YBB Payment Service API
// @version         1.0
// @description     This is the API documentation for the YBB Platform Payment Service.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8002
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

	// Initialize Logger (Custom Loki Core + Console)
	lokiUrl := os.Getenv("LOKI_URL")
	if lokiUrl == "" {
		lokiUrl = "http://localhost:3100"
	}

	lokiLabels := map[string]string{"job": "ybb-payment"}
	lokiCore := telemetry.NewLokiCore(lokiUrl, lokiLabels, zap.InfoLevel)

	consoleEncoder := zapcore.NewConsoleEncoder(zap.NewDevelopmentEncoderConfig())
	consoleCore := zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), zap.InfoLevel)

	core := zapcore.NewTee(lokiCore, consoleCore)
	zLogger := zap.New(core)
	zap.ReplaceGlobals(zLogger)
	logger := zLogger.Sugar()

	// Initialize Telemetry
	tp, err := telemetry.InitTracer(context.Background())
	if err != nil {
		logger.Fatalf("Failed to initialize OTel: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(context.Background()); err != nil {
			logger.Errorf("Error shutting down OTel: %v", err)
		}
	}()

	logger.Infof("Starting Payment Service on port %s", cfg.Port)
	logger.Infof("Environment: %s", cfg.Environment)

	// Connect to database with GORM
	db, err := connectDatabase(cfg.DatabaseURL)
	if err != nil {
		logger.Fatalf("Failed to connect to database: %v", err)
	}

	// Run SQL Migrations (from migrations/ folder)
	// This ensures triggers, indexes, and seeded data are present
	if err := persistence.RunRawSqlMigrations(db, "migrations"); err != nil {
		logger.Fatalf("Failed to run SQL migrations: %v", err)
	}

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

	logger.Info("Connected to database successfully")

	// Initialize event publisher
	var eventPublisher messaging.EventPublisher
	if cfg.RabbitMQURL != "" {
		eventPublisher, err = messaging.NewRabbitMQPublisher(cfg.RabbitMQURL, cfg.RabbitMQExchange)
		if err != nil {
			logger.Errorf("Failed to connect to RabbitMQ, using NoOp publisher: %v", err)
			eventPublisher = messaging.NewNoOpPublisher()
		}
	} else {
		logger.Info("RabbitMQ URL not configured, using NoOp publisher")
		eventPublisher = messaging.NewNoOpPublisher()
	}
	defer eventPublisher.Close()

	// Initialize gateway factory
	gatewayFactory := infraGateways.NewGatewayFactory()

	// Initialize repositories
	gatewayConfigRepo := persistence.NewGatewayConfigRepository(db, cfg.PaymentSecretsKey)
	paymentMethodRepo := persistence.NewPaymentMethodRepository(db)

	// Load gateways: DB-stored configs take priority over env vars.
	// Providers found in DB will override their env-var counterparts.
	registerGateways(context.Background(), cfg, gatewayFactory, gatewayConfigRepo, logger)
	intentRepo := persistence.NewGormPaymentIntentRepository(db)
	txRepo := persistence.NewGormPaymentTransactionRepository(db)
	idempotencyRepo := persistence.NewGormPaymentIdempotencyRepository(db)

	// Start gRPC Server
	go func() {
		grpcPort := "50053" // TODO: Move to config
		lis, err := net.Listen("tcp", ":"+grpcPort)
		if err != nil {
			logger.Fatalf("failed to listen for gRPC: %v", err)
		}
		s := grpc.NewServer(grpc.UnaryInterceptor(grpcServer.InternalServiceKeyInterceptor(cfg.InternalServiceKey)))
		paymentGrpcService := grpcServer.NewPaymentGrpcServer(
			intentRepo,
			txRepo,
			paymentMethodRepo,
			idempotencyRepo,
			gatewayFactory,
			eventPublisher,
			cfg.DefaultGateway,
		)
		pb.RegisterPaymentServiceServer(s, paymentGrpcService)
		logger.Infof("gRPC server listening at %v", lis.Addr())
		if err := s.Serve(lis); err != nil {
			logger.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	paymentHandler := handlers.NewPaymentHandler(
		intentRepo,
		txRepo,
		eventPublisher,
		gatewayFactory,
	)

	paymentMethodHandler := handlers.NewPaymentMethodHandler(paymentMethodRepo)
	gatewayConfigHandler := handlers.NewGatewayConfigHandler(gatewayConfigRepo, paymentMethodRepo)

	// Initialize Intent Handlers
	createIntentHandler := commandHandlers.NewCreateIntentHandler(intentRepo)
	confirmIntentHandler := commandHandlers.NewConfirmIntentHandler(intentRepo, txRepo, paymentMethodRepo, idempotencyRepo, gatewayFactory, cfg.DefaultGateway)
	intentHandler := handlers.NewIntentHandler(createIntentHandler, confirmIntentHandler)

	// Setup router
	r := setupRouter(paymentHandler, paymentMethodHandler, gatewayConfigHandler, intentHandler, cfg.InternalServiceKey)

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start server in goroutine
	go func() {
		logger.Infof("Server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown:", err)
	}

	logger.Info("Server exited")
}

// registerGateways loads payment gateways with DB-stored configs taking priority over env vars.
// Strategy:
//  1. Start with env-var fallbacks (existing behaviour, unchanged).
//  2. For each active DB config, build and register the matching gateway, overwriting the
//     env-var version if the same provider was already registered.
//
// This means: adding a Xendit row in payment_gateway_configs with is_active=true will
// override XENDIT_SECRET_KEY without any restart config change.
func registerGateways(
	ctx context.Context,
	cfg *config.Config,
	gatewayFactory *infraGateways.GatewayFactory,
	gatewayConfigRepo *persistence.GatewayConfigRepository,
	logger *zap.SugaredLogger,
) {
	registered := []string{}

	// Manual gateway is always registered — it has no API keys.
	gatewayFactory.Register(infraGateways.NewManualGateway())
	registered = append(registered, "manual")

	// --- Step 1: env-var fallbacks ---
	if cfg.MidtransServerKey != "" {
		gatewayFactory.Register(infraGateways.NewMidtransGateway(
			cfg.MidtransServerKey,
			cfg.MidtransClientKey,
			cfg.Environment,
		))
		registered = append(registered, "midtrans(env)")
	}
	if cfg.XenditSecretKey != "" {
		gatewayFactory.Register(infraGateways.NewXenditGateway(cfg.XenditSecretKey, cfg.XenditCallbackToken))
		registered = append(registered, "xendit(env)")
	}
	if cfg.StripeSecretKey != "" {
		gatewayFactory.Register(infraGateways.NewStripeGateway(cfg.StripeSecretKey))
		registered = append(registered, "stripe(env)")
	}
	if cfg.PayPalClientID != "" && cfg.PayPalSecret != "" {
		gatewayFactory.Register(infraGateways.NewPayPalGateway(cfg.PayPalClientID, cfg.PayPalSecret, cfg.PayPalMode))
		registered = append(registered, "paypal(env)")
	}

	// --- Step 2: DB configs override env-var registrations ---
	dbConfigs, err := gatewayConfigRepo.FindActive(ctx)
	if err != nil {
		logger.Warnf("Could not load gateway configs from DB, using env vars only: %v", err)
	} else {
		for _, dbCfg := range dbConfigs {
			env := dbCfg.Mode // "sandbox" or "production"
			switch dbCfg.Provider {
			case "midtrans":
				gatewayFactory.Register(infraGateways.NewMidtransGateway(
					dbCfg.ServerKey,
					dbCfg.ClientKey,
					env,
				))
				registered = append(registered, "midtrans(db)")
			case "xendit":
				gatewayFactory.Register(infraGateways.NewXenditGateway(
					dbCfg.ServerKey,
					dbCfg.WebhookSecret, // callback token stored in webhook_secret
				))
				registered = append(registered, "xendit(db)")
			case "stripe":
				gatewayFactory.Register(infraGateways.NewStripeGateway(dbCfg.ServerKey))
				registered = append(registered, "stripe(db)")
			case "paypal":
				gatewayFactory.Register(infraGateways.NewPayPalGateway(
					dbCfg.ServerKey, // client_id stored in server_key
					dbCfg.ClientKey, // secret stored in client_key
					env,
				))
				registered = append(registered, "paypal(db)")
			default:
				logger.Warnf("Unknown provider %q in gateway_configs, skipping", dbCfg.Provider)
			}
		}
	}

	logger.Infof("Registered payment gateways: %v", registered)
}

// setupRouter registers all HTTP routes.
func setupRouter(
	paymentHandler *handlers.PaymentHandler,
	paymentMethodHandler *handlers.PaymentMethodHandler,
	gatewayConfigHandler *handlers.GatewayConfigHandler,
	intentHandler *handlers.IntentHandler,
	internalServiceKey string,
) *gin.Engine {
	router := gin.Default()
	router.Use(otelgin.Middleware("ybb-payment"))

	// Access via browser: http://localhost:8002/swagger/index.html
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "payment",
		})
	})

	// Prometheus Metrics
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		paymentsPublic := v1.Group("/payments")
		{
			paymentsPublic.POST("/webhook/:gateway", paymentHandler.HandleWebhook)
		}

		protected := v1.Group("")
		protected.Use(httpMiddleware.RequireInternalServiceKey(internalServiceKey))

		// New Intent Flow
		intents := protected.Group("/intents")
		{
			intents.POST("", intentHandler.CreateIntent)
			intents.POST("/:id/confirm", intentHandler.ConfirmIntent)
		}

		payments := protected.Group("/payments")
		{
			payments.GET("/:id", paymentHandler.GetPayment)
			payments.GET("/user/:userId", paymentHandler.GetPaymentsByUser)

			// Manual Payment Features
			payments.POST("/:id/proof", paymentHandler.UploadProof)
			payments.POST("/:id/verify", paymentHandler.VerifyPayment)
		}

		// Payment Methods (CRUD)
		methods := protected.Group("/payment-methods")
		{
			methods.GET("", paymentMethodHandler.GetAll)
			methods.GET("/:id", paymentMethodHandler.GetByID)
			methods.POST("", paymentMethodHandler.Create)
			methods.PUT("/:id", paymentMethodHandler.Update)
			methods.DELETE("/:id", paymentMethodHandler.Delete)
		}

		// Gateway Configs (admin — manage provider API keys and active status)
		gwConfigs := protected.Group("/gateway-configs")
		{
			gwConfigs.GET("", gatewayConfigHandler.GetAll)
			gwConfigs.GET("/:id", gatewayConfigHandler.GetByID)
			gwConfigs.POST("", gatewayConfigHandler.Create)
			gwConfigs.PUT("/:id", gatewayConfigHandler.Update)
			gwConfigs.PATCH("/:id/active", gatewayConfigHandler.SetActive)
			gwConfigs.DELETE("/:id", gatewayConfigHandler.Delete)
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

	if err := db.Use(otelgorm.NewPlugin()); err != nil {
		return nil, fmt.Errorf("failed to use otelgorm plugin: %w", err)
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
