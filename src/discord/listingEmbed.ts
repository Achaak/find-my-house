import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import { learnCompatibilityPreferences } from "../utils/compatibility/learn.js";
import { scorePropertyCompatibility } from "../utils/compatibility/score.js";
import { formatListingEmbed, type ListingEmbed } from "./format.js";

let cachedScope: string | null = null;
let cachedPreferences: CompatibilityPreferences | null | undefined;

export function resetListingCompatibilityCache(): void {
  cachedScope = null;
  cachedPreferences = undefined;
}

export async function resolveListingCompatibilityPreferences(
  reactionRepository: ReactionRepository,
  discordUserId?: string
): Promise<CompatibilityPreferences | null> {
  const scope = discordUserId ?? "global";
  if (cachedPreferences !== undefined && cachedScope === scope) {
    return cachedPreferences;
  }

  const { likes, dislikes } =
    await reactionRepository.loadCompatibilityTrainingData(discordUserId);
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

export async function formatListingEmbedWithCompatibility(
  property: PropertyRow,
  reactionRepository: ReactionRepository,
  discordUserId?: string
): Promise<ListingEmbed> {
  const preferences = await resolveListingCompatibilityPreferences(
    reactionRepository,
    discordUserId
  );
  return formatListingEmbed(property, {
    compatibilityScore: getListingCompatibilityScore(property, preferences),
  });
}

export async function formatListingEmbedsWithCompatibility(
  properties: PropertyRow[],
  reactionRepository: ReactionRepository,
  discordUserId?: string
): Promise<ListingEmbed[]> {
  const preferences = await resolveListingCompatibilityPreferences(
    reactionRepository,
    discordUserId
  );
  return properties.map((property) =>
    formatListingEmbed(property, {
      compatibilityScore: getListingCompatibilityScore(property, preferences),
    })
  );
}
