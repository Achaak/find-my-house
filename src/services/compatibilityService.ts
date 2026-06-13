import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import { learnCompatibilityPreferences } from "../utils/compatibility/learn.js";
import { scorePropertyCompatibility } from "../utils/compatibility/score.js";

let cachedScope: string | null = null;
let cachedPreferences: CompatibilityPreferences | null | undefined;

export function resetListingCompatibilityCache(): void {
  cachedScope = null;
  cachedPreferences = undefined;
}

export async function resolveListingCompatibilityPreferences(
  reactionRepository: ReactionRepository,
  userId?: string
): Promise<CompatibilityPreferences | null> {
  const scope = userId ?? "global";
  if (cachedPreferences !== undefined && cachedScope === scope) {
    return cachedPreferences;
  }

  const { likes, dislikes } =
    await reactionRepository.loadCompatibilityTrainingData(userId);
  cachedPreferences = learnCompatibilityPreferences(likes, dislikes);
  cachedScope = scope;
  return cachedPreferences;
}

export function getListingCompatibilityScore(
  property: PropertyRow,
  preferences: CompatibilityPreferences | null
): number | undefined {
  if (!preferences) return undefined;
  return scorePropertyCompatibility(property, preferences)?.score;
}
