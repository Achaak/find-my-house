import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energy/energyClass.js";
import { lookupPostalCodeCoords } from "../geo/postalCodeLookup.js";
import {
  classifiedScrapeImageUrl,
  classifiedScrapeImageUrls,
  syncListingImageFields,
} from "../images/scrapeImageUrls.js";
import {
  buildClassifiedListingUrl,
  parseClassifiedBedrooms,
  parseClassifiedPrice,
  parseClassifiedRooms,
} from "./helpers.js";
import { extractClassifiedListingExtras } from "./extras.js";
import type { ClassifiedCard, ClassifiedPortalConfig } from "./types.js";

function classifiedCardCoords(
  card: ClassifiedCard
): { lat: number; lng: number } | null {
  if (card.latitude != null && card.longitude != null) {
    return { lat: card.latitude, lng: card.longitude };
  }

  const postalCode = card.zipCode?.trim();
  if (!postalCode) return null;

  return lookupPostalCodeCoords(postalCode, card.cityLabel);
}

export function mapClassifiedCardToListing(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  const extras = extractClassifiedListingExtras(card);
  const coords = classifiedCardCoords(card);
  const images = syncListingImageFields(
    classifiedScrapeImageUrls(portal, card)
  );

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
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    city: card.cityLabel ?? fallbackCity,
    postalCode: card.zipCode ?? null,
    url: buildClassifiedListingUrl(portal, card),
    description: card.description ?? null,
    ...images,
    propertyType: card.estateType ?? null,
    dpeClass: normalizeEnergyClass(card.energyClass),
    gesClass: normalizeEnergyClass(card.gesClass),
    dpeConsumptionKwhM2: card.dpeConsumptionKwhM2 ?? null,
    gesEmissionKgM2: card.gesEmissionKgM2 ?? null,
    ...extras,
    scrapedAt,
  };
}

export { classifiedScrapeImageUrl };
