#!/bin/bash
set -euo pipefail

OPTIONS=/data/options.json

opt() {
  jq -r --arg k "$1" '.[$k] // empty' "$OPTIONS"
}

require_opt() {
  local key=$1
  local value
  value=$(opt "$key")
  if [ -z "$value" ]; then
    echo "[run] Missing required option: ${key}" >&2
    exit 1
  fi
  printf '%s' "$value"
}

export_opt() {
  local env_name=$1
  local option_key=$2
  local value
  value=$(opt "$option_key")
  if [ -n "$value" ]; then
    export "${env_name}=${value}"
  fi
}

export_bool_opt() {
  local env_name=$1
  local option_key=$2
  local value
  value=$(jq -r --arg k "$option_key" '.[$k] // false' "$OPTIONS")
  if [ "$value" = "true" ]; then
    export "${env_name}=true"
  else
    export "${env_name}=false"
  fi
}

export_opt SCRAPE_SCRAPERS scrape_scrapers
export_opt SCRAPE_CRON scrape_cron
export_opt SCRAPE_CITY scrape_city
export_opt SCRAPE_POSTAL_CODE scrape_postal_code
export_opt SCRAPE_MAX_PRICE scrape_max_price
export_opt SCRAPE_MIN_SURFACE scrape_min_surface
export_opt SCRAPE_MIN_LAND_SURFACE scrape_min_land_surface
export_opt SCRAPE_MIN_ROOMS scrape_min_rooms
export_opt SCRAPE_MIN_BEDROOMS scrape_min_bedrooms
export_bool_opt SCRAPE_ANCIEN_ONLY scrape_ancien_only
export_opt SCRAPE_MAX_TRAVEL_MINUTES scrape_max_travel_minutes
export_opt SCRAPE_MAX_PAGES scrape_max_pages
export_opt ENRICHMENT_CRON enrichment_cron
export_bool_opt ENRICHMENT_DISABLED enrichment_disabled
export_opt ENRICHMENT_MIN_COMPAT_SCORE enrichment_min_compat_score
export_opt ENRICHMENT_BATCH_LIMIT enrichment_batch_limit
export_opt ENRICHMENT_SEARCH_LIMIT enrichment_search_limit
export_opt LOG_LEVEL log_level

# Web UI + Home Assistant (add-on only — see home-assistant/config.yaml)
export_bool_opt WEB_ENABLED web_enabled
export_opt WEB_ADMIN_USERS web_admin_users
export_bool_opt NOTIFICATIONS_ENABLED notifications_enabled
export_opt NOTIFY_SERVICE notify_service
export_opt NOTIFICATIONS_MAX notifications_max
export PANEL_ADMIN=true
export WEB_PORT=8099
export WEB_HOST=0.0.0.0
export HOME_ASSISTANT_URL=http://supervisor/core
export DATABASE_URL="file:/data/listings.db"
export CLOAKBROWSER_PROFILE_DIR=/data/cloakbrowser-profile
export CLOAKBROWSER_CACHE_DIR=/data/cloakbrowser-cache
export CLOAKBROWSER_HEADLESS=true
export CLOAKBROWSER_AUTO_UPDATE=false

mkdir -p /data /data/cloakbrowser-cache

# Seed persisted cache from the image on first run (avoids a 198 MB download on HA).
if [ -z "$(ls -A /data/cloakbrowser-cache 2>/dev/null)" ] \
  && [ -n "$(ls -A /opt/cloakbrowser 2>/dev/null)" ]; then
  echo "[run] Seeding CloakBrowser cache from image..."
  cp -a /opt/cloakbrowser/. /data/cloakbrowser-cache/
fi

# Drop orphan Chromium processes and stale locks after an unclean shutdown.
echo "[run] Stopping orphan CloakBrowser processes..."
pkill -f "/data/cloakbrowser-profile" 2>/dev/null || true
sleep 2
if [ -d /data/cloakbrowser-profile ]; then
  for lock in SingletonLock SingletonSocket SingletonCookie; do
    fuser -k "/data/cloakbrowser-profile/${lock}" 2>/dev/null || true
    rm -f "/data/cloakbrowser-profile/${lock}" 2>/dev/null || true
  done
fi

# Prevent overlapping add-on instances during fast restarts.
exec 200>/data/.find-my-house.lock
if ! flock -n 200; then
  echo "[run] Another instance is already running — exiting" >&2
  exit 1
fi

cd /app
echo "[run] Applying migrations..."
pnpm exec prisma migrate deploy
echo "[run] Starting web UI..."
exec node dist/index.js
