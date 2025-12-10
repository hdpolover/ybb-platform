#!/bin/bash
set -e

# Directory for SSL certs structure matching Certbot
SSL_DIR="$(dirname "$0")/../infrastructure/nginx/ssl/live/ybbhub.com"
mkdir -p "$SSL_DIR"

# Generate self-signed certificate if it doesn't exist
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
    echo "Generating self-signed SSL certificates for local development..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=*.ybbhub.com/subjectAltName=DNS:ybbhub.com,DNS:*.ybbhub.com"
        
    echo "Certificates generated in $SSL_DIR"
else
    echo "SSL certificates already exist in $SSL_DIR"
fi
