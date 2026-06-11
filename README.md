# Find My House

Bot Discord + scraper d'annonces immobilières françaises, avec stockage SQLite et déduplication automatique.

## Fonctionnalités

- Scraping d'annonces via l'API BienIci (extensible à d'autres sources)
- Filtres avancés : terrain, pièces, chambres, ancien/neuf, rayon km ou temps de trajet en voiture
- Stockage SQLite via Prisma 7 avec contraintes d'unicité (pas de doublons)
- Bot Discord avec commandes slash interactives
- Notifications de nouvelles annonces dans un canal Discord
- Scraping automatique planifié via cron

## Prérequis

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 9+
- Un bot Discord ([Discord Developer Portal](https://discord.com/developers/applications))

## Installation

```bash
pnpm install
cp .env.example .env
# Remplir les variables dans .env
pnpm run db:migrate
```

## Configuration

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Token du bot Discord |
| `DISCORD_CLIENT_ID` | ID de l'application Discord |
| `DISCORD_GUILD_ID` | (Optionnel) ID du serveur pour enregistrer les commandes en dev |
| `DISCORD_CHANNEL_ID` | (Optionnel) Canal pour les notifications de nouvelles annonces. Le bot doit avoir les permissions **Send Messages** et **Embed Links** sur ce canal. |
| `SCRAPE_CITY` | Ville de référence (ex: Paris) |
| `SCRAPE_MAX_PRICE` | Prix maximum en euros |
| `SCRAPE_MIN_SURFACE` | Surface minimum en m² |
| `SCRAPE_MIN_LAND_SURFACE` | (Optionnel) Terrain minimum en m² |
| `SCRAPE_MIN_ROOMS` | (Optionnel) Nombre de pièces minimum |
| `SCRAPE_MIN_BEDROOMS` | (Optionnel) Nombre de chambres minimum |
| `SCRAPE_ANCIEN_ONLY` | (Optionnel) `true` pour exclure le neuf |
| `SCRAPE_MAX_TRAVEL_MINUTES` | (Optionnel) Temps de trajet max en voiture depuis `SCRAPE_CITY`. Prioritaire sur `SCRAPE_RADIUS_KM`. |
| `SCRAPE_RADIUS_KM` | (Optionnel) Rayon de recherche en km (utilisé si `SCRAPE_MAX_TRAVEL_MINUTES` n'est pas défini) |
| `SCRAPE_CRON` | Expression cron (défaut: toutes les 2h) |
| `DATABASE_URL` | URL Prisma SQLite (ex: `file:./data/listings.db`) |

> **Migration Discord** : remplacez l'ancienne variable `DISCORD_WEBHOOK_URL` par `DISCORD_CHANNEL_ID`. Les notifications passent désormais par le bot (REST API) plutôt qu'un webhook.

## Lancement

```bash
# Développement (hot reload)
pnpm run dev

# Scraping manuel (sans Discord)
pnpm run scrape

# Production
pnpm run build && pnpm start
```

## Commandes Discord

| Commande | Description |
|---|---|
| `/annonces` | Rechercher des annonces (ville, prix, surface, terrain, pièces, chambres, ancien, rayon km…) |
| `/annonce id:123` | Détail d'une annonce |
| `/scraper` | Lancer un scraping manuel (critères du `.env`) |
| `/stats` | Statistiques de la base |
| `/aide` | Aide |

## Anti-doublons

Deux contraintes empêchent les doublons :
- `UNIQUE(source, external_id)` — même annonce sur la même source
- `UNIQUE(url)` — même URL quelle que soit la source

Si une annonce existe déjà sans changement, elle est ignorée. Si un champ change (prix, titre, coordonnées, etc.), elle est mise à jour.

## Architecture

```
src/
├── config.ts           # Configuration via .env
├── db/                 # Prisma client + repository
├── utils/              # Géolocalisation, isochrone, calculs geo
├── scrapers/           # Scrapers modulaires (BienIci, ...)
├── discord/            # Bot + commandes slash + notifications
├── services/           # Orchestration du scraping
└── index.ts            # Point d'entrée
prisma/
└── schema.prisma       # Schéma de la base
```

## Ajouter un scraper

Implémenter l'interface `Scraper` dans `src/scrapers/` et l'ajouter dans `src/scrapers/index.ts`.
