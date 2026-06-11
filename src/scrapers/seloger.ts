import type { Listing } from "../types/listing.js";
import { resolveGeoFilter } from "../utils/geoFilter.js";
import {
  buildSeLogerImageUrl,
  buildSeLogerListingUrl,
  buildSeLogerLocation,
  buildSeLogerSearchUrl,
  fetchAllSeLogerClassifieds,
  parseSeLogerBedrooms,
  parseSeLogerPrice,
  resolveSeLogerPlace,
  type SeLogerClassifiedCard,
} from "../utils/selogerApi.js";
import { normalizeEnergyClass } from "../utils/energyClass.js";
import type { Scraper, ScraperOptions } from "./types.js";

export class SeLogerScraper implements Scraper {
  readonly name = "seloger";
  readonly supportsTravelTime = true;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveSeLogerPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur SeLoger`
      );
    }

    const geoFilter = resolveGeoFilter(options, true);
    const location = await buildSeLogerLocation(options.city, place, geoFilter);
    const searchUrl = buildSeLogerSearchUrl(options, location);
    const allCards = await fetchAllSeLogerClassifieds(searchUrl);
    const scrapedAt = new Date().toISOString();

    return allCards.map((card) => this.mapCard(card, scrapedAt, place.name));
  }

  private mapCard(
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
      scrapedAt,
    };
  }
}
