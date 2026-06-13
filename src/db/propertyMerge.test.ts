import { afterEach, describe, expect, it, vi } from "vitest";
import { mergePropertiesIntoCanonical } from "./propertyMerge.js";

function createMergePrismaMocks() {
  const publicationUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const reactionFindMany = vi.fn().mockResolvedValue([]);
  const reactionFindUnique = vi.fn().mockResolvedValue(null);
  const reactionUpdate = vi.fn().mockResolvedValue({});
  const reactionDelete = vi.fn().mockResolvedValue({});
  const propertyDelete = vi.fn().mockResolvedValue({});
  const propertyUpdate = vi.fn().mockResolvedValue({});

  const tx = {
    listingPublication: { updateMany: publicationUpdateMany },
    listingReaction: {
      findMany: reactionFindMany,
      findUnique: reactionFindUnique,
      update: reactionUpdate,
      delete: reactionDelete,
    },
    property: {
      delete: propertyDelete,
      update: propertyUpdate,
    },
  };

  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) =>
      fn(tx)
    ),
  };

  return {
    prisma,
    tx,
    publicationUpdateMany,
    reactionFindMany,
    reactionFindUnique,
    reactionUpdate,
    reactionDelete,
    propertyDelete,
    propertyUpdate,
  };
}

describe("mergePropertiesIntoCanonical", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves publications and reactions from duplicates to the canonical property", async () => {
    const {
      prisma,
      publicationUpdateMany,
      reactionFindMany,
      reactionFindUnique,
      reactionUpdate,
      propertyDelete,
      propertyUpdate,
    } = createMergePrismaMocks();

    reactionFindMany.mockResolvedValueOnce([
      { id: 10, discordUserId: "user-a", propertyId: 2 },
    ]);

    await mergePropertiesIntoCanonical(prisma, { id: 1, firstPrice: 300_000 }, [
      { id: 2, firstPrice: 295_000 },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
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
    expect(reactionFindUnique).toHaveBeenCalled();
  });

  it("drops duplicate reactions when the canonical property already has one", async () => {
    const { prisma, reactionFindMany, reactionFindUnique, reactionDelete } =
      createMergePrismaMocks();

    reactionFindMany.mockResolvedValueOnce([
      { id: 11, discordUserId: "user-a", propertyId: 2 },
    ]);
    reactionFindUnique.mockResolvedValueOnce({ id: 99 });

    await mergePropertiesIntoCanonical(prisma, { id: 1, firstPrice: 300_000 }, [
      { id: 2, firstPrice: 300_000 },
    ]);

    expect(reactionDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it("no-ops when there are no duplicates", async () => {
    const { prisma, publicationUpdateMany } = createMergePrismaMocks();

    await mergePropertiesIntoCanonical(
      prisma,
      { id: 1, firstPrice: 300_000 },
      []
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publicationUpdateMany).not.toHaveBeenCalled();
  });
});
