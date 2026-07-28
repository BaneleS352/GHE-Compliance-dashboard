#!/bin/sh
set -e

export BACKEND_URL="${BACKEND_URL:-http://backend:3001}"

envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf
mv /tmp/default.conf /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"