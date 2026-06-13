import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import {
  formatOverviewStatsEmbed,
  formatPricesStatsEmbed,
  formatSourcesStatsEmbed,
} from "./statsFormat.js";

describe("formatOverviewStatsEmbed", () => {
  it("includes key overview sections", () => {
    const embed = formatOverviewStatsEmbed({
      total: 10,
      activeProperties: 8,
      activePublications: 9,
      inactivePublications: 2,
      priceDrops: 1,
      sourceCounts: {
        bienici: { active: 4, inactive: 1 },
        seloger: { active: 3, inactive: 0 },
        leboncoin: { active: 2, inactive: 1 },
        logicimmo: { active: 0, inactive: 0 },
      },
      priceStats: {
        count: 8,
        min: 200_000,
        max: 500_000,
        median: 350_000,
        average: 360_000,
      },
      topCities: [{ city: "Lyon", count: 5 }],
      activity: {
        lastScrapedAt: new Date("2026-06-12T10:00:00.000Z"),
        addedLast7Days: 2,
        deactivatedLast7Days: 1,
        multiSourceCount: 3,
      },
      likes: 4,
      dislikes: 1,
      recent: [
        makePropertyRow({
          id: 42,
          title: "Maison test",
          city: "Lyon",
        }),
      ],
    });

    expect(embed.title).toContain("Overview");
    expect(embed.description).toContain("8");
    expect(embed.description).toContain("price drop");
    expect(embed.fields.some((field) => field.name === "Your reactions")).toBe(
      true
    );
  });
});

describe("formatSourcesStatsEmbed", () => {
  it("lists only sources with publications", () => {
    const embed = formatSourcesStatsEmbed(
      {
        bienici: { active: 2, inactive: 0 },
        seloger: { active: 0, inactive: 0 },
        leboncoin: { active: 1, inactive: 1 },
        logicimmo: { active: 0, inactive: 0 },
      },
      1
    );

    expect(embed.fields[0]?.value).toContain("Bien'ici");
    expect(embed.fields[0]?.value).not.toContain("SeLoger");
    expect(embed.fields[1]?.value).toContain("1");
  });
});

describe("formatPricesStatsEmbed", () => {
  it("lists the strongest price drops", () => {
    const embed = formatPricesStatsEmbed(
      {
        count: 2,
        min: 250_000,
        max: 400_000,
        median: 325_000,
        average: 325_000,
      },
      1,
      [
        makePropertyRow({
          id: 7,
          title: "Appart",
          price: 280_000,
          firstPrice: 300_000,
        }),
      ]
    );

    expect(embed.fields.some((field) => field.name === "Median")).toBe(true);
    expect(embed.fields.at(-1)?.value).toContain("#7");
    expect(embed.fields.at(-1)?.value).toContain("−");
  });
});
