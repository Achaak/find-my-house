import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseAppConfig,
  parseBrowserConfig,
  parseDiscordConfig,
  parseDiscordConfigOptional,
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
  });

  it("parses optional numeric filters and scraper list", () => {
    const config = parseScrapeConfig({
      SCRAPE_MIN_LAND_SURFACE: "1000",
      SCRAPE_POSTAL_CODE: "69001",
      SCRAPE_SCRAPERS: "bienici, leboncoin",
      DATABASE_URL: "file:./tmp/test.db",
    });

    expect(config.scrape.minLandSurface).toBe(1000);
    expect(config.scrape.postalCode).toBe("69001");
    expect(config.scrape.scrapers).toEqual(["bienici", "leboncoin"]);
    expect(config.database.url).toBe("file:./tmp/test.db");
  });

  it("rejects invalid postal codes", () => {
    expect(() => parseScrapeConfig({ SCRAPE_POSTAL_CODE: "7616" })).toThrow(
      /Invalid scrape configuration/
    );
  });

  it("rejects invalid scraper names", () => {
    expect(() =>
      parseScrapeConfig({ SCRAPE_SCRAPERS: "bienici,unknown" })
    ).toThrow(/Invalid scrape configuration/);
  });

  it("rejects non-positive numbers", () => {
    expect(() => parseScrapeConfig({ SCRAPE_MAX_PRICE: "0" })).toThrow(
      /Invalid scrape configuration/
    );
  });

  it("builds database url from DATABASE_PATH when DATABASE_URL is omitted", () => {
    const config = parseScrapeConfig({
      DATABASE_PATH: "./custom/listings.db",
    });

    expect(config.database.url).toBe("file:./custom/listings.db");
  });
});

describe("parseBrowserConfig", () => {
  it("applies CloakBrowser defaults", () => {
    const config = parseBrowserConfig({});

    expect(config.browser.headless).toBe(true);
    expect(config.browser.humanize).toBe(true);
    expect(config.browser.geoip).toBe(false);
    expect(config.browser.resetProfile).toBe(false);
  });

  it("parses optional CloakBrowser overrides", () => {
    const config = parseBrowserConfig({
      CLOAKBROWSER_HEADLESS: "false",
      CLOAKBROWSER_FINGERPRINT: "12345",
      CLOAKBROWSER_PROXY: "http://proxy.example",
      CLOAKBROWSER_GEOIP: "false",
      CLOAKBROWSER_RESET_PROFILE: "true",
    });

    expect(config.browser.headless).toBe(false);
    expect(config.browser.fingerprint).toBe("12345");
    expect(config.browser.proxy).toBe("http://proxy.example");
    expect(config.browser.geoip).toBe(false);
    expect(config.browser.resetProfile).toBe(true);
  });
});

describe("parseDiscordConfigOptional", () => {
  it("returns null when Discord credentials are missing", () => {
    expect(parseDiscordConfigOptional({})).toBeNull();
  });

  it("returns parsed config when Discord credentials are present", () => {
    expect(
      parseDiscordConfigOptional({
        DISCORD_TOKEN: "token",
        DISCORD_CLIENT_ID: "client",
      })?.discord.token
    ).toBe("token");
  });
});

describe("parseDiscordConfig", () => {
  it("requires Discord credentials", () => {
    expect(() => parseDiscordConfig({})).toThrow(
      /Invalid Discord configuration/
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
      maxNotifications: 20,
    });
  });

  it("parses custom max notifications", () => {
    const config = parseDiscordConfig({
      DISCORD_TOKEN: "token",
      DISCORD_CLIENT_ID: "client",
      DISCORD_MAX_NOTIFICATIONS: "10",
    });

    expect(config.discord.maxNotifications).toBe(10);
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
