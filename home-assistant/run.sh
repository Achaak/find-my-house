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
  fi
}

export DISCORD_TOKEN="$(require_opt discord_token)"
export DISCORD_CLIENT_ID="$(require_opt discord_client_id)"
export_opt DISCORD_GUILD_ID discord_guild_id
export_opt DISCORD_CHANNEL_ID discord_channel_id
export_opt DISCORD_ADMIN_ROLE_ID discord_admin_role_id
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
export_opt LOG_LEVEL log_level

# Web UI + Home Assistant (add-on only — see home-assistant/config.yaml)
export_bool_opt WEB_ENABLED web_enabled
export_opt WEB_ADMIN_USERS web_admin_users
export WEB_PORT=8099
export WEB_HOST=0.0.0.0
export HOME_ASSISTANT_URL=http://supervisor/core
export DATABASE_URL="file:/data/listings.db"
export CLOAKBROWSER_PROFILE_DIR=/data/cloakbrowser-profile

mkdir -p /data

cd /app
echo "[run] Applying migrations..."
pnpm exec prisma migrate deploy
echo "[run] Starting bot and web UI..."
exec node dist/index.js
