import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseAppConfig,
  parseDiscordConfig,
  parseScrapeConfig,
} from "./schema.js";

describe("parseScrapeConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("applies defaults for optional scrape settings", () => {
    const config = parseScrapeConfig({});

    expect(config.scrape.city).toBe("Paris");
    expect(config.scrape.maxPrice).toBe(500_000);
    expect(config.scrape.minSurface).toBe(30);
    expect(config.scrape.maxPages).toBe(20);
    expect(config.scrape.ancienOnly).toBe(false);
    expect(config.database.url).toBe("file:./data/listings.db");
    expect(config.leboncoin.apiKey).toBe("ba0c2dad52b3ec");
  });

  it("parses optional numeric filters and scraper list", () => {
    const config = parseScrapeConfig({
      SCRAPE_MIN_LAND_SURFACE: "1000",
      SCRAPE_SCRAPERS: "bienici, leboncoin",
      DATABASE_URL: "file:./tmp/test.db",
    });

    expect(config.scrape.minLandSurface).toBe(1000);
    expect(config.scrape.scrapers).toEqual(["bienici", "leboncoin"]);
    expect(config.database.url).toBe("file:./tmp/test.db");
  });

  it("rejects invalid scraper names", () => {
    expect(() =>
      parseScrapeConfig({ SCRAPE_SCRAPERS: "bienici,unknown" })
    ).toThrow(/Configuration scrape invalide/);
  });

  it("rejects non-positive numbers", () => {
    expect(() => parseScrapeConfig({ SCRAPE_MAX_PRICE: "0" })).toThrow(
      /Configuration scrape invalide/
    );
  });
});

describe("parseDiscordConfig", () => {
  it("requires Discord credentials", () => {
    expect(() => parseDiscordConfig({})).toThrow(
      /Configuration Discord invalide/
    );
  });

  it("parses optional Discord settings", () => {
    const config = parseDiscordConfig({
      DISCORD_TOKEN: "token",
      DISCORD_CLIENT_ID: "client",
      DISCORD_GUILD_ID: "guild",
      DISCORD_CHANNEL_ID: "channel",
      DISCORD_ADMIN_ROLE_ID: "role",
    });

    expect(config.discord).toEqual({
      token: "token",
      clientId: "client",
      guildId: "guild",
      channelId: "channel",
      adminRoleId: "role",
    });
  });
});

describe("parseAppConfig", () => {
  it("defaults log level to info", () => {
    expect(parseAppConfig({}).logLevel).toBe("info");
  });

  it("accepts supported log levels", () => {
    expect(parseAppConfig({ LOG_LEVEL: "debug" }).logLevel).toBe("debug");
  });
});
