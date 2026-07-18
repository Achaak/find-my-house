import { describe, expect, it } from "vitest";
import { makeListing } from "../test/listingFixtures.js";
import { toPublicationUpdateData } from "./publicationData.js";

describe("toPublicationUpdateData", () => {
  it("keeps prior portal-detail fields when the scrape payload is sparse", () => {
    const listing = makeListing({
      description: null,
      imageUrl: null,
      imageUrls: null,
      price: 290_000,
    });
    const scrapedAt = new Date("2026-06-13T12:00:00.000Z");

    const data = toPublicationUpdateData(listing, scrapedAt, {
      description: "Enriched description",
      imageUrl: "https://example.com/photo.jpg",
      imageUrls: ["https://example.com/photo.jpg"],
      address: "12 rue Example",
      dpeNumero: "1234E",
    });

    expect(data.price).toBe(290_000);
    expect(data.description).toBe("Enriched description");
    expect(data.imageUrl).toBe("https://example.com/photo.jpg");
    expect(data.imageUrls).toEqual(["https://example.com/photo.jpg"]);
    expect(data.address).toBe("12 rue Example");
    expect(data.dpeNumero).toBe("1234E");
  });

  it("accepts non-null scrape detail fields over prior values", () => {
    const listing = makeListing({
      description: "New card text",
      imageUrl: "https://example.com/new.jpg",
      imageUrls: ["https://example.com/new.jpg"],
    });
    const scrapedAt = new Date("2026-06-13T12:00:00.000Z");

    const data = toPublicationUpdateData(listing, scrapedAt, {
      description: "Old enriched text",
      imageUrl: "https://example.com/old.jpg",
      imageUrls: ["https://example.com/old.jpg"],
      address: "12 rue Example",
      dpeNumero: null,
    });

    expect(data.description).toBe("New card text");
    expect(data.imageUrl).toBe("https://example.com/new.jpg");
    expect(data.imageUrls).toEqual(["https://example.com/new.jpg"]);
    expect(data.address).toBe("12 rue Example");
  });
});
