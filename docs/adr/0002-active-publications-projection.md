---
status: accepted
---

# Active publications and property projection

Portal links and scrape freshness live on **publications**, not on the denormalized **property** row exposed by the API. A property can outlive its portal ads (likes, history, compatibility training); availability is determined at scrape time, not re-checked on every browse pick.

## Decision

1. **API contract** — `Property` has no `url`, `source`, or `scrapedAt`. Only `publications[]` carries portal identity and links. Each entry is an **active** publication (`isActive: true`). When all publications are inactive, `publications: []`.
2. **Projection at scrape** — Canonical property fields (title, price, image, …) are recomputed from active publications via `computePropertyProjection`. When **no** publication is active, **do not** update the property row — keep the last values from when at least one publication was still active.
3. **Search and map** — Listing search already filters `publications.some({ isActive: true })`. The map is a view of search results; it does not show delisted properties. No extra runtime freshness check at browse pick time (stale in-memory pool between scrapes is accepted for performance).
4. **UI when delisted** — Outside search/browse: compact badge « Annonces retirées » on cards; full message replacing portal links on the detail page. No fallback link from inactive publications or a synthetic primary URL.

## Considered options

### A — Active-only API, frozen projection (adopted)

Publications are the source of truth for links; property projection freezes when everything goes inactive.

**Pros:** Matches domain language; avoids dead links; historical likes remain readable. **Cons:** `publications: []` requires explicit empty-state UI.

### B — Fallback to inactive publications in API (rejected)

Mapper/API still returned inactive publications or synthesized `Property.url` from the last primary publication.

**Cons:** Contradicts “not referenced = not linkable”; frontend and backend disagreed on what to show.

### C — Runtime re-validation at browse pick (rejected)

Re-fetch or filter `isActive` when showing each browse card.

**Cons:** Extra latency; scrape/enrichment already owns freshness.

## Consequences

- `PropertyRow`, `serializePropertyRow`, and `@find-my-house/api-types` align with the API shape (no property-level portal fields).
- `listingMapper` maps `publications` to active rows only; `selectProjectionPublications` never falls back to inactive rows.
- `ProjectionUpdater.refresh` skips DB update when all publications are inactive.
- Notifications include a portal URL only when an active publication exists.
- Tests cover mapper filtering, projection freeze, and frontend `getDisplayPublications`.
