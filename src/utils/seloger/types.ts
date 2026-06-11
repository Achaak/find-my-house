import type { EnergyMetrics } from "../energy/energyMetrics.js";
import type { GeoPoint } from "../geo/geo.js";

export const BASE_URL = "https://www.seloger.com";
export const IMAGE_BASE_URL = "https://v.seloger.com/s/width/800";
export const SELOGER_PAGE_SIZE = 35;

export type SeLogerPlace = {
  name: string;
  center: GeoPoint;
  locationCode: string;
};

export type SeLogerPricing = {
  rawPrice?: string;
  price?: string;
};

export type SeLogerClassifiedCard = {
  id: number | string;
  cardType: string;
  publicationId?: number;
  title?: string;
  estateType?: string;
  pricing?: SeLogerPricing;
  surface?: number;
  rooms?: number;
  bedroomCount?: number;
  isNew?: boolean;
  cityLabel?: string;
  districtLabel?: string;
  zipCode?: string;
  description?: string;
  photos?: string[];
  classifiedURL?: string;
  tags?: string[];
  energyClass?: string;
  gesClass?: string;
  dpeConsumptionKwhM2?: number;
  gesEmissionKgM2?: number;
};

export type SeLogerSearchResponse = {
  cards?: {
    list?: SeLogerClassifiedCard[];
  };
  navigation?: {
    counts?: { count?: number };
    pagination?: { resultsPerPage?: number };
  };
};

export type SeLogerGeoCoordinates = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

export type SeLogerClassifiedData = {
  id?: string;
  metadata?: { legacyId?: string };
  hardFacts?: {
    title?: string;
    keyfacts?: string[];
    price?: { formatted?: string };
  };
  location?: {
    address?: { city?: string; zipCode?: string };
    coordinates?: SeLogerGeoCoordinates;
    geo?: SeLogerGeoCoordinates;
  };
  gallery?: { images?: { url?: string }[] };
  mainDescription?: { description?: string };
  rawData?: {
    price?: number;
    propertyTypeLabel?: string;
    surface?: { main?: number };
    nbroom?: number;
    nbbedroom?: number;
    latitude?: number;
    longitude?: number;
  };
  tags?: { isNew?: boolean };
  energyClass?: string;
  gesClass?: string;
  url?: string;
};

export type SeLogerUfrnPageProps = {
  classifieds?: string[];
  classifiedsData?: Record<string, SeLogerClassifiedData>;
  totalCount?: number;
};

export type SeLogerEnergyDetails = EnergyMetrics & {
  dpeClass: string | null;
  gesClass: string | null;
};

export type SeLogerListingDetails = SeLogerEnergyDetails & {
  description: string | null;
  landSurface: number | null;
  surface: number | null;
  bedrooms: number | null;
  rooms: number | null;
  latitude: number | null;
  longitude: number | null;
};
