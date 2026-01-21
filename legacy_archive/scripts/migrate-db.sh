#!/bin/bash

# =============================================================================
# Unified MySQL to PostgreSQL Migration Script
# =============================================================================
# This script handles the end-to-end migration from the legacy MySQL database
# to the new PostgreSQL microservices architecture.
#
# Process:
# 1. Exports data from MySQL to temporary TSV files
# 2. Runs Node.js import logic to transform data and insert into PostgreSQL
# 3. Handles UUID generation and cross-service ID mapping
#
# Usage:
#   ./scripts/migrate-db.sh [export|import|all]
# =============================================================================

set -e

# --- Configuration ---
# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# You can override these via environment variables
# DO NOT COMMIT ACTUAL CREDENTIALS TO GIT
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-password}"
MYSQL_DB="${MYSQL_DB:-legacy_db_name}"

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-ybb_user}"
PG_PASS="${PG_PASS:-ybb_password}"
DATABASE_URL="${DATABASE_URL:-postgresql://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/ybb_db}"
PAYMENT_DATABASE_URL="${PAYMENT_DATABASE_URL:-postgresql://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/ybb_payments_db}"

TEMP_EXPORT_DIR="./migration_temp_data"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Export Logic ---
export_mysql() {
    log_info "Starting MySQL export to $TEMP_EXPORT_DIR..."
    mkdir -p "$TEMP_EXPORT_DIR"

    # Helper for mysql commands
    run_mysql() {
        mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" --batch -e "$1" | tail -n +2
    }

    # Exporting core tables
    log_info "Exporting program_categories..."
    run_mysql "SELECT id, name, description, is_active, web_url, about, logo_url, main_banner_url, email, contact, telegram, location, created_at, updated_at FROM program_categories WHERE is_deleted = 0 OR is_deleted IS NULL" > "$TEMP_EXPORT_DIR/program_categories.csv"

    log_info "Exporting programs..."
    run_mysql "SELECT id, program_category_id, name, description, start_date, end_date, banner_url, created_at, updated_at FROM programs WHERE is_deleted = 0 OR is_deleted IS NULL" > "$TEMP_EXPORT_DIR/programs.csv"

    log_info "Exporting users (this may take a while)..."
    run_mysql "SELECT id, full_name, email, password, is_verified, program_category_id, is_active, created_at, updated_at FROM users WHERE is_deleted = 0 OR is_deleted IS NULL" > "$TEMP_EXPORT_DIR/users.csv"

    log_info "Exporting participants (chunked for memory safety)..."
    rm -f "$TEMP_EXPORT_DIR/participants.csv"
    MAX_ID=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -sN -e "SELECT MAX(id) FROM participants")
    CHUNK_SIZE=50000
    for ((i=0; i<=MAX_ID; i+=CHUNK_SIZE)); do
        log_info "  Exporting chunk offset $i..."
        run_mysql "SELECT id, user_id, program_id, account_id, full_name, nickname, birthdate, gender, country_code, phone_number, nationality, nationality_code, REPLACE(REPLACE(origin_address, '\r', ''), '\n', '\\n'), REPLACE(REPLACE(current_address, '\r', ''), '\n', '\\n'), education_level, institution, major, occupation, instagram_account, organizations, tshirt_size, disease_history, emergency_account, contact_relation, emergency_country_code, picture_url, resume_url, knowledge_source, ref_code_ambassador, category, experiences, achievements, twibbon_link, requirement_link, score_total, score_status, created_at, updated_at FROM participants WHERE (is_deleted = 0 OR is_deleted IS NULL) AND id >= $i AND id < $((i + CHUNK_SIZE))" >> "$TEMP_EXPORT_DIR/participants.csv"
    done

    log_info "Exporting statuses..."
    run_mysql "SELECT id, participant_id, general_status, form_status, document_status, payment_status, created_at, updated_at FROM participant_statuses WHERE is_deleted = 0 OR is_deleted IS NULL" > "$TEMP_EXPORT_DIR/participant_statuses.csv"

    log_info "Exporting administrative and payment data..."
    run_mysql "SELECT * FROM admins WHERE is_deleted = 0 OR is_deleted IS NULL" > "$TEMP_EXPORT_DIR/admins.csv"
    run_mysql "SELECT * FROM ambassadors WHERE is_deleted = 0 OR is_deleted IS NULL" > "$TEMP_EXPORT_DIR/ambassadors.csv"
    run_mysql "SELECT * FROM payments" > "$TEMP_EXPORT_DIR/payments.csv"

    log_info "Export Complete!"
}

# --- Import Logic ---
import_postgres() {
    log_info "Starting PostgreSQL import..."
    
    # Force localhost connection for the migration script running on host
    # We ignore the DATABASE_URL from .env because it likely points to 'postgres' container hostname
    export DATABASE_URL="postgresql://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/ybb_db"
    export PAYMENT_DATABASE_URL="postgresql://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/ybb_payments_db"
    
    export EXPORT_DIR="$TEMP_EXPORT_DIR"
    
    if [ ! -d "$TEMP_EXPORT_DIR" ]; then
        log_error "Export directory $TEMP_EXPORT_DIR not found. Run export first."
        exit 1
    fi

    # Run the existing robust Node.js logic
    # We use the existing import-from-csv.js which handles relationships and UUIDs
    node scripts/import-from-csv.js
}

# --- Main Entry ---
case "${1:-all}" in
    export)
        export_mysql
        ;;
    import)
        import_postgres
        ;;
    all)
        export_mysql
        import_postgres
        ;;
    *)
        echo "Usage: $0 [export|import|all]"
        exit 1
        ;;
esac

if [ "$?" -eq 0 ]; then
    log_info "Database migration task finished successfully!"
else
    log_error "An error occurred during migration."
    exit 1
fi
