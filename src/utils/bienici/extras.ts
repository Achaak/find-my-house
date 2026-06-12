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

  if (ad.hasGarden) highlights.push("Jardin");
  if (ad.hasCellar) highlights.push("Cave");
  if (ad.hasPool) highlights.push("Piscine");
  if (ad.hasAirConditioning) highlights.push("Climatisation");
  if (ad.terracesQuantity && ad.terracesQuantity > 0) {
    highlights.push(
      ad.terracesQuantity === 1
        ? "Terrasse"
        : `${String(ad.terracesQuantity)} terrasses`
    );
  }
  if (ad.showerRoomsQuantity && ad.showerRoomsQuantity > 0) {
    highlights.push(
      ad.showerRoomsQuantity === 1
        ? "Salle d'eau"
        : `${String(ad.showerRoomsQuantity)} salles d'eau`
    );
  }

  const propertyCondition =
    ad.workToDo === true
      ? "Travaux à prévoir"
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
