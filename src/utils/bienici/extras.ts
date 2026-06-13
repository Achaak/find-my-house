import {
  mergeHighlights,
  sanitizeConstructionYear,
  sanitizePositiveInt,
} from "../listing/amenities.js";
import type { BienIciAd } from "./mapper.js";

export type BienIciListingExtras = {
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
};

export function extractBienIciListingExtras(
  ad: BienIciAd
): BienIciListingExtras {
  const highlights: string[] = [];

  if (ad.hasGarden) highlights.push("Garden");
  if (ad.hasCellar) highlights.push("Cellar");
  if (ad.hasPool) highlights.push("Pool");
  if (ad.hasAirConditioning) highlights.push("Air conditioning");
  if (ad.terracesQuantity && ad.terracesQuantity > 0) {
    highlights.push(
      ad.terracesQuantity === 1
        ? "Terrace"
        : `${String(ad.terracesQuantity)} terraces`
    );
  }
  if (ad.showerRoomsQuantity && ad.showerRoomsQuantity > 0) {
    highlights.push(
      ad.showerRoomsQuantity === 1
        ? "Shower room"
        : `${String(ad.showerRoomsQuantity)} shower rooms`
    );
  }

  const propertyCondition =
    ad.workToDo === true
      ? "Work required"
      : ad.workToDo === false
        ? null
        : null;

  return {
    bathrooms: sanitizePositiveInt(ad.bathroomsQuantity),
    constructionYear: sanitizeConstructionYear(ad.yearOfConstruction),
    heating: ad.heating ?? null,
    orientation: ad.exposition ?? null,
    propertyCondition,
    parkingSpaces: ad.parkingPlacesQuantity ?? null,
    highlights: mergeHighlights(highlights),
  };
}
