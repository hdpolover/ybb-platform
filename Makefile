SERVICES := shared-rabbitmq api payment file notification admin-dashboard minimal-admin monitoring
# Postgres Port Map: API=5432, Payment=5433, File=5434
# RabbitMQ Port Map: Payment=5673, Notification=5674

.PHONY: all start stop restart logs status clean help

help:
	@echo "YBB Platform (Microservices Edition)"
	@echo "-----------------------------------"
	@echo "make start    - Start all services (detached)"
	@echo "make stop     - Stop all services"
	@echo "make restart  - Restart all services"
	@echo "make rebuild  - Rebuild and start a specific service (default: all)"
	@echo "make logs-api - Watch logs for API service"
	@echo "make status   - Show status of all services"
	@echo "make logs     - Show logs (Ctrl+C to exit)"
	@echo "make clean    - Stop and remove all containers"

start:
	@echo "Starting all services (Hot-reload enabled for API)..."
	@for service in $(SERVICES); do \
		echo ">> Starting $$service..."; \
		(cd services/$$service && docker compose up -d); \
	done
	@echo "All services started! run 'make logs-api' to see API output."

stop:
	@echo "Stopping all services..."
	@for service in $(SERVICES); do \
		echo ">> Stopping $$service..."; \
		(cd services/$$service && docker compose down); \
	done

restart: stop start

rebuild:
	@echo "Rebuilding services..."
	@if [ -z "$(service)" ]; then \
		for s in $(SERVICES); do \
			echo ">> Rebuilding $$s..."; \
			(cd services/$$s && docker compose up -d --build); \
		done; \
	else \
		echo ">> Rebuilding $(service)..."; \
		(cd services/$(service) && docker compose up -d --build); \
	fi

logs-api:
	@echo "Tailing API logs..."
	@(cd services/api && docker compose logs -f api)

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

logs:
	@echo "Tailing logs (Ctrl+C to exit)..."
	@# This is a bit tricky with multiple complies, using a simple loop might not interleave well.
	@# Docker Compose doesn't support waiting for multiple projects easily.
	@# We'll suggest using individual logs or a tool like lazy-docker.
	@echo "For best experience, check individual service logs:"
	@echo "  cd services/<service> && docker compose logs -f"
