import type { PropertyEnrichmentPatch } from "../../types/enrichment.js";
import type { Listing } from "../../types/listing.js";
import { normalizeEnergyClass } from "../energy/energyClass.js";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../energy/energyMetrics.js";
import { sanitizePositiveNumber } from "../listing/amenities.js";
import { extractLeboncoinListingExtras } from "./attributes.js";
import {
  getLeboncoinAttribute,
  parseLeboncoinNumber,
  type LeboncoinAd,
} from "./client.js";

function leboncoinEnergyMetrics(ad: LeboncoinAd) {
  return mergeEnergyMetrics(
    {
      dpeConsumptionKwhM2:
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "energy_consumption")) ??
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "dpe_consumption")),
      gesEmissionKgM2:
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "ges_emission")) ??
        parseLeboncoinNumber(getLeboncoinAttribute(ad, "ghg_emission")),
    },
    parseEnergyMetricsFromText(ad.body)
  );
}

function leboncoinPropertyType(ad: LeboncoinAd): string | null {
  const propertyTypeAttr = ad.attributes.find(
    (attr) => attr.key === "real_estate_type"
  );
  return propertyTypeAttr?.value_label ?? propertyTypeAttr?.value ?? null;
}

export function leboncoinScrapeImageUrl(ad: LeboncoinAd): string | null {
  const images = ad.images;
  if (!images) return null;

  const fromLarge = images.urls_large?.find((url) => url.trim());
  if (fromLarge) return fromLarge.trim();

  const fromStandard = images.urls?.find((url) => url.trim());
  if (fromStandard) return fromStandard.trim();

  const thumb = images.thumb_url?.trim();
  if (!thumb) return null;
  return thumb;
}

function leboncoinDimensions(ad: LeboncoinAd) {
  return {
    surface: sanitizePositiveNumber(
      parseLeboncoinNumber(getLeboncoinAttribute(ad, "square"))
    ),
    landSurface: sanitizePositiveNumber(
      parseLeboncoinNumber(getLeboncoinAttribute(ad, "land_plot_surface"))
    ),
    rooms: sanitizePositiveNumber(
      parseLeboncoinNumber(getLeboncoinAttribute(ad, "rooms"))
    ),
    bedrooms: sanitizePositiveNumber(
      parseLeboncoinNumber(getLeboncoinAttribute(ad, "bedrooms"))
    ),
  };
}

export function mapLeboncoinAdToListing(
  ad: LeboncoinAd,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  const sellType = getLeboncoinAttribute(ad, "immo_sell_type");
  const metrics = leboncoinEnergyMetrics(ad);
  const extras = extractLeboncoinListingExtras(ad);
  const dimensions = leboncoinDimensions(ad);

  return {
    externalId: String(ad.list_id),
    source: "leboncoin",
    title: ad.subject,
    price: ad.price[0] ?? 0,
    ...dimensions,
    isNewProperty:
      sellType === "new" ? true : sellType === "old" ? false : null,
    latitude: ad.location.lat,
    longitude: ad.location.lng,
    city: ad.location.city || fallbackCity,
    postalCode: ad.location.zipcode ?? null,
    url: ad.url,
    description: ad.body,
    imageUrl: leboncoinScrapeImageUrl(ad),
    propertyType: leboncoinPropertyType(ad),
    dpeClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "energy_rate")),
    gesClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "ges")),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
    ...extras,
    scrapedAt,
  };
}

export function mapLeboncoinAdToEnrichmentPatch(
  ad: LeboncoinAd
): PropertyEnrichmentPatch {
  const metrics = leboncoinEnergyMetrics(ad);
  const extras = extractLeboncoinListingExtras(ad);
  const dimensions = leboncoinDimensions(ad);

  return {
    description: ad.body,
    ...dimensions,
    latitude: ad.location.lat,
    longitude: ad.location.lng,
    dpeClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "energy_rate")),
    gesClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "ges")),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
    ...extras,
  };
}
