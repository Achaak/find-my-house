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
    maxPrice: Number(process.env.SCRAPE_MAX_PRICE ?? "500000"),
    minSurface: Number(process.env.SCRAPE_MIN_SURFACE ?? "30"),
    minLandSurface: process.env.SCRAPE_MIN_LAND_SURFACE
      ? Number(process.env.SCRAPE_MIN_LAND_SURFACE)
      : undefined,
    minRooms: process.env.SCRAPE_MIN_ROOMS
      ? Number(process.env.SCRAPE_MIN_ROOMS)
      : undefined,
    minBedrooms: process.env.SCRAPE_MIN_BEDROOMS
      ? Number(process.env.SCRAPE_MIN_BEDROOMS)
      : undefined,
    ancienOnly: process.env.SCRAPE_ANCIEN_ONLY === "true",
    radiusKm: process.env.SCRAPE_RADIUS_KM
      ? Number(process.env.SCRAPE_RADIUS_KM)
      : undefined,
    maxTravelMinutes: process.env.SCRAPE_MAX_TRAVEL_MINUTES
      ? Number(process.env.SCRAPE_MAX_TRAVEL_MINUTES)
      : undefined,
  },
  database: {
    url:
      process.env.DATABASE_URL ??
      `file:${process.env.DATABASE_PATH ?? "./data/listings.db"}`,
  },
};
