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
} from "@find-my-house/api-types";
import { createApiApp } from "./app.js";
import type { ApiContext } from "./types.js";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import { clearBrowseSession } from "../services/browseSession.js";
import type { EnrichmentQueue } from "../services/enrichmentQueue.js";
import type { ScraperService } from "../services/scraperService.js";

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

function createMockEnrichmentQueue(): EnrichmentQueue {
  return {
    getQueuedCount: () => 0,
    schedule: vi.fn(),
    scheduleScrapeResults: vi.fn(),
    waitUntilEnriched: vi.fn(() => Promise.resolve({ warnings: [] })),
  } as unknown as EnrichmentQueue;
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

  beforeAll(async () => {
    const testDb = createTestRepository();
    dispose = testDb.dispose;

    ctx = {
      repository: testDb.repository,
      reactionRepository: testDb.reactionRepository,
      scraperService: createMockScraperService(),
      enrichmentQueue: createMockEnrichmentQueue(),
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

  it("GET /api/listings/:id returns a property", async () => {
    const response = await app.request(`/api/listings/${String(propertyId)}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingDetailResponse;
    expect(body.item.id).toBe(propertyId);
    expect(body.enrichment.status).toBe("complete");
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
    const body = (await list.json()) as { items: { id: number }[] };
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
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("archived");
  });

  it("GET /api/stats/overview returns database overview", async () => {
    const response = await app.request("/api/stats/overview");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      total: number;
      likes: number;
      enrichment: { pending: number; queued: number };
    };
    expect(body.total).toBeGreaterThan(0);
    expect(body.enrichment.queued).toBe(0);
    expect(typeof body.likes).toBe("number");
  });

  it("GET /api/stats/mine returns household reactions", async () => {
    await ctx.reactionRepository.add(propertyId, "like");

    const response = await app.request("/api/stats/mine");
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      likes: number;
      recentLikes: { id: number }[];
    };
    expect(body.likes).toBeGreaterThan(0);
    expect(body.recentLikes.some((item) => item.id === propertyId)).toBe(true);
  });
});
