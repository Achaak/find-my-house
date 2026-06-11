import type { Listing } from "../types/listing.js";
import {
  buildBienIciSearchFilters,
  computeBienIciTravelZone,
  fetchAllBienIciAds,
  type BienIciZoneIdsByTypes,
} from "../utils/bieniciApi.js";
import { isWithinRadiusKm, type GeoPoint } from "../utils/geo.js";
import { resolveGeoFilter } from "../utils/geoFilter.js";
import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../utils/geocode.js";
import type { Scraper, ScraperOptions } from "./types.js";

type BienIciBlurInfo = {
  position?: { lat: number; lon: number };
  centroid?: { lat: number; lon: number };
};

type BienIciAd = {
  id: string;
  title: string;
  price: number;
  surfaceArea?: number;
  landSurfaceArea?: number;
  roomsQuantity?: number;
  bedroomsQuantity?: number;
  newProperty?: boolean;
  blurInfo?: BienIciBlurInfo;
  city: string;
  postalCode?: string;
  description?: string;
  photos?: { url_photo: string }[];
  propertyType?: string;
  url?: string;
};

function extractAdCoords(ad: BienIciAd): GeoPoint | null {
  const position = ad.blurInfo?.position ?? ad.blurInfo?.centroid;
  if (!position) return null;
  return { lat: position.lat, lng: position.lon };
}

async function resolveZoneIdsByTypes(
  options: ScraperOptions,
  place: NonNullable<Awaited<ReturnType<typeof resolveBienIciPlace>>>
): Promise<BienIciZoneIdsByTypes> {
  const geoFilter = resolveGeoFilter(options, true);

  if (geoFilter.mode === "travel") {
    const origin = (await resolveBienIciTravelOrigin(options.city)) ?? {
      center: place.center,
      address: place.name,
    };
    const zoneId = await computeBienIciTravelZone({
      center: origin.center,
      address: origin.address,
      durationMinutes: geoFilter.maxTravelMinutes,
    });
    return { travelTimeZone: [zoneId] };
  }

  if (geoFilter.mode === "radius") {
    const zoneIds =
      place.departmentZoneIds.length > 0
        ? place.departmentZoneIds
        : place.cityZoneIds;
    return { zoneIds };
  }

  return { zoneIds: place.cityZoneIds };
}

export class BienIciScraper implements Scraper {
  readonly name = "bienici";
  readonly supportsTravelTime = true;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveBienIciPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur BienIci`
      );
    }

    const geoFilter = resolveGeoFilter(options, true);
    const zoneIdsByTypes = await resolveZoneIdsByTypes(options, place);

    if (
      !zoneIdsByTypes.zoneIds?.length &&
      !zoneIdsByTypes.travelTimeZone?.length
    ) {
      throw new Error(`Aucune zone BienIci trouvée pour "${options.city}"`);
    }

    const filters = buildBienIciSearchFilters(options, zoneIdsByTypes);
    let allAds = await fetchAllBienIciAds<BienIciAd>(filters);
    const scrapedAt = new Date().toISOString();

    if (geoFilter.mode === "radius") {
      const radiusKm = geoFilter.radiusKm;
      allAds = allAds.filter((ad) => {
        const coords = extractAdCoords(ad);
        return (
          coords !== null && isWithinRadiusKm(coords, place.center, radiusKm)
        );
      });
    }

    return allAds.map((ad) => this.mapAd(ad, scrapedAt, place.name));
  }

  private mapAd(
    ad: BienIciAd,
    scrapedAt: string,
    fallbackCity: string
  ): Listing {
    const url = ad.url ?? `https://www.bienici.com/annonce/${ad.id}`;
    const coords = extractAdCoords(ad);

    return {
      externalId: ad.id,
      source: "bienici",
      title: ad.title,
      price: ad.price,
      surface: ad.surfaceArea ?? null,
      landSurface: ad.landSurfaceArea ?? null,
      rooms: ad.roomsQuantity ?? null,
      bedrooms: ad.bedroomsQuantity ?? null,
      isNewProperty: ad.newProperty ?? null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      city: ad.city || fallbackCity,
      postalCode: ad.postalCode ?? null,
      url,
      description: ad.description ?? null,
      imageUrl: ad.photos?.[0]?.url_photo ?? null,
      propertyType: ad.propertyType ?? null,
      scrapedAt,
    };
  }
}
