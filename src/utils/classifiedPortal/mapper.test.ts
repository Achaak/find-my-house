import { describe, expect, it } from "vitest";
import { LOGIC_IMMO_PORTAL } from "./config.js";
import { mapClassifiedCardToListing } from "./mapper.js";
import type { ClassifiedCard } from "./types.js";

function makeCard(photos?: string[]): ClassifiedCard {
  return {
    id: "abc123",
    cardType: "classified",
    title: "Maison",
    photos,
  };
}

describe("mapClassifiedCardToListing", () => {
  it("maps the first photo from the search card", () => {
    const signed =
      "https://mms.logic-immo.com/2/9/a/4/photo.jpg?ci_seal=abc123";
    const listing = mapClassifiedCardToListing(
      LOGIC_IMMO_PORTAL,
      makeCard([signed, "https://mms.logic-immo.com/other.jpg"]),
      "2026-06-15T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.imageUrl).toBe(signed);
  });

  it("prefixes relative photo paths with the portal image host", () => {
    const listing = mapClassifiedCardToListing(
      LOGIC_IMMO_PORTAL,
      makeCard(["2/9/a/4/photo.jpg"]),
      "2026-06-15T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.imageUrl).toBe("https://mms.seloger.com/2/9/a/4/photo.jpg");
  });

  it("returns null when no photo is available", () => {
    const listing = mapClassifiedCardToListing(
      LOGIC_IMMO_PORTAL,
      makeCard(),
      "2026-06-15T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.imageUrl).toBeNull();
  });
});
