import type { ListingRepository } from "../db/listingRepository.js";
import {
  publicationHasIncompleteLocalImages,
  propertyNeedsDisplayRefresh,
  propertyNeedsDisplayWork,
  propertyNeedsEnrichment,
  type EnrichmentPurpose,
} from "../domain/enrichmentCriteria.js";
import { isTruncatedPortalDescription } from "../utils/classifiedPortal/parsers/detailDescription.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { PropertyRow, PublicationRow } from "../types/listing.js";
import { formatSourceLabel } from "../utils/listing/sourceLabel.js";
import {
  mergeHighlights,
  highlightsSetsEqual,
} from "../utils/listing/amenities.js";
import {
  enrichFromPublication,
  isEnrichmentAccessBlockedError,
  SOURCE_PRIORITY,
} from "./enrichmentAdapters.js";
import { downloadPublicationImages } from "./imageDownloadService.js";
import {
  filterSyndicatedPhotoUrls,
  firstPhotoUrl,
  SYNDICATED_PHOTO_MIN_PROPERTY_COUNT,
} from "../utils/images/filterSyndicatedPhotoUrls.js";
import { mergePublicationImageUrls } from "../utils/images/mergePublicationImageUrls.js";

export type { PropertyEnrichmentPatch } from "../types/enrichment.js";

export type EnrichmentResult = {
  patch: PropertyEnrichmentPatch;
  patches: { publicationId: number; patch: PropertyEnrichmentPatch }[];
  updatedFields: string[];
  warnings: string[];
};

export type EnrichmentOptions = {
  blockedPhotoUrlKeys?: ReadonlySet<string>;
};

function applyBlockedPhotoUrlsToPatch(
  publication: PublicationRow,
  patch: PropertyEnrichmentPatch,
  blockedPhotoUrlKeys: ReadonlySet<string> | undefined
): PropertyEnrichmentPatch {
  const shouldFilterImages =
    Boolean(patch.imageUrls) ||
    Boolean(blockedPhotoUrlKeys?.size && publication.imageUrls?.length);

  if (!shouldFilterImages) {
    return patch;
  }

  const blocked = blockedPhotoUrlKeys ?? new Set<string>();
  const filteredExisting = filterSyndicatedPhotoUrls(
    publication.imageUrls,
    blocked
  );
  const filteredIncoming = filterSyndicatedPhotoUrls(patch.imageUrls, blocked);
  const mergedImageUrls = mergePublicationImageUrls(
    filteredExisting,
    filteredIncoming
  );

  return {
    ...patch,
    imageUrls: mergedImageUrls,
    imageUrl:
      firstPhotoUrl(mergedImageUrls) ?? patch.imageUrl ?? publication.imageUrl,
  };
}

export type {
  EnrichmentPurpose,
  EnrichmentStatus,
} from "../domain/enrichmentCriteria.js";
export {
  getEnrichmentStatus,
  propertyNeedsDisplayRefresh,
  propertyNeedsDisplayWork,
  propertyNeedsEnrichment,
} from "../domain/enrichmentCriteria.js";

/** @deprecated Prefer propertyNeedsDisplayWork */
export function needsDisplayEnrichmentWork(property: PropertyRow): boolean {
  return propertyNeedsDisplayWork(property);
}

const DEDUP_STRUCTURE_FIELDS = new Set([
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
]);

function enrichmentTouchesDedupFields(updatedFields: string[]): boolean {
  return updatedFields.some((field) => DEDUP_STRUCTURE_FIELDS.has(field));
}

