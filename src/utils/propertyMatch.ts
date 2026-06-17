import { canonicalPropertyType } from "./propertyType.js";

export const FUZZY_PRICE_TOLERANCE = 0.02;
export const FUZZY_LAND_SURFACE_TOLERANCE = 0.05;
export const FUZZY_SURFACE_RELATIVE_TOLERANCE = 0.02;
export const FUZZY_SURFACE_ABSOLUTE_TOLERANCE = 2;
export const FUZZY_INTEGER_FIELD_TOLERANCE = 1;
export const PROPERTY_MATCH_THRESHOLD = 0.85;
export const PROPERTY_MATCH_PARTIAL_CREDIT = 0.75;

export const PROPERTY_MATCH_WEIGHTS = {
  price: 0.25,
  surface: 0.25,
  rooms: 0.1,
  bedrooms: 0.1,
  landSurface: 0.15,
  propertyType: 0.15,
} as const;

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

export type PropertyMatchFieldScore = {
  score: number;
  weight: number;
};

export type PropertyMatchScore = {
  score: number;
  fields: Record<keyof typeof PROPERTY_MATCH_WEIGHTS, PropertyMatchFieldScore>;
  veto?: string;
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

function propertyTypesMatch(a: string | null, b: string | null): boolean {
  const left = canonicalPropertyType(a);
  const right = canonicalPropertyType(b);
  if (!left || !right) return true;
  return left === right;
}

function surfacesMatchFuzzy(a: number, b: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return (
    diff <= FUZZY_SURFACE_ABSOLUTE_TOLERANCE ||
    diff / Math.max(a, b) <= FUZZY_SURFACE_RELATIVE_TOLERANCE
  );
}

function integersMatchFuzzy(a: number, b: number): boolean {
  return Math.abs(a - b) <= FUZZY_INTEGER_FIELD_TOLERANCE;
}

function scoreSurface(
  a: number | null,
  b: number | null
): { score: number; veto?: string } {
  if (a === null || b === null) {
    return { score: PROPERTY_MATCH_PARTIAL_CREDIT };
  }
  if (surfacesMatchFuzzy(a, b)) {
    return { score: 1 };
  }
  return { score: 0, veto: "surface_out_of_tolerance" };
}

function scoreIntegerField(
  a: number | null,
  b: number | null
): { score: number; veto?: string } {
  if (a === null || b === null) {
    return { score: PROPERTY_MATCH_PARTIAL_CREDIT };
  }
  if (integersMatchFuzzy(a, b)) {
    return { score: 1 };
  }
  return { score: 0, veto: "numeric_mismatch" };
}

function scorePrice(a: number, b: number): { score: number; veto?: string } {
  if (pricesMatchFuzzy(a, b)) {
    return { score: 1 };
  }
  return { score: 0, veto: "price_out_of_tolerance" };
}

function scoreLandSurface(
  a: number | null,
  b: number | null
): { score: number; veto?: string } {
  if (a === null || b === null) {
    return { score: PROPERTY_MATCH_PARTIAL_CREDIT };
  }
  if (a === b) {
    return { score: 1 };
  }
  if (landSurfacesMatchFuzzy(a, b)) {
    return { score: 1 };
  }
  return { score: 0, veto: "land_surface_out_of_tolerance" };
}

function scorePropertyType(
  a: string | null,
  b: string | null
): { score: number; veto?: string } {
  if (propertyTypesMatch(a, b)) {
    if (!canonicalPropertyType(a) || !canonicalPropertyType(b)) {
      return { score: PROPERTY_MATCH_PARTIAL_CREDIT };
    }
    return { score: 1 };
  }

  const left = canonicalPropertyType(a);
  const right = canonicalPropertyType(b);
  if (!left || !right) {
    return { score: PROPERTY_MATCH_PARTIAL_CREDIT };
  }
  return { score: 0, veto: "property_type_mismatch" };
}

function weightedScore(
  fields: Record<keyof typeof PROPERTY_MATCH_WEIGHTS, PropertyMatchFieldScore>
): number {
  let total = 0;
  for (const field of Object.values(fields)) {
    total += field.score * field.weight;
  }
  return total;
}

export function scorePropertyMatch(
  a: PropertyMatchInput,
  b: PropertyMatchInput
): PropertyMatchScore {
  const emptyFields = Object.fromEntries(
    Object.entries(PROPERTY_MATCH_WEIGHTS).map(([name, weight]) => [
      name,
      { score: 0, weight },
    ])
  ) as Record<keyof typeof PROPERTY_MATCH_WEIGHTS, PropertyMatchFieldScore>;

  if (!a.postalCode || !b.postalCode || a.postalCode !== b.postalCode) {
    return { score: 0, fields: emptyFields, veto: "postal_code_mismatch" };
  }

  const price = scorePrice(a.price, b.price);
  const surface = scoreSurface(a.surface, b.surface);
  const rooms = scoreIntegerField(a.rooms, b.rooms);
  const bedrooms = scoreIntegerField(a.bedrooms, b.bedrooms);
  const landSurface = scoreLandSurface(a.landSurface, b.landSurface);
  const propertyType = scorePropertyType(a.propertyType, b.propertyType);

  const fields: Record<
    keyof typeof PROPERTY_MATCH_WEIGHTS,
    PropertyMatchFieldScore
  > = {
    price: { score: price.score, weight: PROPERTY_MATCH_WEIGHTS.price },
    surface: { score: surface.score, weight: PROPERTY_MATCH_WEIGHTS.surface },
    rooms: { score: rooms.score, weight: PROPERTY_MATCH_WEIGHTS.rooms },
    bedrooms: {
      score: bedrooms.score,
      weight: PROPERTY_MATCH_WEIGHTS.bedrooms,
    },
    landSurface: {
      score: landSurface.score,
      weight: PROPERTY_MATCH_WEIGHTS.landSurface,
    },
    propertyType: {
      score: propertyType.score,
      weight: PROPERTY_MATCH_WEIGHTS.propertyType,
    },
  };

  const veto =
    price.veto ??
    surface.veto ??
    rooms.veto ??
    bedrooms.veto ??
    landSurface.veto ??
    propertyType.veto;

  return {
    score: weightedScore(fields),
    fields,
    ...(veto ? { veto } : {}),
  };
}

export function propertiesMatchFuzzy(
  a: PropertyMatchInput,
  b: PropertyMatchInput,
  threshold = PROPERTY_MATCH_THRESHOLD
): boolean {
  const result = scorePropertyMatch(a, b);
  if (result.veto) return false;
  return result.score >= threshold;
}

export function toPropertyMatchInput(
  value: PropertyMatchInput
): PropertyMatchInput {
  return {
    postalCode: value.postalCode,
    price: value.price,
    surface: value.surface,
    rooms: value.rooms,
    bedrooms: value.bedrooms,
    landSurface: value.landSurface,
    propertyType: value.propertyType,
    isNewProperty: value.isNewProperty,
  };
}
