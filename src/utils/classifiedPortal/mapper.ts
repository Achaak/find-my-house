import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energy/energyClass.js";
import {
  buildClassifiedImageUrl,
  buildClassifiedListingUrl,
  parseClassifiedBedrooms,
  parseClassifiedPrice,
  parseClassifiedRooms,
} from "./helpers.js";
import { extractClassifiedListingExtras } from "./extras.js";
import type { ClassifiedCard, ClassifiedPortalConfig } from "./types.js";

function classifiedScrapeImageUrl(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard
): string | null {
  const photo = card.photos?.find((url) => url.trim());
  if (!photo) return null;
  return buildClassifiedImageUrl(portal, photo.trim());
}

export function mapClassifiedCardToListing(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  const extras = extractClassifiedListingExtras(card);

  return {
    externalId: String(card.id),
    source: portal.id,
    title: card.title ?? card.estateType ?? "House",
    price: parseClassifiedPrice(card.pricing),
    surface: card.surface ?? null,
    landSurface: card.landSurface ?? null,
    rooms: parseClassifiedRooms(card),
    bedrooms: parseClassifiedBedrooms(card),
    isNewProperty:
      card.isNew === true ? true : card.isNew === false ? false : null,
    latitude: card.latitude ?? null,
    longitude: card.longitude ?? null,
    city: card.cityLabel ?? fallbackCity,
    postalCode: card.zipCode ?? null,
    url: buildClassifiedListingUrl(portal, card),
    description: card.description ?? null,
    imageUrl: classifiedScrapeImageUrl(portal, card),
    propertyType: card.estateType ?? null,
    dpeClass: normalizeEnergyClass(card.energyClass),
    gesClass: normalizeEnergyClass(card.gesClass),
    dpeConsumptionKwhM2: card.dpeConsumptionKwhM2 ?? null,
    gesEmissionKgM2: card.gesEmissionKgM2 ?? null,
    ...extras,
    scrapedAt,
  };
}
