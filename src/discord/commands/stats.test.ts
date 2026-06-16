import { describe, expect, it, vi } from "vitest";
import { handleStats } from "./stats.js";

type DiscordReply = {
  embeds: { title: string }[];
};

function isDiscordReply(payload: unknown): payload is DiscordReply {
  return !!payload && typeof payload === "object" && "embeds" in payload;
}

function makeInteraction(subcommand: string) {
  return {
    user: { id: "user-1" },
    options: {
      getSubcommand: vi.fn(() => subcommand),
    },
    deferReply: vi.fn(() => Promise.resolve(undefined)),
    editReply: vi.fn(() => Promise.resolve(undefined)),
  };
}

const repository = {
  count: vi.fn(() => Promise.resolve(12)),
  countActiveProperties: vi.fn(() => Promise.resolve(10)),
  countPublications: vi.fn(() => Promise.resolve(11)),
  countInactivePublications: vi.fn(() => Promise.resolve(3)),
  countPriceDrops: vi.fn(() => Promise.resolve(2)),
  getPublicationCountsBySource: vi.fn(() =>
    Promise.resolve({
      bienici: { active: 5, inactive: 1 },
      seloger: { active: 4, inactive: 1 },
      leboncoin: { active: 2, inactive: 1 },
      logicimmo: { active: 0, inactive: 0 },
    })
  ),
  getPriceStats: vi.fn(() =>
    Promise.resolve({
      count: 10,
      min: 200_000,
      max: 480_000,
      median: 350_000,
      average: 355_000,
    })
  ),
  getTopCities: vi.fn(() => Promise.resolve([{ city: "Lyon", count: 6 }])),
  getActivityStats: vi.fn(() =>
    Promise.resolve({
      lastScrapedAt: new Date("2026-06-12T08:00:00.000Z"),
      addedLast7Days: 3,
      deactivatedLast7Days: 1,
      multiSourceCount: 2,
    })
  ),
  findRecent: vi.fn(() => Promise.resolve([])),
  findPriceDrops: vi.fn(() => Promise.resolve([])),
  countPendingDisplayEnrichment: vi.fn(() => Promise.resolve(0)),
};

const enrichmentQueue = {
  getQueuedCount: vi.fn(() => 0),
};

const reactionRepository = {
  countByType: vi.fn(() => Promise.resolve(2)),
  findListingsByType: vi.fn(() => Promise.resolve([])),
};

function getFirstReply(
  interaction: ReturnType<typeof makeInteraction>
): DiscordReply {
  const calls = (
    interaction.editReply as unknown as { mock: { calls: unknown[][] } }
  ).mock.calls;
  const payload = calls[0]?.[0];
  if (!isDiscordReply(payload)) {
    throw new Error("Expected editReply payload with embeds");
  }
  return payload;
}

describe("handleStats", () => {
  it("returns an overview embed", async () => {
    const interaction = makeInteraction("overview");

    await handleStats(interaction as never, {
      repository: repository as never,
      reactionRepository: reactionRepository as never,
      scraperService: {} as never,
      enrichmentQueue: enrichmentQueue as never,
      defaultScrapeOptions: { city: "Lyon", maxPrice: 500_000, minSurface: 30 },
      discord: { token: "token" },
      notifyScrapeResults: vi.fn(),
    });

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(repository.countActiveProperties).toHaveBeenCalledOnce();
    expect(reactionRepository.countByType).toHaveBeenCalledWith("like");
    const reply = getFirstReply(interaction);
    expect(reply.embeds[0]?.title).toContain("Overview");
  });

  it("returns a prices embed", async () => {
    const interaction = makeInteraction("prices");

    await handleStats(interaction as never, {
      repository: repository as never,
      reactionRepository: reactionRepository as never,
      scraperService: {} as never,
      enrichmentQueue: enrichmentQueue as never,
      defaultScrapeOptions: { city: "Lyon", maxPrice: 500_000, minSurface: 30 },
      discord: { token: "token" },
      notifyScrapeResults: vi.fn(),
    });

    expect(repository.findPriceDrops).toHaveBeenCalledWith(5);
    const reply = getFirstReply(interaction);
    expect(reply.embeds[0]?.title).toContain("Prices");
  });
});
