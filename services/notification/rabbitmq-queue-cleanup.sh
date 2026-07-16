#!/bin/sh
set -eu

CLEANUP_ENABLED="${NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY:-false}"
if [ "$CLEANUP_ENABLED" != "true" ]; then
  echo "ℹ️ Notification RabbitMQ queue cleanup skipped (NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY=false)."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required to parse RabbitMQ URLs for queue cleanup."
  exit 1
fi

HOST_FROM_URL="$(node -p "try { const u = new URL(process.env.RABBITMQ_URL || ''); u.hostname || ''; } catch { ''; }")"
USER_FROM_URL="$(node -p "try { const u = new URL(process.env.RABBITMQ_URL || ''); decodeURIComponent(u.username || ''); } catch { ''; }")"
PASS_FROM_URL="$(node -p "try { const u = new URL(process.env.RABBITMQ_URL || ''); decodeURIComponent(u.password || ''); } catch { ''; }")"
VHOST_FROM_URL="$(node -p "try { const u = new URL(process.env.RABBITMQ_URL || ''); const rawPath = (u.pathname || '/').replace(/^\\//, ''); decodeURIComponent(rawPath || '/'); } catch { '/'; }")"

RABBITMQ_MANAGEMENT_URL="${RABBITMQ_MANAGEMENT_URL:-}"
if [ -z "$RABBITMQ_MANAGEMENT_URL" ]; then
  if [ -z "$HOST_FROM_URL" ]; then
    echo "❌ Cannot infer RabbitMQ host. Set RABBITMQ_URL or RABBITMQ_MANAGEMENT_URL."
    exit 1
  fi
  RABBITMQ_MANAGEMENT_URL="http://${HOST_FROM_URL}:15672"
fi

RABBITMQ_MANAGEMENT_USER="${RABBITMQ_MANAGEMENT_USER:-$USER_FROM_URL}"
RABBITMQ_MANAGEMENT_PASS="${RABBITMQ_MANAGEMENT_PASS:-$PASS_FROM_URL}"
RABBITMQ_MANAGEMENT_VHOST="${RABBITMQ_MANAGEMENT_VHOST:-$VHOST_FROM_URL}"

if [ -z "$RABBITMQ_MANAGEMENT_USER" ] || [ -z "$RABBITMQ_MANAGEMENT_PASS" ]; then
  echo "❌ Missing RabbitMQ management credentials. Set RABBITMQ_MANAGEMENT_USER and RABBITMQ_MANAGEMENT_PASS."
  exit 1
fi

VHOST_ENCODED="$(RABBITMQ_MANAGEMENT_VHOST="$RABBITMQ_MANAGEMENT_VHOST" node -p "encodeURIComponent(process.env.RABBITMQ_MANAGEMENT_VHOST || '/')")"
QUEUE_BASE_NAMES="${NOTIFICATION_QUEUE_CLEANUP_TARGETS:-notification_queue}"
INCLUDE_RETRY_DLQ="${NOTIFICATION_QUEUE_CLEANUP_INCLUDE_RETRY_DLQ:-true}"

wait_for_management_api() {
  retries=20
  while [ "$retries" -gt 0 ]; do
    if curl -sS -u "${RABBITMQ_MANAGEMENT_USER}:${RABBITMQ_MANAGEMENT_PASS}" "${RABBITMQ_MANAGEMENT_URL%/}/api/overview" >/dev/null 2>&1; then
      return 0
    fi

    retries=$((retries - 1))
    sleep 2
  done

  echo "❌ RabbitMQ management API is not reachable at ${RABBITMQ_MANAGEMENT_URL}."
  return 1
}

delete_queue() {
  queue_name="$1"
  endpoint="${RABBITMQ_MANAGEMENT_URL%/}/api/queues/${VHOST_ENCODED}/${queue_name}"
  tmp_file="$(mktemp)"

  status_code="$(curl -sS -u "${RABBITMQ_MANAGEMENT_USER}:${RABBITMQ_MANAGEMENT_PASS}" -o "$tmp_file" -w "%{http_code}" -X DELETE "$endpoint" || true)"

  case "$status_code" in
    204)
      echo "✅ Deleted queue: ${queue_name}"
      ;;
    404)
      echo "ℹ️ Queue not found (already absent): ${queue_name}"
      ;;
    *)
      echo "❌ Failed deleting queue: ${queue_name} (HTTP ${status_code})"
      cat "$tmp_file"
      rm -f "$tmp_file"
      exit 1
      ;;
  esac

  rm -f "$tmp_file"
}

echo "🧹 Running notification RabbitMQ queue cleanup against ${RABBITMQ_MANAGEMENT_URL}"
wait_for_management_api

OLD_IFS="$IFS"
IFS=','
set -- $QUEUE_BASE_NAMES
IFS="$OLD_IFS"

for queue_base in "$@"; do
  queue_name="$(printf '%s' "$queue_base" | tr -d '[:space:]')"
  if [ -z "$queue_name" ]; then
    continue
  fi

  delete_queue "$queue_name"

  if [ "$INCLUDE_RETRY_DLQ" = "true" ]; then
    delete_queue "${queue_name}.retry"
    delete_queue "${queue_name}.dlq"
  fi
done

echo "✅ Notification RabbitMQ queue cleanup finished."
