import type { ListingRepository } from "../db/listingRepository.js";
import {
  propertyNeedsEnrichment,
  type EnrichmentPurpose,
} from "../domain/enrichmentCriteria.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { PropertyRow, PublicationRow } from "../types/listing.js";
import { formatSourceLabel } from "../discord/format.js";
import {
  mergeHighlights,
  highlightsSetsEqual,
} from "../utils/listing/amenities.js";
import {
  enrichFromPublication,
  isEnrichmentAccessBlockedError,
  SOURCE_PRIORITY,
} from "./enrichmentAdapters.js";

export type { PropertyEnrichmentPatch } from "../types/enrichment.js";

export type EnrichmentResult = {
  patch: PropertyEnrichmentPatch;
  patches: { publicationId: number; patch: PropertyEnrichmentPatch }[];
  updatedFields: string[];
  warnings: string[];
};

export type {
  EnrichmentPurpose,
  EnrichmentStatus,
} from "../domain/enrichmentCriteria.js";
export {
  getEnrichmentStatus,
  propertyNeedsEnrichment,
} from "../domain/enrichmentCriteria.js";

const DEDUP_STRUCTURE_FIELDS = new Set([
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
]);

function enrichmentTouchesDedupFields(updatedFields: string[]): boolean {
  return updatedFields.some((field) => DEDUP_STRUCTURE_FIELDS.has(field));
}

const ENRICHMENT_FIELDS = [
  "description",
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
  "latitude",
  "longitude",
  "imageUrl",
  "dpeClass",
  "gesClass",
  "dpeConsumptionKwhM2",
  "gesEmissionKgM2",
  "bathrooms",
  "constructionYear",
  "heating",
  "orientation",
  "propertyCondition",
  "parkingSpaces",
] as const satisfies readonly (keyof PropertyEnrichmentPatch)[];

