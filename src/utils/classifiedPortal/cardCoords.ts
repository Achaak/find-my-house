import { lookupPostalCodeCoords } from "../geo/postalCodeLookup.js";
import type { ClassifiedCard } from "./types.js";

/** Fills missing card coordinates from the bundled postal-code index. */
export function applyPostalCodeCoordsToCard(
  card: ClassifiedCard
): ClassifiedCard {
  if (card.latitude != null && card.longitude != null) return card;

  const postalCode = card.zipCode?.trim();
  if (!postalCode) return card;

  const coords = lookupPostalCodeCoords(postalCode, card.cityLabel);
  if (!coords) return card;

  return {
    ...card,
    latitude: coords.lat,
    longitude: coords.lng,
  };
}
