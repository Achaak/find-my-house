import { z } from "zod";
import { parseNotifyServices } from "../homeAssistant/notifyServices.js";

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
    SCRAPE_POSTAL_CODE: z.preprocess(
      (value) => {
        if (value === undefined || value === null) return undefined;
        if (typeof value === "string" && value.trim() === "") return undefined;
        return value;
      },
      z
        .string()
        .regex(/^\d{5}$/, "SCRAPE_POSTAL_CODE must be 5 digits")
        .optional()
    ),
    SCRAPE_MAX_PRICE: z.coerce.number().int().positive().default(500_000),
    SCRAPE_MIN_SURFACE: z.coerce.number().positive().default(30),
    SCRAPE_MIN_LAND_SURFACE: optionalPositiveNumber,
    SCRAPE_MIN_ROOMS: optionalPositiveInteger,
    SCRAPE_MIN_BEDROOMS: optionalPositiveInteger,
    SCRAPE_ANCIEN_ONLY: z.preprocess((value) => value === "true", z.boolean()),
    SCRAPE_MAX_TRAVEL_MINUTES: optionalPositiveInteger,
    SCRAPE_MAX_PAGES: z.coerce.number().int().positive().default(20),
    SCRAPE_SCRAPERS: z.string().optional(),
    ENRICHMENT_CRON: z.string().min(1).default("0 * * * *"),
    ENRICHMENT_DISABLED: z.preprocess((value) => value === "true", z.boolean()),
    ENRICHMENT_MIN_COMPAT_SCORE: z.coerce.number().min(0).max(100).default(0),
    ENRICHMENT_BATCH_LIMIT: z.coerce.number().int().positive().default(20),
    ENRICHMENT_SEARCH_LIMIT: z.coerce.number().int().positive().default(1000),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_PATH: z.string().min(1).optional(),
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
        postalCode: env.SCRAPE_POSTAL_CODE,
        maxPrice: env.SCRAPE_MAX_PRICE,
        minSurface: env.SCRAPE_MIN_SURFACE,
        minLandSurface: env.SCRAPE_MIN_LAND_SURFACE,
        minRooms: env.SCRAPE_MIN_ROOMS,
        minBedrooms: env.SCRAPE_MIN_BEDROOMS,
        ancienOnly: env.SCRAPE_ANCIEN_ONLY,
        maxTravelMinutes: env.SCRAPE_MAX_TRAVEL_MINUTES,
        maxPages: env.SCRAPE_MAX_PAGES,
        scrapers,
      },
      enrichment: {
        cron: env.ENRICHMENT_CRON,
        enabled: !env.ENRICHMENT_DISABLED,
        minCompatScore: env.ENRICHMENT_MIN_COMPAT_SCORE,
        batchLimit: env.ENRICHMENT_BATCH_LIMIT,
        searchLimit: env.ENRICHMENT_SEARCH_LIMIT,
      },
      database: {
        url:
          env.DATABASE_URL ??
          `file:${env.DATABASE_PATH ?? "./data/listings.db"}`,
      },
    };
  });

const optionalNonEmptyString = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().min(1).optional());

export const notificationsEnvSchema = z
  .object({
    NOTIFICATIONS_ENABLED: z.preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }, z.boolean().optional()),
    NOTIFY_SERVICE: z.string().min(1).default("persistent_notification.create"),
    NOTIFICATIONS_MAX: z.coerce.number().int().positive().default(5),
    HOME_ASSISTANT_TOKEN: optionalNonEmptyString,
  })
  .transform((env) => ({
    notifications: {
      enabled:
        env.NOTIFICATIONS_ENABLED ?? Boolean(process.env.SUPERVISOR_TOKEN),
      notifyServices: parseNotifyServices(env.NOTIFY_SERVICE),
      maxNotifications: env.NOTIFICATIONS_MAX,
      token: env.HOME_ASSISTANT_TOKEN,
    },
  }));

export type ScrapeConfig = z.infer<typeof scrapeEnvSchema>;
export type NotificationsConfig = z.infer<typeof notificationsEnvSchema>;
export type AppConfig = z.infer<typeof appEnvSchema>;

export const browserEnvSchema = z
  .object({
    CLOAKBROWSER_PROFILE_DIR: optionalNonEmptyString,
    CLOAKBROWSER_HEADLESS: optionalNonEmptyString,
    CLOAKBROWSER_HUMANIZE: optionalNonEmptyString,
    CLOAKBROWSER_FINGERPRINT: optionalNonEmptyString,
    CLOAKBROWSER_STORAGE_QUOTA: optionalNonEmptyString,
    CLOAKBROWSER_PROXY: optionalNonEmptyString,
    CLOAKBROWSER_GEOIP: optionalNonEmptyString,
    CLOAKBROWSER_RESET_PROFILE: optionalNonEmptyString,
  })
  .transform((env) => {
    const proxy = env.CLOAKBROWSER_PROXY;
    return {
      browser: {
        profileDir: env.CLOAKBROWSER_PROFILE_DIR,
        headless: env.CLOAKBROWSER_HEADLESS !== "false",
        humanize: env.CLOAKBROWSER_HUMANIZE !== "false",
        fingerprint: env.CLOAKBROWSER_FINGERPRINT?.trim(),
        storageQuota: env.CLOAKBROWSER_STORAGE_QUOTA?.trim(),
        proxy,
        geoip: proxy ? env.CLOAKBROWSER_GEOIP !== "false" : false,
        resetProfile: env.CLOAKBROWSER_RESET_PROFILE === "true",
      },
    };
  });

export function formatConfigError(error: z.ZodError, section: string): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Invalid ${section} configuration: ${details}`;
}

export function parseScrapeConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = scrapeEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error, "scrape"));
  }
  return result.data;
}

export type BrowserConfig = z.infer<typeof browserEnvSchema>;

export function parseBrowserConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = browserEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error, "browser"));
  }
  return result.data;
}

export function parseNotificationsConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = notificationsEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error, "notifications"));
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
