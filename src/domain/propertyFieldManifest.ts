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
  description: string | null;
  imageUrl: string | null;
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

export const PROPERTY_PROJECTION_FIELDS = [
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
  "address",
  "dpeNumero",
  "description",
  "imageUrl",
  "propertyType",
  "dpeClass",
  "gesClass",
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
