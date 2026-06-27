export type PropertyProjectionShape = {
  title: string;
  price: number;
  surface: number | null;
  landSurface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  isNewProperty: boolean | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  postalCode: string | null;
  address: string | null;
  dpeNumero: string | null;
  propertyType: string | null;
  dpeClass: string | null;
  gesClass: string | null;
  dpeConsumptionKwhM2: number | null;
  gesEmissionKgM2: number | null;
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
};

/** Denormalized on `Property` for search, sort, and enrichment scan. */
export const PROPERTY_SEARCH_CACHE_FIELDS = [
  "title",
  "price",
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
  "isNewProperty",
  "latitude",
  "longitude",
  "city",
  "postalCode",
  "dpeClass",
  "gesClass",
] as const satisfies readonly (keyof PropertyProjectionShape)[];

/** Computed from publications at read time — not stored on `Property`. */
export const PROPERTY_DISPLAY_PROJECTION_FIELDS = [
  "address",
  "dpeNumero",
  "propertyType",
  "dpeConsumptionKwhM2",
  "gesEmissionKgM2",
  "bathrooms",
  "constructionYear",
  "heating",
  "orientation",
  "propertyCondition",
  "parkingSpaces",
  "highlights",
] as const satisfies readonly (keyof PropertyProjectionShape)[];

export const PROPERTY_PROJECTION_FIELDS = [
  ...PROPERTY_SEARCH_CACHE_FIELDS,
  ...PROPERTY_DISPLAY_PROJECTION_FIELDS,
] as const satisfies readonly (keyof PropertyProjectionShape)[];

export type PropertySearchCacheShape = Pick<
  PropertyProjectionShape,
  (typeof PROPERTY_SEARCH_CACHE_FIELDS)[number]
>;

export type PropertyDisplayProjectionShape = Pick<
  PropertyProjectionShape,
  (typeof PROPERTY_DISPLAY_PROJECTION_FIELDS)[number]
>;
