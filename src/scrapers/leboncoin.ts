import type { Listing } from "../types/listing.js";
import { isWithinRadiusKm, type GeoPoint } from "../utils/geo.js";
import { resolveScraperGeoFilter } from "../utils/geoFilter.js";
import { resolveGeoSearchCenter } from "../utils/geocode.js";
import {
  buildLeboncoinAreaLocation,
  buildLeboncoinSearchBody,
  fetchLeboncoinAds,
  getLeboncoinAttribute,
  parseLeboncoinNumber,
  resolveLeboncoinPlace,
  type LeboncoinAd,
} from "../utils/leboncoinApi.js";
import { normalizeEnergyClass } from "../utils/energyClass.js";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../utils/energyMetrics.js";
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

    const geoFilter = resolveScraperGeoFilter(options, false);
    let searchLocation = place.location;
    let radiusFilter: { center: GeoPoint; radiusKm: number } | null = null;

    if (geoFilter.mode === "radius") {
      const searchCenter =
        options.maxTravelMinutes !== undefined
          ? ((await resolveGeoSearchCenter(options.city))?.center ??
            place.center)
          : place.center;
      searchLocation = buildLeboncoinAreaLocation(
        place,
        geoFilter.radiusKm,
        searchCenter
      );
      radiusFilter = { center: searchCenter, radiusKm: geoFilter.radiusKm };
    }

    const body = buildLeboncoinSearchBody(options, searchLocation);
    let allAds = await fetchLeboncoinAds(body);

    if (radiusFilter) {
      const { center, radiusKm } = radiusFilter;
      allAds = allAds.filter((ad) =>
        isWithinRadiusKm(
          { lat: ad.location.lat, lng: ad.location.lng },
          center,
          radiusKm
        )
      );
    }
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
    const metrics = mergeEnergyMetrics(
      {
        dpeConsumptionKwhM2:
          parseLeboncoinNumber(
            getLeboncoinAttribute(ad, "energy_consumption")
          ) ??
          parseLeboncoinNumber(getLeboncoinAttribute(ad, "dpe_consumption")),
        gesEmissionKgM2:
          parseLeboncoinNumber(getLeboncoinAttribute(ad, "ges_emission")) ??
          parseLeboncoinNumber(getLeboncoinAttribute(ad, "ghg_emission")),
      },
      parseEnergyMetricsFromText(ad.body)
    );

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
      dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
      gesEmissionKgM2: metrics.gesEmissionKgM2,
      scrapedAt,
    };
  }
}
