import type { ListingRepository } from "../db/listingRepository.js";
import type {
  ListingSource,
  PropertyRow,
  PublicationRow,
} from "../types/listing.js";
import { fetchBienIciAdById } from "../utils/bieniciApi.js";
import { normalizeEnergyClass } from "../utils/energyClass.js";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../utils/energyMetrics.js";
import {
  fetchLeboncoinAdById,
  getLeboncoinAttribute,
  parseLeboncoinNumber,
} from "../utils/leboncoinApi.js";
import {
  fetchSeLogerListingDetails,
  SeLogerAccessBlockedError,
} from "../utils/selogerApi.js";

export type PropertyEnrichmentPatch = {
  description?: string | null;
  surface?: number | null;
  landSurface?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  dpeClass?: string | null;
  gesClass?: string | null;
  dpeConsumptionKwhM2?: number | null;
  gesEmissionKgM2?: number | null;
};

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

  if (purpose === "address") {
    return missingEnergy || property.surface === null;
  }

  return (
    missingEnergy ||
    property.landSurface === null ||
    property.description === null
  );
}

type BienIciAd = {
  id: string;
  description?: string;
  surfaceArea?: number;
  landSurfaceArea?: number;
  roomsQuantity?: number;
  bedroomsQuantity?: number;
  blurInfo?: {
    position?: { lat: number; lon: number };
    centroid?: { lat: number; lon: number };
  };
  photos?: { url_photo: string }[];
  energyClassification?: string;
  greenhouseGazClassification?: string;
  energyConsumption?: number;
  greenhouseGazConsumption?: number;
};

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

  const position = ad.blurInfo?.position ?? ad.blurInfo?.centroid;
  const metrics = mergeEnergyMetrics(
    {
      dpeConsumptionKwhM2: ad.energyConsumption ?? null,
      gesEmissionKgM2: ad.greenhouseGazConsumption ?? null,
    },
    parseEnergyMetricsFromText(ad.description)
  );

  return pickDefined({
    description: ad.description ?? null,
    surface: ad.surfaceArea ?? null,
    landSurface: ad.landSurfaceArea ?? null,
    rooms: ad.roomsQuantity ?? null,
    bedrooms: ad.bedroomsQuantity ?? null,
    latitude: position?.lat ?? null,
    longitude: position?.lon ?? null,
    imageUrl: ad.photos?.[0]?.url_photo ?? null,
    dpeClass: normalizeEnergyClass(ad.energyClassification),
    gesClass: normalizeEnergyClass(ad.greenhouseGazClassification),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
  });
}

async function enrichFromLeboncoin(
  publication: PublicationRow
): Promise<PropertyEnrichmentPatch> {
  const ad = await fetchLeboncoinAdById(publication.externalId);
  if (!ad) return {};

  const metrics = mergeEnergyMetrics(
    {
      dpeConsumptionKwhM2:
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "energy_consumption")) ??
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "dpe_consumption")),
      gesEmissionKgM2:
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "ges_emission")) ??
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "ghg_emission")),
    },
    parseEnergyMetricsFromText(ad.body)
  );

  return pickDefined({
    description: ad.body ?? null,
    surface: parseLeboncoinNumber(getLeboncoinAttribute(ad, "square")),
    landSurface: parseLeboncoinNumber(
      getLeboncoinAttribute(ad, "land_plot_surface")
    ),
    rooms: parseLeboncoinNumber(getLeboncoinAttribute(ad, "rooms")),
    bedrooms: parseLeboncoinNumber(getLeboncoinAttribute(ad, "bedrooms")),
    latitude: ad.location.lat,
    longitude: ad.location.lng,
    imageUrl:
      ad.images?.urls_large?.[0] ??
      ad.images?.urls?.[0] ??
      ad.images?.thumb_url ??
      null,
    dpeClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "energy_rate")),
    gesClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "ges")),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
  });
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
