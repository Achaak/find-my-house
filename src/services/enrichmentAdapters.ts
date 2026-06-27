import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { ListingSource, PublicationRow } from "../types/listing.js";
import {
  fetchBienIciAdById,
  mapBienIciAdToEnrichmentPatch,
  type BienIciAd,
} from "../utils/bienici/index.js";
import { normalizeEnergyClass } from "../utils/energy/energyClass.js";
import {
  fetchLeboncoinAdById,
  fetchLeboncoinDetailById,
  mapLeboncoinAdToEnrichmentPatch,
} from "../utils/leboncoin/index.js";
import { leboncoinScrapeImageUrls } from "../utils/images/scrapeImageUrls.js";
import { ClassifiedPortalAccessBlockedError } from "../utils/classifiedPortal/index.js";
import type { ClassifiedListingDetails } from "../utils/classifiedPortal/types.js";
import { fetchLogicImmoListingDetails } from "../utils/logicimmo/index.js";
import { fetchSeLogerListingDetails } from "../utils/seloger/index.js";

export type EnrichmentPurpose = "display" | "address";

export type EnrichPublicationOptions = {
  purpose?: EnrichmentPurpose;
  skipImage?: boolean;
};

export type EnrichmentAdapter = {
  enrich(
    publication: PublicationRow,
    options: EnrichPublicationOptions
  ): Promise<PropertyEnrichmentPatch>;
  isAccessBlockedError?(error: unknown): boolean;
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

function pickDefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

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
    ...(options.skipImage
      ? {}
      : {
          imageUrl: details.imageUrl,
          imageUrls: details.imageUrls,
        }),
  });
}

function classifiedPortalAdapter(
  fetchDetails: (url: string) => Promise<ClassifiedListingDetails>
): EnrichmentAdapter {
  return {
    async enrich(publication, options) {
      const details = await fetchDetails(publication.url);
      return mapClassifiedDetailsToEnrichmentPatch(details, options);
    },
    isAccessBlockedError(error) {
      return error instanceof ClassifiedPortalAccessBlockedError;
    },
  };
}

const bieniciAdapter: EnrichmentAdapter = {
  async enrich(publication, options = {}) {
    const purpose = options.purpose ?? "display";
    const ad = await fetchBienIciAdById<BienIciAd>(publication.externalId);
    if (!ad) return {};

    const patch = mapBienIciAdToEnrichmentPatch(ad);
    if (purpose === "address" || options.skipImage) {
      const { imageUrl: _imageUrl, imageUrls: _imageUrls, ...rest } = patch;
      return pickPatchForPurpose(pickDefined(rest), purpose);
    }

    return pickPatchForPurpose(pickDefined(patch), purpose);
  },
};

const leboncoinAdapter: EnrichmentAdapter = {
  async enrich(publication, options = {}) {
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
      imageUrls:
        leboncoinScrapeImageUrls(detail.ad) ??
        (detail.imageUrl ? [detail.imageUrl] : null),
    });
  },
};

export const ENRICHMENT_ADAPTERS: Record<ListingSource, EnrichmentAdapter> = {
  seloger: classifiedPortalAdapter(fetchSeLogerListingDetails),
  logicimmo: classifiedPortalAdapter(fetchLogicImmoListingDetails),
  bienici: bieniciAdapter,
  leboncoin: leboncoinAdapter,
};

export const SOURCE_PRIORITY: ListingSource[] = [
  "seloger",
  "logicimmo",
  "leboncoin",
  "bienici",
];

export async function enrichFromPublication(
  publication: PublicationRow,
  options: EnrichPublicationOptions = {}
): Promise<PropertyEnrichmentPatch> {
  const purpose = options.purpose ?? "display";
  const publicationOptions: EnrichPublicationOptions = {
    ...options,
    purpose,
    skipImage: options.skipImage ?? purpose === "address",
  };

  const adapter = ENRICHMENT_ADAPTERS[publication.source];
  const patch = await adapter.enrich(publication, publicationOptions);
  return pickPatchForPurpose(patch, purpose);
}

export function isEnrichmentAccessBlockedError(
  source: ListingSource,
  error: unknown
): boolean {
  return ENRICHMENT_ADAPTERS[source].isAccessBlockedError?.(error) ?? false;
}
