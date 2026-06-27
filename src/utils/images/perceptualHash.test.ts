import { describe, expect, it } from "vitest";
import {
  arePerceptualHashesSimilar,
  computePerceptualHash,
} from "./perceptualHash.js";

describe("perceptualHash", () => {
  it("returns identical hashes for the same image bytes", async () => {
    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );

    const [left, right] = await Promise.all([
      computePerceptualHash(buffer),
      computePerceptualHash(Buffer.from(buffer)),
    ]);

    expect(left).toBe(right);
    expect(arePerceptualHashesSimilar(left, right)).toBe(true);
  });
});
