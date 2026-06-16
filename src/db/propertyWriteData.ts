import { Prisma } from "../generated/prisma/client.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { PropertyProjection } from "../domain/propertyProjection.js";

export function toPrismaHighlights(
  highlights: string[] | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (highlights === undefined) return undefined;
  if (highlights === null) return Prisma.DbNull;
  return highlights;
}

export function toPrismaPropertyPatch(patch: PropertyEnrichmentPatch) {
  const { highlights, ...rest } = patch;
  return {
    ...rest,
    ...(highlights !== undefined
      ? { highlights: toPrismaHighlights(highlights) }
      : {}),
  };
}

export function toPrismaProjectionData(projection: PropertyProjection) {
  const { highlights, ...rest } = projection;
  return {
    ...rest,
    highlights: toPrismaHighlights(highlights),
  };
}
