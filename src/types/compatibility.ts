import type { EnergyClass } from "../utils/energy/energyClass.js";
import type { GeoPoint } from "../utils/geo/geo.js";
import type { PropertyRow } from "./listing.js";

export type CompatibilityPreferences = {
  maxPrice?: number;
  idealPrice?: number;
  minSurface?: number;
  idealSurface?: number;
  minLandSurface?: number;
  idealLandSurface?: number;
  minRooms?: number;
  idealRooms?: number;
  minBedrooms?: number;
  idealBedrooms?: number;
  minBathrooms?: number;
  idealBathrooms?: number;
  minParkingSpaces?: number;
  idealParkingSpaces?: number;
  idealConstructionYear?: number;
  preferredHighlights?: string[];
  avoidRenovation?: boolean;
  idealHeating?: string;
  idealOrientation?: string;
  idealDpeClass?: EnergyClass;
  ancienOnly?: boolean;
  referencePoint?: GeoPoint;
  maxDistanceKm?: number;
  dislikes?: PropertyRow[];
};

export type CompatibilityBreakdown = {
  price: number | null;
  surface: number | null;
  landSurface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  constructionYear: number | null;
  highlights: number | null;
  condition: number | null;
  heating: number | null;
  orientation: number | null;
  dpe: number | null;
  ancien: number | null;
  distance: number | null;
  dislikePenalty: number | null;
};

export type CompatibilityResult = {
  score: number;
  breakdown: CompatibilityBreakdown;
};
