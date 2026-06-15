import type { PropertyRow } from "../types/listing.js";
import { formatListingEmbed, type ListingEmbed } from "./format.js";
import {
  getListingCompatibilityScore,
  resolveListingCompatibilityPreferences,
} from "../services/compatibilityService.js";
import type { ReactionRepository } from "../db/reactionRepository.js";

export {
  getListingCompatibilityScore,
  resetListingCompatibilityCache,
  resolveListingCompatibilityPreferences,
} from "../services/compatibilityService.js";

export async function formatListingEmbedWithCompatibility(
  property: PropertyRow,
  reactionRepository: ReactionRepository
): Promise<ListingEmbed> {
  const preferences =
    await resolveListingCompatibilityPreferences(reactionRepository);
  return formatListingEmbed(property, {
    compatibilityScore: getListingCompatibilityScore(property, preferences),
  });
}

export async function formatListingEmbedsWithCompatibility(
  properties: PropertyRow[],
  reactionRepository: ReactionRepository
): Promise<ListingEmbed[]> {
  const preferences =
    await resolveListingCompatibilityPreferences(reactionRepository);
  return properties.map((property) =>
    formatListingEmbed(property, {
      compatibilityScore: getListingCompatibilityScore(property, preferences),
    })
  );
}
