import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  BrowseState,
  ListingDetailResponse,
  ReactionMutationResponse,
  ReactionsResponse,
  StatsMine,
  StatsOverview,
  PropertyMatchDiagnosticsPage,
} from "@find-my-house/api-types";
import { createApiApp } from "./app.js";
import type { ApiContext } from "./types.js";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import { clearBrowseSession } from "../services/browseSession.js";
import type { EnrichmentQueue } from "../services/enrichmentQueue.js";
import type { ScraperService } from "../services/scraperService.js";
import { NotificationPreferenceRepository } from "../db/notificationPreferenceRepository.js";

vi.mock("../config/web.js", () => ({
  webConfig: {
    web: {
      authDisabled: true,
      homeAssistantUrl: "http://127.0.0.1:8123",
      adminUsers: [],
      devUser: "test-user",
    },
  },
}));

vi.mock("../utils/energy/ademeDpeApi.js", () => ({
  searchDpeForProperty: vi.fn(),
  fetchDpeByNumero: vi.fn(),
}));

vi.mock("../config/notifications.js", () => ({
  notificationsConfig: {
    notifications: {
      enabled: true,
      notifyServices: ["persistent_notification.create"],
      maxNotifications: 5,
    },
  },
}));

const sendTestNotification = vi.fn(() =>
  Promise.resolve({ ok: true as const })
);

vi.mock("../homeAssistant/notifications.js", () => ({
  sendTestNotification: (...args: unknown[]) => sendTestNotification(...args),
  sendNewListingNotifications: vi.fn(),
  sendPriceDropNotifications: vi.fn(),
}));

vi.mock("../homeAssistant/client.js", () => ({
  resolveHaApiToken: (token?: string) => token ?? "test-token",
  isHomeAssistantAddOn: () => false,
}));

function createMockEnrichmentQueue(findById: (id: number) => Promise<unknown>) {
  const schedule = vi.fn();
  const ensureReady = vi.fn(async (id: number) => findById(id));
  const getStatus = vi.fn(() => "complete" as const);

  return {
    queue: {
      getQueuedCount: () => 0,
      schedule,
      scheduleScrapeResults: vi.fn(),
      ensureReady,
      getStatus,
      runBackfill: vi.fn(() => Promise.resolve(0)),
    } as unknown as EnrichmentQueue,
    schedule,
    ensureReady,
    getStatus,
  };
}

function createMockScraperService(): ScraperService {
  return {
    run: vi.fn(),
  } as unknown as ScraperService;
}

