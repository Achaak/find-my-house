import { describe, expect, it } from "vitest";
import {
  filterSyndicatedPhotoUrls,
  firstPhotoUrl,
  photoUrlDedupKey,
} from "./filterSyndicatedPhotoUrls.js";

describe("filterSyndicatedPhotoUrls", () => {
  it("drops URLs whose dedup key is blocked", () => {
    const spam =
      "https://media.immo-facile.com/office5/cotepa/catalog/60587888d.jpg?DATEMAJ=25/06/2026";
    const blocked = new Set([photoUrlDedupKey(spam)]);

    expect(
      filterSyndicatedPhotoUrls(
        ["https://cdn.safti.fr/bien-photo/61/60/1660105/photo.jpg", spam],
        blocked
      )
    ).toEqual(["https://cdn.safti.fr/bien-photo/61/60/1660105/photo.jpg"]);
  });

  it("blocks variants that only differ by query string", () => {
    const blocked = new Set([
      photoUrlDedupKey(
        "https://media.immo-facile.com/office5/cotepa/catalog/60587888d.jpg?DATEMAJ=old"
      ),
    ]);

    expect(
      filterSyndicatedPhotoUrls(
        [
          "https://media.immo-facile.com/office5/cotepa/catalog/60587888d.jpg?DATEMAJ=new",
        ],
        blocked
      )
    ).toBeNull();
  });

  it("returns null when every URL is blocked", () => {
    const url = "https://example.com/spam.jpg";
    expect(
      filterSyndicatedPhotoUrls([url], new Set([photoUrlDedupKey(url)]))
    ).toBeNull();
  });

  it("returns the original list when nothing is blocked", () => {
    const urls = ["https://example.com/a.jpg", "https://example.com/b.jpg"];
    expect(filterSyndicatedPhotoUrls(urls, new Set())).toEqual(urls);
  });
});

describe("firstPhotoUrl", () => {
  it("returns the first trimmed URL", () => {
    expect(firstPhotoUrl([" https://example.com/a.jpg ", "b.jpg"])).toBe(
      "https://example.com/a.jpg"
    );
  });

  it("returns null for empty input", () => {
    expect(firstPhotoUrl(null)).toBeNull();
    expect(firstPhotoUrl([])).toBeNull();
  });
});
