# =============================================================================
# Database Export Utility (PowerShell Version)
# =============================================================================
# Usage: .\scripts\export-db.ps1
# Dependencies: docker
# =============================================================================

$ErrorActionPreference = "Stop"

$CONTAINER_NAME = "ybb-postgres"
$DB_USER = "ybb_user"
$DB_NAME = "ybb_db"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$OUTPUT_FILE = "ybb_db_dump_${TIMESTAMP}.sql"

# Check container
$status = docker ps | Select-String $CONTAINER_NAME
if (-not $status) {
    Write-Host "Error: Container $CONTAINER_NAME is not running." -ForegroundColor Red
    exit 1
}

Write-Host "Exporting database '$DB_NAME' from container '$CONTAINER_NAME'..." -ForegroundColor Cyan

# Execute export
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME -F p > $OUTPUT_FILE

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database exported successfully to: $OUTPUT_FILE" -ForegroundColor Green
    Write-Host "You can share this file with other developers."
} else {
    Write-Host "❌ Error exporting database." -ForegroundColor Red
    if (Test-Path $OUTPUT_FILE) { Remove-Item $OUTPUT_FILE }
}
