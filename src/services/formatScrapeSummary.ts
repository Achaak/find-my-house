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
    `⚠️ **${String(errors.length)} scraper(s) failed**`,
    ...errors.map((error) => `• **${error.scraper}** — ${error.message}`),
  ];
}

export function formatScrapeSummary(
  result: ExtendedScrapeResult,
  options: ScrapeSummaryOptions
): string {
  const zoneLabel = options.zoneLabel ?? "";
  const lines = [
    `Scrape complete for **${options.city}**${zoneLabel}`,
    `📥 ${String(result.found)} found`,
    `✅ ${String(result.inserted)} new properties`,
    `🔗 ${String(result.linked)} publications linked (cross-site duplicate)`,
    `🔄 ${String(result.updated)} updated`,
    `📉 ${String(result.priceDropListings.length)} price drop(s)`,
    `⏭️ ${String(result.skipped)} unchanged`,
    `🚫 ${String(result.deactivated)} publication(s) deactivated`,
    ...formatScrapeErrors(result.errors),
  ];

  if (
    options.totalProperties !== undefined &&
    options.totalPublications !== undefined
  ) {
    lines.push(
      `📊 Total: **${String(options.totalProperties)}** properties, **${String(options.totalPublications)}** publications`
    );
  }

  return lines.join("\n");
}
