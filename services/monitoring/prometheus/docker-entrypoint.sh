#!/bin/sh
set -e

# Replace environment variables in the template
# We use | as delimiter to avoid issues with URLs, though here we expect simple host:port
sed -e "s|{{API_HOST}}|${API_HOST:-host.docker.internal}|g" \
    -e "s|{{API_PORT}}|${API_PORT:-4000}|g" \
    -e "s|{{PAYMENT_HOST}}|${PAYMENT_HOST:-host.docker.internal}|g" \
    -e "s|{{PAYMENT_PORT}}|${PAYMENT_PORT:-8002}|g" \
    -e "s|{{FILE_HOST}}|${FILE_HOST:-host.docker.internal}|g" \
    -e "s|{{FILE_PORT}}|${FILE_PORT:-8001}|g" \
    -e "s|{{NOTIFICATION_HOST}}|${NOTIFICATION_HOST:-host.docker.internal}|g" \
    -e "s|{{NOTIFICATION_PORT}}|${NOTIFICATION_PORT:-4002}|g" \
    -e "s|{{RABBITMQ_HOST}}|${RABBITMQ_HOST:-host.docker.internal}|g" \
    -e "s|{{RABBITMQ_PORT}}|${RABBITMQ_PORT:-15692}|g" \
    /etc/prometheus/prometheus.yml.tpl > /etc/prometheus/prometheus.yml

exec /bin/prometheus "$@"
