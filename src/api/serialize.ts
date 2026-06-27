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
  PropertyPublicationDetail,
  PropertyPublicationDescription,
  PropertyReactionState,
} from "./types.js";
import type { ReactionType } from "../db/reactionRepository.js";
import { descriptionsAreEquivalent } from "../domain/descriptionEquivalence.js";
import {
  computePropertyDescription,
  computePropertyImageUrl,
} from "../domain/propertyDisplayFields.js";
import {
  mergePropertyPhotos,
  type PropertyPhoto,
} from "../domain/publicationImages.js";
import type { ListingSource } from "./types.js";

type ReactionSnapshot = { type: ReactionType; archivedAt: Date | null };

const PUBLICATION_DELTA_FIELDS = [
  "price",
  "description",
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
] as const;

const PUBLICATION_SOURCE_PRIORITY: ListingSource[] = [
  "bienici",
  "seloger",
  "logicimmo",
  "leboncoin",
];

function publicationSourceRank(source: ListingSource): number {
  const index = PUBLICATION_SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? PUBLICATION_SOURCE_PRIORITY.length : index;
}

function serializePhotos(property: PropertyRow): PropertyPhoto[] {
  const photos = mergePropertyPhotos(
    property.publications.map((publication) => ({
      id: publication.id,
      source: publication.source,
      imageUrls: publication.imageUrls,
      imageLocalHashes: publication.imageLocalHashes,
      imagePerceptualHashes: publication.imagePerceptualHashes,
      isActive: publication.isActive,
    }))
  );

  if (photos.length > 0) return photos;

  const fallbackImageUrl = computePropertyImageUrl(property.publications);
  const primaryPublication = property.publications.find(
    (publication) => publication.isActive
  );
  if (fallbackImageUrl && primaryPublication) {
    return [
      {
        url: fallbackImageUrl,
        source: primaryPublication.source,
        publicationId: primaryPublication.id,
      },
    ];
  }

  return [];
}

function serializePublicationDetails(
  property: PropertyRow
): PropertyPublicationDetail[] {
  const projectedDescription = computePropertyDescription(
    property.publications
  );

  return property.publications
    .filter((publication) => publication.isActive)
    .map((publication) => {
      const photos = mergePropertyPhotos([
        {
          id: publication.id,
          source: publication.source,
          imageUrls: publication.imageUrls,
          imageLocalHashes: publication.imageLocalHashes,
          imagePerceptualHashes: publication.imagePerceptualHashes,
          isActive: publication.isActive,
        },
      ]);

      const detail: PropertyPublicationDetail = {
        id: publication.id,
        externalId: publication.externalId,
        source: publication.source,
        url: publication.url,
        isActive: publication.isActive,
        scrapedAt: publication.scrapedAt,
        price: publication.price,
        description: publication.description,
        surface: publication.surface,
        landSurface: publication.landSurface,
        rooms: publication.rooms,
        bedrooms: publication.bedrooms,
        photos,
      };

      return detail;
    })
    .filter((detail) =>
      PUBLICATION_DELTA_FIELDS.some((field) => {
        switch (field) {
          case "price":
            return detail.price !== property.price;
          case "description":
            return !descriptionsAreEquivalent(
              detail.description,
              projectedDescription
            );
          case "surface":
            return detail.surface !== property.surface;
          case "landSurface":
            return detail.landSurface !== property.landSurface;
          case "rooms":
            return detail.rooms !== property.rooms;
          case "bedrooms":
            return detail.bedrooms !== property.bedrooms;
        }
      })
    );
}

function serializePublicationDescriptions(
  property: PropertyRow
): PropertyPublicationDescription[] {
  return [...property.publications]
    .flatMap((publication) => {
      if (!publication.isActive) return [];
      const description = publication.description?.trim();
      if (!description) return [];
      return [
        {
          id: publication.id,
          externalId: publication.externalId,
          source: publication.source,
          url: publication.url,
          isActive: publication.isActive,
          scrapedAt: publication.scrapedAt,
          description,
        },
      ];
    })
    .sort((a, b) => {
      const rankDelta =
        publicationSourceRank(a.source) - publicationSourceRank(b.source);
      if (rankDelta !== 0) return rankDelta;
      return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime();
    });
}

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
    description: computePropertyDescription(property.publications),
    imageUrl: computePropertyImageUrl(property.publications),
    photos: serializePhotos(property),
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

  const base = serializePropertyRow(property, {
    ...options,
    model,
    reaction,
    includeCompatibilityDetail: true,
  });

  return {
    ...base,
    publicationDetails: serializePublicationDetails(property),
    publicationDescriptions: serializePublicationDescriptions(property),
  };
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
