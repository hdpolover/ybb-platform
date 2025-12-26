# =============================================================================
# YBB Platform - Initial Setup Script (PowerShell Version)
# =============================================================================
# Usage: .\scripts\setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "YBB Platform - Initial Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "Please update the .env file with your configuration before continuing." -ForegroundColor Yellow
    Read-Host "Press Enter to continue after updating .env..."
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Load environment variables (Simple parser)
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Check if Docker is running
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker is running" -ForegroundColor Green

# Check if Docker Compose (plugin or standalone)
# We assume 'docker-compose' alias or 'docker compose'
# Try 'docker-compose' first
$DOCKER_COMPOSE_CMD = "docker-compose"
if (-not (Get-Command "docker-compose" -ErrorAction SilentlyContinue)) {
    # Try 'docker compose' (v2)
    $DOCKER_COMPOSE_CMD = "docker compose"
}

Write-Host "✓ Docker Compose is available ($DOCKER_COMPOSE_CMD)" -ForegroundColor Green

Write-Host ""
Write-Host "Building Docker images..."
Invoke-Expression "$DOCKER_COMPOSE_CMD build"

Write-Host ""
Write-Host "Starting infrastructure services (PostgreSQL, Redis, MinIO)..."
Invoke-Expression "$DOCKER_COMPOSE_CMD up -d postgres redis minio"

Write-Host ""
Write-Host "Waiting for PostgreSQL to be ready..."
Start-Sleep -Seconds 10

# Check if PostgreSQL is ready
$DB_USER = [Environment]::GetEnvironmentVariable("DATABASE_USER")
# Loop check
while ($true) {
    $out = Invoke-Expression "$DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U $DB_USER" 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Write-Host "Waiting for PostgreSQL..."
    Start-Sleep -Seconds 2
}
Write-Host "✓ PostgreSQL is ready" -ForegroundColor Green

Write-Host ""
Write-Host "Running database migrations..."
$DB_NAME = [Environment]::GetEnvironmentVariable("DATABASE_NAME")
$migrations = Get-ChildItem "database/migrations/*.sql"
foreach ($migration in $migrations) {
    $baseName = $migration.Name
    Write-Host "Running: $baseName"
    # Note: Path separator '/' used for inside container
    Invoke-Expression "$DOCKER_COMPOSE_CMD exec -T postgres psql -U $DB_USER -d $DB_NAME -f /docker-entrypoint-initdb.d/$baseName"
}
Write-Host "✓ Migrations completed" -ForegroundColor Green

Write-Host ""
Write-Host "Creating MinIO buckets..."
$MINIO_ACCESS = [Environment]::GetEnvironmentVariable("MINIO_ACCESS_KEY")
$MINIO_SECRET = [Environment]::GetEnvironmentVariable("MINIO_SECRET_KEY")
$MINIO_BUCKET = [Environment]::GetEnvironmentVariable("MINIO_BUCKET")

# Suppress errors if alias already exists or bucket exists
Invoke-Expression "$DOCKER_COMPOSE_CMD exec -T minio mc alias set local http://localhost:9000 $MINIO_ACCESS $MINIO_SECRET" 2> $null
Invoke-Expression "$DOCKER_COMPOSE_CMD exec -T minio mc mb local/$MINIO_BUCKET" 2> $null
Invoke-Expression "$DOCKER_COMPOSE_CMD exec -T minio mc anonymous set download local/$MINIO_BUCKET" 2> $null

Write-Host "✓ MinIO configured" -ForegroundColor Green

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run '.\scripts\dev.ps1' to start all services"
Write-Host "  2. Run '.\scripts\seed-db.ps1' to add sample data (optional)"
Write-Host "  3. Access the admin dashboard at http://localhost:4001"
Write-Host "  4. Access the API at http://localhost:4000"
Write-Host ""
