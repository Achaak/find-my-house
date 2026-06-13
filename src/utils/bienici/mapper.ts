import type { PropertyEnrichmentPatch } from "../../types/enrichment.js";
import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energy/energyClass.js";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../energy/energyMetrics.js";
import type { GeoPoint } from "../geo/geo.js";
import { sanitizePositiveNumber } from "../listing/amenities.js";
import { extractBienIciListingExtras } from "./extras.js";

export type BienIciBlurInfo = {
  position?: { lat: number; lon: number };
  centroid?: { lat: number; lon: number };
};

export type BienIciAd = {
  id: string;
  title: string;
  price: number;
  surfaceArea?: number;
  landSurfaceArea?: number;
  gardenSurfaceArea?: number;
  roomsQuantity?: number;
  bedroomsQuantity?: number;
  newProperty?: boolean;
  blurInfo?: BienIciBlurInfo;
  city: string;
  postalCode?: string;
  description?: string;
  photos?: { url_photo: string }[];
  propertyType?: string;
  energyClassification?: string;
  greenhouseGazClassification?: string;
  energyConsumption?: number;
  greenhouseGazConsumption?: number;
  url?: string;
  bathroomsQuantity?: number;
  showerRoomsQuantity?: number;
  yearOfConstruction?: number;
  heating?: string;
  exposition?: string;
  parkingPlacesQuantity?: number;
  hasGarden?: boolean;
  hasCellar?: boolean;
  hasPool?: boolean;
  hasAirConditioning?: boolean;
  terracesQuantity?: number;
  workToDo?: boolean;
};

export function extractBienIciAdCoords(ad: BienIciAd): GeoPoint | null {
  const position = ad.blurInfo?.position ?? ad.blurInfo?.centroid;
  if (!position) return null;
  return { lat: position.lat, lng: position.lon };
}

function bienIciEnergyMetrics(ad: BienIciAd) {
  return mergeEnergyMetrics(
    {
      dpeConsumptionKwhM2: ad.energyConsumption ?? null,
      gesEmissionKgM2: ad.greenhouseGazConsumption ?? null,
    },
    parseEnergyMetricsFromText(ad.description)
  );
}

export function mapBienIciAdToListing(
  ad: BienIciAd,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  const url = ad.url ?? `https://www.bienici.com/annonce/${ad.id}`;
  const coords = extractBienIciAdCoords(ad);
  const metrics = bienIciEnergyMetrics(ad);
  const extras = extractBienIciListingExtras(ad);

  const trimmedTitle = ad.title.trim();
  const title =
    trimmedTitle !== ""
      ? trimmedTitle
      : (ad.propertyType?.trim() ?? "Property listing");

  return {
    externalId: ad.id,
    source: "bienici",
    title,
    price: ad.price,
    surface: sanitizePositiveNumber(ad.surfaceArea),
    landSurface: sanitizePositiveNumber(
      ad.landSurfaceArea ?? ad.gardenSurfaceArea
    ),
    rooms: sanitizePositiveNumber(ad.roomsQuantity),
    bedrooms: sanitizePositiveNumber(ad.bedroomsQuantity),
    isNewProperty: ad.newProperty ?? null,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    city: ad.city.trim() || fallbackCity,
    postalCode: ad.postalCode ?? null,
    url,
    description: ad.description ?? null,
    imageUrl: null,
    propertyType: ad.propertyType ?? null,
    dpeClass: normalizeEnergyClass(ad.energyClassification),
    gesClass: normalizeEnergyClass(ad.greenhouseGazClassification),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
    ...extras,
    scrapedAt,
  };
}

export function mapBienIciAdToEnrichmentPatch(
  ad: BienIciAd
): PropertyEnrichmentPatch {
  const position = ad.blurInfo?.position ?? ad.blurInfo?.centroid;
  const metrics = bienIciEnergyMetrics(ad);
  const extras = extractBienIciListingExtras(ad);

  return {
    description: ad.description ?? null,
    surface: ad.surfaceArea ?? null,
    landSurface: ad.landSurfaceArea ?? ad.gardenSurfaceArea ?? null,
    rooms: ad.roomsQuantity ?? null,
    bedrooms: ad.bedroomsQuantity ?? null,
    latitude: position?.lat ?? null,
    longitude: position?.lon ?? null,
    dpeClass: normalizeEnergyClass(ad.energyClassification),
    gesClass: normalizeEnergyClass(ad.greenhouseGazClassification),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
    ...extras,
  };
}
