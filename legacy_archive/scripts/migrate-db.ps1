# =============================================================================
# Unified MySQL to PostgreSQL Migration Script (PowerShell Version)
# =============================================================================
# This script handles the end-to-end migration from the legacy MySQL database
# to the new PostgreSQL microservices architecture on Windows.
#
# Process:
# 1. Exports data from MySQL to temporary TSV files
# 2. Runs Node.js import logic to transform data and insert into PostgreSQL
# 3. Handles UUID generation and cross-service ID mapping
#
# Usage:
#   .\scripts\migrate-db.ps1 [export|import|all]
# =============================================================================

param (
    [string]$Action = "all"
)

$ErrorActionPreference = "Stop"

# --- Configuration ---

# Load environment variables if .env exists
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Helper to get Env Variable with Default
function Get-EnvOrDefault {
    param($Name, $Default)
    $val = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrEmpty($val)) { return $Default }
    return $val
}

$MYSQL_HOST = Get-EnvOrDefault "MYSQL_HOST" "localhost"
$MYSQL_PORT = Get-EnvOrDefault "MYSQL_PORT" "3306"
$MYSQL_USER = Get-EnvOrDefault "MYSQL_USER" "root"
$MYSQL_PASS = Get-EnvOrDefault "MYSQL_PASS" "password"
$MYSQL_DB   = Get-EnvOrDefault "MYSQL_DB" "legacy_db_name"

$PG_HOST = Get-EnvOrDefault "PG_HOST" "localhost"
$PG_PORT = Get-EnvOrDefault "PG_PORT" "5432"
$PG_USER = Get-EnvOrDefault "PG_USER" "ybb_user"
$PG_PASS = Get-EnvOrDefault "PG_PASS" "ybb_password"

# Construct connection strings for local execution
$Env:DATABASE_URL = "postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/ybb_db"
$Env:PAYMENT_DATABASE_URL = "postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/ybb_payments_db"

$TEMP_EXPORT_DIR = "./migration_temp_data"
$Env:EXPORT_DIR = $TEMP_EXPORT_DIR

