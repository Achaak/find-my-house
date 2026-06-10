# Find My House

Bot Discord + scraper d'annonces immobilières françaises, avec stockage SQLite et déduplication automatique.

## Fonctionnalités

- Scraping d'annonces via Playwright (BienIci, extensible à d'autres sources)
- Stockage SQLite via Prisma 7 avec contraintes d'unicité (pas de doublons)
- Bot Discord avec commandes slash interactives
- Scraping automatique planifié via cron

## Prérequis

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 9+
- Un bot Discord ([Discord Developer Portal](https://discord.com/developers/applications))

## Installation

```bash
pnpm install
pnpm run browser:install
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
| `SCRAPE_CITY` | Ville par défaut (ex: Paris) |
| `SCRAPE_MAX_PRICE` | Prix maximum en euros |
| `SCRAPE_MIN_SURFACE` | Surface minimum en m² |
| `SCRAPE_CRON` | Expression cron (défaut: toutes les 2h) |
| `DATABASE_URL` | URL Prisma SQLite (ex: `file:./data/listings.db`) |

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
| `/annonces` | Rechercher des annonces (ville, prix max, surface min) |
| `/annonce id:123` | Détail d'une annonce |
| `/scraper` | Lancer un scraping manuel |
| `/stats` | Statistiques de la base |
| `/aide` | Aide |

## Anti-doublons

Deux contraintes empêchent les doublons :
- `UNIQUE(source, external_id)` — même annonce sur la même source
- `UNIQUE(url)` — même URL quelle que soit la source

Si une annonce existe déjà sans changement (prix/titre), elle est ignorée. Si le prix ou le titre change, elle est mise à jour.

## Architecture

```
src/
├── config.ts           # Configuration via .env
├── db/                 # Prisma client + repository
prisma/
└── schema.prisma       # Schéma de la base
prisma.config.ts        # Config Prisma 7 (URL, migrations)
├── scrapers/           # Playwright + scrapers modulaires (BienIci, ...)
├── discord/            # Bot + commandes slash
├── services/           # Orchestration du scraping
└── index.ts            # Point d'entrée
```

## Ajouter un scraper

Implémenter l'interface `Scraper` dans `src/scrapers/` et l'ajouter dans `src/scrapers/index.ts`.
