SERVICES := shared-rabbitmq api payment file notification admin-dashboard monitoring pgadmin
# Postgres Port Map: API=5432, Payment=5433, File=5434
# RabbitMQ Port Map: Payment=5673, Notification=5674
# gRPC Port Map: File=50052, Payment=50053

.PHONY: all start stop restart logs status clean help $(SERVICES)

help:
	@echo "YBB Platform (Microservices Edition)"
	@echo "-----------------------------------"
	@echo "make start           - Start all services (detached)"
	@echo "make start-<svc>     - Start specific service (e.g. make start-api)"
	@echo "make stop            - Stop all services"
	@echo "make stop-<svc>      - Stop specific service"
	@echo "make restart         - Restart all services"
	@echo "make restart-<svc>   - Restart specific service (down & up)"
	@echo "make rebuild         - Rebuild all services"
	@echo "make rebuild-<svc>   - Rebuild specific service"
	@echo "make logs            - Tailing usage info"
	@echo "make logs-<svc>      - Watch logs for specific service"
	@echo "make status          - Show status of all services"
	@echo "make clean           - Stop and remove all containers"

# Generic Loop Targets
start:
	@if [ -z "$(service)" ]; then \
		echo "Starting all services..."; \
		for s in $(SERVICES); do \
			echo ">> Starting $$s..."; \
			(cd services/$$s && docker compose up -d); \
		done; \
	else \
		echo ">> Starting $(service)..."; \
		(cd services/$(service) && docker compose up -d); \
	fi

stop:
	@if [ -z "$(service)" ]; then \
		echo "Stopping all services..."; \
		for s in $(SERVICES); do \
			echo ">> Stopping $$s..."; \
			(cd services/$$s && docker compose down); \
		done; \
	else \
		echo ">> Stopping $(service)..."; \
		(cd services/$(service) && docker compose down); \
	fi

restart:
	@if [ -z "$(service)" ]; then \
		$(MAKE) stop; \
		$(MAKE) start; \
	else \
		echo ">> Restarting $(service)..."; \
		(cd services/$(service) && docker compose down); \
		(cd services/$(service) && docker compose up -d); \
	fi

rebuild:
	@if [ -z "$(service)" ]; then \
		echo "Rebuilding all services..."; \
		for s in $(SERVICES); do \
			echo ">> Rebuilding $$s..."; \
			(cd services/$$s && docker compose up -d --build); \
		done; \
	else \
		echo ">> Rebuilding $(service)..."; \
		(cd services/$(service) && docker compose up -d --build); \
	fi

# Pattern Rules for Convenience
start-%:
	$(MAKE) start service=$*

stop-%:
	$(MAKE) stop service=$*

restart-%:
	$(MAKE) restart service=$*

rebuild-%:
	$(MAKE) rebuild service=$*

logs-%:
	@echo "Tailing logs for $*..."
	@(cd services/$* && docker compose logs -f $*)

# =========================================
# Dependency Management (No Rebuild Needed)
# =========================================

# Usage: make add service=api pkg=firebase-admin
add:
	@if [ -z "$(service)" ] || [ -z "$(pkg)" ]; then \
		echo "Usage: make add service=<name> pkg=<package_name>"; \
		exit 1; \
	fi
	@echo "📦 Installing $(pkg) in $(service) (Host)..."
	@(cd services/$(service) && npm install $(pkg))
	@echo "🐳 Installing $(pkg) in $(service) (Container)..."
	@(cd services/$(service) && docker compose exec $(service) npm install $(pkg))
	@echo "✅ Done! The app should pick it up automatically."

# Usage: make install service=api
install:
	@if [ -z "$(service)" ]; then \
		echo "Usage: make install service=<name>"; \
		exit 1; \
	fi
	@echo "📦 Syncing dependencies for $(service)..."
	@(cd services/$(service) && npm install)
	@echo "🐳 Syncing container node_modules..."
	@(cd services/$(service) && docker compose exec $(service) npm install)
	@echo "✅ Done!"

logs:
	@if [ -z "$(service)" ]; then \
		echo "For best experience, check individual service logs:"; \
		echo "  make logs-<service> (e.g. make logs-api)"; \
	else \
		echo "Tailing logs for $(service)..."; \
		(cd services/$(service) && docker compose logs -f $(service)); \
	fi

status:
	@echo "Checking Service Status..."
	@for service in $(SERVICES); do \
		echo "--- $$service ---"; \
		(cd services/$$service && docker compose ps); \
	done

clean:
	@echo "Cleaning up..."
	@for service in $(SERVICES); do \
		echo ">> Cleaning $$service..."; \
		(cd services/$$service && docker compose down -v); \
	done
