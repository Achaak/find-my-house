import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

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
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  },
  scrape: {
    cron: process.env.SCRAPE_CRON ?? "0 */2 * * *",
    city: process.env.SCRAPE_CITY ?? "Paris",
    maxPrice: Number(process.env.SCRAPE_MAX_PRICE ?? "500000"),
    minSurface: Number(process.env.SCRAPE_MIN_SURFACE ?? "30"),
  },
  database: {
    url:
      process.env.DATABASE_URL ??
      `file:${process.env.DATABASE_PATH ?? "./data/listings.db"}`,
  },
};