describe("createApiApp", () => {
  let dispose: (() => Promise<void>) | undefined;
  let ctx: ApiContext;
  let app: ReturnType<typeof createApiApp>;
  let propertyId: number;
  let enrichmentSchedule: ReturnType<typeof vi.fn>;
  let enrichmentEnsureReady: ReturnType<typeof vi.fn>;
  let enrichmentGetStatus: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const testDb = createTestRepository();
    dispose = testDb.dispose;

    const enrichment = createMockEnrichmentQueue((id) =>
      testDb.repository.findById(id)
    );
    enrichmentSchedule = enrichment.schedule;
    enrichmentEnsureReady = enrichment.ensureReady;
    enrichmentGetStatus = enrichment.getStatus;

    ctx = {
      repository: testDb.repository,
      reactionRepository: testDb.reactionRepository,
      notificationPreferenceRepository: new NotificationPreferenceRepository(
        testDb.prisma
      ),
      scraperService: createMockScraperService(),
      enrichmentQueue: enrichment.queue,
      scrapeDefaults: {
        city: "Lanquetot",
        postalCode: "76160",
        maxPrice: 500_000,
        minSurface: 50,
      },
      notifyScrapeResults: vi.fn(() => Promise.resolve()),
    };

    app = createApiApp(ctx);

    const result = await testDb.repository.upsertMany([
      makeListing({
        externalId: "api-browse-a",
        url: "https://www.bienici.com/annonce/api-browse-a",
        city: "Lanquetot",
        postalCode: "76160",
        description: "Maison A",
        imageUrl: "https://example.com/a.jpg",
        landSurface: 400,
      }),
      makeListing({
        externalId: "api-browse-b",
        url: "https://www.bienici.com/annonce/api-browse-b",
        city: "Lanquetot",
        postalCode: "76160",
        description: "Maison B",
        imageUrl: "https://example.com/b.jpg",
        landSurface: 500,
      }),
    ]);

    for (const property of [
      ...result.insertedListings,
      ...result.linkedListings,
    ]) {
      for (const publication of property.publications) {
        const imageUrls =
          publication.imageUrls ??
          (publication.imageUrl ? [publication.imageUrl] : null);
        await testDb.repository.applyPublicationGallery(publication.id, {
          imageUrls,
          imageLocalHashes: imageUrls
            ? Object.fromEntries(
                imageUrls.map((url, index) => [url, `hash-${String(index)}`])
              )
            : null,
        });
        await testDb.repository.markPublicationEnrichmentAttempted(
          publication.id,
          "display"
        );
      }
    }

    propertyId = (result.insertedListings[0] ?? result.linkedListings[0]).id;
  });

  afterAll(async () => {
    await dispose?.();
  });

  beforeEach(() => {
    clearBrowseSession("ha:test-user");
  });

  it("GET /api/health is public", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("browse start then current returns the same listing", async () => {
    const start = await app.request("/api/browse/start", { method: "POST" });
    expect(start.status).toBe(200);
    const started = (await start.json()) as BrowseState;
    expect(started.item).not.toBeNull();

    const current = await app.request("/api/browse");
    expect(current.status).toBe(200);
    const currentBody = (await current.json()) as BrowseState;

    expect(currentBody.item?.id).toBe(started.item?.id);
    expect(currentBody.shownCount).toBe(started.shownCount);
  });

  it("browse pass advances without recording a reaction", async () => {
    const start = await app.request("/api/browse/start", { method: "POST" });
    const started = (await start.json()) as BrowseState;
    expect(started.item).not.toBeNull();
    if (!started.item) throw new Error("Expected browse item");
    const passedId = started.item.id;

    const passed = await app.request("/api/browse/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: passedId }),
    });
    expect(passed.status).toBe(200);
    const passedBody = (await passed.json()) as BrowseState;

    expect(passedBody.shownCount).toBeGreaterThan(started.shownCount);
    if (passedBody.item) {
      expect(passedBody.item.id).not.toBe(passedId);
    }

    const dislikes = await app.request("/api/reactions/dislike");
    const likes = await app.request("/api/reactions/like");
    const dislikeBody = (await dislikes.json()) as ReactionsResponse;
    const likeBody = (await likes.json()) as ReactionsResponse;
    expect(
      [...dislikeBody.items, ...likeBody.items].some(
        (item) => item.id === passedId
      )
    ).toBe(false);
  });

  it("browse like advances to a different listing when available", async () => {
    const start = await app.request("/api/browse/start", { method: "POST" });
    const started = (await start.json()) as BrowseState;
    expect(started.item).not.toBeNull();

    const liked = await app.request("/api/browse/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: started.item?.id }),
    });
    expect(liked.status).toBe(200);
    const likedBody = (await liked.json()) as BrowseState;

    expect(likedBody.shownCount).toBeGreaterThan(started.shownCount);
    if (likedBody.item && started.item) {
      expect(likedBody.item.id).not.toBe(started.item.id);
    }
  });

  it("browse action rejects a mismatched propertyId without advancing", async () => {
    const start = await app.request("/api/browse/start", { method: "POST" });
    const started = (await start.json()) as BrowseState;
    expect(started.item).not.toBeNull();
    if (!started.item) throw new Error("Expected browse item");

    const mismatched = await app.request("/api/browse/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: started.item.id + 999_999 }),
    });
    expect(mismatched.status).toBe(409);

    const current = await app.request("/api/browse");
    expect(current.status).toBe(200);
    const currentBody = (await current.json()) as BrowseState;
    expect(currentBody.item?.id).toBe(started.item.id);
    expect(currentBody.shownCount).toBe(started.shownCount);
  });

  it("browse action keeps the session when the listing is missing", async () => {
    const start = await app.request("/api/browse/start", { method: "POST" });
    const started = (await start.json()) as BrowseState;
    expect(started.item).not.toBeNull();
    if (!started.item) throw new Error("Expected browse item");

    const session = (
      await import("../services/browseSession.js")
    ).getBrowseSession("ha:test-user");
    // Force a cursor that points at a deleted id while keeping the session.
    if (session) {
      session.currentPropertyId = 9_999_999;
    }

    const response = await app.request("/api/browse/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: 9_999_999 }),
    });
    expect(response.status).toBe(404);

    const stillThere = (
      await import("../services/browseSession.js")
    ).getBrowseSession("ha:test-user");
    expect(stillThere).toBeDefined();
  });

  it("GET /api/listings/:id returns a property", async () => {
    const response = await app.request(`/api/listings/${String(propertyId)}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingDetailResponse;
    expect(body.item.id).toBe(propertyId);
    expect(body.enrichment.status).toBe("complete");
    expect(enrichmentEnsureReady).not.toHaveBeenCalled();
  });

  it("GET /api/listings/:id schedules display enrichment without waiting", async () => {
    enrichmentGetStatus.mockReturnValue("pending");

    const response = await app.request(`/api/listings/${String(propertyId)}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingDetailResponse;
    expect(body.enrichment.status).toBe("pending");
    expect(enrichmentSchedule).toHaveBeenCalledWith(
      propertyId,
      "display",
      "high"
    );
    expect(enrichmentEnsureReady).not.toHaveBeenCalled();

    enrichmentGetStatus.mockReturnValue("complete");
  });

  it("POST /api/reactions/like adds a household like", async () => {
    const response = await app.request("/api/reactions/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "added" });

    const list = await app.request("/api/reactions/like");
    const body = (await list.json()) as ReactionsResponse;
    expect(body.items.some((item) => item.id === propertyId)).toBe(true);
  });

  it("DELETE /api/reactions/like/:id removes a like", async () => {
    await ctx.reactionRepository.add(propertyId, "like");

    const response = await app.request(
      `/api/reactions/like/${String(propertyId)}`,
      { method: "DELETE" }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ removed: true });
  });

  it("POST /api/reactions/like/:id/archive archives a like", async () => {
    await ctx.reactionRepository.add(propertyId, "like");

    const response = await app.request(
      `/api/reactions/like/${String(propertyId)}/archive`,
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ReactionMutationResponse;
    expect(body.status).toBe("archived");
  });

  it("GET /api/stats/overview returns database overview", async () => {
    const response = await app.request("/api/stats/overview");
    expect(response.status).toBe(200);

    const body = (await response.json()) as StatsOverview;
    expect(body.total).toBeGreaterThan(0);
    expect(body.enrichment.queued).toBe(0);
    expect(typeof body.likes).toBe("number");
  });

  it("GET /api/stats/mine returns household reactions", async () => {
    await ctx.reactionRepository.add(propertyId, "like");

    const response = await app.request("/api/stats/mine");
    expect(response.status).toBe(200);

    const body = (await response.json()) as StatsMine;
    expect(body.likes).toBeGreaterThan(0);
    expect(body.recentLikes.some((item) => item.id === propertyId)).toBe(true);
  });

  it("GET /api/admin/property-match-diagnostics returns diagnostics list", async () => {
    const response = await app.request("/api/admin/property-match-diagnostics");
    expect(response.status).toBe(200);
    const body = (await response.json()) as PropertyMatchDiagnosticsPage;
    expect(Array.isArray(body.items)).toBe(true);
    expect(
      body.nextBeforeId === null || typeof body.nextBeforeId === "number"
    ).toBe(true);
  });

  it("GET /api/admin/property-match-diagnostics validates from/to query params", async () => {
    const badFrom = await app.request(
      "/api/admin/property-match-diagnostics?from=not-a-date"
    );
    expect(badFrom.status).toBe(400);

    const badTo = await app.request(
      "/api/admin/property-match-diagnostics?to=not-a-date"
    );
    expect(badTo.status).toBe(400);
  });

  it("GET /api/admin/property-match-diagnostics validates beforeId query param", async () => {
    const badBeforeId = await app.request(
      "/api/admin/property-match-diagnostics?beforeId=oops"
    );
    expect(badBeforeId.status).toBe(400);
  });

  it("GET /api/admin/property-match-diagnostics validates source query param", async () => {
    const badSource = await app.request(
      "/api/admin/property-match-diagnostics?source=unknown"
    );
    expect(badSource.status).toBe(400);
  });

  it("GET /api/notifications/preferences returns enabled by default", async () => {
    const response = await app.request("/api/notifications/preferences");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: true });
  });

  it("PUT /api/notifications/preferences updates the current user preference", async () => {
    const disable = await app.request("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disable.status).toBe(200);
    await expect(disable.json()).resolves.toEqual({ enabled: false });

    const read = await app.request("/api/notifications/preferences");
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toEqual({ enabled: false });
  });

  it("PUT /api/notifications/preferences validates body", async () => {
    const response = await app.request("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: "no" }),
    });
    expect(response.status).toBe(400);
  });

  it("POST /api/admin/notifications/test sends a test notification", async () => {
    sendTestNotification.mockClear();

    const response = await app.request("/api/admin/notifications/test", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sent: true,
      notifyServices: ["persistent_notification.create"],
    });
    expect(sendTestNotification).toHaveBeenCalledWith(
      ["persistent_notification.create"],
      { token: undefined }
    );
  });
});