# --- Logging ---
function Log-Info ($msg) { Write-Host "[INFO] $msg" -ForegroundColor Green }
function Log-Warn ($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Log-Error ($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# --- Export Logic ---
function Export-MySQL {
    Log-Info "Starting MySQL export to $TEMP_EXPORT_DIR..."
    
    if (-not (Test-Path $TEMP_EXPORT_DIR)) {
        New-Item -ItemType Directory -Force -Path $TEMP_EXPORT_DIR | Out-Null
    }

    # Helper for mysql commands (Using --batch for TSV output)
    # Note: Using Invoke-Expression or & operator. 'mysql' must be in PATH.
    function Run-Mysql-Query {
        param($Query, $OutputFile)
        
        # We use cmd /c to ensure proper piping and redirection in PowerShell if native piping is tricky
        # But we can try direct invocation first.
        # Construct the command string to be safe with quoting
        $cmdArgs = @(
            "-h", "$MYSQL_HOST", 
            "-P", "$MYSQL_PORT", 
            "-u", "$MYSQL_USER", 
            "-p$MYSQL_PASS", 
            "$MYSQL_DB",
            "--batch",
            "-e", "$Query"
        )
        
        # Run mysql, skip header (1st line), save to file
        # 'mysql' might output warnings to stderr, so we redirect stderr to null or verify
        
        # On Windows, handling the 'tail -n +2' equivalent is cleaner in PowerShell
        # We'll run the command, capture output, skip index 0, set content.
        
        # NOTE: For very large datasets, capturing to memory ($res) is bad. 
        # Ideally, we pipe directly: mysql ... | Select-Object -Skip 1 | Out-File ...
        
        Log-Info "  Exporting to $OutputFile..."
        
        & mysql $cmdArgs | Select-Object -Skip 1 | Out-File -FilePath $OutputFile -Encoding utf8
    }
    
    # Check if mysql exists
    if (-not (Get-Command "mysql" -ErrorAction SilentlyContinue)) {
        Log-Error "MySQL command-line tool 'mysql' not found in PATH."
        exit 1
    }

    Log-Info "Exporting program_categories..."
    Run-Mysql-Query "SELECT id, name, description, is_active, web_url, about, logo_url, main_banner_url, email, contact, telegram, location, created_at, updated_at FROM program_categories WHERE is_deleted = 0 OR is_deleted IS NULL" "$TEMP_EXPORT_DIR/program_categories.csv"

    Log-Info "Exporting programs..."
    Run-Mysql-Query "SELECT id, program_category_id, name, description, start_date, end_date, banner_url, created_at, updated_at FROM programs WHERE is_deleted = 0 OR is_deleted IS NULL" "$TEMP_EXPORT_DIR/programs.csv"

    Log-Info "Exporting users..."
    Run-Mysql-Query "SELECT id, full_name, email, password, is_verified, program_category_id, is_active, created_at, updated_at FROM users WHERE is_deleted = 0 OR is_deleted IS NULL" "$TEMP_EXPORT_DIR/users.csv"

    Log-Info "Exporting participants (chunked)..."
    # Clean previous
    if (Test-Path "$TEMP_EXPORT_DIR/participants.csv") { Remove-Item "$TEMP_EXPORT_DIR/participants.csv" }
    
    # Get Max ID
    $MAX_ID = (& mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "-p$MYSQL_PASS" "$MYSQL_DB" -sN -e "SELECT MAX(id) FROM participants")
    $CHUNK_SIZE = 50000
    
    if (-not $MAX_ID) { $MAX_ID = 0 }
    
    for ($i=0; $i -le [int]$MAX_ID; $i+=$CHUNK_SIZE) {
        $next = $i + $CHUNK_SIZE
        Log-Info "  Exporting chunk offset $i..."
        $q = "SELECT id, user_id, program_id, account_id, full_name, nickname, birthdate, gender, country_code, phone_number, nationality, nationality_code, REPLACE(REPLACE(origin_address, '\r', ''), '\n', '\\n'), REPLACE(REPLACE(current_address, '\r', ''), '\n', '\\n'), education_level, institution, major, occupation, instagram_account, organizations, tshirt_size, disease_history, emergency_account, contact_relation, emergency_country_code, picture_url, resume_url, knowledge_source, ref_code_ambassador, category, experiences, achievements, twibbon_link, requirement_link, score_total, score_status, created_at, updated_at FROM participants WHERE (is_deleted = 0 OR is_deleted IS NULL) AND id >= $i AND id < $next"
        
        # Append to file
        & mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "-p$MYSQL_PASS" "$MYSQL_DB" --batch -e "$q" | Select-Object -Skip 1 | Out-File -FilePath "$TEMP_EXPORT_DIR/participants.csv" -Encoding utf8 -Append
    }

    Log-Info "Exporting statuses..."
    Run-Mysql-Query "SELECT id, participant_id, general_status, form_status, document_status, payment_status, created_at, updated_at FROM participant_statuses WHERE is_deleted = 0 OR is_deleted IS NULL" "$TEMP_EXPORT_DIR/participant_statuses.csv"

    Log-Info "Exporting administrative and payment data..."
    Run-Mysql-Query "SELECT * FROM admins WHERE is_deleted = 0 OR is_deleted IS NULL" "$TEMP_EXPORT_DIR/admins.csv"
    Run-Mysql-Query "SELECT * FROM ambassadors WHERE is_deleted = 0 OR is_deleted IS NULL" "$TEMP_EXPORT_DIR/ambassadors.csv"
    Run-Mysql-Query "SELECT * FROM payments" "$TEMP_EXPORT_DIR/payments.csv"

    Log-Info "Export Complete!"
}

# --- Import Logic ---
function Import-Postgres {
    Log-Info "Starting PostgreSQL import..."
    
    if (-not (Test-Path $TEMP_EXPORT_DIR)) {
        Log-Error "Export directory $TEMP_EXPORT_DIR not found. Run export first."
        exit 1
    }

    # Run Node script
    node scripts/import-from-csv.js
}

# --- Main Entry ---
try {
    switch ($Action) {
        "export" { Export-MySQL }
        "import" { Import-Postgres }
        "all" { 
            Export-MySQL
            Import-Postgres 
        }
        Default { 
            Write-Host "Usage: .\scripts\migrate-db.ps1 [export|import|all]"
            exit 1 
        }
    }
    Log-Info "Database migration task finished successfully!"
} catch {
    Log-Error "An error occurred during migration: $_"
    exit 1
}
