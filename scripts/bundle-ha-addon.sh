#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE="$ROOT/ha-addon-bundle"
ADDON="$ROOT/homeassistant-addon/find-my-house"

rm -rf "$BUNDLE"
mkdir -p "$BUNDLE"

for file in config.yaml Dockerfile run.sh; do
  cp "$ADDON/$file" "$BUNDLE/$file"
done
chmod +x "$BUNDLE/run.sh"

cp "$ROOT/package.json" "$ROOT/pnpm-lock.yaml" "$ROOT/tsconfig.json" "$BUNDLE/"
cp "$ROOT/prisma.config.ts" "$ROOT/prisma.config.js" "$ROOT/prisma.config.d.ts" "$BUNDLE/"
cp -R "$ROOT/prisma" "$ROOT/src" "$BUNDLE/"

echo "Bundle prêt: $BUNDLE"
echo ""
echo "Contenu ($(find "$BUNDLE" -type f | wc -l | tr -d ' ') fichiers) :"
ls -la "$BUNDLE"
echo ""
echo "Copiez le CONTENU de ha-addon-bundle/ dans addons/local/find-my-house/ via Samba."
echo "Puis dans HA: Apps → Find My House → Reconstruire → Installer"
