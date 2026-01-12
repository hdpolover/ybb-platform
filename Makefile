.PHONY: help dev prod stop clean logs build restart health setup seed-db backup restore

# Default target
help:
	@echo "YBB Platform - Available Commands:"
	@echo ""
	@echo "Quick Start (for new developers):"
	@echo "  make start        - One command to rule them all! Sets up & starts everything"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services in development mode"
	@echo "  make stop         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make logs         - View logs from all services"
	@echo "  make build        - Build all Docker images"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start all services in production mode"
	@echo "  make prod-build   - Build production images"
	@echo ""
	@echo "Database:"
	@echo "  make setup        - Initial setup (creates database, runs migrations)"
	@echo "  make migrate      - Run database migrations"
	@echo "  make seed-db      - Seed database with sample data"
	@echo "  make backup       - Backup database"
	@echo "  make restore      - Restore database from backup"
	@echo "  make db-reset     - Reset database (DANGER: deletes all data)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Remove all containers, volumes, and images"
	@echo "  make health       - Check health of all services"
	@echo "  make ps           - Show running containers"
	@echo ""
	@echo "Code Generation:"
	@echo "  make proto        - Generate protobuf files"
	@echo ""

# ===========================================
# QUICK START - One command for new developers
# ===========================================
start:
	@chmod +x ./scripts/start-safe.sh
	@./scripts/start-safe.sh

# Development
dev:
	@echo "Starting development environment..."
	docker compose up -d
	@echo "Services are starting. Run 'make logs' to view logs."
	@echo "Access points:"
	@echo "  - Admin Dashboard: http://localhost:4001"
	@echo "  - API Gateway: http://localhost:4000"
	@echo "  - Payment Service: http://localhost:8002"
	@echo "  - File Service: http://localhost:8001"

stop:
	@echo "Stopping all services..."
	docker compose down

restart:
	@echo "Restarting all services..."
	docker compose restart

logs:
	docker compose logs -f

build:
	@echo "Building all Docker images..."
	docker compose build

# Production
prod:
	@echo "Starting production environment..."
	docker compose -f docker-compose.prod.yml up -d
	@echo "Production services are running."

prod-build:
	@echo "Building production images..."
	docker compose -f docker-compose.prod.yml build

# Staging
staging:
	@echo "Starting staging environment..."
	docker compose -f docker-compose.staging.yml up -d
	@echo "Staging services are running."

staging-build:
	@echo "Building staging images..."
	docker compose -f docker-compose.staging.yml build

# Database operations
setup:
	@echo "Running initial setup..."
	chmod +x ./scripts/setup.sh
	./scripts/setup.sh

migrate:
	@echo "Running database migrations..."
	docker compose exec api npm run migration:run

prod-migrate:
	@echo "Running production database migrations..."
	docker compose -f docker-compose.prod.yml exec api npm run migration:run

staging-migrate:
	@echo "Running staging database migrations..."
	docker compose -f docker-compose.staging.yml exec api npm run migration:run

seed-db:
	@echo "Seeding database..."
	chmod +x ./scripts/seed-db.sh
	./scripts/seed-db.sh

backup:
	@echo "Creating database backup..."
	chmod +x ./scripts/backup.sh
	./scripts/backup.sh

restore:
	@echo "Restoring database from backup..."
	chmod +x ./scripts/restore.sh
	./scripts/restore.sh

# Database reset (for development only)
db-reset:
	@echo "⚠️  WARNING: This will DELETE all data!"
	@read -p "Are you sure? Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	@echo "🗑️  Stopping services and removing database volume..."
	docker compose down
	docker volume rm ybb-platform_postgres_data 2>/dev/null || true
	@echo "🔄 Restarting with fresh database..."
	@$(MAKE) start
	@echo "✅ Database reset complete!"

# Maintenance
clean:
	@echo "Cleaning up all containers, volumes, and images..."
	docker compose down -v --rmi all
	@echo "Cleanup complete."

health:
	@echo "Checking service health..."
	chmod +x ./scripts/health-check.sh
	./scripts/health-check.sh

ps:
	docker compose ps

# Code generation
proto:
	@echo "Generating protobuf files..."
	chmod +x ./scripts/generate-proto.sh
	./scripts/generate-proto.sh

# Individual service operations
api-logs:
	docker compose logs -f api

payment-logs:
	docker compose logs -f payment-service

file-logs:
	docker compose logs -f file-service

dashboard-logs:
	docker compose logs -f admin-dashboard

# Shell access
api-shell:
	docker compose exec api sh

payment-shell:
	docker compose exec payment-service sh

file-shell:
	docker compose exec file-service sh

db-shell:
	docker compose exec postgres psql -U ${DATABASE_USER} -d ${DATABASE_NAME}

redis-shell:
	docker compose exec redis redis-cli
