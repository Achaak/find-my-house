---
status: accepted
---

# Property deduplication across portals

Today, a **publication** is attached to a **property** at scrape time via a strict `propertyKey` fingerprint, with a secondary fuzzy match (`propertiesMatchFuzzy`) when keys differ. A manual **reconcile** pass can merge duplicates already in the database. Listing attributes and enrichment now live primarily on `ListingPublication`; `Property` remains the aggregate root that stores denormalized canonical fields for search/sort plus reaction metadata.

This design trades simplicity and low false-merge risk against missed merges: two portal ads for the same home can remain separate when structural fields disagree at first insert (e.g. `surface: null` on Logic-Immo vs `110` on Leboncoin), or when the second publication appears in a later scrape and fuzzy match fails. Reconcile fixes this only if an operator runs it manually.

## Decision

Replace the binary fuzzy matcher with a **tolerance score**, and run deduplication **deferred** — automatically after each scrape and when enrichment updates structural fields. Do **not** use description/title text similarity.

## Considered options

### A — Tolerance score (adopted)

Replace all-or-nothing `propertiesMatchFuzzy` with a weighted score per field pair. Two candidates merge when the score reaches a configurable threshold.

**Hard gates** (score = 0, no merge):

- Different or missing `postalCode` on either side
- Conflicting `isNewProperty` (`true` vs `false` when both set)

**Hard vetoes** stay binary; everything else is scored:

| Signal              | Behaviour                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `price`             | Full credit within ±2 %; partial credit sliding down to 0 beyond tolerance                       |
| `surface`           | Full credit if equal; partial if one side is `null`; 0 if both set and different                 |
| `rooms`, `bedrooms` | Same pattern as `surface`                                                                        |
| `landSurface`       | Full credit if equal or one `null`; partial within ±5 %; 0 beyond                                |
| `propertyType`      | Full credit if canonical types match; partial if one side `null`; 0 if both set and incompatible |

Weights favour high-confidence signals (`postalCode` is a gate, not a weight; `price` and `surface` weigh more than `propertyType`). The threshold (starting point: **≥ 0.85**) is configurable and tuned against real false-positive / false-negative cases.

**Pros:** Handles incomplete portal data without per-field special cases; one algorithm for scrape-time linking and reconcile. **Cons:** Requires test fixtures for score boundaries; threshold tuning is ongoing.

### B — Deferred dedup (adopted)

Keep scrape-time linking for exact `propertyKey` matches. Additionally:

1. Run fuzzy reconcile automatically after each successful scrape.
2. When enrichment updates publication structure (`surface`, `rooms`, `bedrooms`, or `landSurface`), refresh the canonical property projection then re-evaluate merge candidates in the same postal code.
3. Log near-misses (score just below threshold) and hard vetoes with field breakdown for prod diagnosis.

Reuse `mergePropertiesIntoCanonical` for the actual merge; only the _match predicate_ changes.

### C — Text similarity (rejected)

Description/title similarity (e.g. shared prefix _CAMPAGNE DE BREAUTE_) is not used. Too risky: same agency, same development, templated copy. Revisit only if tolerance scoring + deferred dedup leave a measured gap.

### D — Scheduled reconcile only (rejected)

Cron reconcile without rule changes does not fix enrichment timing or null-field mismatches.

## Consequences

- `propertiesMatchFuzzy` becomes a thin wrapper over `scorePropertyMatch >= threshold`, or is replaced outright.
- Duplicate properties should collapse without manual `/reconcile` in normal operation; the admin endpoint remains for on-demand runs.
- `firstSeenAt` / canonical property selection stays “oldest property wins”.
- The API contract remains property-shaped, but values are composed from publications through deterministic projection rules.
- Tests must cover: score boundaries, cross-scrape merge, post-enrichment merge, hard vetoes (`isNewProperty` conflict), and regression cases that must not merge (same postal code, different homes).
