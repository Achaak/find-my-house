import type { ReactionRepository } from "../db/reactionRepository.js";
import type { PropertyRow } from "../types/listing.js";
import {
  getListingCompatibilityScore,
  resolveListingCompatibilityPreferences,
} from "../services/compatibilityService.js";
import type { Property, PropertyReactionState } from "./types.js";

export async function serializeProperty(
  property: PropertyRow,
  reactionRepository: ReactionRepository,
  userId?: string,
  options?: { includeCompatibility?: boolean }
): Promise<Property> {
  let compatibilityScore: number | undefined;
  if (options?.includeCompatibility !== false && userId) {
    const preferences = await resolveListingCompatibilityPreferences(
      reactionRepository,
      userId
    );
    compatibilityScore = getListingCompatibilityScore(property, preferences);
  }

  let reaction: PropertyReactionState = null;
  let archived = false;
  if (userId) {
    const existing = await reactionRepository.getReaction(userId, property.id);
    if (existing) {
      reaction = existing.type;
      archived = existing.archivedAt !== null;
    }
  }

  return {
    id: property.id,
    title: property.title,
    price: property.price,
    firstPrice: property.firstPrice,
    surface: property.surface,
    landSurface: property.landSurface,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    isNewProperty: property.isNewProperty,
    latitude: property.latitude,
    longitude: property.longitude,
    city: property.city,
    postalCode: property.postalCode,
    address: property.address,
    dpeNumero: property.dpeNumero,
    description: property.description,
    imageUrl: property.imageUrl,
    propertyType: property.propertyType,
    dpeClass: property.dpeClass,
    gesClass: property.gesClass,
    dpeConsumptionKwhM2: property.dpeConsumptionKwhM2,
    gesEmissionKgM2: property.gesEmissionKgM2,
    bathrooms: property.bathrooms,
    constructionYear: property.constructionYear,
    heating: property.heating,
    orientation: property.orientation,
    propertyCondition: property.propertyCondition,
    parkingSpaces: property.parkingSpaces,
    highlights: property.highlights,
    firstSeenAt: property.firstSeenAt,
    publications: property.publications,
    url: property.url,
    source: property.source,
    scrapedAt: property.scrapedAt,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    compatibilityScore,
    reaction,
    archived,
  };
}

export async function serializeProperties(
  properties: PropertyRow[],
  reactionRepository: ReactionRepository,
  userId?: string,
  options?: { includeCompatibility?: boolean }
): Promise<Property[]> {
  return Promise.all(
    properties.map((property) =>
      serializeProperty(property, reactionRepository, userId, options)
    )
  );
}
