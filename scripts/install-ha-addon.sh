#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON_DIR="$ROOT/homeassistant-addon/find-my-house"

cp "$ADDON_DIR/config.yaml" "$ROOT/config.yaml"
chmod +x "$ADDON_DIR/run.sh"

echo "Add-on Home Assistant prêt dans: $ROOT"
echo "  - config.yaml copié à la racine"
echo "  - Dockerfile et run.sh déjà en place"
echo ""
echo "Dans Home Assistant: Paramètres → Add-ons → Find My House → Installer"
