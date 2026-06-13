import type { ListingSource, PropertyRow } from "../types/listing.js";
import { normalizeAvivImageUrl } from "../utils/classifiedPortal/helpers.js";
import { formatEnergyClasses } from "../utils/energy/energyClass.js";
import { formatCompatibilityLabel } from "../utils/compatibility/score.js";

const SOURCE_LABELS: Record<ListingSource, string> = {
  bienici: "Bien'ici",
  leboncoin: "Leboncoin",
  seloger: "SeLoger",
  logicimmo: "Logic-Immo",
};

const SOURCE_COLORS: Record<ListingSource, number> = {
  bienici: 0x00a8e8,
  leboncoin: 0xff6e14,
  seloger: 0xe00034,
  logicimmo: 0x003b7a,
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: "Maison",
  flat: "Appartement",
  apartment: "Appartement",
  loft: "Loft",
  castle: "Château",
  townhouse: "Maison de ville",
  villa: "Villa",
  maison: "Maison",
  appartement: "Appartement",
};

type EmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type ListingEmbed = {
  title: string;
  url: string;
  color: number;
  author?: { name: string };
  description: string;
  fields: EmbedField[];
  image?: { url: string };
  footer: { text: string };
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function isValidEmbedImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return url.length <= 2048;
  } catch {
    return false;
  }
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatPriceDrop(property: PropertyRow): string | null {
  if (property.price >= property.firstPrice) return null;

  const drop = property.firstPrice - property.price;
  const pct = Math.round((drop / property.firstPrice) * 100);
  return `📉 **Baisse de prix** : ~~${formatPrice(property.firstPrice)}~~ → **${formatPrice(property.price)}** (−${formatPrice(drop)}, −${String(pct)} %)`;
}

export function formatSourceLabel(source: ListingSource): string {
  return SOURCE_LABELS[source];
}

function formatSources(property: PropertyRow): string {
  const sources = [...new Set(property.publications.map((p) => p.source))];
  return sources.map(formatSourceLabel).join(", ");
}

function getPrimarySource(property: PropertyRow): ListingSource {
  return property.publications[0]?.source ?? property.source;
}

function formatPropertyType(propertyType: string | null): string | null {
  if (!propertyType) return null;

  const normalized = propertyType.trim().toLowerCase();
  return PROPERTY_TYPE_LABELS[normalized] ?? propertyType;
}

function formatPricePerSqm(price: number, surface: number): string {
  return `${formatPrice(Math.round(price / surface))}/m²`;
}

function formatNewPropertyLabel(isNewProperty: boolean | null): string | null {
  if (isNewProperty === false) return "Ancien";
  if (isNewProperty === true) return "Neuf";
  return null;
}

function formatLocation(property: PropertyRow): string {
  if (property.address) {
    return truncate(
      `${property.address}\n${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`,
      1024
    );
  }

  return `${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`;
}

function formatEnergyDetails(property: PropertyRow): string | null {
  const energyLabel = formatEnergyClasses(property.dpeClass, property.gesClass);
  if (!energyLabel) return null;

  const details = [
    property.dpeConsumptionKwhM2
      ? `${String(property.dpeConsumptionKwhM2)} kWh/m²/an`
      : null,
    property.gesEmissionKgM2
      ? `${String(property.gesEmissionKgM2)} kg CO₂/m²/an`
      : null,
  ].filter(Boolean);

  if (details.length > 0) {
    return `${energyLabel}\n${details.join(" · ")}`;
  }

  return energyLabel;
}

export function formatPublicationLinks(property: PropertyRow): string {
  const activePublications = property.publications.filter(
    (publication) => publication.isActive
  );
  const publications =
    activePublications.length > 0
      ? activePublications
      : property.publications.length > 0
        ? property.publications
        : [{ source: property.source, url: property.url } as const];

  const links = publications
    .map((p) => `[${formatSourceLabel(p.source)}](${p.url})`)
    .join(" • ");

  return links;
}

