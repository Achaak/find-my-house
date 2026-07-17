import { computePropertyKey } from "../../utils/propertyKey.js";
import {
  toPropertyMatchInput as propertyRowToMatchInput,
  type PropertyMatchInput,
} from "../../utils/propertyMatch.js";
import { anyPublicationPairMatches } from "./lookup.js";

export type { PropertyMatchInput };

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

export function groupByFuzzyPropertyMatch<T extends { id: number }>(
  items: T[],
  toPublicationInputs: (item: T) => (PropertyMatchInput & {
    source?: string;
    agencySlug?: string | null;
    agencyRef?: string | null;
  })[]
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

/** Publication field bags for reconcile — includes agency for shared match rules. */
export function propertyRecordToPublicationInputs(property: {
  postalCode: string | null;
  price: number;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  landSurface: number | null;
  isNewProperty: boolean | null;
  publications: {
    source?: string;
    postalCode: string | null;
    price: number;
    surface: number | null;
    rooms: number | null;
    bedrooms: number | null;
    landSurface: number | null;
    propertyType: string | null;
    isNewProperty: boolean | null;
    agencySlug?: string | null;
    agencyRef?: string | null;
  }[];
}): (PropertyMatchInput & {
  source?: string;
  agencySlug?: string | null;
  agencyRef?: string | null;
})[] {
  if (property.publications.length === 0) {
    return [
      {
        ...propertyRowToMatchInput({
          postalCode: property.postalCode,
          price: property.price,
          surface: property.surface,
          rooms: property.rooms,
          bedrooms: property.bedrooms,
          landSurface: property.landSurface,
          propertyType: null,
          isNewProperty: property.isNewProperty,
        }),
      },
    ];
  }

  return property.publications.map((publication) => ({
    ...propertyRowToMatchInput({
      postalCode: publication.postalCode ?? property.postalCode,
      price: publication.price,
      surface: publication.surface,
      rooms: publication.rooms,
      bedrooms: publication.bedrooms,
      landSurface: publication.landSurface,
      propertyType: publication.propertyType,
      isNewProperty: publication.isNewProperty,
    }),
    source: publication.source,
    agencySlug: publication.agencySlug,
    agencyRef: publication.agencyRef,
  }));
}
