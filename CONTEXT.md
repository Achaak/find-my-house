# Find My House

French real-estate listing aggregator: scrapes portal publications, deduplicates them into properties, enriches missing fields, and surfaces them via web UI.

## Language

**Property**:
The canonical home entity stored in the database (`Property` table). One property can have several portal publications.
_Avoid_: Listing (for persisted rows), house record

**Publication**:
A single portal ad (`ListingPublication`) linked to a property. Identified by `source` + `externalId`. Portal-specific fields (`url`, `source`, `scrapedAt`) belong here — not on `Property`.
_Avoid_: Listing (when meaning a portal ad), ad

**Active publication**:
A publication with `isActive: true` after the latest scrape for its source. Search, browse pool refill, and map (listings view) only surface properties with at least one active publication. The API exposes **active publications only** in `Property.publications`; when every publication is inactive the array is empty (typical on liked/disliked lists and detail pages after delisting).
_Avoid_: Available listing (use active publication)

**Listing**:
A normalized scrape result from one portal before persistence. Ephemeral input to `upsertMany`.
_Avoid_: Property, publication

**Scrape**:
A run of portal search adapters that upserts publications and deactivates missing ones.
_Avoid_: Crawl, fetch job

**Property matching**:
The rule that decides whether a Listing or two Properties refer to the same home (agency signals + tolerance scoring). Shared by scrape-time linking and later reconcile; distinct from merging rows into one canonical Property.
_Avoid_: Deduplication (too broad — also covers merge), fuzzy match (implementation detail), DedupEngine

**Enrichment**:
Post-scrape async fill of missing property fields from portal detail APIs. Two purposes: `display` (image, description, land) and `address` (stricter energy/coords for DPE lookup).

**Display enrichment backfill**:
Scheduled job (startup + hourly cron) that queues Properties still needing _first-time_ display enrichment (`enrichedAt` null) or incomplete local image hashes. Does **not** include sticky HTML-portal refresh (truncated SeLoger/LogicImmo description or unsigned image URLs) — that is on-demand when a Property is opened.

**Display enrichment refresh**:
On-demand re-fetch for HTML-portal Publications that are already enriched but still have truncated descriptions or stale image URLs. Triggered from browse/detail, not from the backfill conveyor.
_Avoid_: Treating refresh as backfill pending (causes catalog-wide re-queue)

_Avoid_: Backfill (unless referring to the scheduled backfill job)

**Browse session**:
In-memory per-user cursor over search results for one-at-a-time review (like, dislike, or pass). Reactions persist; **pass** advances the session without recording a reaction — the property may reappear on a later session.
_Avoid_: Swipe stack, feed session

**Pass** (browse):
Skip the current property for this browse session only. Does not write a reaction; unlike dislike, the property is not excluded from future browse sessions via `excludeReacted`.
_Avoid_: Skip (too generic), defer, maybe

**Reaction**:
A household like or dislike on a property — one reaction per property, shared across the web UI.
_Avoid_: Vote, rating, per-user reaction

**Dislike undo** (browse):
After a dislike in browse, the client may call undo within a grace period (`DISLIKE_UNDO_GRACE_MS` in `src/config/reactions.ts`). The API removes the dislike and rewinds the in-memory browse session so the same property is shown again.
_Avoid_: Generic undo without session context

**Stats daily snapshot**:
Once per day (after scrape or on startup), aggregate metrics are stored in `stats_daily_snapshots`. `GET /api/stats/series?range=7d|30d|90d` serves chart series; sparse history is bootstrapped on startup when fewer than seven days exist.
_Avoid_: Live-only stats without history
