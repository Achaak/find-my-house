#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

missing=0

check() {
  if [ ! -e "$1" ]; then
    echo "MANQUANT: $1"
    missing=1
  else
    echo "OK: $1"
  fi
}

echo "Vérification du dossier app locale Home Assistant..."
echo ""

check "config.yaml"
check "Dockerfile"
check "run.sh"
check "package.json"
check "pnpm-lock.yaml"
check "prisma/schema.prisma"
check "src/index.ts"

echo ""
if [ "$missing" -eq 1 ]; then
  echo "Échec: copiez le dépôt ENTIER dans /addons/local/find-my-house/"
  echo "Puis lancez: ./scripts/install-ha-addon.sh"
  exit 1
fi

echo "Tout est prêt. Dans HA: Paramètres → Apps → ⋮ → Vérifier les mises à jour"
