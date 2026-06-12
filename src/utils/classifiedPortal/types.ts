import type { EnergyMetrics } from "../energy/energyMetrics.js";
import type { GeoPoint } from "../geo/geo.js";
import type { ListingSource } from "../../types/listing.js";

export type ClassifiedPortalId = Extract<
  ListingSource,
  "seloger" | "logicimmo"
>;

export type ClassifiedPortalConfig = {
  readonly id: ClassifiedPortalId;
  readonly label: string;
  readonly baseUrl: string;
  readonly imageBaseUrl: string;
};

export const CLASSIFIED_PAGE_SIZE = 35;

export type ClassifiedPlace = {
  name: string;
  center: GeoPoint;
  locationCode: string;
};

export type ClassifiedPricing = {
  rawPrice?: string;
  price?: string;
};

export type ClassifiedCard = {
  id: number | string;
  cardType: string;
  publicationId?: number;
  title?: string;
  estateType?: string;
  pricing?: ClassifiedPricing;
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
  landSurface?: number;
  latitude?: number;
  longitude?: number;
};

export type ClassifiedSearchResponse = {
  cards?: {
    list?: ClassifiedCard[];
  };
  navigation?: {
    counts?: { count?: number };
    pagination?: { resultsPerPage?: number };
  };
};

export type ClassifiedGeoCoordinates = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

export type ClassifiedData = {
  id?: string;
  metadata?: { legacyId?: string };
  hardFacts?: {
    title?: string;
    keyfacts?: string[];
    price?: { formatted?: string };
  };
  location?: {
    address?: { city?: string; zipCode?: string };
    coordinates?: ClassifiedGeoCoordinates;
    geo?: ClassifiedGeoCoordinates;
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

export type ClassifiedUfrnPageProps = {
  classifieds?: string[];
  classifiedsData?: Record<string, ClassifiedData>;
  totalCount?: number;
};

export type ClassifiedEnergyDetails = EnergyMetrics & {
  dpeClass: string | null;
  gesClass: string | null;
};

export type ClassifiedListingDetails = ClassifiedEnergyDetails & {
  description: string | null;
  landSurface: number | null;
  surface: number | null;
  bedrooms: number | null;
  rooms: number | null;
  latitude: number | null;
  longitude: number | null;
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
};
