import { describe, expect, it } from "vitest";
import type { LeboncoinAd } from "./client.js";
import { leboncoinScrapeImageUrl, mapLeboncoinAdToListing } from "./mapper.js";

function makeAd(images?: LeboncoinAd["images"]): LeboncoinAd {
  return {
    list_id: 42,
    subject: "Maison",
    body: "Description",
    url: "https://www.leboncoin.fr/ad/ventes_immobilieres/42",
    price: [300_000],
    images,
    attributes: [],
    location: { city: "Lyon", lat: 45.75, lng: 4.85 },
  };
}

describe("leboncoinScrapeImageUrl", () => {
  it("prefers urls_large over urls and thumb_url", () => {
    expect(
      leboncoinScrapeImageUrl(
        makeAd({
          urls_large: ["https://img.leboncoin.fr/large.jpg"],
          urls: ["https://img.leboncoin.fr/standard.jpg"],
          thumb_url: "https://img.leboncoin.fr/thumb.jpg",
        })
      )
    ).toBe("https://img.leboncoin.fr/large.jpg");
  });

  it("falls back to urls then thumb_url", () => {
    expect(
      leboncoinScrapeImageUrl(
        makeAd({
          urls: ["https://img.leboncoin.fr/standard.jpg"],
          thumb_url: "https://img.leboncoin.fr/thumb.jpg",
        })
      )
    ).toBe("https://img.leboncoin.fr/standard.jpg");

    expect(
      leboncoinScrapeImageUrl(
        makeAd({
          thumb_url: "https://img.leboncoin.fr/thumb.jpg",
        })
      )
    ).toBe("https://img.leboncoin.fr/thumb.jpg");
  });

  it("returns null when no image is available", () => {
    expect(leboncoinScrapeImageUrl(makeAd())).toBeNull();
    expect(leboncoinScrapeImageUrl(makeAd({ urls_large: ["  "] }))).toBeNull();
  });
});

describe("mapLeboncoinAdToListing", () => {
  it("maps scrape imageUrl from search payload", () => {
    const listing = mapLeboncoinAdToListing(
      makeAd({
        urls_large: ["https://img.leboncoin.fr/large.jpg"],
      }),
      "2026-06-15T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.imageUrl).toBe("https://img.leboncoin.fr/large.jpg");
  });
});
