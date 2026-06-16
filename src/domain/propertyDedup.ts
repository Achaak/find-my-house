import { computePropertyKey } from "../utils/propertyKey.js";
import {
  propertiesMatchFuzzy,
  type PropertyMatchInput,
} from "../utils/propertyMatch.js";

export type { PropertyMatchInput };

export function toPropertyMatchInput(
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

export function groupByFuzzyPropertyMatch<T extends { id: number }>(
  items: T[],
  toInput: (item: T) => PropertyMatchInput
): T[][] {
  const byPostal = new Map<string, T[]>();

  for (const item of items) {
    const input = toInput(item);
    if (!input.postalCode) continue;
    const group = byPostal.get(input.postalCode) ?? [];
    group.push(item);
    byPostal.set(input.postalCode, group);
  }

  const parents = new Map<number, number>(
    items.map((item) => [item.id, item.id])
  );

  for (const group of byPostal.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const left = group[i];
        const right = group[j];

        if (propertiesMatchFuzzy(toInput(left), toInput(right))) {
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
