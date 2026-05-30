#!/bin/sh
set -e

export PORT="${PORT:-80}"
export BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

# BACKEND_URL dan host qismini ajratamiz (https://host -> host)
BACKEND_HOST=$(echo "$BACKEND_URL" | sed -E 's#^https?://##; s#/.*$##')
export BACKEND_HOST

echo "→ nginx render: PORT=$PORT BACKEND_URL=$BACKEND_URL BACKEND_HOST=$BACKEND_HOST"

envsubst '${PORT} ${BACKEND_URL} ${BACKEND_HOST}' < /nginx.conf.template > /etc/nginx/conf.d/default.conf

echo "→ rendered config:"
cat /etc/nginx/conf.d/default.conf

# nginx sintaksisni tekshiramiz (xato bo'lsa log'da ko'rinadi)
nginx -t

exec nginx -g 'daemon off;'
