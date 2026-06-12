import type { ExtendedScrapeResult } from "../types/listing.js";

export type ScrapeSummaryOptions = {
  city: string;
  zoneLabel?: string;
  totalProperties?: number;
  totalPublications?: number;
};

export function formatScrapeErrors(
  errors: ExtendedScrapeResult["errors"]
): string[] {
  if (errors.length === 0) return [];

  return [
    `⚠️ **${String(errors.length)} scraper(s) en échec**`,
    ...errors.map((error) => `• **${error.scraper}** — ${error.message}`),
  ];
}

export function formatScrapeSummary(
  result: ExtendedScrapeResult,
  options: ScrapeSummaryOptions
): string {
  const zoneLabel = options.zoneLabel ?? "";
  const lines = [
    `Scraping terminé pour **${options.city}**${zoneLabel}`,
    `📥 ${String(result.found)} trouvées`,
    `✅ ${String(result.inserted)} nouveaux biens`,
    `🔗 ${String(result.linked)} publications liées (doublon inter-sites)`,
    `🔄 ${String(result.updated)} mises à jour`,
    `📉 ${String(result.priceDropListings.length)} baisse(s) de prix`,
    `⏭️ ${String(result.skipped)} inchangées`,
    `🚫 ${String(result.deactivated)} publication(s) désactivée(s)`,
    ...formatScrapeErrors(result.errors),
  ];

  if (
    options.totalProperties !== undefined &&
    options.totalPublications !== undefined
  ) {
    lines.push(
      `📊 Total: **${String(options.totalProperties)}** biens, **${String(options.totalPublications)}** publications`
    );
  }

  return lines.join("\n");
}
