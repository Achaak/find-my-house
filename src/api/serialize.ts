import type {
  ReactionRepository,
  ReactionType,
} from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import {
  getListingCompatibilityScore,
  resolveListingCompatibilityPreferences,
} from "../services/compatibilityService.js";
import type { RankedDpeSearchResult } from "../utils/energy/dpePropertyMatch.js";
import type { DpeCandidate, Property, PropertyReactionState } from "./types.js";

type ReactionSnapshot = { type: ReactionType; archivedAt: Date | null };

export type SerializeBatchContext = {
  preferences: CompatibilityPreferences | null;
  reactions: Map<number, ReactionSnapshot>;
};

export function serializeDpeCandidate(
  candidate: RankedDpeSearchResult
): DpeCandidate {
  return {
    numeroDpe: candidate.numeroDpe,
    address: candidate.address,
    postalCode: candidate.postalCode,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    score: candidate.matchScore,
    dpeClass: candidate.dpeClass,
    surface: candidate.surfaceM2,
  };
}

function serializePropertyRow(
  property: PropertyRow,
  options?: {
    includeCompatibility?: boolean;
    userId?: string;
    batch?: SerializeBatchContext;
    preferences?: CompatibilityPreferences | null;
    reaction?: ReactionSnapshot | null;
  }
): Property {
  const includeCompatibility = options?.includeCompatibility !== false;
  const userId = options?.userId;
  const preferences =
    options?.preferences ?? options?.batch?.preferences ?? null;
  const existingReaction =
    options?.reaction !== undefined
      ? options.reaction
      : (options?.batch?.reactions.get(property.id) ?? null);

  let compatibilityScore: number | undefined;
  if (includeCompatibility && userId) {
    compatibilityScore = getListingCompatibilityScore(property, preferences);
  }

  let reaction: PropertyReactionState = null;
  let archived = false;
  if (existingReaction) {
    reaction = existingReaction.type;
    archived = existingReaction.archivedAt !== null;
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

export async function serializeProperty(
  property: PropertyRow,
  reactionRepository: ReactionRepository,
  userId?: string,
  options?: { includeCompatibility?: boolean }
): Promise<Property> {
  if (!userId) {
    return serializePropertyRow(property, options);
  }

  const preferences =
    options?.includeCompatibility !== false
      ? await resolveListingCompatibilityPreferences(reactionRepository, userId)
      : null;
  const reaction = await reactionRepository.getReaction(userId, property.id);

  return serializePropertyRow(property, {
    ...options,
    userId,
    preferences,
    reaction,
  });
}

export async function serializeProperties(
  properties: PropertyRow[],
  reactionRepository: ReactionRepository,
  userId?: string,
  options?: { includeCompatibility?: boolean }
): Promise<Property[]> {
  if (!userId || properties.length === 0) {
    return properties.map((property) =>
      serializePropertyRow(property, options)
    );
  }

  const includeCompatibility = options?.includeCompatibility !== false;
  const [preferences, reactions] = await Promise.all([
    includeCompatibility
      ? resolveListingCompatibilityPreferences(reactionRepository, userId)
      : Promise.resolve(null),
    reactionRepository.getReactionsForProperties(
      userId,
      properties.map((property) => property.id)
    ),
  ]);

  const batch: SerializeBatchContext = { preferences, reactions };

  return properties.map((property) =>
    serializePropertyRow(property, { ...options, userId, batch })
  );
}
