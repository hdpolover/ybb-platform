# =============================================================================
# YBB Platform - Start Development Environment (PowerShell Version)
# =============================================================================
# Usage: .\scripts\dev.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "Starting YBB Platform Development Environment..." -ForegroundColor Cyan

# Load environment variables if .env exists
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Start all services
docker-compose up -d

Write-Host ""
Write-Host "Services are starting..."
Write-Host ""

# Wait for services to be healthy
Start-Sleep -Seconds 5

Write-Host "Service Status:"
docker-compose ps

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "YBB Platform is running!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access points:"
Write-Host "  Admin Dashboard:      http://localhost:4001"
Write-Host "  API Gateway:          http://localhost:4000"
Write-Host "  API Docs:             http://localhost:4000/api/docs"
Write-Host "  Payment Service:      http://localhost:8002"
Write-Host "  File Service:         http://localhost:8001"
Write-Host "  File Docs:            http://localhost:8001/docs"
Write-Host "  Notification Service: http://localhost:4002"
Write-Host "  MinIO Console:        http://localhost:9001"
Write-Host "  RabbitMQ:             http://localhost:15672"
Write-Host "  Grafana:              http://localhost:43000"
Write-Host "  Prometheus:           http://localhost:49090"
Write-Host ""
Write-Host "Database:"
Write-Host "  PostgreSQL:      localhost:5432"
Write-Host "  Redis:           localhost:6379"
Write-Host ""
Write-Host "Run 'docker-compose logs -f' to view logs"
Write-Host "Run 'docker-compose stop' to stop all services"
Write-Host ""
