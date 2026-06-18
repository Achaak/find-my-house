import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseAppConfig,
  parseBrowserConfig,
  parseNotificationsConfig,
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
    expect(config.enrichment.cron).toBe("0 * * * *");
    expect(config.enrichment.enabled).toBe(true);
    expect(config.enrichment.minCompatScore).toBe(0);
    expect(config.enrichment.batchLimit).toBe(20);
    expect(config.enrichment.searchLimit).toBe(1000);
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

  it("allows disabling enrichment backfill", () => {
    const config = parseScrapeConfig({ ENRICHMENT_DISABLED: "true" });

    expect(config.enrichment.enabled).toBe(false);
  });
});

describe("parseNotificationsConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults notifications to disabled without supervisor token", () => {
    const config = parseNotificationsConfig({});

    expect(config.notifications.enabled).toBe(false);
    expect(config.notifications.notifyServices).toEqual([
      "persistent_notification.create",
    ]);
    expect(config.notifications.maxNotifications).toBe(5);
  });

  it("enables notifications by default when SUPERVISOR_TOKEN is set", () => {
    vi.stubEnv("SUPERVISOR_TOKEN", "supervisor-token");

    const config = parseNotificationsConfig({});

    expect(config.notifications.enabled).toBe(true);
  });

  it("allows explicit disable even with supervisor token", () => {
    vi.stubEnv("SUPERVISOR_TOKEN", "supervisor-token");

    const config = parseNotificationsConfig({
      NOTIFICATIONS_ENABLED: "false",
    });

    expect(config.notifications.enabled).toBe(false);
  });

  it("parses notify service and max notifications", () => {
    const config = parseNotificationsConfig({
      NOTIFICATIONS_ENABLED: "true",
      NOTIFY_SERVICE: "notify.mobile_app_iphone",
      NOTIFICATIONS_MAX: "3",
    });

    expect(config.notifications.enabled).toBe(true);
    expect(config.notifications.notifyServices).toEqual([
      "notify.mobile_app_iphone",
    ]);
    expect(config.notifications.maxNotifications).toBe(3);
  });

  it("parses comma-separated notify services", () => {
    const config = parseNotificationsConfig({
      NOTIFY_SERVICE:
        "notify.mobile_app_iphone, notify.mobile_app_pixel, persistent_notification.create",
    });

    expect(config.notifications.notifyServices).toEqual([
      "notify.mobile_app_iphone",
      "notify.mobile_app_pixel",
      "persistent_notification.create",
    ]);
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

describe("parseAppConfig", () => {
  it("defaults log level to info", () => {
    expect(parseAppConfig({}).logLevel).toBe("info");
  });

  it("accepts supported log levels", () => {
    expect(parseAppConfig({ LOG_LEVEL: "debug" }).logLevel).toBe("debug");
  });
});
