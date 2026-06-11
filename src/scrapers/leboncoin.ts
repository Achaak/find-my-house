import type { Listing } from "../types/listing.js";
import { resolveGeoFilter } from "../utils/geoFilter.js";
import {
  buildLeboncoinAreaLocation,
  buildLeboncoinSearchBody,
  fetchAllLeboncoinAds,
  getLeboncoinAttribute,
  parseLeboncoinNumber,
  resolveLeboncoinPlace,
  type LeboncoinAd,
} from "../utils/leboncoinApi.js";
import { normalizeEnergyClass } from "../utils/energyClass.js";
import type { Scraper, ScraperOptions } from "./types.js";

export class LeboncoinScraper implements Scraper {
  readonly name = "leboncoin";
  readonly supportsTravelTime = false;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveLeboncoinPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur LeBonCoin`
      );
    }

    const geoFilter = resolveGeoFilter(options, false);
    const searchLocation =
      geoFilter.mode === "radius"
        ? buildLeboncoinAreaLocation(place, geoFilter.radiusKm)
        : place.location;
    const body = buildLeboncoinSearchBody(options, searchLocation);
    const allAds = await fetchAllLeboncoinAds(body);
    const scrapedAt = new Date().toISOString();

    return allAds.map((ad) => this.mapAd(ad, scrapedAt, place.name));
  }

  private mapAd(
    ad: LeboncoinAd,
    scrapedAt: string,
    fallbackCity: string
  ): Listing {
    const sellType = getLeboncoinAttribute(ad, "immo_sell_type");
    const propertyTypeAttr = ad.attributes.find(
      (attr) => attr.key === "real_estate_type"
    );
    const propertyType =
      propertyTypeAttr?.value_label ?? propertyTypeAttr?.value ?? null;

    return {
      externalId: String(ad.list_id),
      source: "leboncoin",
      title: ad.subject,
      price: ad.price[0] ?? 0,
      surface: parseLeboncoinNumber(getLeboncoinAttribute(ad, "square")),
      landSurface: parseLeboncoinNumber(
        getLeboncoinAttribute(ad, "land_plot_surface")
      ),
      rooms: parseLeboncoinNumber(getLeboncoinAttribute(ad, "rooms")),
      bedrooms: parseLeboncoinNumber(getLeboncoinAttribute(ad, "bedrooms")),
      isNewProperty:
        sellType === "new" ? true : sellType === "old" ? false : null,
      latitude: ad.location.lat,
      longitude: ad.location.lng,
      city: ad.location.city || fallbackCity,
      postalCode: ad.location.zipcode ?? null,
      url: ad.url,
      description: ad.body,
      imageUrl:
        ad.images?.urls_large?.[0] ??
        ad.images?.urls?.[0] ??
        ad.images?.thumb_url ??
        null,
      propertyType,
      dpeClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "energy_rate")),
      gesClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "ges")),
      scrapedAt,
    };
  }
}
