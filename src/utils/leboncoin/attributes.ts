import {
  mergeHighlights,
  parseConstructionYear,
  parsePositiveInt,
  sanitizePositiveInt,
} from "../listing/amenities.js";
import {
  getLeboncoinAttribute,
  parseLeboncoinNumber,
  type LeboncoinAd,
} from "./client.js";

function getLeboncoinAttributeLabel(
  ad: LeboncoinAd,
  key: string
): string | undefined {
  const attr = ad.attributes.find((item) => item.key === key);
  const label = attr?.value_label?.trim();
  if (label) return label;

  const value = attr?.value.trim();
  if (!value) return undefined;
  return value;
}

function splitSpecificities(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type LeboncoinListingExtras = {
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
};

export function extractLeboncoinListingExtras(
  ad: LeboncoinAd
): LeboncoinListingExtras {
  const specificities = splitSpecificities(
    getLeboncoinAttributeLabel(ad, "specificities")
  );
  const outsideAccess = getLeboncoinAttributeLabel(ad, "outside_access");
  const elevator = getLeboncoinAttributeLabel(ad, "elevator");
  const heating = getLeboncoinAttributeLabel(ad, "heating") ?? null;
  const orientation = getLeboncoinAttributeLabel(ad, "orientation") ?? null;
  const propertyCondition =
    getLeboncoinAttributeLabel(ad, "global_condition") ?? null;

  const extraHighlights = [
    outsideAccess,
    elevator && !/^non$/i.test(elevator) ? `Ascenseur` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    bathrooms: sanitizePositiveInt(
      parseLeboncoinNumber(getLeboncoinAttribute(ad, "nb_bathrooms")) ??
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "bathrooms"))
    ),
    constructionYear: parseConstructionYear(
      getLeboncoinAttribute(ad, "building_year")
    ),
    heating,
    orientation,
    propertyCondition,
    parkingSpaces: parsePositiveInt(getLeboncoinAttribute(ad, "nb_parkings")),
    highlights: mergeHighlights(specificities, extraHighlights),
  };
}
