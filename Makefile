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
	@echo "make status   - Show status of all services"
	@echo "make logs     - Show logs (Ctrl+C to exit)"
	@echo "make clean    - Stop and remove all containers"

start:
	@echo "Starting all services..."
	@for service in $(SERVICES); do \
		echo ">> Starting $$service..."; \
		(cd services/$$service && docker compose up -d); \
	done
	@echo "All services started!"

stop:
	@echo "Stopping all services..."
	@for service in $(SERVICES); do \
		echo ">> Stopping $$service..."; \
		(cd services/$$service && docker compose down); \
	done

restart: stop start

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
