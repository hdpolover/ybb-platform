<#
.SYNOPSIS
    Windows management script for YBB Platform (Makefile alternative)
.DESCRIPTION
    Replicates the functionality of the Makefile for Windows users via PowerShell.
    This script acts as a unified entry point for development commands.
.EXAMPLE
    .\Manage.ps1 dev
.EXAMPLE
    .\Manage.ps1 help
.EXAMPLE
    .\Manage.ps1 logs
#>

param (
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Continue"

# --- Helper to detect Docker Compose command ---
function Get-DockerComposeCmd {
    if (Get-Command "docker-compose" -ErrorAction SilentlyContinue) {
        return "docker-compose"
    } elseif (Get-Command "docker" -ErrorAction SilentlyContinue) {
        # Check if 'docker compose' works
        $ver = docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) { return "docker compose" }
    }
    Write-Host "Error: Docker options (docker-compose or docker compose) not found." -ForegroundColor Red
    Write-Host "Please install Docker Desktop for Windows."
    exit 1
}

$DC = Get-DockerComposeCmd

# --- Help Menu ---
function Show-Help {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  YBB Platform - Manager (Windows)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Usage: .\Manage.ps1 <command>"
    Write-Host ""
    Write-Host "Development:"
    Write-Host "  dev           Start development environment (uses scripts\dev.ps1)"
    Write-Host "  stop          Stop all services"
    Write-Host "  restart       Restart all services"
    Write-Host "  logs          View logs (ctrl+c to exit)"
    Write-Host "  build         Build all Docker images"
    Write-Host "  clean         Remove all containers, volumes, and images"
    Write-Host "  ps            Show running containers"
    Write-Host ""
    Write-Host "Production:"
    Write-Host "  prod          Start production environment"
    Write-Host "  prod-build    Build production images"
    Write-Host ""
    Write-Host "Database:"
    Write-Host "  setup         Initial project setup (env, db, migrations)"
    Write-Host "  migrate       Run API migrations (npm run migration:run)"
    Write-Host "  seed-db       Seed database with sample data"
    Write-Host "  backup        Backup database"
    Write-Host "  restore       Restore database"
    Write-Host ""
    Write-Host "Service Logs:"
    Write-Host "  api-logs, payment-logs, file-logs, dashboard-logs"
    Write-Host ""
    Write-Host "Shell Access:"
    Write-Host "  api-shell, payment-shell, db-shell"
    Write-Host ""
}

# --- Command Switch ---
switch ($Command) {
    "help" { Show-Help }
    
    # --- Development ---
    "dev" { 
        if (Test-Path "$PSScriptRoot\scripts\dev.ps1") {
            & "$PSScriptRoot\scripts\dev.ps1"
        } else {
            Write-Host "Starting dev environment..."
            Invoke-Expression "$DC up -d" 
        }
    }

    "stop" {
        Write-Host "Stopping services..." -ForegroundColor Yellow
        Invoke-Expression "$DC down"
    }

    "restart" {
        Write-Host "Restarting services..." -ForegroundColor Cyan
        Invoke-Expression "$DC restart"
    }

    "logs" {
        Invoke-Expression "$DC logs -f"
    }

    "build" {
        Write-Host "Building Docker images..." -ForegroundColor Cyan
        Invoke-Expression "$DC build"
    }

    "clean" {
        Write-Host "⚠️  Cleaning up all containers, volumes, and images..." -ForegroundColor Red
        Invoke-Expression "$DC down -v --rmi all"
        Write-Host "Cleanup complete." -ForegroundColor Green
    }

    "ps" {
        Invoke-Expression "$DC ps"
    }

    # --- Production ---
    "prod" {
        Write-Host "Starting production environment..." -ForegroundColor Cyan
        Invoke-Expression "$DC -f docker-compose.prod.yml up -d"
    }

    "prod-build" {
        Write-Host "Building Production images..." -ForegroundColor Cyan
        Invoke-Expression "$DC -f docker-compose.prod.yml build"
    }

    # --- Database / Setup ---
    "setup" {
        if (Test-Path "$PSScriptRoot\scripts\setup.ps1") {
            & "$PSScriptRoot\scripts\setup.ps1"
        } else {
            Write-Error "scripts\setup.ps1 not found."
        }
    }

    "migrate" {
        Write-Host "Running migrations..." -ForegroundColor Cyan
        # Check if API container is running
        $status = Invoke-Expression "$DC ps -q api"
        if (-not $status) {
            Write-Host "API service is not running. Starting it..."
            Invoke-Expression "$DC up -d api postgres"
            Start-Sleep -Seconds 5
        }
        Invoke-Expression "$DC exec api npm run migration:run"
    }

    "seed-db" {
        if (Test-Path "$PSScriptRoot\scripts\seed-db.ps1") {
            & "$PSScriptRoot\scripts\seed-db.ps1"
        } else {
            Write-Error "scripts\seed-db.ps1 not found."
        }
    }

    "backup" {
        if (Test-Path "$PSScriptRoot\scripts\export-db.ps1") {
            & "$PSScriptRoot\scripts\export-db.ps1"
        } else {
            Write-Error "scripts\export-db.ps1 not found."
        }
    }

    "restore" {
         if (Test-Path "$PSScriptRoot\scripts\import-db.ps1") {
            & "$PSScriptRoot\scripts\import-db.ps1"
        } else {
            Write-Error "scripts\import-db.ps1 not found."
        }
    }

    # --- Logs Wrappers ---
    "api-logs" { Invoke-Expression "$DC logs -f api" }
    "payment-logs" { Invoke-Expression "$DC logs -f payment-service" }
    "file-logs" { Invoke-Expression "$DC logs -f file-service" }
    "dashboard-logs" { Invoke-Expression "$DC logs -f admin-dashboard" }
    
    # --- Shell Access ---
    "api-shell" { Invoke-Expression "$DC exec api sh" }
    "payment-shell" { Invoke-Expression "$DC exec payment-service sh" }
    "file-shell" { Invoke-Expression "$DC exec file-service sh" }
    "db-shell" {
        # Try to read env vars if not set
        if (Test-Path .env) {
            Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
                $parts = $_ -split '=', 2
                if (-not (Get-Item "Env:\$($parts[0])" -ErrorAction SilentlyContinue)) {
                    [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
                }
            }
        }
        $DB_USER = if ($Env:DATABASE_USER) { $Env:DATABASE_USER } else { "ybb_user" }
        $DB_NAME = if ($Env:DATABASE_NAME) { $Env:DATABASE_NAME } else { "ybb_db" }
        
        Write-Host "Connecting to database '$DB_NAME' as '$DB_USER'..."
        Invoke-Expression "$DC exec postgres psql -U $DB_USER -d $DB_NAME"
    }

    Default {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Show-Help
    }
}
