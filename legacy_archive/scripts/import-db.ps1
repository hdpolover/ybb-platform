# =============================================================================
# Database Import Utility (PowerShell Version)
# =============================================================================
# Usage: .\scripts\import-db.ps1 "path\to\dump.sql"
# Dependencies: docker
# =============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$DumpFile
)

$ErrorActionPreference = "Stop"

$CONTAINER_NAME = "ybb-postgres"
$DB_USER = "ybb_user"
$DB_NAME = "ybb_db"

if (-not (Test-Path $DumpFile)) {
    Write-Host "Error: File $DumpFile not found." -ForegroundColor Red
    exit 1
}

# Check container
$status = docker ps | Select-String $CONTAINER_NAME
if (-not $status) {
    Write-Host "Error: Container $CONTAINER_NAME is not running." -ForegroundColor Red
    exit 1
}

Write-Host "⚠️  WARNING: This will overwrite the existing database '$DB_NAME' in '$CONTAINER_NAME'." -ForegroundColor Yellow
$confirmation = Read-Host "Are you sure? (y/N)"
if ($confirmation -notmatch "^[Yy]$") {
    Write-Host "Aborted."
    exit 1
}

Write-Host "Importing database from '$DumpFile'..." -ForegroundColor Cyan

# Determine if file is gzipped
if ($DumpFile.EndsWith(".gz")) {
    # If gz, decompress stream -> docker
    # PowerShell pipe cleanliness for binary/text mixed can be tricky.
    # Easiest way is to shell out to cmd for the pipe or use 7z if available, but standard gzip isn't default on Windows.
    # Assuming standard 'gzip' tool availability (e.g. from Git Bash) or we can just cat if uncompressed.
    
    # We will try to use 'docker exec -i' reading from stdin.
    
    # Check for gunzip availability
    if (Get-Command "gunzip" -ErrorAction SilentlyContinue) {
        cmd /c "gunzip -c ""$DumpFile"" | docker exec -i ""$CONTAINER_NAME"" psql -U ""$DB_USER"" -d ""$DB_NAME"""
    } else {
        Write-Host "Error: 'gunzip' command not found. Please extract the .gz file manually first." -ForegroundColor Red
        exit 1
    }
} else {
    # Plain SQL
    Get-Content $DumpFile | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database imported successfully." -ForegroundColor Green
} else {
    Write-Host "❌ Error importing database." -ForegroundColor Red
}
