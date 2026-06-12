import type { CompatibilityPreferences } from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import {
  normalizeEnergyClass,
  type EnergyClass,
} from "../energy/energyClass.js";
import { haversineDistanceKm, type GeoPoint } from "../geo/geo.js";

const DPE_RANK: Record<EnergyClass, number> = {
  A: 7,
  B: 6,
  C: 5,
  D: 4,
  E: 3,
  F: 2,
  G: 1,
  N: 0,
  V: 0,
};

const RANK_TO_DPE = Object.entries(DPE_RANK)
  .filter(([letter]) => letter !== "N" && letter !== "V")
  .sort(([, a], [, b]) => b - a)
  .map(([letter]) => letter as EnergyClass);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function numericValues(
  listings: PropertyRow[],
  pick: (listing: PropertyRow) => number | null
): number[] {
  return listings
    .map(pick)
    .filter((value): value is number => value !== null && value > 0);
}

function learnHigherIsBetterRange(
  listings: PropertyRow[],
  pick: (listing: PropertyRow) => number | null
): { min?: number; ideal?: number } {
  const values = numericValues(listings, pick);
  if (values.length === 0) return {};

  return {
    min: Math.min(...values) * 0.9,
    ideal: median(values),
  };
}

function learnDpeClass(listings: PropertyRow[]): EnergyClass | undefined {
  const ranks = listings
    .map((listing) => normalizeEnergyClass(listing.dpeClass))
    .filter((value): value is EnergyClass => value !== null)
    .map((value) => DPE_RANK[value]);

  if (ranks.length === 0) return undefined;

  const medianRank = median(ranks);
  return RANK_TO_DPE.reduce((closest, letter) => {
    const closestDistance = Math.abs(DPE_RANK[closest] - medianRank);
    const nextDistance = Math.abs(DPE_RANK[letter] - medianRank);
    return nextDistance < closestDistance ? letter : closest;
  });
}

function learnAncienPreference(listings: PropertyRow[]): boolean | undefined {
  const known = listings.filter((listing) => listing.isNewProperty !== null);
  if (known.length === 0) return undefined;

  const ancienCount = known.filter(
    (listing) => listing.isNewProperty === false
  ).length;
  return ancienCount / known.length >= 0.7;
}

function learnGeoPreferences(
  listings: PropertyRow[]
): Pick<CompatibilityPreferences, "referencePoint" | "maxDistanceKm"> {
  const points = listings
    .filter(
      (
        listing
      ): listing is PropertyRow & { latitude: number; longitude: number } =>
        listing.latitude !== null && listing.longitude !== null
    )
    .map((listing) => ({
      lat: listing.latitude,
      lng: listing.longitude,
    }));

  if (points.length < 2) return {};

  const referencePoint: GeoPoint = {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };

  const distances = points.map((point) =>
    haversineDistanceKm(
      referencePoint.lat,
      referencePoint.lng,
      point.lat,
      point.lng
    )
  );

  return {
    referencePoint,
    maxDistanceKm: Math.max(...distances, 1) * 1.3,
  };
}

export function learnCompatibilityPreferences(
  likes: PropertyRow[],
  dislikes: PropertyRow[] = []
): CompatibilityPreferences | null {
  if (likes.length === 0) return null;

  const prices = numericValues(likes, (listing) => listing.price);
  const surfaceRange = learnHigherIsBetterRange(
    likes,
    (listing) => listing.surface
  );
  const landRange = learnHigherIsBetterRange(
    likes,
    (listing) => listing.landSurface
  );
  const idealDpeClass = learnDpeClass(likes);
  const ancienOnly = learnAncienPreference(likes);
  const roomValues = numericValues(likes, (listing) => listing.rooms);
  const bedroomValues = numericValues(likes, (listing) => listing.bedrooms);

  const preferences: CompatibilityPreferences = {
    ...(prices.length > 0
      ? {
          idealPrice: median(prices),
          maxPrice: Math.max(...prices) * 1.15,
        }
      : {}),
    ...(surfaceRange.ideal !== undefined
      ? {
          minSurface: surfaceRange.min,
          idealSurface: surfaceRange.ideal,
        }
      : {}),
    ...(landRange.ideal !== undefined
      ? {
          minLandSurface: landRange.min,
          idealLandSurface: landRange.ideal,
        }
      : {}),
    ...(roomValues.length > 0
      ? {
          minRooms: Math.min(...roomValues),
          idealRooms: median(roomValues),
        }
      : {}),
    ...(bedroomValues.length > 0
      ? {
          minBedrooms: Math.min(...bedroomValues),
          idealBedrooms: median(bedroomValues),
        }
      : {}),
    ...(idealDpeClass ? { idealDpeClass } : {}),
    ...(ancienOnly ? { ancienOnly } : {}),
    ...learnGeoPreferences(likes),
    ...(dislikes.length > 0 ? { dislikes } : {}),
  };

  return preferences;
}
