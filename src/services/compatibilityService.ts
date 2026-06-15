import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import { learnCompatibilityPreferences } from "../utils/compatibility/learn.js";
import { scorePropertyCompatibility } from "../utils/compatibility/score.js";

let cachedPreferences: CompatibilityPreferences | null | undefined;

export function resetListingCompatibilityCache(): void {
  cachedPreferences = undefined;
}

export async function resolveListingCompatibilityPreferences(
  reactionRepository: ReactionRepository
): Promise<CompatibilityPreferences | null> {
  if (cachedPreferences !== undefined) {
    return cachedPreferences;
  }

  const { likes, dislikes } =
    await reactionRepository.loadCompatibilityTrainingData();
  cachedPreferences = learnCompatibilityPreferences(likes, dislikes);
  return cachedPreferences;
}

export function getListingCompatibilityScore(
  property: PropertyRow,
  preferences: CompatibilityPreferences | null
): number | undefined {
  if (!preferences) return undefined;
  return scorePropertyCompatibility(property, preferences)?.score;
}
