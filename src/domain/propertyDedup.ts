import { computePropertyKey } from "../utils/propertyKey.js";
import {
  propertiesMatchFuzzy,
  toPropertyMatchInput as propertyRowToMatchInput,
  type PropertyMatchInput,
} from "../utils/propertyMatch.js";

export type { PropertyMatchInput };

export function toPropertyMatchInputFromFields(
  fields: PropertyMatchInput
): PropertyMatchInput {
  return fields;
}

export function groupByStrictPropertyKey<T>(
  items: T[],
  toInput: (item: T) => PropertyMatchInput
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = computePropertyKey(toInput(item));
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function findUnionParent(parents: Map<number, number>, id: number): number {
  const current = parents.get(id);
  if (current === undefined || current === id) return id;

  const root = findUnionParent(parents, current);
  parents.set(id, root);
  return root;
}

function unionIds(parents: Map<number, number>, a: number, b: number): void {
  const rootA = findUnionParent(parents, a);
  const rootB = findUnionParent(parents, b);
  if (rootA !== rootB) {
    parents.set(rootB, rootA);
  }
}

function anyPublicationPairMatches(
  leftInputs: PropertyMatchInput[],
  rightInputs: PropertyMatchInput[]
): boolean {
  for (const left of leftInputs) {
    for (const right of rightInputs) {
      if (propertiesMatchFuzzy(left, right)) {
        return true;
      }
    }
  }
  return false;
}

export function groupByFuzzyPropertyMatch<T extends { id: number }>(
  items: T[],
  toPublicationInputs: (item: T) => PropertyMatchInput[]
): T[][] {
  const byPostal = new Map<string, T[]>();

  for (const item of items) {
    const inputs = toPublicationInputs(item);
    const postalCode = inputs.find((input) => input.postalCode)?.postalCode;
    if (!postalCode) continue;
    const group = byPostal.get(postalCode) ?? [];
    group.push(item);
    byPostal.set(postalCode, group);
  }

  const parents = new Map<number, number>(
    items.map((item) => [item.id, item.id])
  );

  for (const group of byPostal.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const left = group[i];
        const right = group[j];

        if (
          anyPublicationPairMatches(
            toPublicationInputs(left),
            toPublicationInputs(right)
          )
        ) {
          unionIds(parents, left.id, right.id);
        }
      }
    }
  }

  const grouped = new Map<number, T[]>();
  for (const item of items) {
    const root = findUnionParent(parents, item.id);
    const bucket = grouped.get(root) ?? [];
    bucket.push(item);
    grouped.set(root, bucket);
  }

  return [...grouped.values()].filter((group) => group.length > 1);
}

export function propertyRecordToPublicationInputs(property: {
  postalCode: string | null;
  price: number;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  landSurface: number | null;
  propertyType: string | null;
  isNewProperty: boolean | null;
  publications: {
    postalCode: string | null;
    price: number;
    surface: number | null;
    rooms: number | null;
    bedrooms: number | null;
    landSurface: number | null;
    propertyType: string | null;
    isNewProperty: boolean | null;
  }[];
}): PropertyMatchInput[] {
  if (property.publications.length === 0) {
    return [
      propertyRowToMatchInput({
        postalCode: property.postalCode,
        price: property.price,
        surface: property.surface,
        rooms: property.rooms,
        bedrooms: property.bedrooms,
        landSurface: property.landSurface,
        propertyType: property.propertyType,
        isNewProperty: property.isNewProperty,
      }),
    ];
  }

  return property.publications.map((publication) =>
    toPropertyMatchInput({
      postalCode: publication.postalCode ?? property.postalCode,
      price: publication.price,
      surface: publication.surface,
      rooms: publication.rooms,
      bedrooms: publication.bedrooms,
      landSurface: publication.landSurface,
      propertyType: publication.propertyType,
      isNewProperty: publication.isNewProperty,
    })
  );
}

// Backward-compatible alias used by strict grouping tests.
export const toPropertyMatchInput = toPropertyMatchInputFromFields;
