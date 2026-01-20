<#
.SYNOPSIS
    Management script for YBB Platform services on Windows.
    This is the Windows equivalent of the root Makefile.

.DESCRIPTION
    Allows starting, stopping, and managing the lifecycle of the microservices
    defined in the /services directory.

.EXAMPLE
    .\Manage.ps1 start
    .\Manage.ps1 stop
#>

param (
    [Parameter(Mandatory=$false, Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "clean", "help", "logs")]
    [string]$Command = "help"
)

# List of services matching the Makefile
$Services = @(
    "shared-rabbitmq",
    "api",
    "payment",
    "file",
    "notification",
    "admin-dashboard",
    "minimal-admin",
    "monitoring"
)

# Save the root directory to ensure we can return to it
$RootDir = Get-Location

function Start-Services {
    Write-Host "Starting all services..." -ForegroundColor Green
    foreach ($service in $Services) {
        Write-Host ">> Starting $service..." -ForegroundColor Cyan
        if (Test-Path "services\$service") {
            Push-Location "services\$service"
            try {
                docker compose up -d
            } finally {
                Pop-Location
            }
        } else {
            Write-Warning "Directory services\$service not found."
        }
    }
    Write-Host "All services started!" -ForegroundColor Green
}

function Stop-Services {
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    foreach ($service in $Services) {
        Write-Host ">> Stopping $service..." -ForegroundColor Cyan
        if (Test-Path "services\$service") {
            Push-Location "services\$service"
            try {
                docker compose down
            } finally {
                Pop-Location
            }
        }
    }
}

function Get-Status {
    Write-Host "Checking Service Status..." -ForegroundColor Magenta
    foreach ($service in $Services) {
        Write-Host "--- $service ---" -ForegroundColor Cyan
        if (Test-Path "services\$service") {
            Push-Location "services\$service"
            try {
                docker compose ps
            } finally {
                Pop-Location
            }
        }
    }
}

function Clean-Services {
    Write-Host "Cleaning up (Stop and Remove Volumes)..." -ForegroundColor Red
    foreach ($service in $Services) {
        Write-Host ">> Cleaning $service..." -ForegroundColor Cyan
        if (Test-Path "services\$service") {
            Push-Location "services\$service"
            try {
                docker compose down -v
            } finally {
                Pop-Location
            }
        }
    }
}

function Show-Logs-Help {
    Write-Host "Tailing logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    Write-Host "For a better experience, we recommend checking individual service logs."
    Write-Host "Use: cd services\<service> ; docker compose logs -f"
}

function Show-Help {
    Write-Host "YBB Platform (Microservices Edition) - Windows Management Script"
    Write-Host "----------------------------------------------------------------"
    Write-Host "Usage: .\Manage.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  start    - Start all services (detached)"
    Write-Host "  stop     - Stop all services"
    Write-Host "  restart  - Restart all services"
    Write-Host "  status   - Show status of all services"
    Write-Host "  logs     - Show log instructions"
    Write-Host "  clean    - Stop and remove all containers and volumes"
    Write-Host "  help     - Show this help message"
}

# Main Execution Flow
try {
    switch ($Command) {
        "start"   { Start-Services }
        "stop"    { Stop-Services }
        "restart" { Stop-Services; Start-Services }
        "status"  { Get-Status }
        "clean"   { Clean-Services }
        "logs"    { Show-Logs-Help }
        "help"    { Show-Help }
        Default   { Show-Help }
    }
}
catch {
    Write-Error "An error occurred executing the command: $_"
    Set-Location $RootDir
}
