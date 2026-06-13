import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import { formatListingEmbed, formatPrice, formatPriceDrop } from "./format.js";

describe("discord/format", () => {
  it("formats prices in EUR without decimals", () => {
    expect(formatPrice(300_000)).toContain("300");
    expect(formatPrice(300_000)).toContain("€");
  });

  it("describes a price drop from first price", () => {
    const property = makePropertyRow({
      price: 280_000,
      firstPrice: 300_000,
    });

    const label = formatPriceDrop(property);
    expect(label).toContain("Baisse de prix");
    expect(label).toContain("280");
    expect(label).toContain("300");
  });

  it("returns null when price did not drop", () => {
    expect(
      formatPriceDrop(makePropertyRow({ price: 300_000, firstPrice: 300_000 }))
    ).toBeNull();
  });

  it("builds a structured embed with fields and source color", () => {
    const embed = formatListingEmbed(
      makePropertyRow({
        source: "seloger",
        publications: [
          {
            id: 1,
            externalId: "ext-1",
            source: "seloger",
            url: "https://www.seloger.com/annonce/1",
            isActive: true,
            scrapedAt: "2026-01-15T10:00:00.000Z",
          },
        ],
        url: "https://www.seloger.com/annonce/1",
      })
    );

    expect(embed.color).toBe(0xe00034);
    expect(embed.author?.name).toContain("SeLoger");
    expect(embed.fields.some((field) => field.name === "Surface")).toBe(true);
    expect(embed.description).toContain("/m²");
  });

  it("uses green color and price drop in description when price fell", () => {
    const embed = formatListingEmbed(
      makePropertyRow({ price: 280_000, firstPrice: 300_000 })
    );

    expect(embed.color).toBe(0x2ecc71);
    expect(embed.description).toContain("Baisse de prix");
  });

  it("omits invalid image urls from embeds", () => {
    const embed = formatListingEmbed(
      makePropertyRow({ imageUrl: "not-a-valid-url" })
    );

    expect(embed.image).toBeUndefined();
  });

  it("preserves signed mms image urls for Discord embeds", () => {
    const embed = formatListingEmbed(
      makePropertyRow({
        source: "logicimmo",
        imageUrl:
          "https://mms.logic-immo.com/2/9/a/4/photo.jpg?ci_seal=signed-token",
      })
    );

    expect(embed.image?.url).toBe(
      "https://mms.logic-immo.com/2/9/a/4/photo.jpg?ci_seal=signed-token"
    );
  });

  it("includes compatibility score when provided", () => {
    const embed = formatListingEmbed(makePropertyRow(), {
      compatibilityScore: 87,
    });

    const field = embed.fields.find((entry) => entry.name === "Compatibilité");
    expect(field?.value).toContain("87/100");
  });
});
