import { Prisma } from "../generated/prisma/client.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import {
  PROPERTY_SEARCH_CACHE_FIELDS,
  type PropertyProjectionShape,
} from "../domain/propertyFieldManifest.js";

export function toPrismaHighlights(
  highlights: string[] | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (highlights === undefined) return undefined;
  if (highlights === null) return Prisma.DbNull;
  return highlights;
}

export function toPrismaImageUrls(
  imageUrls: string[] | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (imageUrls === undefined) return undefined;
  if (imageUrls === null) return Prisma.DbNull;
  return imageUrls;
}

export function toPrismaImageLocalHashes(
  hashes: Record<string, string> | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (hashes === undefined) return undefined;
  if (hashes === null) return Prisma.DbNull;
  return hashes;
}

export function toPrismaImagePerceptualHashes(
  hashes: Record<string, string> | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (hashes === undefined) return undefined;
  if (hashes === null) return Prisma.DbNull;
  return hashes;
}

export function toPrismaPropertyPatch(patch: PropertyEnrichmentPatch) {
  const {
    highlights,
    imageUrls,
    imageLocalHashes,
    imagePerceptualHashes,
    ...rest
  } = patch;
  return {
    ...rest,
    ...(highlights !== undefined
      ? { highlights: toPrismaHighlights(highlights) }
      : {}),
    ...(imageUrls !== undefined
      ? { imageUrls: toPrismaImageUrls(imageUrls) }
      : {}),
    ...(imageLocalHashes !== undefined
      ? { imageLocalHashes: toPrismaImageLocalHashes(imageLocalHashes) }
      : {}),
    ...(imagePerceptualHashes !== undefined
      ? {
          imagePerceptualHashes: toPrismaImagePerceptualHashes(
            imagePerceptualHashes
          ),
        }
      : {}),
  };
}

const SEARCH_CACHE_FIELD_SET = new Set<string>(PROPERTY_SEARCH_CACHE_FIELDS);

export function toPrismaSearchCacheData(projection: PropertyProjectionShape) {
  const data: Record<string, unknown> = {};
  for (const field of PROPERTY_SEARCH_CACHE_FIELDS) {
    data[field] = projection[field];
  }
  return data;
}

/** @deprecated Use toPrismaSearchCacheData — Property stores search cache fields only. */
export function toPrismaProjectionData(projection: PropertyProjectionShape) {
  return toPrismaSearchCacheData(projection);
}

export function filterPropertySearchCachePatch(
  patch: PropertyEnrichmentPatch
): PropertyEnrichmentPatch {
  const filtered: PropertyEnrichmentPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (SEARCH_CACHE_FIELD_SET.has(key)) {
      (filtered as Record<string, unknown>)[key] = value;
    }
  }
  return filtered;
}
