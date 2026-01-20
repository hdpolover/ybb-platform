# =============================================================================
# YBB Platform - Seed Database (PowerShell Version)
# =============================================================================
# Usage:.\scripts\seed-db.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Seeding Database with Sample Data" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$DB_USER = [Environment]::GetEnvironmentVariable("DATABASE_USER")
$DB_NAME = [Environment]::GetEnvironmentVariable("DATABASE_NAME")

# Check if PostgreSQL is running
$pgStatus = docker-compose ps postgres
if ($pgStatus -notmatch "Up") {
    Write-Host "ERROR: PostgreSQL is not running" -ForegroundColor Red
    Write-Host "Run '.\scripts\dev.ps1' first to start services"
    exit 1
}

Write-Host "Seeding users..."
docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME -f /docker-entrypoint-initdb.d/../database/seeds/users.sql 2>$null
# Note: Path is tricky depending on volume mapping. Assuming /app or similar mapping might be needed if seeds aren't in /docker-entrypoint-initdb.d
# However, docker-compose.yml usually doesn't map the whole root to postgres.
# The original script used: < database/seeds/users.sql
# So we pipe it in:
Get-Content database/seeds/users.sql | docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME

Write-Host "Seeding programs..."
Get-Content database/seeds/programs.sql | docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Database seeding completed!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default admin credentials:"
Write-Host "  Email: admin@ybbhub.com"
Write-Host "  Password: Admin123!"
Write-Host ""
Write-Host "Test user credentials:"
Write-Host "  Email: user@ybbhub.com"
Write-Host "  Password: Admin123!"
Write-Host ""
