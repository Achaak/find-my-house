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
    `**#${listing.id}** — ${listing.title}`,
    `💰 ${formatPrice(listing.price)}`,
    listing.surface ? `📐 ${listing.surface} m²` : null,
    listing.rooms ? `🛏️ ${listing.rooms} pièces` : null,
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
      listing.surface ? `**Surface:** ${listing.surface} m²` : null,
      listing.rooms ? `**Pièces:** ${listing.rooms}` : null,
      `**Ville:** ${listing.city}${listing.postalCode ? ` (${listing.postalCode})` : ""}`,
      listing.propertyType ? `**Type:** ${listing.propertyType}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    image: listing.imageUrl ? { url: listing.imageUrl } : undefined,
    footer: {
      text: `#${listing.id} • ${listing.source} • ${new Date(listing.scrapedAt).toLocaleString("fr-FR")}`,
    },
  };
}
