import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityModel } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import {
  buildListingCompatibilityRanks,
  getListingCompatibilityCard,
  getListingCompatibilityDetail,
  resolveCompatibilityModel,
} from "../services/compatibilityService.js";
import type { RankedDpeSearchResult } from "../utils/energy/dpePropertyMatch.js";
import type {
  CompatibilityCard,
  CompatibilityDetail,
  DpeCandidate,
  Property,
  PropertyCard,
  PropertyDetail,
  PropertyReactionState,
} from "./types.js";
import type { ReactionType } from "../db/reactionRepository.js";

type ReactionSnapshot = { type: ReactionType; archivedAt: Date | null };

export type SerializeBatchContext = {
  model: CompatibilityModel | null;
  reactions: Map<number, ReactionSnapshot>;
  ranks: Map<number, { rank: number; rankTotal: number }>;
  includeDetail?: boolean;
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

function serializeCompatibility(
  property: PropertyRow,
  model: CompatibilityModel | null,
  options?: {
    rank?: { rank: number; rankTotal: number };
    detail?: boolean;
  }
): CompatibilityCard | CompatibilityDetail | undefined {
  if (!model) return undefined;

  if (options?.detail) {
    return getListingCompatibilityDetail(property, model, options.rank);
  }

  return getListingCompatibilityCard(property, model, options?.rank);
}

export function serializePropertyRow(
  property: PropertyRow,
  options?: {
    includeCompatibility?: boolean;
    batch?: SerializeBatchContext;
    model?: CompatibilityModel | null;
    reaction?: ReactionSnapshot | null;
    includeCompatibilityDetail?: boolean;
  }
): Property {
  const includeCompatibility = options?.includeCompatibility !== false;
  const model = options?.model ?? options?.batch?.model ?? null;
  const existingReaction =
    options?.reaction !== undefined
      ? options.reaction
      : (options?.batch?.reactions.get(property.id) ?? null);

  const rank = options?.batch?.ranks.get(property.id);
  const includeDetail =
    options?.includeCompatibilityDetail ??
    options?.batch?.includeDetail ??
    false;

  const compatibility = includeCompatibility
    ? serializeCompatibility(property, model, { rank, detail: includeDetail })
    : undefined;

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
    compatibility,
    reaction,
    archived,
  };
}

export async function serializeProperty(
  property: PropertyRow,
  reactionRepository: ReactionRepository,
  options?: { includeCompatibility?: boolean }
): Promise<PropertyDetail> {
  const includeCompatibility = options?.includeCompatibility !== false;
  const [model, reaction] = await Promise.all([
    includeCompatibility
      ? resolveCompatibilityModel(reactionRepository)
      : Promise.resolve(null),
    reactionRepository.getReaction(property.id),
  ]);

  return serializePropertyRow(property, {
    ...options,
    model,
    reaction,
    includeCompatibilityDetail: true,
  });
}

export async function serializeProperties(
  properties: PropertyRow[],
  reactionRepository: ReactionRepository,
  options?: {
    includeCompatibility?: boolean;
    includeRanks?: boolean;
  }
): Promise<PropertyCard[]> {
  if (properties.length === 0) {
    return [];
  }

  const includeCompatibility = options?.includeCompatibility !== false;
  const [model, reactions] = await Promise.all([
    includeCompatibility
      ? resolveCompatibilityModel(reactionRepository)
      : Promise.resolve(null),
    reactionRepository.getReactionsForProperties(
      properties.map((property) => property.id)
    ),
  ]);

  const ranks =
    includeCompatibility && (options?.includeRanks ?? true)
      ? buildListingCompatibilityRanks(properties, model)
      : new Map<number, { rank: number; rankTotal: number }>();

  const batch: SerializeBatchContext = { model, reactions, ranks };

  return properties.map((property) =>
    serializePropertyRow(property, { ...options, batch })
  );
}
