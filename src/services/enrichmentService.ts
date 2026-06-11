import type { ListingRepository } from "../db/listingRepository.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type {
  ListingSource,
  PropertyRow,
  PublicationRow,
} from "../types/listing.js";
import {
  fetchBienIciAdById,
  mapBienIciAdToEnrichmentPatch,
  type BienIciAd,
} from "../utils/bienici/index.js";
import { normalizeEnergyClass } from "../utils/energy/energyClass.js";
import {
  fetchLeboncoinAdById,
  mapLeboncoinAdToEnrichmentPatch,
} from "../utils/leboncoin/index.js";
import {
  fetchSeLogerListingDetails,
  SeLogerAccessBlockedError,
} from "../utils/seloger/index.js";

export type { PropertyEnrichmentPatch } from "../types/enrichment.js";

export type EnrichmentResult = {
  patch: PropertyEnrichmentPatch;
  updatedFields: string[];
  warnings: string[];
};

export type EnrichmentPurpose = "display" | "address";

export function propertyNeedsEnrichment(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): boolean {
  const missingEnergy =
    property.dpeClass === null ||
    property.gesClass === null ||
    property.dpeConsumptionKwhM2 === null ||
    property.gesEmissionKgM2 === null;
  const missingCoords =
    property.latitude === null || property.longitude === null;
  const hasSeLogerPublication = property.publications.some(
    (publication) => publication.source === "seloger"
  );

  if (purpose === "address") {
    return (
      missingEnergy ||
      property.surface === null ||
      (hasSeLogerPublication && missingCoords)
    );
  }

  return (
    missingEnergy ||
    property.landSurface === null ||
    property.description === null ||
    (hasSeLogerPublication && missingCoords)
  );
}

const SOURCE_PRIORITY: ListingSource[] = ["seloger", "bienici", "leboncoin"];

function pickDefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

async function enrichFromSeLoger(
  publication: PublicationRow
): Promise<PropertyEnrichmentPatch> {
  const details = await fetchSeLogerListingDetails(publication.url);
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
  });
}

async function enrichFromBienIci(
  publication: PublicationRow
): Promise<PropertyEnrichmentPatch> {
  const ad = await fetchBienIciAdById<BienIciAd>(publication.externalId);
  if (!ad) return {};

  return pickDefined(mapBienIciAdToEnrichmentPatch(ad));
}

async function enrichFromLeboncoin(
  publication: PublicationRow
): Promise<PropertyEnrichmentPatch> {
  const ad = await fetchLeboncoinAdById(publication.externalId);
  if (!ad) return {};

  return pickDefined(mapLeboncoinAdToEnrichmentPatch(ad));
}

async function enrichFromPublication(
  publication: PublicationRow
): Promise<PropertyEnrichmentPatch> {
  switch (publication.source) {
    case "seloger":
      return enrichFromSeLoger(publication);
    case "bienici":
      return enrichFromBienIci(publication);
    case "leboncoin":
      return enrichFromLeboncoin(publication);
  }
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
] as const satisfies readonly (keyof PropertyEnrichmentPatch)[];

function mergePatches(
  patches: PropertyEnrichmentPatch[]
): PropertyEnrichmentPatch {
  const merged: PropertyEnrichmentPatch = {};

  for (const field of ENRICHMENT_FIELDS) {
    for (const patch of patches) {
      const value = patch[field];
      if (value === undefined || value === null) continue;
      if (merged[field] === undefined || merged[field] === null) {
        (merged as Record<string, unknown>)[field] = value;
      }
    }
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

  return changes;
}

export async function enrichProperty(
  property: PropertyRow
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
            scrapedAt: property.scrapedAt,
          },
        ];

  const ordered = SOURCE_PRIORITY.flatMap((source) =>
    publications.filter((publication) => publication.source === source)
  );

  const patches: PropertyEnrichmentPatch[] = [];
  const warnings: string[] = [];

  for (const publication of ordered) {
    try {
      patches.push(await enrichFromPublication(publication));
    } catch (error) {
      if (error instanceof SeLogerAccessBlockedError) {
        warnings.push(
          `SeLoger bloque l'enrichissement (${publication.url}). Réessayez plus tard.`
        );
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${publication.source}: ${message}`);
    }
  }

  const merged = mergePatches(patches);
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

  const { patch, updatedFields, warnings } = await enrichProperty(property);
  if (updatedFields.length === 0) {
    return { property, warnings };
  }

  const updated = await repository.applyEnrichment(id, patch);
  return { property: updated ?? property, warnings };
}
