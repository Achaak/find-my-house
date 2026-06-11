#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON_DIR="$ROOT/homeassistant-addon/find-my-house"

for file in config.yaml Dockerfile run.sh; do
  if [ ! -f "$ADDON_DIR/$file" ]; then
    echo "Fichier manquant: $ADDON_DIR/$file" >&2
    exit 1
  fi
  cp "$ADDON_DIR/$file" "$ROOT/$file"
done

chmod +x "$ROOT/run.sh"

echo "App Home Assistant prête dans: $ROOT"
echo "  - config.yaml"
echo "  - Dockerfile"
echo "  - run.sh"
echo ""
echo "Vérifiez avec: ./scripts/verify-ha-addon.sh"
echo "Puis dans HA: Paramètres → Apps → Find My House → Installer"
