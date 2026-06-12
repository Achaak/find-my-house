import {
  highlightsFromTags,
  parseBathroomsFromTags,
  parseConstructionYearFromText,
} from "../listing/amenities.js";
import type { ClassifiedCard } from "./types.js";

export type ClassifiedListingExtras = {
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
};

function parseHeatingFromTags(tags: string[] | undefined): string | null {
  const tag = tags?.find((item) => /chauffage/i.test(item));
  return tag?.trim() ?? null;
}

function parseConditionFromTags(tags: string[] | undefined): string | null {
  const tag = tags?.find((item) =>
    /travaux|bon\s+état|à\s+rafraîchir|neuf/i.test(item)
  );
  return tag?.trim() ?? null;
}

function parseParkingFromTags(tags: string[] | undefined): number | null {
  if (!tags?.length) return null;

  for (const tag of tags) {
    const match =
      /(\d+)\s*(?:places?\s+de\s+)?parkings?/i.exec(tag) ??
      /(\d+)\s*places?\s+(?:de\s+)?stationnement/i.exec(tag);
    if (match) return Number(match[1]);
    if (/\b(?:garage|parking|stationnement)\b/i.test(tag) && !/\d/.test(tag)) {
      return 1;
    }
  }

  return null;
}

export function extractClassifiedListingExtras(
  card: ClassifiedCard
): ClassifiedListingExtras {
  const text = [card.description, ...(card.tags ?? [])]
    .filter(Boolean)
    .join("\n");

  return {
    bathrooms: parseBathroomsFromTags(card.tags),
    constructionYear: parseConstructionYearFromText(text),
    heating: parseHeatingFromTags(card.tags),
    orientation: null,
    propertyCondition: parseConditionFromTags(card.tags),
    parkingSpaces: parseParkingFromTags(card.tags),
    highlights: highlightsFromTags(card.tags),
  };
}
