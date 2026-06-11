import { config as loadDotenv } from "dotenv";

loadDotenv();
loadDotenv({ path: ".env.local", override: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

function parseRequiredPositiveNumber(
  name: string,
  raw: string | undefined,
  fallback: number
): number {
  const value = raw ?? String(fallback);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Variable d'environnement invalide: ${name}=${value}`);
  }
  return parsed;
}

function parseOptionalPositiveNumber(
  name: string,
  raw: string | undefined
): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Variable d'environnement invalide: ${name}=${raw}`);
  }
  return parsed;
}

export const config = {
  discord: {
    token: requireEnv("DISCORD_TOKEN"),
    clientId: requireEnv("DISCORD_CLIENT_ID"),
    guildId: process.env.DISCORD_GUILD_ID,
    channelId: process.env.DISCORD_CHANNEL_ID,
  },
  scrape: {
    cron: process.env.SCRAPE_CRON ?? "0 */2 * * *",
    city: process.env.SCRAPE_CITY ?? "Paris",
    maxPrice: parseRequiredPositiveNumber(
      "SCRAPE_MAX_PRICE",
      process.env.SCRAPE_MAX_PRICE,
      500_000
    ),
    minSurface: parseRequiredPositiveNumber(
      "SCRAPE_MIN_SURFACE",
      process.env.SCRAPE_MIN_SURFACE,
      30
    ),
    minLandSurface: parseOptionalPositiveNumber(
      "SCRAPE_MIN_LAND_SURFACE",
      process.env.SCRAPE_MIN_LAND_SURFACE
    ),
    minRooms: parseOptionalPositiveNumber(
      "SCRAPE_MIN_ROOMS",
      process.env.SCRAPE_MIN_ROOMS
    ),
    minBedrooms: parseOptionalPositiveNumber(
      "SCRAPE_MIN_BEDROOMS",
      process.env.SCRAPE_MIN_BEDROOMS
    ),
    ancienOnly: process.env.SCRAPE_ANCIEN_ONLY === "true",
    radiusKm: parseOptionalPositiveNumber(
      "SCRAPE_RADIUS_KM",
      process.env.SCRAPE_RADIUS_KM
    ),
    maxTravelMinutes: parseOptionalPositiveNumber(
      "SCRAPE_MAX_TRAVEL_MINUTES",
      process.env.SCRAPE_MAX_TRAVEL_MINUTES
    ),
    /** When set, only these scrapers run (e.g. bienici,leboncoin). */
    scrapers: process.env.SCRAPE_SCRAPERS
      ? process.env.SCRAPE_SCRAPERS.split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : undefined,
  },
  database: {
    url:
      process.env.DATABASE_URL ??
      `file:${process.env.DATABASE_PATH ?? "./data/listings.db"}`,
  },
};
