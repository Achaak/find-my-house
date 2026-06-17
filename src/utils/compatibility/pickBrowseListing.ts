import type { CompatibilityModel } from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import { evaluatePropertyCompatibility } from "./evaluate.js";
import { scoreToTier } from "./present.js";

export const BROWSE_EXPLORE_INTERVAL = 5;
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

function isExploreTier(
  property: PropertyRow,
  model: CompatibilityModel
): boolean {
  const evaluation = evaluatePropertyCompatibility(property, model);
  if (!evaluation) return true;

  const tier = scoreToTier(evaluation.score, model);
  return tier === "weak" || tier === "moderate";
}

export function pickBrowseListing(
  candidates: PropertyRow[],
  model: CompatibilityModel | null,
  shownCount: number
): BrowsePickResult | null {
  if (candidates.length === 0) return null;

  if (!model) {
    return { property: candidates[0], isExplore: false };
  }

  const scored = candidates.map((property) => ({
    property,
    evaluation: evaluatePropertyCompatibility(property, model),
    score: evaluatePropertyCompatibility(property, model)?.score ?? 0,
  }));

  const isExplore =
    shownCount > 0 && shownCount % BROWSE_EXPLORE_INTERVAL === 0;

  if (isExplore) {
    const exploreCandidates = scored.filter((entry) =>
      isExploreTier(entry.property, model)
    );
    if (exploreCandidates.length > 0) {
      return {
        property: pickRandom(exploreCandidates).property,
        isExplore: true,
      };
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