function buildListingFields(
  property: PropertyRow,
  compatibilityScore?: number
): EmbedField[] {
  const fields: EmbedField[] = [];
  const propertyType = formatPropertyType(property.propertyType);
  const newPropertyLabel = formatNewPropertyLabel(property.isNewProperty);

  if (compatibilityScore !== undefined) {
    fields.push({
      name: "Compatibilité",
      value: formatCompatibilityLabel(compatibilityScore),
      inline: true,
    });
  }

  if (property.surface) {
    fields.push({
      name: "Surface",
      value: `${String(property.surface)} m²`,
      inline: true,
    });
  }

  if (property.landSurface) {
    fields.push({
      name: "Terrain",
      value: `${String(property.landSurface)} m²`,
      inline: true,
    });
  }

  if (property.rooms) {
    fields.push({
      name: "Pièces",
      value: String(property.rooms),
      inline: true,
    });
  }

  if (property.bedrooms) {
    fields.push({
      name: "Chambres",
      value: String(property.bedrooms),
      inline: true,
    });
  }

  if (property.bathrooms) {
    fields.push({
      name: "Salles de bain",
      value: String(property.bathrooms),
      inline: true,
    });
  }

  if (property.constructionYear) {
    fields.push({
      name: "Construction",
      value: String(property.constructionYear),
      inline: true,
    });
  }

  if (property.parkingSpaces) {
    fields.push({
      name: "Parking",
      value: String(property.parkingSpaces),
      inline: true,
    });
  }

  if (propertyType) {
    fields.push({
      name: "Type",
      value: propertyType,
      inline: true,
    });
  }

  if (newPropertyLabel) {
    fields.push({
      name: "État",
      value: newPropertyLabel,
      inline: true,
    });
  }

  fields.push({
    name: "Localisation",
    value: formatLocation(property),
    inline: false,
  });

  const comfortDetails = [
    property.heating ? `Chauffage : ${property.heating}` : null,
    property.orientation ? `Exposition : ${property.orientation}` : null,
    property.propertyCondition ? `État : ${property.propertyCondition}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (comfortDetails) {
    fields.push({
      name: "Confort",
      value: truncate(comfortDetails, 1024),
      inline: false,
    });
  }

  const energyDetails = formatEnergyDetails(property);
  if (energyDetails) {
    fields.push({
      name: "Énergie",
      value: truncate(energyDetails, 1024),
      inline: false,
    });
  }

  if (property.highlights?.length) {
    fields.push({
      name: "Atouts",
      value: truncate(property.highlights.join(" · "), 1024),
      inline: false,
    });
  }

  fields.push({
    name: "Liens",
    value: formatPublicationLinks(property),
    inline: false,
  });

  return fields;
}

function buildListingDescription(property: PropertyRow): string {
  const priceDrop = formatPriceDrop(property);
  if (priceDrop) return priceDrop;

  const priceLine = `**${formatPrice(property.price)}**`;
  if (property.surface && property.surface > 0) {
    return `${priceLine} · ${formatPricePerSqm(property.price, property.surface)}`;
  }

  return priceLine;
}

function getEmbedColor(property: PropertyRow): number {
  if (property.price < property.firstPrice) return 0x2ecc71;
  return SOURCE_COLORS[getPrimarySource(property)];
}

function buildEmbedAuthor(property: PropertyRow): { name: string } {
  const sources = formatSources(property);
  const propertyType = formatPropertyType(property.propertyType);
  const parts = [sources, propertyType].filter(Boolean);
  return { name: parts.join(" · ") };
}

export function formatListingEmbed(
  property: PropertyRow,
  options?: { compatibilityScore?: number }
): ListingEmbed {
  return {
    title: truncate(property.title, 256),
    url: property.url,
    color: getEmbedColor(property),
    author: buildEmbedAuthor(property),
    description: buildListingDescription(property),
    fields: buildListingFields(property, options?.compatibilityScore),
    image: isValidEmbedImageUrl(property.imageUrl)
      ? { url: normalizeAvivImageUrl(property.imageUrl) }
      : undefined,
    footer: {
      text: truncate(
        `#${String(property.id)} • ${new Date(property.firstSeenAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`,
        2048
      ),
    },
  };
}

export function formatListing(property: PropertyRow): string {
  const energyLabel = formatEnergyClasses(property.dpeClass, property.gesClass);
  const propertyType = formatPropertyType(property.propertyType);
  const parts = [
    `**#${String(property.id)}** — ${property.title}`,
    formatPriceDrop(property) ??
      (property.surface && property.surface > 0
        ? `💰 ${formatPrice(property.price)} · ${formatPricePerSqm(property.price, property.surface)}`
        : `💰 ${formatPrice(property.price)}`),
    [
      property.surface ? `📐 ${String(property.surface)} m²` : null,
      property.landSurface
        ? `🌳 ${String(property.landSurface)} m² terrain`
        : null,
      property.rooms ? `🛏️ ${String(property.rooms)} pièces` : null,
      property.bedrooms ? `🛌 ${String(property.bedrooms)} chambres` : null,
      property.bathrooms
        ? `🚿 ${String(property.bathrooms)} salle${property.bathrooms > 1 ? "s" : ""} de bain`
        : null,
      property.constructionYear
        ? `📅 ${String(property.constructionYear)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    property.highlights?.length
      ? `✨ ${property.highlights.join(" · ")}`
      : null,
    energyLabel ? `⚡ ${energyLabel}` : null,
    property.isNewProperty === false
      ? "🏠 Ancien"
      : property.isNewProperty === true
        ? "🏗️ Neuf"
        : null,
    propertyType ? `🏷️ ${propertyType}` : null,
    property.address
      ? `📍 ${property.address}`
      : `📍 ${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`,
    `🔗 ${formatPublicationLinks(property)}`,
    `_${formatSources(property)} — ${new Date(property.firstSeenAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}_`,
  ];

  return parts.filter(Boolean).join("\n");
}
