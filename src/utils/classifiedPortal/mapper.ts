import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energy/energyClass.js";
import {
  buildClassifiedImageUrl,
  buildClassifiedListingUrl,
  parseClassifiedBedrooms,
  parseClassifiedPrice,
} from "./helpers.js";
import type { ClassifiedCard, ClassifiedPortalConfig } from "./types.js";

export function mapClassifiedCardToListing(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  return {
    externalId: String(card.id),
    source: portal.id,
    title: card.title ?? card.estateType ?? "Maison",
    price: parseClassifiedPrice(card.pricing),
    surface: card.surface ?? null,
    landSurface: null,
    rooms: card.rooms ?? null,
    bedrooms: parseClassifiedBedrooms(card),
    isNewProperty:
      card.isNew === true ? true : card.isNew === false ? false : null,
    latitude: null,
    longitude: null,
    city: card.cityLabel ?? fallbackCity,
    postalCode: card.zipCode ?? null,
    url: buildClassifiedListingUrl(portal, card),
    description: card.description ?? null,
    imageUrl: buildClassifiedImageUrl(portal, card.photos?.[0]),
    propertyType: card.estateType ?? null,
    dpeClass: normalizeEnergyClass(card.energyClass),
    gesClass: normalizeEnergyClass(card.gesClass),
    dpeConsumptionKwhM2: card.dpeConsumptionKwhM2 ?? null,
    gesEmissionKgM2: card.gesEmissionKgM2 ?? null,
    scrapedAt,
  };
}
