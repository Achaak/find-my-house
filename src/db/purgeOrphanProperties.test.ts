import { describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { purgeOrphanProperties } from "./purgeOrphanProperties.js";

describe("purgeOrphanProperties", () => {
  it("deletes properties without publications", async () => {
    const { prisma, dispose } = createTestRepository();

    try {
      const orphan = await prisma.property.create({
        data: {
          propertyKey: "orphan-key",
          title: "Orphelin",
          price: 100_000,
          firstPrice: 100_000,
          city: "Paris",
          firstSeenAt: new Date(),
        },
      });

      expect(await purgeOrphanProperties(prisma)).toBe(1);
      expect(
        await prisma.property.findUnique({ where: { id: orphan.id } })
      ).toBeNull();
    } finally {
      await dispose();
    }
  });
});
