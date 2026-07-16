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
    .\Manage.ps1 start api
    .\Manage.ps1 logs payment
    .\Manage.ps1 shell api
#>

param (
    [Parameter(Mandatory=$false, Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "clean", "help", "logs", "ps", "migrate", "shell", "db-shell", "build")]
    [string]$Command = "help",
    
    [Parameter(Mandatory=$false, Position=1)]
    [string]$Service = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Build = $false
)

# List of services matching the Makefile
$Services = @(
    "shared-rabbitmq",
    "api",
    "payment",
    "file",
    "notification",
    "admin-dashboard",
    "monitoring",
    "pgadmin"
)

# Save the root directory to ensure we can return to it
$RootDir = Get-Location

function Start-Services {
    param(
        [string]$TargetService = "",
        [bool]$BuildFirst = $false
    )
    
    if ($TargetService) {
        Write-Host "Starting $TargetService..." -ForegroundColor Cyan
        if (Test-Path "services\$TargetService") {
            Push-Location "services\$TargetService"
            try {
                if ($BuildFirst) {
                    Write-Host "  Building image..." -ForegroundColor Yellow
                    docker compose build
                }
                docker compose up -d
            } finally {
                Pop-Location
            }
        } else {
            Write-Warning "Directory services\$TargetService not found."
        }
        return
    }
    
    Write-Host "Starting all services..." -ForegroundColor Green
    foreach ($service in $Services) {
        Write-Host ">> Starting $service..." -ForegroundColor Cyan
        if (Test-Path "services\$service") {
            Push-Location "services\$service"
            try {
                if ($BuildFirst) {
                    Write-Host "  Building image..." -ForegroundColor Yellow
                    docker compose build
                }
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
    param([string]$TargetService = "")
    
    if ($TargetService) {
        Write-Host "Stopping $TargetService..." -ForegroundColor Yellow
        if (Test-Path "services\$TargetService") {
            Push-Location "services\$TargetService"
            try {
                docker compose down
            } finally {
                Pop-Location
            }
        }
        return
    }
    
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
    param([string]$TargetService = "")

    if ($TargetService) {
        Write-Host "Cleaning up $TargetService (Stop and Remove Volumes)..." -ForegroundColor Red
        if (Test-Path "services\$TargetService") {
            Push-Location "services\$TargetService"
            try {
                docker compose down -v
            } finally {
                Pop-Location
            }
        } else {
            Write-Warning "Directory services\$TargetService not found."
        }
        return
    }

    Write-Host "Cleaning up ALL services (Stop and Remove Volumes)..." -ForegroundColor Red
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
    Write-Host "Cleanup complete!" -ForegroundColor Green
}

function Build-Services {
    param([string]$TargetService = "")
    
    if ($TargetService) {
        Write-Host "Building $TargetService..." -ForegroundColor Cyan
        if (Test-Path "services\$TargetService") {
            Push-Location "services\$TargetService"
            try {
                docker compose build
            } finally {
                Pop-Location
            }
        } else {
            Write-Warning "Directory services\$TargetService not found."
        }
        return
    }
    
    Write-Host "Building all services..." -ForegroundColor Green
    foreach ($service in $Services) {
        Write-Host ">> Building $service..." -ForegroundColor Cyan
        if (Test-Path "services\$service") {
            Push-Location "services\$service"
            try {
                docker compose build
            } finally {
                Pop-Location
            }
        } else {
            Write-Warning "Directory services\$service not found."
        }
    }
    Write-Host "Build complete!" -ForegroundColor Green
}

function Show-Logs-Help {
    param([string]$TargetService = "")
    
    if ($TargetService) {
        Write-Host "Tailing logs for $TargetService..." -ForegroundColor Yellow
        if (Test-Path "services\$TargetService") {
            Push-Location "services\$TargetService"
            try {
                docker compose logs -f
            } finally {
                Pop-Location
            }
        }
        return
    }
    
    Write-Host "Tailing logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    Write-Host "For a better experience, we recommend checking individual service logs."
    Write-Host "Use: .\Manage.ps1 logs <service>"
    Write-Host ""
    Write-Host "Available services: $($Services -join ', ')"
}

function Show-DockerPs {
    docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
}

function Run-Migrate {
    Write-Host "Running Prisma migrations on API service..." -ForegroundColor Cyan
    # Note: API service automatically runs migrations on startup via docker-entrypoint.sh
    # This manual command is for triggering it without restart
    docker exec ybb-api npx prisma migrate deploy
    
    Write-Host "Triggering Payment service migrations (via restart)..." -ForegroundColor Cyan
    if (Test-Path "services\payment") {
        Push-Location "services\payment"
        try {
            docker compose restart
        } finally {
            Pop-Location
        }
    }
}

function Open-Shell {
    param([string]$TargetService)
    
    if (-not $TargetService) {
        Write-Host "Please specify a service: .\Manage.ps1 shell <service>" -ForegroundColor Red
        Write-Host "Available: api, payment, file, notification"
        return
    }
    
    $containerMap = @{
        "api" = "ybb-api"
        "payment" = "ybb-payment"
        "file" = "ybb-file"
        "notification" = "ybb-notification"
        "admin-dashboard" = "ybb-admin-dashboard"
        "pgadmin" = "ybb-pgadmin"
    }
    
    $container = $containerMap[$TargetService]
    if (-not $container) {
        Write-Host "Unknown service: $TargetService" -ForegroundColor Red
        return
    }
    
    Write-Host "Opening shell in $container..." -ForegroundColor Cyan
    docker exec -it $container sh
}

function Open-DbShell {
    Write-Host "Connecting to API database..." -ForegroundColor Cyan
    docker exec -it ybb-postgres-api psql -U ybb_user -d ybb_db
}

function Show-Help {
    Write-Host "YBB Platform (Microservices Edition) - Windows Management Script"
    Write-Host "----------------------------------------------------------------"
    Write-Host "Usage: .\Manage.ps1 [command] [service] [-Build]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  start [svc]  - Start all services or a specific service"
    Write-Host "  stop [svc]   - Stop all services or a specific service"
    Write-Host "  restart      - Restart all services"
    Write-Host "  build [svc]  - Build all Docker images or a specific service"
    Write-Host "  status       - Show status of all services"
    Write-Host "  ps           - Show all running containers"
    Write-Host "  logs [svc]   - Show log instructions or tail a specific service"
    Write-Host "  clean [svc]  - Stop and remove containers and volumes (all or specific)"
    Write-Host "  migrate      - Run Prisma migrations on API"
    Write-Host "  shell <svc>  - Open shell in a service container"
    Write-Host "  db-shell     - Connect to API PostgreSQL database"
    Write-Host "  help         - Show this help message"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Build       - Build images before starting (use with 'start')"
    Write-Host ""
    Write-Host "Services: $($Services -join ', ')"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\Manage.ps1 start              # Start all services"
    Write-Host "  .\Manage.ps1 start -Build       # Build and start all services"
    Write-Host "  .\Manage.ps1 start api          # Start only API"
    Write-Host "  .\Manage.ps1 start api -Build   # Build and start API"
    Write-Host "  .\Manage.ps1 build api          # Build only API image"
    Write-Host "  .\Manage.ps1 clean              # Clean everything (fresh start)"
    Write-Host "  .\Manage.ps1 logs payment       # Tail payment logs"
    Write-Host "  .\Manage.ps1 shell api          # Shell into API container"
    Write-Host ""
    Write-Host "Fresh Start (clean install):"
    Write-Host "  .\Manage.ps1 clean"
    Write-Host "  .\Manage.ps1 start -Build"
    Write-Host ""
    Write-Host "Note: API service auto-runs database migrations on startup."
}

# Main Execution Flow
try {
    switch ($Command) {
        "start"    { Start-Services -TargetService $Service -BuildFirst $Build }
        "stop"     { Stop-Services -TargetService $Service }
        "restart"  { Stop-Services; Start-Services -BuildFirst $Build }
        "build"    { Build-Services -TargetService $Service }
        "status"   { Get-Status }
        "ps"       { Show-DockerPs }
        "clean"    { Clean-Services -TargetService $Service }
        "logs"     { Show-Logs-Help -TargetService $Service }
        "migrate"  { Run-Migrate }
        "shell"    { Open-Shell -TargetService $Service }
        "db-shell" { Open-DbShell }
        "help"     { Show-Help }
        Default    { Show-Help }
    }
}
catch {
    Write-Error "An error occurred executing the command: $_"
    Set-Location $RootDir
}
