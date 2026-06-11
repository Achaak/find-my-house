import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energy/energyClass.js";
import {
  buildSeLogerImageUrl,
  buildSeLogerListingUrl,
  parseSeLogerBedrooms,
  parseSeLogerPrice,
} from "./helpers.js";
import type { SeLogerClassifiedCard } from "./types.js";

export function mapSeLogerCardToListing(
  card: SeLogerClassifiedCard,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  return {
    externalId: String(card.id),
    source: "seloger",
    title: card.title ?? card.estateType ?? "Maison",
    price: parseSeLogerPrice(card.pricing),
    surface: card.surface ?? null,
    landSurface: null,
    rooms: card.rooms ?? null,
    bedrooms: parseSeLogerBedrooms(card),
    isNewProperty:
      card.isNew === true ? true : card.isNew === false ? false : null,
    latitude: null,
    longitude: null,
    city: card.cityLabel ?? fallbackCity,
    postalCode: card.zipCode ?? null,
    url: buildSeLogerListingUrl(card),
    description: card.description ?? null,
    imageUrl: buildSeLogerImageUrl(card.photos?.[0]),
    propertyType: card.estateType ?? null,
    dpeClass: normalizeEnergyClass(card.energyClass),
    gesClass: normalizeEnergyClass(card.gesClass),
    dpeConsumptionKwhM2: card.dpeConsumptionKwhM2 ?? null,
    gesEmissionKgM2: card.gesEmissionKgM2 ?? null,
    scrapedAt,
  };
}
