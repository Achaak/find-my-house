import { describe, expect, it } from "vitest";
import { mapBienIciAdToListing, type BienIciAd } from "./mapper.js";

function makeAd(photos?: BienIciAd["photos"]): BienIciAd {
  return {
    id: "bi-1",
    title: "Maison",
    price: 300_000,
    city: "Lyon",
    photos,
  };
}

describe("mapBienIciAdToListing", () => {
  it("maps the first photo url from the search payload", () => {
    const listing = mapBienIciAdToListing(
      makeAd([
        { url_photo: "https://photos.bienici.com/1.jpg" },
        { url_photo: "https://photos.bienici.com/2.jpg" },
      ]),
      "2026-06-15T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.imageUrl).toBe("https://photos.bienici.com/1.jpg");
  });

  it("returns null when no photo is available", () => {
    const listing = mapBienIciAdToListing(
      makeAd(),
      "2026-06-15T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.imageUrl).toBeNull();
  });
});
