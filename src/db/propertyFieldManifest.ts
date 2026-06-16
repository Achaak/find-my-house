import type { Listing } from "../types/listing.js";
import { highlightsSetsEqual } from "../utils/listing/amenities.js";

export const PROPERTY_COMPARABLE_FIELDS = [
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
] as const;

export type PropertyComparableField =
  (typeof PROPERTY_COMPARABLE_FIELDS)[number];
export type PropertyScalarData = Pick<Listing, PropertyComparableField>;

export function toPropertyScalarData(listing: Listing): PropertyScalarData {
  return Object.fromEntries(
    PROPERTY_COMPARABLE_FIELDS.map((field) => [field, listing[field]])
  ) as PropertyScalarData;
}

export function hasPropertyScalarChanges(
  existing: PropertyScalarData,
  listing: Listing
): boolean {
  for (const field of PROPERTY_COMPARABLE_FIELDS) {
    if (field === "highlights") {
      if (!highlightsSetsEqual(existing.highlights, listing.highlights)) {
        return true;
      }
      continue;
    }
    if (existing[field] !== listing[field]) {
      return true;
    }
  }
  return false;
}
