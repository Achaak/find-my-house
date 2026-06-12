import { canonicalPropertyType } from "./propertyType.js";

export const FUZZY_PRICE_TOLERANCE = 0.02;
export const FUZZY_LAND_SURFACE_TOLERANCE = 0.05;

export type PropertyMatchInput = {
  postalCode: string | null;
  price: number;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  landSurface: number | null;
  propertyType: string | null;
  isNewProperty: boolean | null;
};

function pricesMatchFuzzy(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) / Math.max(a, b) <= FUZZY_PRICE_TOLERANCE;
}

function landSurfacesMatchFuzzy(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return true;
  if (a === b) return true;
  return Math.abs(a - b) / Math.max(a, b) <= FUZZY_LAND_SURFACE_TOLERANCE;
}

function isNewPropertyCompatible(
  a: boolean | null,
  b: boolean | null
): boolean {
  if (a === null || b === null) return true;
  return a === b;
}

function structuralFieldsMatch(
  a: PropertyMatchInput,
  b: PropertyMatchInput
): boolean {
  if (!a.postalCode || !b.postalCode || a.postalCode !== b.postalCode) {
    return false;
  }

  if (a.surface !== b.surface) return false;
  if (a.rooms !== b.rooms) return false;
  if (a.bedrooms !== b.bedrooms) return false;

  return (
    canonicalPropertyType(a.propertyType) ===
    canonicalPropertyType(b.propertyType)
  );
}

export function propertiesMatchFuzzy(
  a: PropertyMatchInput,
  b: PropertyMatchInput
): boolean {
  if (!structuralFieldsMatch(a, b)) return false;

  return (
    pricesMatchFuzzy(a.price, b.price) &&
    landSurfacesMatchFuzzy(a.landSurface, b.landSurface) &&
    isNewPropertyCompatible(a.isNewProperty, b.isNewProperty)
  );
}

export function toPropertyMatchInput(
  value: PropertyMatchInput
): PropertyMatchInput {
  return value;
}
