import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";

describe("purgeOrphanStoredImages", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fmh-orphan-images-"));
    vi.stubEnv("IMAGE_STORE_DIR", tempDir);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deletes store files not referenced by any publication hash map", async () => {
    const { repository, prisma, dispose } = createTestRepository();
    const { purgeOrphanStoredImages, resetPerceptualImageIndexCache } =
      await import("./purgeOrphanStoredImages.js");
    const { registerPerceptualImage, findContentHashByPerceptualHash } =
      await import("./perceptualImageIndex.js");
    resetPerceptualImageIndexCache();

    try {
      const listing = makeListing({
        externalId: "orphan-img-keep",
        url: "https://www.bienici.com/annonce/orphan-img-keep",
        imageUrl: "https://example.com/keep.jpg",
        imageUrls: ["https://example.com/keep.jpg"],
      });
      const inserted = await repository.upsertMany([listing]);
      const insertedListing = inserted.insertedListings.at(0);
      if (!insertedListing) throw new Error("expected property");
      const property = await repository.findById(insertedListing.id);
      const publicationId = property?.publications[0]?.id;
      if (publicationId === undefined) throw new Error("expected publication");

      await repository.applyPublicationGallery(publicationId, {
        imageUrls: ["https://example.com/keep.jpg"],
        imageLocalHashes: {
          "https://example.com/keep.jpg": "aa".repeat(32),
        },
        imagePerceptualHashes: {
          "https://example.com/keep.jpg": "phashkeep",
        },
      });

      const keepHash = "aa".repeat(32);
      const orphanHash = "bb".repeat(32);

      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, `${keepHash}.jpg`), Buffer.from("keep"));
      await writeFile(
        join(tempDir, `${orphanHash}.jpg`),
        Buffer.from("orphan")
      );
      await registerPerceptualImage("phashkeep", keepHash);
      await registerPerceptualImage("phashorphan", orphanHash);

      const result = await purgeOrphanStoredImages(prisma, {
        storeDir: tempDir,
      });

      expect(result.deletedFiles).toBe(1);
      await expect(
        access(join(tempDir, `${keepHash}.jpg`))
      ).resolves.toBeUndefined();
      await expect(
        access(join(tempDir, `${orphanHash}.jpg`))
      ).rejects.toThrow();
      expect(await findContentHashByPerceptualHash("phashkeep")).toBe(keepHash);
      expect(await findContentHashByPerceptualHash("phashorphan")).toBeNull();
    } finally {
      await dispose();
      resetPerceptualImageIndexCache();
    }
  });

  it("drops stale url→hash entries then deletes the freed files", async () => {
    const { repository, prisma, dispose } = createTestRepository();
    const { purgeOrphanStoredImages, resetPerceptualImageIndexCache } =
      await import("./purgeOrphanStoredImages.js");
    resetPerceptualImageIndexCache();

    try {
      const listing = makeListing({
        externalId: "orphan-img-stale",
        url: "https://www.bienici.com/annonce/orphan-img-stale",
        imageUrl: "https://example.com/current.jpg",
        imageUrls: ["https://example.com/current.jpg"],
      });
      const inserted = await repository.upsertMany([listing]);
      const insertedListing = inserted.insertedListings.at(0);
      if (!insertedListing) throw new Error("expected property");
      const property = await repository.findById(insertedListing.id);
      const publicationId = property?.publications[0]?.id;
      if (publicationId === undefined) throw new Error("expected publication");

      const currentHash = "cc".repeat(32);
      const staleHash = "dd".repeat(32);

      await repository.applyPublicationGallery(publicationId, {
        imageUrls: ["https://example.com/current.jpg"],
        imageLocalHashes: {
          "https://example.com/current.jpg": currentHash,
          "https://example.com/old.jpg": staleHash,
        },
        imagePerceptualHashes: {
          "https://example.com/current.jpg": "phashcurrent",
          "https://example.com/old.jpg": "phashstale",
        },
      });

      await mkdir(tempDir, { recursive: true });
      await writeFile(
        join(tempDir, `${currentHash}.jpg`),
        Buffer.from("current")
      );
      await writeFile(join(tempDir, `${staleHash}.jpg`), Buffer.from("stale"));

      const result = await purgeOrphanStoredImages(prisma, {
        storeDir: tempDir,
      });

      expect(result.prunedHashEntries).toBe(2);
      expect(result.deletedFiles).toBe(1);

      const after = await repository.findById(insertedListing.id);
      expect(after?.publications[0]?.imageLocalHashes).toEqual({
        "https://example.com/current.jpg": currentHash,
      });
      await expect(access(join(tempDir, `${staleHash}.jpg`))).rejects.toThrow();
      await expect(
        access(join(tempDir, `${currentHash}.jpg`))
      ).resolves.toBeUndefined();
    } finally {
      await dispose();
      resetPerceptualImageIndexCache();
    }
  });
});
