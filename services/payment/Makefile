.PHONY: build run migrate clean

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
BINARY_NAME=ybb-payment
BINARY_UNIX=$(BINARY_NAME)_unix

all: test build

build:
	$(GOBUILD) -o $(BINARY_NAME) -v cmd/server/main.go

test:
	$(GOTEST) -v ./...

clean:
	$(GOCLEAN)
	rm -f $(BINARY_NAME)
	rm -f $(BINARY_UNIX)

run:
	$(GOBUILD) -o $(BINARY_NAME) -v cmd/server/main.go
	./$(BINARY_NAME)

# Explicit migrate command (Using the same binary logic, just ensuring it runs)
# In our architecture, "run" performs migration on startup.
migrate:
	@echo "Running migrations via app startup..."
	@# We just run the app and exit if we wanted strict migration mode,
	@# but for now, just starting the app is the standard way to migrate.
	$(GOBUILD) -o $(BINARY_NAME) -v cmd/server/main.go
	./$(BINARY_NAME)
