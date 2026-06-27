import { describe, expect, it } from "vitest";
import { mergePropertyPhotos } from "./publicationImages.js";

describe("mergePropertyPhotos", () => {
  it("deduplicates by normalized URL", () => {
    const photos = mergePropertyPhotos([
      {
        id: 1,
        source: "bienici",
        imageUrls: [
          "https://cdn.example/a.jpg?w=800",
          "https://cdn.example/b.jpg",
        ],
        imageLocalHashes: null,
        imagePerceptualHashes: null,
        isActive: true,
      },
      {
        id: 2,
        source: "seloger",
        imageUrls: ["https://cdn.example/a.jpg?w=1200"],
        imageLocalHashes: null,
        imagePerceptualHashes: null,
        isActive: true,
      },
    ]);

    expect(photos).toHaveLength(2);
    expect(photos.map((photo) => photo.url)).toEqual([
      "https://cdn.example/a.jpg?w=800",
      "https://cdn.example/b.jpg",
    ]);
  });

  it("deduplicates by stored content hash across URLs", () => {
    const photos = mergePropertyPhotos([
      {
        id: 1,
        source: "bienici",
        imageUrls: ["https://portal-a.example/photo-1.jpg"],
        imageLocalHashes: {
          "https://portal-a.example/photo-1.jpg": "abc123",
        },
        imagePerceptualHashes: null,
        isActive: true,
      },
      {
        id: 2,
        source: "seloger",
        imageUrls: ["https://portal-b.example/other-path.jpg"],
        imageLocalHashes: {
          "https://portal-b.example/other-path.jpg": "abc123",
        },
        imagePerceptualHashes: null,
        isActive: true,
      },
    ]);

    expect(photos).toHaveLength(1);
    expect(photos[0]?.url).toBe("/api/media/abc123");
    expect(photos[0]?.source).toBe("bienici");
  });

  it("deduplicates by perceptual hash across portals", () => {
    const photos = mergePropertyPhotos([
      {
        id: 1,
        source: "bienici",
        imageUrls: ["https://portal-a.example/salon.jpg"],
        imageLocalHashes: {
          "https://portal-a.example/salon.jpg": "hash-a",
        },
        imagePerceptualHashes: {
          "https://portal-a.example/salon.jpg": "ff00112233445566",
        },
        isActive: true,
      },
      {
        id: 2,
        source: "leboncoin",
        imageUrls: ["https://portal-b.example/photo.jpg"],
        imageLocalHashes: {
          "https://portal-b.example/photo.jpg": "hash-b",
        },
        imagePerceptualHashes: {
          "https://portal-b.example/photo.jpg": "ff00112233445567",
        },
        isActive: true,
      },
    ]);

    expect(photos).toHaveLength(1);
    expect(photos[0]?.source).toBe("bienici");
  });
});
