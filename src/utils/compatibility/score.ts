import type {
  CompatibilityCard,
  CompatibilityDetail,
  CompatibilityModel,
  CompatibilityTier,
} from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import { evaluatePropertyCompatibility } from "./evaluate.js";
import { buildCompatibilityModel } from "./model.js";
import {
  assignCompatibilityRanks,
  buildCompatibilityCard,
  buildCompatibilityDetail,
  formatCompatibilityTierEmoji,
  formatCompatibilityTierLabel,
} from "./present.js";

export {
  evaluatePropertyCompatibility,
  sortPropertiesByCompatibility as sortByCompatibility,
  comparePropertyCompatibility as compareCompatibility,
} from "./evaluate.js";

export { buildCompatibilityModel } from "./model.js";

export {
  assignCompatibilityRanks,
  buildCompatibilityCard,
  buildCompatibilityDetail,
  buildCompatibilityProfile,
  buildCompatibilitySummary,
  formatCompatibilityFieldValue,
  formatCompatibilityTierEmoji,
  formatCompatibilityTierLabel,
  MIN_LIKES_FOR_RANK,
  MIN_LIKES_FOR_TIER,
  scoreToTier,
} from "./present.js";

export {
  scorePrice,
  scoreNumericTarget,
  scoreRoomsTarget,
  scoreDpeClass,
  scoreAncienPreference,
  scoreConstructionYear,
  scoreHighlightsMatch,
  scoreRenovationCondition,
  scoreTextPreference,
  scoreDistance,
  similarityToProperty,
  scoreDislikePenalty,
} from "./legacyScore.js";

export function getCompatibilityScore(
  property: PropertyRow,
  model: CompatibilityModel | null
): number | undefined {
  if (!model) return undefined;
  return evaluatePropertyCompatibility(property, model)?.score;
}

export function buildPropertyCompatibilityCard(
  property: PropertyRow,
  model: CompatibilityModel | null,
  rank?: { rank: number; rankTotal: number }
): CompatibilityCard | undefined {
  if (!model) return undefined;
  const evaluation = evaluatePropertyCompatibility(property, model);
  return buildCompatibilityCard(evaluation, model, rank);
}

export function buildPropertyCompatibilityDetail(
  property: PropertyRow,
  model: CompatibilityModel | null,
  rank?: { rank: number; rankTotal: number }
): CompatibilityDetail | undefined {
  if (!model) return undefined;
  const evaluation = evaluatePropertyCompatibility(property, model);
  return buildCompatibilityDetail(evaluation, model, rank);
}

export function buildBatchCompatibilityRanks(
  properties: PropertyRow[],
  model: CompatibilityModel | null
): Map<number, { rank: number; rankTotal: number }> {
  return assignCompatibilityRanks(
    properties,
    model,
    evaluatePropertyCompatibility
  );
}

export function formatCompatibilityLabel(
  scoreOrTier: number | CompatibilityTier
): string {
  if (typeof scoreOrTier === "string") {
    return `${formatCompatibilityTierEmoji(scoreOrTier)} ${formatCompatibilityTierLabel(scoreOrTier)}`;
  }

  const rounded = Math.round(scoreOrTier);
  const emoji =
    rounded >= 85 ? "🟢" : rounded >= 70 ? "🟡" : rounded >= 50 ? "🟠" : "🔴";
  return `${emoji} ${String(rounded)}/100`;
}

/** @deprecated Use evaluatePropertyCompatibility with a CompatibilityModel */
export function scorePropertyCompatibility(
  property: PropertyRow,
  model: CompatibilityModel
) {
  return evaluatePropertyCompatibility(property, model);
}

/** @deprecated Use buildCompatibilityModel */
export function modelFromTrainingData(
  likes: PropertyRow[],
  dislikes: PropertyRow[] = []
) {
  return buildCompatibilityModel(likes, dislikes);
}
