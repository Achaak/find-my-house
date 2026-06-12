import { z } from "zod";

const scraperNameSchema = z.enum([
  "bienici",
  "leboncoin",
  "seloger",
  "logicimmo",
]);

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.coerce.number().positive().optional());

const optionalPositiveInteger = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.coerce.number().int().positive().optional());

export const logLevelSchema = z
  .enum(["debug", "info", "warn", "error"])
  .default("info");

export const appEnvSchema = z
  .object({
    LOG_LEVEL: logLevelSchema.optional(),
  })
  .transform((env) => ({
    logLevel: env.LOG_LEVEL ?? "info",
  }));

export const scrapeEnvSchema = z
  .object({
    SCRAPE_CRON: z.string().min(1).default("0 */2 * * *"),
    SCRAPE_CITY: z.string().min(1).default("Paris"),
    SCRAPE_MAX_PRICE: z.coerce.number().int().positive().default(500_000),
    SCRAPE_MIN_SURFACE: z.coerce.number().positive().default(30),
    SCRAPE_MIN_LAND_SURFACE: optionalPositiveNumber,
    SCRAPE_MIN_ROOMS: optionalPositiveInteger,
    SCRAPE_MIN_BEDROOMS: optionalPositiveInteger,
    SCRAPE_ANCIEN_ONLY: z.preprocess((value) => value === "true", z.boolean()),
    SCRAPE_RADIUS_KM: optionalPositiveNumber,
    SCRAPE_MAX_TRAVEL_MINUTES: optionalPositiveInteger,
    SCRAPE_MAX_PAGES: z.coerce.number().int().positive().default(20),
    SCRAPE_SCRAPERS: z.string().optional(),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_PATH: z.string().min(1).optional(),
    LEBONCOIN_API_KEY: z.string().min(1).default("ba0c2dad52b3ec"),
  })
  .transform((env) => {
    const scrapers = env.SCRAPE_SCRAPERS
      ? env.SCRAPE_SCRAPERS.split(",")
          .map((name) => name.trim().toLowerCase())
          .filter(Boolean)
      : undefined;

    if (scrapers) {
      const scraperResult = scraperNameSchema.array().safeParse(scrapers);
      if (!scraperResult.success) {
        throw new Error(formatConfigError(scraperResult.error, "scrape"));
      }
    }

    return {
      scrape: {
        cron: env.SCRAPE_CRON,
        city: env.SCRAPE_CITY,
        maxPrice: env.SCRAPE_MAX_PRICE,
        minSurface: env.SCRAPE_MIN_SURFACE,
        minLandSurface: env.SCRAPE_MIN_LAND_SURFACE,
        minRooms: env.SCRAPE_MIN_ROOMS,
        minBedrooms: env.SCRAPE_MIN_BEDROOMS,
        ancienOnly: env.SCRAPE_ANCIEN_ONLY,
        radiusKm: env.SCRAPE_RADIUS_KM,
        maxTravelMinutes: env.SCRAPE_MAX_TRAVEL_MINUTES,
        maxPages: env.SCRAPE_MAX_PAGES,
        scrapers,
      },
      database: {
        url:
          env.DATABASE_URL ??
          `file:${env.DATABASE_PATH ?? "./data/listings.db"}`,
      },
      leboncoin: {
        apiKey: env.LEBONCOIN_API_KEY,
      },
    };
  });

export const discordEnvSchema = z
  .object({
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN est requis"),
    DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID est requis"),
    DISCORD_GUILD_ID: z.string().min(1).optional(),
    DISCORD_CHANNEL_ID: z.string().min(1).optional(),
    DISCORD_ADMIN_ROLE_ID: z.string().min(1).optional(),
  })
  .transform((env) => ({
    discord: {
      token: env.DISCORD_TOKEN,
      clientId: env.DISCORD_CLIENT_ID,
      guildId: env.DISCORD_GUILD_ID,
      channelId: env.DISCORD_CHANNEL_ID,
      adminRoleId: env.DISCORD_ADMIN_ROLE_ID,
    },
  }));

export type ScrapeConfig = z.infer<typeof scrapeEnvSchema>;
export type DiscordConfig = z.infer<typeof discordEnvSchema>;
export type AppConfig = z.infer<typeof appEnvSchema>;

export function formatConfigError(error: z.ZodError, section: string): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Configuration ${section} invalide: ${details}`;
}

export function parseScrapeConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = scrapeEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error, "scrape"));
  }
  return result.data;
}

export function parseDiscordConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = discordEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error, "Discord"));
  }
  return result.data;
}

export function parseAppConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = appEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error, "application"));
  }
  return result.data;
}
