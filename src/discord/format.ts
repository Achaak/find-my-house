import type { ListingSource, PropertyRow } from "../types/listing.js";

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
  const parts = [
    `**#${String(property.id)}** — ${property.title}`,
    `💰 ${formatPrice(property.price)}`,
    property.surface ? `📐 ${String(property.surface)} m²` : null,
    property.landSurface
      ? `🌳 ${String(property.landSurface)} m² terrain`
      : null,
    property.rooms ? `🛏️ ${String(property.rooms)} pièces` : null,
    property.bedrooms ? `🛌 ${String(property.bedrooms)} chambres` : null,
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
  return {
    title: property.title,
    url: property.url,
    description: [
      `**Prix:** ${formatPrice(property.price)}`,
      property.surface ? `**Surface:** ${String(property.surface)} m²` : null,
      property.landSurface
        ? `**Terrain:** ${String(property.landSurface)} m²`
        : null,
      property.rooms ? `**Pièces:** ${String(property.rooms)}` : null,
      property.bedrooms ? `**Chambres:** ${String(property.bedrooms)}` : null,
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
