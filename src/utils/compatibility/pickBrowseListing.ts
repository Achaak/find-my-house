import type { CompatibilityPreferences } from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import { scorePropertyCompatibility } from "./score.js";

export const BROWSE_EXPLORE_INTERVAL = 5;
export const BROWSE_LOW_COMPAT_THRESHOLD = 50;
export const BROWSE_TOP_TIER_SIZE = 10;

export type BrowsePickResult = {
  property: PropertyRow;
  isExplore: boolean;
};

function pickRandom<T>(items: T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error("pickRandom called with an empty array");
  }
  return item;
}

export function pickBrowseListing(
  candidates: PropertyRow[],
  preferences: CompatibilityPreferences | null,
  shownCount: number
): BrowsePickResult | null {
  if (candidates.length === 0) return null;

  if (!preferences) {
    return { property: candidates[0], isExplore: false };
  }

  const scored = candidates.map((property) => ({
    property,
    score: scorePropertyCompatibility(property, preferences)?.score ?? 0,
  }));

  const isExplore =
    shownCount > 0 && shownCount % BROWSE_EXPLORE_INTERVAL === 0;

  if (isExplore) {
    const lowCompat = scored.filter(
      (entry) => entry.score < BROWSE_LOW_COMPAT_THRESHOLD
    );
    if (lowCompat.length > 0) {
      return { property: pickRandom(lowCompat).property, isExplore: true };
    }

    scored.sort((a, b) => a.score - b.score);
    return { property: scored[0].property, isExplore: true };
  }

  scored.sort((a, b) => b.score - a.score);
  const topTier = scored.slice(
    0,
    Math.min(BROWSE_TOP_TIER_SIZE, scored.length)
  );
  return { property: pickRandom(topTier).property, isExplore: false };
}
