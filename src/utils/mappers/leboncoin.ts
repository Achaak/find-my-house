import type { PropertyEnrichmentPatch } from "../../types/enrichment.js";
import type { Listing } from "../../types/listing.js";
import {
  getLeboncoinAttribute,
  parseLeboncoinNumber,
  type LeboncoinAd,
} from "../leboncoinApi.js";
import { normalizeEnergyClass } from "../energyClass.js";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../energyMetrics.js";

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

export function mapLeboncoinAdToListing(
  ad: LeboncoinAd,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  const sellType = getLeboncoinAttribute(ad, "immo_sell_type");
  const metrics = leboncoinEnergyMetrics(ad);

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
    propertyType: leboncoinPropertyType(ad),
    dpeClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "energy_rate")),
    gesClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "ges")),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
    scrapedAt,
  };
}

export function mapLeboncoinAdToEnrichmentPatch(
  ad: LeboncoinAd
): PropertyEnrichmentPatch {
  const metrics = leboncoinEnergyMetrics(ad);

  return {
    description: ad.body,
    surface: parseLeboncoinNumber(getLeboncoinAttribute(ad, "square")),
    landSurface: parseLeboncoinNumber(
      getLeboncoinAttribute(ad, "land_plot_surface")
    ),
    rooms: parseLeboncoinNumber(getLeboncoinAttribute(ad, "rooms")),
    bedrooms: parseLeboncoinNumber(getLeboncoinAttribute(ad, "bedrooms")),
    latitude: ad.location.lat,
    longitude: ad.location.lng,
    imageUrl:
      ad.images?.urls_large?.[0] ??
      ad.images?.urls?.[0] ??
      ad.images?.thumb_url ??
      null,
    dpeClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "energy_rate")),
    gesClass: normalizeEnergyClass(getLeboncoinAttribute(ad, "ges")),
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2,
    gesEmissionKgM2: metrics.gesEmissionKgM2,
  };
}
