import { afterEach, describe, expect, it, vi } from "vitest";
import { mergePropertiesIntoCanonical } from "./propertyMerge.js";

describe("mergePropertiesIntoCanonical", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves publications and reactions from duplicates to the canonical property", async () => {
    const publicationUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const reactionFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 10, discordUserId: "user-a", propertyId: 2 },
      ])
      .mockResolvedValueOnce([]);
    const reactionFindUnique = vi.fn().mockResolvedValue(null);
    const reactionUpdate = vi.fn().mockResolvedValue({});
    const propertyDelete = vi.fn().mockResolvedValue({});
    const propertyUpdate = vi.fn().mockResolvedValue({});

    const prisma = {
      listingPublication: { updateMany: publicationUpdateMany },
      listingReaction: {
        findMany: reactionFindMany,
        findUnique: reactionFindUnique,
        update: reactionUpdate,
        delete: vi.fn(),
      },
      property: {
        delete: propertyDelete,
        update: propertyUpdate,
      },
    };

    await mergePropertiesIntoCanonical(prisma, { id: 1, firstPrice: 300_000 }, [
      { id: 2, firstPrice: 295_000 },
    ]);

    expect(publicationUpdateMany).toHaveBeenCalledWith({
      where: { propertyId: 2 },
      data: { propertyId: 1 },
    });
    expect(reactionUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { propertyId: 1 },
    });
    expect(propertyDelete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(propertyUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { firstPrice: 295_000 },
    });
  });

  it("drops duplicate reactions when the canonical property already has one", async () => {
    const reactionDelete = vi.fn().mockResolvedValue({});

    const prisma = {
      listingPublication: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      listingReaction: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 11, discordUserId: "user-a", propertyId: 2 },
          ]),
        findUnique: vi.fn().mockResolvedValue({ id: 99 }),
        update: vi.fn(),
        delete: reactionDelete,
      },
      property: {
        delete: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      },
    };

    await mergePropertiesIntoCanonical(prisma, { id: 1, firstPrice: 300_000 }, [
      { id: 2, firstPrice: 300_000 },
    ]);

    expect(reactionDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it("no-ops when there are no duplicates", async () => {
    const publicationUpdateMany = vi.fn();

    await mergePropertiesIntoCanonical(
      {
        listingPublication: { updateMany: publicationUpdateMany },
        listingReaction: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        property: { delete: vi.fn(), update: vi.fn() },
      },
      { id: 1, firstPrice: 300_000 },
      []
    );

    expect(publicationUpdateMany).not.toHaveBeenCalled();
  });
});
