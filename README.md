# Find My House

Discord bot + French real-estate listing scraper, with SQLite storage and automatic deduplication.

## Features

- Multi-source scraping: **BienIci**, **Leboncoin**, **SeLoger**, and **Logic-Immo** (modular scrapers, enabled via `SCRAPE_SCRAPERS`)
- Advanced filters: land area, rooms, bedrooms, old/new builds, radius in km or driving travel time
- SQLite storage via Prisma 7 with uniqueness constraints (no duplicates)
- Discord bot with slash commands and rich embeds (photo, price, surface area, link…)
- **Like** / **Dislike** buttons on each listing, with per-Discord-user persisted favorites
- New listing notifications in a Discord channel
- Scheduled automatic scraping via cron

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 9+
- A Discord bot ([Discord Developer Portal](https://discord.com/developers/applications))

## Installation

```bash
pnpm install
cp .env.local.example .env.local
# Fill in Discord and your search criteria in .env.local
pnpm run db:migrate
```

**Defaults** live in `.env` (versioned). **Secrets** and **overrides** (Discord token, city, scrapers…) go in `.env.local` (git-ignored, overrides `.env`).

## Configuration

| Variable                    | Description                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`             | Discord bot token                                                                                                                  |
| `DISCORD_CLIENT_ID`         | Discord application ID                                                                                                             |
| `DISCORD_GUILD_ID`          | (Optional) Server ID for registering commands in dev                                                                               |
| `DISCORD_CHANNEL_ID`        | (Optional) Channel for new listing notifications. The bot needs **Send Messages** and **Embed Links** permissions on this channel. |
| `SCRAPE_SCRAPERS`           | (Optional) Active scrapers, comma-separated (`bienici`, `leboncoin`, `seloger`, `logicimmo`). All enabled if omitted.              |
| `SCRAPE_CITY`               | Reference city (e.g. Paris)                                                                                                        |
| `SCRAPE_POSTAL_CODE`        | (Optional) 5-digit postal code — disambiguates homonyms and filters SeLoger/Logic-Immo listings by commune                         |
| `SCRAPE_MAX_PRICE`          | Maximum price in euros                                                                                                             |
| `SCRAPE_MIN_SURFACE`        | Minimum surface area in m²                                                                                                         |
| `SCRAPE_MIN_LAND_SURFACE`   | (Optional) Minimum land area in m²                                                                                                 |
| `SCRAPE_MIN_ROOMS`          | (Optional) Minimum number of rooms                                                                                                 |
| `SCRAPE_MIN_BEDROOMS`       | (Optional) Minimum number of bedrooms                                                                                              |
| `SCRAPE_ANCIEN_ONLY`        | (Optional) `true` to exclude new builds                                                                                            |
| `SCRAPE_MAX_TRAVEL_MINUTES` | (Optional) Max driving time from `SCRAPE_CITY` in minutes.                                                                         |
| `SCRAPE_CRON`               | Cron expression (default: every 2 hours)                                                                                           |
| `DATABASE_URL`              | Prisma SQLite URL (e.g. `file:./data/listings.db`)                                                                                 |
| `DATABASE_PATH`             | (Optional) Alternative to `DATABASE_URL` — relative path under `file:` (e.g. `./data/listings.db`)                                 |
| `CLOAKBROWSER_HEADLESS`     | (Optional) Set to `false` for headed mode if portals still block requests                                                          |
| `CLOAKBROWSER_PROXY`        | (Optional) Residential proxy URL for CloakBrowser                                                                                  |
| `CLOAKBROWSER_GEOIP`        | (Optional) Match timezone/locale to proxy IP (default `true` when proxy is set)                                                    |

> **Discord migration**: replace the legacy `DISCORD_WEBHOOK_URL` variable with `DISCORD_CHANNEL_ID`. Notifications now go through the bot (REST API) instead of a webhook.

## Running

```bash
# Development (hot reload)
pnpm run dev

# Manual scrape (uses .env criteria; notifies Discord if DISCORD_CHANNEL_ID is set)
pnpm run scrape

# Production
pnpm run build && pnpm start
```

## Versioning

Versioning uses [release-it](https://github.com/release-it/release-it) with [@release-it/bumper](https://github.com/release-it/bumper) (config in `.release-it.json`):

| Command              | Action                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| `pnpm release:patch` | Bump patch, sync `home-assistant/config.yaml`, commit, tag `v*`, push, GitHub release |
| `pnpm release:minor` | Bump minor version                                                                    |
| `pnpm release:major` | Bump major version                                                                    |
| `pnpm release`       | Interactive release (choose increment)                                                |

Requires `gh` CLI authenticated (`gh auth login`) for the GitHub release step. CI builds Docker images tagged with the version (`:1.0.0`, `:latest`, and the commit SHA).

## Deployment

### Home Assistant OS (Raspberry Pi 4)

The Docker image is **pre-built on GitHub Actions** (GHCR) — the Pi downloads the image instead of compiling (~2–5 min).

1. **Push** to `main` → GitHub Actions builds the image (repo **Actions** tab)
2. Make the package **public**: GitHub → **Packages** → `find-my-house-aarch64` → **Package settings** → **Change visibility**
3. **Settings → Apps → ⋮ → Repositories** → `https://github.com/Achaak/find-my-house`
4. **Apps → Find My House → Install**
5. **Configuration** tab: Discord token, scrape criteria, etc.
6. **Start** + **Start on boot**

Variables are set through the HA UI (no `.env`). SQLite: persistent volume `/data/listings.db`.

**Updates**: run `pnpm release:patch` (or `minor` / `major`) — release-it bumps, syncs `config.yaml`, pushes, and creates the GitHub release. Wait for the Actions build, then **Apps → Update** (or Rebuild → Restart).

Version is managed in `package.json` and synced automatically to `home-assistant/config.yaml`. Use `/version` in Discord to check the running build.

**SSH alternative** (Terminal & SSH add-on):

```bash
ha store add https://github.com/Achaak/find-my-house
ha addons install find_my_house
```

> The GitHub repo must be **public** (or reachable without auth from the Pi). In production, leave `discord_guild_id` empty.

### Docker (NAS, NUC, VPS)

```bash
cp .env.local.example .env.local   # edit the variables
docker compose up -d --build
```

## Discord commands

| Command                                       | Description                                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/listings`                                   | Search the database (city, postal code, text, source, min/max price, surface, land, rooms, bedrooms, old/new, radius km, travel time, sort…). Results as embeds with buttons. |
| `/listing id:123`                             | Listing details                                                                                                                                                               |
| `/browse`                                     | Browse listings with compatibility scoring based on your likes/dislikes                                                                                                       |
| `/address id:123`                             | Identify a listing address from ADEME public DPE data (confirm with a button to save it)                                                                                      |
| `/like add\|remove\|list\|archive\|unarchive` | Manage favorites                                                                                                                                                              |
| `/dislike add\|remove\|list`                  | Manage disliked listings                                                                                                                                                      |
| `/scraper`                                    | Run a manual scrape (`.env` criteria)                                                                                                                                         |
| `/reconcile`                                  | Merge duplicate properties in the database                                                                                                                                    |
| `/stats`                                      | Database statistics                                                                                                                                                           |
| `/version`                                    | Application version                                                                                                                                                           |
| `/help`                                       | Help                                                                                                                                                                          |

The **❤️ Like** and **👎 Dislike** buttons under each listing let you add or remove a reaction in one click (ephemeral reply, visible only to you). Clicking an already active button removes the reaction.

## Deduplication

The model separates the **property** (`properties`) from its per-portal **publications** (`listing_publications`):

- A unique property is identified by a fingerprint (`property_key`) computed from postal code, price, surface area, rooms, and bedrooms (no GPS or title — too variable across portals).
- Each portal keeps its own publication (`UNIQUE(source, external_id)` and `UNIQUE(url)`).
- The same house on BienIci and Leboncoin creates **one property** and **two publications** — only one Discord notification is sent.
- User reactions (`listing_reactions`) are tied to the **property**, not an individual publication.

After migrating from the legacy schema, run `pnpm run db:reconcile` to merge existing duplicates.

## Architecture

```
src/
├── config/                # Env loading, Zod schema, scrape + Discord config
├── db/                    # Prisma client, listing + reaction repositories
├── types/                 # Domain types (listings, enrichment)
├── utils/
│   ├── browser/           # CloakBrowser client (in-page fetch + HTML scraping)
│   ├── classifiedPortal/  # Shared SeLoger / Logic-Immo stack
│   ├── bienici/           # Bien'ici client, place resolution, mapper
│   ├── leboncoin/         # Leboncoin JSON search API + HTML detail parsing
│   ├── seloger/           # SeLoger facade over classifiedPortal
│   ├── logicimmo/         # Logic-Immo facade over classifiedPortal
│   ├── geo/               # Coordinates, radius, travel-time filters
│   ├── energy/            # DPE/GES classes, ADEME API, matching
│   ├── errors/            # HTTP and invariant error helpers
│   ├── http/              # got client (ADEME public API only)
│   └── …                  # Shared helpers (logger, validation, …)
├── scrapers/              # Modular scrapers (bienici, leboncoin, seloger, logicimmo)
├── services/              # Scraping orchestration + enrichment
├── scripts/               # CLI utilities (scrape-once, reconcile)
├── discord/               # Bot, slash commands, embeds, buttons, notifications
└── index.ts               # Entry point (bot + cron)
home-assistant/            # Home Assistant add-on (config.yaml, run.sh)
prisma/
└── schema.prisma          # Schema (properties + listing_publications + listing_reactions)
```

## Adding a scraper

1. Implement the `Scraper` interface in `src/scrapers/`
2. Add a portal module under `src/utils/<source>/` (client, mapper, optional parsers)
3. Register the scraper in `src/scrapers/index.ts`
4. Document the name (lowercase) for `SCRAPE_SCRAPERS`
