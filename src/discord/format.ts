import type { ListingRow } from "../types/listing.js";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatListing(listing: ListingRow): string {
  const parts = [
    `**#${String(listing.id)}** — ${listing.title}`,
    `💰 ${formatPrice(listing.price)}`,
    listing.surface ? `📐 ${String(listing.surface)} m²` : null,
    listing.landSurface ? `🌳 ${String(listing.landSurface)} m² terrain` : null,
    listing.rooms ? `🛏️ ${String(listing.rooms)} pièces` : null,
    listing.bedrooms ? `🛌 ${String(listing.bedrooms)} chambres` : null,
    listing.isNewProperty === false
      ? "🏠 Ancien"
      : listing.isNewProperty === true
        ? "🏗️ Neuf"
        : null,
    `📍 ${listing.city}${listing.postalCode ? ` (${listing.postalCode})` : ""}`,
    `🔗 ${listing.url}`,
    `_Source: ${listing.source} — ${new Date(listing.scrapedAt).toLocaleString("fr-FR")}_`,
  ];

  return parts.filter(Boolean).join("\n");
}

export function formatListingEmbed(listing: ListingRow) {
  return {
    title: listing.title,
    url: listing.url,
    description: [
      `**Prix:** ${formatPrice(listing.price)}`,
      listing.surface ? `**Surface:** ${String(listing.surface)} m²` : null,
      listing.landSurface
        ? `**Terrain:** ${String(listing.landSurface)} m²`
        : null,
      listing.rooms ? `**Pièces:** ${String(listing.rooms)}` : null,
      listing.bedrooms ? `**Chambres:** ${String(listing.bedrooms)}` : null,
      listing.isNewProperty === false
        ? "**État:** Ancien"
        : listing.isNewProperty === true
          ? "**État:** Neuf"
          : null,
      `**Ville:** ${listing.city}${listing.postalCode ? ` (${listing.postalCode})` : ""}`,
      listing.propertyType ? `**Type:** ${listing.propertyType}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    image: listing.imageUrl ? { url: listing.imageUrl } : undefined,
    footer: {
      text: `#${String(listing.id)} • ${listing.source} • ${new Date(listing.scrapedAt).toLocaleString("fr-FR")}`,
    },
  };
}
