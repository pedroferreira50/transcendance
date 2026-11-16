#!/bin/sh
# Runs before nginx starts (official nginx entrypoint). Creates a self-signed
# certificate for local/defense use when one was not mounted in /etc/nginx/certs.
set -e

CERT_DIR=/etc/nginx/certs
CERT="$CERT_DIR/server.crt"
KEY="$CERT_DIR/server.key"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout "$KEY" \
        -out "$CERT" \
        -subj "/C=BR/ST=SP/L=Sao Paulo/O=Open Sea/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
    chmod 600 "$KEY"
    echo "Generated self-signed certificate in $CERT_DIR"
fi