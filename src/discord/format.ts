import type { ListingSource, PropertyRow } from "../types/listing.js";
import { formatEnergyClasses } from "../utils/energyClass.js";

const SOURCE_LABELS: Record<ListingSource, string> = {
  bienici: "Bien'ici",
  leboncoin: "Leboncoin",
  seloger: "SeLoger",
};

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

function formatSourceLabel(source: ListingSource): string {
  return SOURCE_LABELS[source];
}

function formatSources(property: PropertyRow): string {
  const sources = [...new Set(property.publications.map((p) => p.source))];
  return sources.map(formatSourceLabel).join(", ");
}

export function formatPublicationLinks(property: PropertyRow): string {
  const publications =
    property.publications.length > 0
      ? property.publications
      : [{ source: property.source, url: property.url } as const];

  const links = publications
    .map((p) => `[${formatSourceLabel(p.source)}](${p.url})`)
    .join(" • ");

  return `**Liens :** ${links}`;
}

export function formatListing(property: PropertyRow): string {
  const energyLabel = formatEnergyClasses(property.dpeClass, property.gesClass);
  const parts = [
    `**#${String(property.id)}** — ${property.title}`,
    formatPriceDrop(property) ?? `💰 ${formatPrice(property.price)}`,
    property.surface ? `📐 ${String(property.surface)} m²` : null,
    property.landSurface
      ? `🌳 ${String(property.landSurface)} m² terrain`
      : null,
    property.rooms ? `🛏️ ${String(property.rooms)} pièces` : null,
    property.bedrooms ? `🛌 ${String(property.bedrooms)} chambres` : null,
    energyLabel ? `⚡ ${energyLabel}` : null,
    property.isNewProperty === false
      ? "🏠 Ancien"
      : property.isNewProperty === true
        ? "🏗️ Neuf"
        : null,
    `📍 ${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`,
    formatPublicationLinks(property),
    `_Sources: ${formatSources(property)} — ${new Date(property.firstSeenAt).toLocaleString("fr-FR")}_`,
  ];

  return parts.filter(Boolean).join("\n");
}

export function formatListingEmbed(property: PropertyRow) {
  const priceDrop = formatPriceDrop(property);
  const energyLabel = formatEnergyClasses(property.dpeClass, property.gesClass);

  return {
    title: property.title,
    url: property.url,
    color: priceDrop ? 0x2ecc71 : undefined,
    description: [
      priceDrop ?? `**Prix:** ${formatPrice(property.price)}`,
      property.surface ? `**Surface:** ${String(property.surface)} m²` : null,
      property.landSurface
        ? `**Terrain:** ${String(property.landSurface)} m²`
        : null,
      property.rooms ? `**Pièces:** ${String(property.rooms)}` : null,
      property.bedrooms ? `**Chambres:** ${String(property.bedrooms)}` : null,
      energyLabel ? `**Énergie:** ${energyLabel}` : null,
      property.isNewProperty === false
        ? "**État:** Ancien"
        : property.isNewProperty === true
          ? "**État:** Neuf"
          : null,
      `**Ville:** ${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`,
      property.propertyType ? `**Type:** ${property.propertyType}` : null,
      formatPublicationLinks(property),
    ]
      .filter(Boolean)
      .join("\n"),
    image: property.imageUrl ? { url: property.imageUrl } : undefined,
    footer: {
      text: `#${String(property.id)} • ${formatSources(property)} • ${new Date(property.firstSeenAt).toLocaleString("fr-FR")}`,
    },
  };
}
