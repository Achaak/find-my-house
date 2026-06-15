import type { ListingRepository } from "../db/listingRepository.js";
import {
  propertyNeedsEnrichment,
  type EnrichmentPurpose,
} from "../domain/enrichmentCriteria.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type {
  ListingSource,
  PropertyRow,
  PublicationRow,
} from "../types/listing.js";
import { formatSourceLabel } from "../discord/format.js";
import {
  fetchBienIciAdById,
  fetchBienIciListingHtml,
  mapBienIciAdToEnrichmentPatch,
  type BienIciAd,
} from "../utils/bienici/index.js";
import { parseOgImageFromHtml } from "../utils/html/ogImage.js";
import {
  mergeHighlights,
  highlightsSetsEqual,
} from "../utils/listing/amenities.js";
import { normalizeEnergyClass } from "../utils/energy/energyClass.js";
import {
  fetchLeboncoinAdById,
  fetchLeboncoinDetailById,
  mapLeboncoinAdToEnrichmentPatch,
} from "../utils/leboncoin/index.js";
import {
  fetchLogicImmoListingDetails,
  LogicImmoAccessBlockedError,
} from "../utils/logicimmo/index.js";
import {
  fetchSeLogerListingDetails,
  SeLogerAccessBlockedError,
} from "../utils/seloger/index.js";
import type { ClassifiedListingDetails } from "../utils/classifiedPortal/types.js";

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

type EnrichPublicationOptions = {
  purpose?: EnrichmentPurpose;
  skipImage?: boolean;
};

const ADDRESS_ENRICHMENT_FIELDS = [
  "surface",
  "latitude",
  "longitude",
  "dpeClass",
  "gesClass",
  "dpeConsumptionKwhM2",
  "gesEmissionKgM2",
] as const satisfies readonly (keyof PropertyEnrichmentPatch)[];

function pickPatchForPurpose(
  patch: PropertyEnrichmentPatch,
  purpose: EnrichmentPurpose
): PropertyEnrichmentPatch {
  if (purpose === "display") return patch;

  return pickDefined(
    Object.fromEntries(
      ADDRESS_ENRICHMENT_FIELDS.map((field) => [field, patch[field]])
    ) as PropertyEnrichmentPatch
  );
}

const SOURCE_PRIORITY: ListingSource[] = [
  "seloger",
  "logicimmo",
  "leboncoin",
  "bienici",
];

function pickDefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function mapClassifiedDetailsToEnrichmentPatch(
  details: ClassifiedListingDetails,
  options: EnrichPublicationOptions = {}
): PropertyEnrichmentPatch {
  return pickDefined({
    description: details.description,
    surface: details.surface,
    landSurface: details.landSurface,
    rooms: details.rooms,
    bedrooms: details.bedrooms,
    latitude: details.latitude,
    longitude: details.longitude,
    dpeClass: normalizeEnergyClass(details.dpeClass),
    gesClass: normalizeEnergyClass(details.gesClass),
    dpeConsumptionKwhM2: details.dpeConsumptionKwhM2,
    gesEmissionKgM2: details.gesEmissionKgM2,
    bathrooms: details.bathrooms,
    constructionYear: details.constructionYear,
    heating: details.heating,
    orientation: details.orientation,
    propertyCondition: details.propertyCondition,
    parkingSpaces: details.parkingSpaces,
    highlights: details.highlights,
    ...(options.skipImage ? {} : { imageUrl: details.imageUrl }),
  });
}

async function enrichFromSeLoger(
  publication: PublicationRow,
  options: EnrichPublicationOptions = {}
): Promise<PropertyEnrichmentPatch> {
  const details = await fetchSeLogerListingDetails(publication.url);
  return mapClassifiedDetailsToEnrichmentPatch(details, options);
}

async function enrichFromBienIci(
  publication: PublicationRow,
  options: EnrichPublicationOptions = {}
): Promise<PropertyEnrichmentPatch> {
  const ad = await fetchBienIciAdById<BienIciAd>(publication.externalId);
  if (!ad) return {};

  const patch = mapBienIciAdToEnrichmentPatch(ad);
  if (options.purpose === "address" || options.skipImage) {
    return pickPatchForPurpose(
      pickDefined(patch),
      options.purpose ?? "display"
    );
  }

  const html = await fetchBienIciListingHtml(publication.url);

  return pickPatchForPurpose(
    pickDefined({
      ...patch,
      imageUrl: parseOgImageFromHtml(html),
    }),
    options.purpose ?? "display"
  );
}

async function enrichFromLeboncoin(
  publication: PublicationRow,
  options: EnrichPublicationOptions = {}
): Promise<PropertyEnrichmentPatch> {
  if (options.skipImage) {
    const ad = await fetchLeboncoinAdById(publication.externalId);
    if (!ad) return {};
    return pickDefined(mapLeboncoinAdToEnrichmentPatch(ad));
  }

  const detail = await fetchLeboncoinDetailById(publication.externalId);
  if (!detail) return {};

  return pickDefined({
    ...mapLeboncoinAdToEnrichmentPatch(detail.ad),
    imageUrl: detail.imageUrl,
  });
}

async function enrichFromLogicImmo(
  publication: PublicationRow,
  options: EnrichPublicationOptions = {}
): Promise<PropertyEnrichmentPatch> {
  const details = await fetchLogicImmoListingDetails(publication.url);
  return mapClassifiedDetailsToEnrichmentPatch(details, options);
}

async function enrichFromPublication(
  publication: PublicationRow,
  options: EnrichPublicationOptions = {}
): Promise<PropertyEnrichmentPatch> {
  const purpose = options.purpose ?? "display";
  const publicationOptions: EnrichPublicationOptions = {
    ...options,
    purpose,
    skipImage: options.skipImage ?? purpose === "address",
  };

  let patch: PropertyEnrichmentPatch;
  switch (publication.source) {
    case "seloger":
      patch = await enrichFromSeLoger(publication, publicationOptions);
      break;
    case "logicimmo":
      patch = await enrichFromLogicImmo(publication, publicationOptions);
      break;
    case "bienici":
      patch = await enrichFromBienIci(publication, publicationOptions);
      break;
    case "leboncoin":
      patch = await enrichFromLeboncoin(publication, publicationOptions);
      break;
  }

  return pickPatchForPurpose(patch, purpose);
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
          },
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
      if (
        error instanceof SeLogerAccessBlockedError ||
        error instanceof LogicImmoAccessBlockedError
      ) {
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
    resultProperty = updated ?? property;
  }

  const marked = await repository.markEnrichmentAttempted(id, purpose);
  return { property: marked ?? resultProperty, warnings };
}
