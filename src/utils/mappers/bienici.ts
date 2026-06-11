import type { PropertyEnrichmentPatch } from "../../types/enrichment.js";
import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energyClass.js";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../energyMetrics.js";
import type { GeoPoint } from "../geo.js";

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

  return {
    externalId: ad.id,
    source: "bienici",
    title: ad.title,
    price: ad.price,
    surface: ad.surfaceArea ?? null,
    landSurface: ad.landSurfaceArea ?? null,
    rooms: ad.roomsQuantity ?? null,
    bedrooms: ad.bedroomsQuantity ?? null,
    isNewProperty: ad.newProperty ?? null,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    city: ad.city || fallbackCity,
    postalCode: ad.postalCode ?? null,
    url,
    description: ad.description ?? null,
    imageUrl: ad.photos?.[0]?.url_photo ?? null,
    propertyType: ad.propertyType ?? null,
    dpeClass: normalizeEnergyClass(ad.energyClassification),
    gesClass: normalizeEnergyClass(ad.greenhouseGazClassification),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
    scrapedAt,
  };
}

export function mapBienIciAdToEnrichmentPatch(
  ad: BienIciAd
): PropertyEnrichmentPatch {
  const position = ad.blurInfo?.position ?? ad.blurInfo?.centroid;
  const metrics = bienIciEnergyMetrics(ad);

  return {
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
  };
}
