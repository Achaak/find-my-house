import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("downloadPublicationImages", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fmh-images-"));
    vi.stubEnv("IMAGE_STORE_DIR", tempDir);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("re-downloads when a hash exists in the database but the file is missing", async () => {
    const { downloadPublicationImages, hashImageContent } =
      await import("./imageDownloadService.js");
    const remoteUrl = "https://example.com/photo.jpg";
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const existingHash = hashImageContent(Buffer.from("cached-bytes"));

    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Response(imageBytes, {
            status: 200,
            headers: { "content-type": "image/png" },
          })
      )
    );

    const result = await downloadPublicationImages(
      [remoteUrl],
      { [remoteUrl]: existingHash },
      { [remoteUrl]: "deadbeef" }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      remoteUrl,
      expect.objectContaining({ redirect: "follow" })
    );
    expect(result.localHashes[remoteUrl]).not.toBe(existingHash);
    expect(result.perceptualHashes[remoteUrl]).toBeTruthy();
  });

  it("skips download when the stored file still exists on disk", async () => {
    const { downloadPublicationImages, hashImageContent, localImagePath } =
      await import("./imageDownloadService.js");
    const remoteUrl = "https://example.com/photo.jpg";
    const existingHash = hashImageContent(Buffer.from("cached-bytes"));
    await writeFile(
      localImagePath(existingHash, "jpg"),
      Buffer.from("cached-bytes")
    );

    vi.stubGlobal("fetch", vi.fn());

    const result = await downloadPublicationImages(
      [remoteUrl],
      { [remoteUrl]: existingHash },
      { [remoteUrl]: "deadbeef" }
    );

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.localHashes[remoteUrl]).toBe(existingHash);
  });
});

describe("publicationHasMissingStoredImages", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fmh-images-"));
    vi.stubEnv("IMAGE_STORE_DIR", tempDir);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when a local hash has no matching file", async () => {
    const { hashImageContent, publicationHasMissingStoredImages } =
      await import("./imageDownloadService.js");
    const remoteUrl = "https://example.com/photo.jpg";
    const existingHash = hashImageContent(Buffer.from("missing"));

    await expect(
      publicationHasMissingStoredImages({
        isActive: true,
        imageUrls: [remoteUrl],
        imageLocalHashes: { [remoteUrl]: existingHash },
      })
    ).resolves.toBe(true);
  });

  it("returns false when every hashed photo exists on disk", async () => {
    const {
      hashImageContent,
      localImagePath,
      publicationHasMissingStoredImages,
    } = await import("./imageDownloadService.js");
    const remoteUrl = "https://example.com/photo.jpg";
    const existingHash = hashImageContent(Buffer.from("cached-bytes"));
    await writeFile(
      localImagePath(existingHash, "jpg"),
      Buffer.from("cached-bytes")
    );

    await expect(
      publicationHasMissingStoredImages({
        isActive: true,
        imageUrls: [remoteUrl],
        imageLocalHashes: { [remoteUrl]: existingHash },
      })
    ).resolves.toBe(false);
  });
});
