# Find My House

French real-estate listing aggregator: scrapes portal publications, deduplicates them into properties, enriches missing fields, and surfaces them via web UI.

## Language

**Property**:
The canonical home entity stored in the database (`Property` table). One property can have several portal publications.
_Avoid_: Listing (for persisted rows), house record

**Publication**:
A single portal ad (`ListingPublication`) linked to a property. Identified by `source` + `externalId`.
_Avoid_: Listing (when meaning a portal ad), ad

**Listing**:
A normalized scrape result from one portal before persistence. Ephemeral input to `upsertMany`.
_Avoid_: Property, publication

**Scrape**:
A run of portal search adapters that upserts publications and deactivates missing ones.
_Avoid_: Crawl, fetch job

**Enrichment**:
Post-scrape async fill of missing property fields from portal detail APIs. Two purposes: `display` (image, description, land) and `address` (stricter energy/coords for DPE lookup).
_Avoid_: Backfill (unless referring to the scheduled backfill job)

**Browse session**:
In-memory per-user cursor over search results for one-at-a-time review (like/dislike).
_Avoid_: Swipe stack, feed session

**Reaction**:
A household like or dislike on a property — one reaction per property, shared across the web UI.
_Avoid_: Vote, rating, per-user reaction
