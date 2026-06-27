---
status: accepted
---

# Browse pass and review card UX

Browse is a household review loop: commit with like/dislike, or **pass** when not ready to decide. The card is the primary surface for one-at-a-time review; detail remains one click away on the image.

## Decision

### Pass semantics

- **`POST /api/browse/pass`** advances the browse session without calling `reactionRepository.add` or `noteBrowseReaction`.
- **This session:** the property stays in `seenPropertyIds` (already set when picked) — it will not reappear until the session restarts.
- **Later sessions:** the property can reappear; only persisted likes/dislikes are excluded via `excludeReacted`.

Pass is weaker than dislike (not a household rejection) and weaker than like (not shortlisted).

### When a property has no active publication in browse

Should not happen under normal operation (search pool filters active publications). If it does — publication deactivated between scrapes while the in-memory pool is stale — there is **no** special UX branch: no auto-skip, no blocking like/dislike. Freshness is owned by scrape, not browse pick.

### Browse card layout

- Card constrained to **`max-w-md`**, centered — smaller than full-width list cards.
- Image **16:9** (`aspect-video`), width-driven height.
- Image (and no-photo placeholder) links to **`/listings/$id`**; footer « Détails » remains.
- Actions: like + dislike grouped on the left; **Passer** ghost button on the right.

## Considered options

### Pass — session-only skip (adopted)

**Pros:** Hesitation ≠ rejection; couples can revisit after reflection. **Cons:** Same property may show again on a new browse.

### Pass — permanent skip without dislike (rejected)

Would need a new persisted exclusion separate from reactions.

### Pass — equivalent to dislike for filtering (rejected)

Collapses two distinct household intents.

### Browse — block like/dislike when no portal link (rejected)

Delisted-in-pool treated as a system edge case, not a user choice on browse.

## Consequences

- Integration test: pass advances `shownCount`, property absent from like/dislike lists.
- i18n: `browse_pass_next` (EN/FR).
- `PropertyCard` image link applies everywhere cards render; browse wrapper only adds width constraint.
