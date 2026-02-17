#!/bin/bash

# YBB Platform Observability Verification Script
# This script hits the health check endpoint and verifies that telemetry data is received.

API_URL=${API_URL:-"http://localhost:4000/v1/health"}
LOKI_URL=${LOKI_URL:-"http://localhost:3100"}
TEMPO_URL=${TEMPO_URL:-"http://localhost:3200"}

echo "🔍 Phase 1: Sending request to API..."
TRACE_PARENT=$(curl -s -D - "$API_URL" -o /dev/null | grep -i "traceparent" | awk '{print $2}')

if [ -z "$TRACE_PARENT" ]; then
  echo "⚠️  Warning: No traceparent header found in local response. Attempting to hit endpoint to generate logs..."
  curl -s "$API_URL" > /dev/null
fi

echo "✅ Request sent to $API_URL"
sleep 5 # Wait for Loki/Tempo to process

check_loki() {
  local job=$1
  echo "🔍 Checking Loki for logs from $job..."
  local query="{job=\"$job\"}"
  local response=$(curl -s -G "$LOKI_URL/loki/api/v1/query" --data-urlencode "query=$query")
  local count=$(echo "$response" | jq '.data.result | length' 2>/dev/null || echo "0")
  if [[ "$count" =~ ^[0-9]+$ ]] && [ "$count" -gt 0 ]; then
    echo "✅ Success: Loki received logs from $job."
  else
    echo "❌ Error: No logs found in Loki for $job."
  fi
}

check_tempo() {
  local service=$1
  echo "🔍 Checking Tempo for traces from $service..."
  local response=$(curl -s "$TEMPO_URL/api/search?tags=service.name=$service&limit=1")
  local count=$(echo "$response" | jq '.traces | length' 2>/dev/null || echo "0")
  if [[ "$count" =~ ^[0-9]+$ ]] && [ "$count" -gt 0 ]; then
    echo "✅ Success: Tempo received traces from $service."
  else
    echo "❌ Error: No traces found in Tempo for $service."
  fi
}

# Check all instrumented services
for service in "ybb-api" "ybb-notification" "ybb-payment" "ybb-file"; do
  check_loki "$service"
  check_tempo "$service"
  echo "---"
done

echo ""
echo "🔭 Infrastructure Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "loki|tempo|prometheus|grafana|otel-collector"

echo ""
echo "🚀 Verification complete!"