function highlightsEqual(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean {
  return highlightsSetsEqual(left, right);
}

function mergePatches(
  property: PropertyRow,
  patches: PropertyEnrichmentPatch[]
): PropertyEnrichmentPatch {
  const merged: PropertyEnrichmentPatch = {};

  for (const field of ENRICHMENT_FIELDS) {
    const existing = property[field];
    if (existing !== null) {
      (merged as Record<string, unknown>)[field] = existing;
    }
  }

  for (const field of ENRICHMENT_FIELDS) {
    for (const patch of patches) {
      const value = patch[field];
      if (value === undefined || value === null) continue;
      if (merged[field] === undefined || merged[field] === null) {
        (merged as Record<string, unknown>)[field] = value;
      }
    }
  }

  const mergedHighlights = mergeHighlights(
    ...patches.map((patch) => patch.highlights)
  );
  if (mergedHighlights) {
    merged.highlights = mergedHighlights;
  }

  return merged;
}

function toPropertyLike(publication: PublicationRow): PropertyRow {
  return {
    id: 0,
    title: publication.title,
    price: publication.price,
    firstPrice: publication.price,
    surface: publication.surface,
    landSurface: publication.landSurface,
    rooms: publication.rooms,
    bedrooms: publication.bedrooms,
    isNewProperty: publication.isNewProperty,
    latitude: publication.latitude,
    longitude: publication.longitude,
    city: publication.city,
    postalCode: publication.postalCode,
    address: publication.address,
    dpeNumero: publication.dpeNumero,
    description: publication.description,
    imageUrl: publication.imageUrl,
    propertyType: publication.propertyType,
    dpeClass: publication.dpeClass,
    gesClass: publication.gesClass,
    dpeConsumptionKwhM2: publication.dpeConsumptionKwhM2,
    gesEmissionKgM2: publication.gesEmissionKgM2,
    bathrooms: publication.bathrooms,
    constructionYear: publication.constructionYear,
    heating: publication.heating,
    orientation: publication.orientation,
    propertyCondition: publication.propertyCondition,
    parkingSpaces: publication.parkingSpaces,
    highlights: publication.highlights,
    displayEnrichedAt: publication.displayEnrichedAt,
    addressEnrichedAt: publication.addressEnrichedAt,
    firstSeenAt: publication.scrapedAt,
    publications: [publication],
    url: publication.url,
    source: publication.source,
    scrapedAt: publication.scrapedAt,
    createdAt: publication.scrapedAt,
    updatedAt: publication.scrapedAt,
  };
}

function diffPatch(
  property: PropertyRow,
  patch: PropertyEnrichmentPatch
): PropertyEnrichmentPatch {
  const changes: PropertyEnrichmentPatch = {};

  for (const field of ENRICHMENT_FIELDS) {
    const value = patch[field];
    if (value === undefined || value === null) continue;
    if (property[field] !== value) {
      (changes as Record<string, unknown>)[field] = value;
    }
  }

  if (
    patch.highlights &&
    !highlightsEqual(property.highlights, patch.highlights)
  ) {
    changes.highlights = patch.highlights;
  }

  return changes;
}

export async function enrichProperty(
  property: PropertyRow,
  purpose: EnrichmentPurpose = "display"
): Promise<EnrichmentResult> {
  const publications =
    property.publications.length > 0 ? property.publications : [];
  if (publications.length === 0) {
    return { patch: {}, patches: [], updatedFields: [], warnings: [] };
  }

  const ordered = SOURCE_PRIORITY.flatMap((source) =>
    publications.filter((publication) => publication.source === source)
  );

  const patches: {
    publicationId: number;
    patch: PropertyEnrichmentPatch;
  }[] = [];
  const warnings: string[] = [];
  let resolvedImageUrl: string | null = null;

  for (const publication of ordered) {
    try {
      const patch = await enrichFromPublication(publication, {
        purpose,
        skipImage: resolvedImageUrl !== null,
      });
      const publicationPatch = diffPatch(toPropertyLike(publication), patch);
      patches.push({ publicationId: publication.id, patch: publicationPatch });
      if (resolvedImageUrl === null && patch.imageUrl) {
        resolvedImageUrl = patch.imageUrl;
      }
    } catch (error) {
      if (isEnrichmentAccessBlockedError(publication.source, error)) {
        warnings.push(
          `${formatSourceLabel(publication.source)} is blocking enrichment (${publication.url}). Try again later.`
        );
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${publication.source}: ${message}`);
    }
  }

  const merged = mergePatches(
    property,
    patches.map((entry) => entry.patch)
  );
  const patch = diffPatch(property, merged);
  const updatedFields = Object.keys(patch);

  return { patch, patches, updatedFields, warnings };
}

export async function ensurePropertyEnriched(
  repository: ListingRepository,
  id: number,
  purpose: EnrichmentPurpose
): Promise<{ property: PropertyRow | undefined; warnings: string[] }> {
  const property = await repository.findById(id);
  if (!property) return { property: undefined, warnings: [] };

  if (!propertyNeedsEnrichment(property, purpose)) {
    return { property, warnings: [] };
  }

  const { patches, updatedFields, warnings } = await enrichProperty(
    property,
    purpose
  );

  let resultProperty = property;
  for (const publicationPatch of patches) {
    if (Object.keys(publicationPatch.patch).length === 0) continue;
    const updated = await repository.applyPublicationEnrichment(
      publicationPatch.publicationId,
      publicationPatch.patch
    );
    if (updated.ok) {
      resultProperty = updated.value;
    } else {
      warnings.push(`Database update failed: ${updated.error}`);
    }
    const marked = await repository.markPublicationEnrichmentAttempted(
      publicationPatch.publicationId,
      purpose
    );
    if (marked.ok) {
      resultProperty = marked.value;
    } else {
      warnings.push(`Failed to mark enrichment attempt: ${marked.error}`);
    }
  }

  const marked = await repository.markEnrichmentAttempted(id, purpose);
  if (marked.ok) {
    resultProperty = marked.value;
    if (
      updatedFields.length > 0 &&
      enrichmentTouchesDedupFields(updatedFields)
    ) {
      if (resultProperty.postalCode) {
        await repository.reconcileDuplicates([resultProperty.postalCode]);
      }
    }
  } else {
    warnings.push(`Failed to mark enrichment attempt: ${marked.error}`);
  }

  return { property: resultProperty, warnings };
}
