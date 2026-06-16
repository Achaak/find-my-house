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
    property.publications.length > 0
      ? property.publications
      : [
          {
            id: 0,
            externalId: "",
            source: property.source,
            url: property.url,
            isActive: true,
            scrapedAt: property.scrapedAt,
          } satisfies PublicationRow,
        ];

  const ordered = SOURCE_PRIORITY.flatMap((source) =>
    publications.filter((publication) => publication.source === source)
  );

  const patches: PropertyEnrichmentPatch[] = [];
  const warnings: string[] = [];
  let resolvedImageUrl: string | null = null;

  for (const publication of ordered) {
    try {
      const patch = await enrichFromPublication(publication, {
        purpose,
        skipImage: resolvedImageUrl !== null,
      });
      patches.push(patch);
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

  const merged = mergePatches(property, patches);
  const patch = diffPatch(property, merged);
  const updatedFields = Object.keys(patch);

  return { patch, updatedFields, warnings };
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

  const { patch, updatedFields, warnings } = await enrichProperty(
    property,
    purpose
  );

  let resultProperty = property;
  if (updatedFields.length > 0) {
    const updated = await repository.applyEnrichment(id, patch);
    if (updated.ok) {
      resultProperty = updated.value;
      if (
        enrichmentTouchesDedupFields(updatedFields) &&
        resultProperty.postalCode
      ) {
        await repository.reconcileDuplicates([resultProperty.postalCode]);
      }
    } else {
      warnings.push(`Database update failed: ${updated.error}`);
    }
  }

  const marked = await repository.markEnrichmentAttempted(id, purpose);
  if (marked.ok) {
    resultProperty = marked.value;
  } else {
    warnings.push(`Failed to mark enrichment attempt: ${marked.error}`);
  }

  return { property: resultProperty, warnings };
}
