#!/usr/bin/env bash
# Configure a DigitalOcean Space for the YBB file service:
#   - Public-read bucket policy (so public_url GETs return 200)
#   - CORS rule (so the browser can PUT to presigned upload URLs)
#
# Idempotent: re-running replaces the existing policy + CORS config.
# Requires: aws cli; reads MINIO_* env vars from the file service .env.
#
# Usage:
#   ./scripts/configure_spaces.sh                       # uses ./.env
#   ENV_FILE=./.env.staging ./scripts/configure_spaces.sh
#   CORS_ORIGINS="http://localhost:3000,https://admin.ybbhub.com" ./scripts/configure_spaces.sh

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-./.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

# Load MINIO_* vars without exporting everything in the env file
eval "$(grep -E '^MINIO_' "$ENV_FILE" | sed 's/^/export /')"

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT not set}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY not set}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY not set}"
: "${MINIO_BUCKET:?MINIO_BUCKET not set}"
: "${MINIO_REGION:?MINIO_REGION not set}"

# Default origins: wide open. Narrow for prod via CORS_ORIGINS env var.
CORS_ORIGINS="${CORS_ORIGINS:-*}"

ENDPOINT_URL="https://${MINIO_ENDPOINT}"

export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"
export AWS_DEFAULT_REGION="$MINIO_REGION"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# ─── Public-read bucket policy ──────────────────────────────────────────────
cat > "$TMPDIR/policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${MINIO_BUCKET}/*"
  }]
}
EOF

echo "→ Applying public-read policy to $MINIO_BUCKET"
aws s3api put-bucket-policy \
  --bucket "$MINIO_BUCKET" \
  --policy "file://$TMPDIR/policy.json" \
  --endpoint-url "$ENDPOINT_URL"

# ─── CORS config ─────────────────────────────────────────────────────────────
# AllowedOrigins: comma-separated CORS_ORIGINS → JSON array
IFS=',' read -ra ORIGIN_ARR <<< "$CORS_ORIGINS"
ORIGIN_JSON=""
for o in "${ORIGIN_ARR[@]}"; do
  o_trimmed="$(echo -n "$o" | sed 's/^ *//;s/ *$//')"
  [[ -z "$o_trimmed" ]] && continue
  [[ -n "$ORIGIN_JSON" ]] && ORIGIN_JSON+=","
  ORIGIN_JSON+="\"$o_trimmed\""
done

cat > "$TMPDIR/cors.json" <<EOF
{
  "CORSRules": [{
    "AllowedOrigins": [$ORIGIN_JSON],
    "AllowedMethods": ["GET", "PUT", "HEAD", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }]
}
EOF

echo "→ Applying CORS config to $MINIO_BUCKET (origins: $CORS_ORIGINS)"
aws s3api put-bucket-cors \
  --bucket "$MINIO_BUCKET" \
  --cors-configuration "file://$TMPDIR/cors.json" \
  --endpoint-url "$ENDPOINT_URL"

echo "→ Verifying"
aws s3api get-bucket-policy --bucket "$MINIO_BUCKET" --endpoint-url "$ENDPOINT_URL" \
  --query Policy --output text | python3 -m json.tool
echo "---"
aws s3api get-bucket-cors --bucket "$MINIO_BUCKET" --endpoint-url "$ENDPOINT_URL"

echo "✓ Space $MINIO_BUCKET configured"