const PROPERTY_ENRICHMENT_FIELDS = [
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
  "latitude",
  "longitude",
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

const PUBLICATION_ENRICHMENT_FIELDS = [
  ...PROPERTY_ENRICHMENT_FIELDS,
  "description",
  "imageUrl",
  "imageUrls",
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

  for (const field of PROPERTY_ENRICHMENT_FIELDS) {
    const existing = property[field];
    if (existing !== null) {
      (merged as Record<string, unknown>)[field] = existing;
    }
  }

  for (const field of PROPERTY_ENRICHMENT_FIELDS) {
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

function imageUrlListsEqual(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) return false;
  return a.every((url, index) => url === b[index]);
}

function diffPublicationPatch(
  publication: PublicationRow,
  patch: PropertyEnrichmentPatch
): PropertyEnrichmentPatch {
  const changes: PropertyEnrichmentPatch = {};

  for (const field of PUBLICATION_ENRICHMENT_FIELDS) {
    const value = patch[field];
    if (value === undefined || value === null) continue;
    if (field === "imageUrls") {
      if (!imageUrlListsEqual(publication.imageUrls, value as string[])) {
        (changes as Record<string, unknown>)[field] = value;
      }
      continue;
    }
    if (field === "description") {
      const existing = publication.description;
      const incoming = value as string;
      if (
        !existing ||
        incoming.length > existing.length ||
        (isTruncatedPortalDescription(existing) &&
          !isTruncatedPortalDescription(incoming))
      ) {
        changes.description = incoming;
      }
      continue;
    }
    if (publication[field as keyof PublicationRow] !== value) {
      (changes as Record<string, unknown>)[field] = value;
    }
  }

  if (
    patch.highlights &&
    !highlightsEqual(publication.highlights, patch.highlights)
  ) {
    changes.highlights = patch.highlights;
  }

  return changes;
}

function diffPatch(
  property: PropertyRow,
  patch: PropertyEnrichmentPatch
): PropertyEnrichmentPatch {
  const changes: PropertyEnrichmentPatch = {};

  for (const field of PROPERTY_ENRICHMENT_FIELDS) {
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
  purpose: EnrichmentPurpose = "display",
  options: EnrichmentOptions = {}
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

  for (const publication of ordered) {
    try {
      const patch = await enrichFromPublication(publication, {
        purpose,
        skipImage: purpose === "address",
      });
      const mergedImages = applyBlockedPhotoUrlsToPatch(
        publication,
        patch,
        options.blockedPhotoUrlKeys
      );
      const publicationPatch = diffPublicationPatch(publication, mergedImages);
      patches.push({ publicationId: publication.id, patch: publicationPatch });
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

  const needsDisplayWork =
    purpose === "display"
      ? propertyNeedsDisplayWork(property)
      : propertyNeedsEnrichment(property, purpose);

  if (!needsDisplayWork) {
    return { property, warnings: [] };
  }

  const blockedPhotoUrlKeys = await repository.findOverusedPhotoUrlKeys(
    SYNDICATED_PHOTO_MIN_PROPERTY_COUNT
  );

  const warnings: string[] = [];
  let resultProperty = property;
  const needsPortalFetch =
    purpose === "address"
      ? propertyNeedsEnrichment(property, purpose)
      : propertyNeedsEnrichment(property, "display") ||
        propertyNeedsDisplayRefresh(property);

  if (needsPortalFetch) {
    const {
      patches,
      updatedFields,
      warnings: enrichWarnings,
    } = await enrichProperty(property, purpose, { blockedPhotoUrlKeys });
    warnings.push(...enrichWarnings);

    for (const publicationPatch of patches) {
      if (Object.keys(publicationPatch.patch).length > 0) {
        const updated = await repository.applyPublicationEnrichment(
          publicationPatch.publicationId,
          publicationPatch.patch
        );
        if (updated.ok) {
          resultProperty = updated.value;
        } else {
          warnings.push(`Database update failed: ${updated.error}`);
        }
      }
    }

    if (purpose === "address") {
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
    }

    if (
      purpose === "display" &&
      updatedFields.length > 0 &&
      enrichmentTouchesDedupFields(updatedFields)
    ) {
      if (resultProperty.postalCode) {
        await repository.reconcileDuplicates([resultProperty.postalCode]);
      }
    }
  }

  if (purpose === "display") {
    for (const publication of resultProperty.publications) {
      if (!publication.isActive) {
        continue;
      }

      const needsFirst = publication.enrichedAt === null;
      const needsImages = publicationHasIncompleteLocalImages(publication);
      if (!needsFirst && !needsImages) {
        continue;
      }

      const galleryUrls = filterSyndicatedPhotoUrls(
        publication.imageUrls,
        blockedPhotoUrlKeys
      );

      if (galleryUrls?.length) {
        const { localHashes, perceptualHashes } =
          await downloadPublicationImages(
            galleryUrls,
            publication.imageLocalHashes,
            publication.imagePerceptualHashes
          );
        const galleryUpdated = await repository.applyPublicationGallery(
          publication.id,
          {
            imageUrls: galleryUrls,
            imageLocalHashes: localHashes,
            imagePerceptualHashes: perceptualHashes,
          }
        );
        if (galleryUpdated.ok) {
          resultProperty = galleryUpdated.value;
        } else {
          warnings.push(`Gallery update failed: ${galleryUpdated.error}`);
        }
      } else if (publication.imageLocalHashes === null) {
        const galleryUpdated = await repository.applyPublicationGallery(
          publication.id,
          { imageLocalHashes: {} }
        );
        if (galleryUpdated.ok) {
          resultProperty = galleryUpdated.value;
        } else {
          warnings.push(`Gallery update failed: ${galleryUpdated.error}`);
        }
      }

      if (needsFirst) {
        const marked = await repository.markPublicationEnrichmentAttempted(
          publication.id,
          purpose
        );
        if (marked.ok) {
          resultProperty = marked.value;
        } else {
          warnings.push(`Failed to mark enrichment attempt: ${marked.error}`);
        }
      }
    }
  }

  return { property: resultProperty, warnings };
}
