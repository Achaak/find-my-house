import type { ReactionRepository } from "../db/reactionRepository.js";
import type { PropertyRow } from "../types/listing.js";
import {
  getListingCompatibilityCard,
  resolveCompatibilityModel,
} from "../services/compatibilityService.js";
import { formatListingEmbed } from "./format.js";

export {
  getListingCompatibilityCard,
  resolveCompatibilityModel,
  resetListingCompatibilityCache,
} from "../services/compatibilityService.js";

export async function formatListingEmbedWithCompatibility(
  property: PropertyRow,
  reactionRepository: ReactionRepository,
  model?: Awaited<ReturnType<typeof resolveCompatibilityModel>>
): Promise<import("./format.js").ListingEmbed> {
  const resolvedModel =
    model ?? (await resolveCompatibilityModel(reactionRepository));
  const compatibility = getListingCompatibilityCard(property, resolvedModel);
  return formatListingEmbed(property, { compatibility });
}

export async function formatListingEmbedsWithCompatibility(
  properties: PropertyRow[],
  reactionRepository: ReactionRepository
): Promise<import("./format.js").ListingEmbed[]> {
  const model = await resolveCompatibilityModel(reactionRepository);
  return properties.map((property) => {
    const compatibility = getListingCompatibilityCard(property, model);
    return formatListingEmbed(property, { compatibility });
  });
}
