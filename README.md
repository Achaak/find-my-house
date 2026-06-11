# Find My House

Bot Discord + scraper d'annonces immobilières françaises, avec stockage SQLite et déduplication automatique.

## Fonctionnalités

- Scraping multi-sources : **BienIci**, **Leboncoin** et **SeLoger** (scrapers modulaires, activables via `SCRAPE_SCRAPERS`)
- Filtres avancés : terrain, pièces, chambres, ancien/neuf, rayon km ou temps de trajet en voiture
- Stockage SQLite via Prisma 7 avec contraintes d'unicité (pas de doublons)
- Bot Discord avec commandes slash et embeds enrichis (photo, prix, surface, lien…)
- Boutons **J'aime** / **Pas j'aime** sur chaque annonce, avec favoris persistés par utilisateur Discord
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

| Variable                    | Description                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`             | Token du bot Discord                                                                                                                                 |
| `DISCORD_CLIENT_ID`         | ID de l'application Discord                                                                                                                          |
| `DISCORD_GUILD_ID`          | (Optionnel) ID du serveur pour enregistrer les commandes en dev                                                                                      |
| `DISCORD_CHANNEL_ID`        | (Optionnel) Canal pour les notifications de nouvelles annonces. Le bot doit avoir les permissions **Send Messages** et **Embed Links** sur ce canal. |
| `SCRAPE_SCRAPERS`           | (Optionnel) Scrapers actifs, séparés par des virgules (`bienici`, `leboncoin`, `seloger`). Tous activés si absent.                                   |
| `SCRAPE_CITY`               | Ville de référence (ex: Paris)                                                                                                                       |
| `SCRAPE_MAX_PRICE`          | Prix maximum en euros                                                                                                                                |
| `SCRAPE_MIN_SURFACE`        | Surface minimum en m²                                                                                                                                |
| `SCRAPE_MIN_LAND_SURFACE`   | (Optionnel) Terrain minimum en m²                                                                                                                    |
| `SCRAPE_MIN_ROOMS`          | (Optionnel) Nombre de pièces minimum                                                                                                                 |
| `SCRAPE_MIN_BEDROOMS`       | (Optionnel) Nombre de chambres minimum                                                                                                               |
| `SCRAPE_ANCIEN_ONLY`        | (Optionnel) `true` pour exclure le neuf                                                                                                              |
| `SCRAPE_MAX_TRAVEL_MINUTES` | (Optionnel) Temps de trajet max en voiture depuis `SCRAPE_CITY`. Prioritaire sur `SCRAPE_RADIUS_KM`.                                                 |
| `SCRAPE_RADIUS_KM`          | (Optionnel) Rayon de recherche en km (utilisé si `SCRAPE_MAX_TRAVEL_MINUTES` n'est pas défini)                                                       |
| `SCRAPE_CRON`               | Expression cron (défaut: toutes les 2h)                                                                                                              |
| `DATABASE_URL`              | URL Prisma SQLite (ex: `file:./data/listings.db`)                                                                                                    |

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

## Déploiement

| Cible                                  | Guide                                                          |
| -------------------------------------- | -------------------------------------------------------------- |
| **Home Assistant OS** (Raspberry Pi 4) | [homeassistant-addon/README.md](homeassistant-addon/README.md) |
| **Docker** (NAS, NUC, VPS)             | `docker compose up -d --build` avec un `.env` configuré        |

Sur Home Assistant, le bot tourne comme add-on local : volume persistant pour SQLite, redémarrage automatique, configuration via l'interface HA.

## Commandes Discord

| Commande                             | Description                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/annonces`                          | Rechercher en base (ville, code postal, texte, source, prix min/max, surface, terrain, pièces, chambres, ancien/neuf, rayon km, temps de trajet, tri…). Résultats en embeds avec boutons. |
| `/annonce id:123`                    | Détail d'une annonce                                                                                                                                                                      |
| `/jaime ajouter\|retirer\|liste`     | Gérer ses favoris                                                                                                                                                                         |
| `/pas-jaime ajouter\|retirer\|liste` | Gérer les annonces marquées comme non aimées                                                                                                                                              |
| `/scraper`                           | Lancer un scraping manuel (critères du `.env`)                                                                                                                                            |
| `/stats`                             | Statistiques de la base                                                                                                                                                                   |
| `/aide`                              | Aide                                                                                                                                                                                      |

Les boutons **❤️ J'aime** et **👎 Pas j'aime** sous chaque annonce permettent d'ajouter ou retirer une réaction en un clic (réponse éphémère, visible uniquement par vous). Un clic sur un bouton déjà actif retire la réaction.

## Anti-doublons

Le modèle sépare le **bien** (`properties`) de ses **publications** par portail (`listing_publications`) :

- Un bien unique est identifié par une empreinte (`property_key`) calculée à partir du code postal, prix, surface, pièces et chambres (sans GPS ni titre, trop variables entre portails).
- Chaque portail conserve sa propre publication (`UNIQUE(source, external_id)` et `UNIQUE(url)`).
- Une même maison sur BienIci et Leboncoin crée **un bien** et **deux publications** — une seule notification Discord est envoyée.
- Les réactions utilisateur (`listing_reactions`) sont liées au **bien**, pas à une publication individuelle.

Après migration depuis l'ancien schéma, lancer `pnpm run db:reconcile` pour fusionner les doublons existants.

## Architecture

```
src/
├── config.ts              # Configuration via .env
├── db/                    # Prisma client, repository annonces + réactions
├── utils/                 # Géolocalisation, isochrone, APIs (BienIci, Leboncoin, SeLoger)
├── scrapers/              # Scrapers modulaires (bienici, leboncoin, seloger)
├── discord/               # Bot, commandes slash, embeds, boutons, notifications
├── services/              # Orchestration du scraping
└── index.ts               # Point d'entrée (bot + cron)
prisma/
└── schema.prisma          # Schéma (properties + listing_publications + listing_reactions)
```

## Ajouter un scraper

1. Implémenter l'interface `Scraper` dans `src/scrapers/`
2. Ajouter le client API correspondant dans `src/utils/` si nécessaire
3. Enregistrer le scraper dans `src/scrapers/index.ts`
4. Documenter le nom (minuscules) pour `SCRAPE_SCRAPERS`
