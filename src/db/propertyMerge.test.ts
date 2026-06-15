import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergePropertiesIntoCanonical,
  pickReactionOnMerge,
} from "./propertyMerge.js";

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

    reactionFindMany.mockResolvedValueOnce([{ id: 10, propertyId: 2 }]);

    await mergePropertiesIntoCanonical(
      prisma,
      { id: 1, firstPrice: 300_000, price: 300_000 },
      [{ id: 2, firstPrice: 295_000, price: 295_000 }]
    );

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
      data: { firstPrice: 295_000, hasPriceDrop: false },
    });
    expect(reactionFindUnique).toHaveBeenCalledWith({
      where: { propertyId: 1 },
    });
  });

  it("drops duplicate reactions when the canonical property already has the same type", async () => {
    const { prisma, reactionFindMany, reactionFindUnique, reactionDelete } =
      createMergePrismaMocks();

    reactionFindMany.mockResolvedValueOnce([
      {
        id: 11,
        propertyId: 2,
        type: "like",
        archivedAt: null,
        createdAt: new Date("2026-02-01"),
      },
    ]);
    reactionFindUnique.mockResolvedValueOnce({
      id: 99,
      type: "like",
      archivedAt: null,
      createdAt: new Date("2026-01-01"),
    });

    await mergePropertiesIntoCanonical(
      prisma,
      { id: 1, firstPrice: 300_000, price: 300_000 },
      [{ id: 2, firstPrice: 300_000, price: 300_000 }]
    );

    expect(reactionDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it("keeps the newer reaction when canonical and duplicate disagree", async () => {
    const {
      prisma,
      reactionFindMany,
      reactionFindUnique,
      reactionUpdate,
      reactionDelete,
    } = createMergePrismaMocks();

    reactionFindMany.mockResolvedValueOnce([
      {
        id: 11,
        propertyId: 2,
        type: "dislike",
        archivedAt: null,
        createdAt: new Date("2026-03-01"),
      },
    ]);
    reactionFindUnique.mockResolvedValueOnce({
      id: 99,
      type: "like",
      archivedAt: null,
      createdAt: new Date("2026-01-01"),
    });

    await mergePropertiesIntoCanonical(
      prisma,
      { id: 1, firstPrice: 300_000, price: 300_000 },
      [{ id: 2, firstPrice: 300_000, price: 300_000 }]
    );

    expect(reactionUpdate).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { type: "dislike", archivedAt: null },
    });
    expect(reactionDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it("keeps the canonical reaction when it is newer than the duplicate", async () => {
    const {
      prisma,
      reactionFindMany,
      reactionFindUnique,
      reactionUpdate,
      reactionDelete,
    } = createMergePrismaMocks();

    reactionFindMany.mockResolvedValueOnce([
      {
        id: 11,
        propertyId: 2,
        type: "dislike",
        archivedAt: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    reactionFindUnique.mockResolvedValueOnce({
      id: 99,
      type: "like",
      archivedAt: null,
      createdAt: new Date("2026-03-01"),
    });

    await mergePropertiesIntoCanonical(
      prisma,
      { id: 1, firstPrice: 300_000, price: 300_000 },
      [{ id: 2, firstPrice: 300_000, price: 300_000 }]
    );

    expect(reactionUpdate).not.toHaveBeenCalled();
    expect(reactionDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it("no-ops when there are no duplicates", async () => {
    const { prisma, publicationUpdateMany } = createMergePrismaMocks();

    await mergePropertiesIntoCanonical(
      prisma,
      { id: 1, firstPrice: 300_000, price: 300_000 },
      []
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publicationUpdateMany).not.toHaveBeenCalled();
  });
});

describe("pickReactionOnMerge", () => {
  const canonical = {
    id: 1,
    type: "like" as const,
    archivedAt: null,
    createdAt: new Date("2026-02-01"),
  };

  it("prefers the newer reaction when types differ", () => {
    const duplicate = {
      id: 2,
      type: "dislike" as const,
      archivedAt: null,
      createdAt: new Date("2026-03-01"),
    };

    expect(pickReactionOnMerge(canonical, duplicate)).toBe(duplicate);
  });

  it("keeps the canonical reaction when it is newer", () => {
    const duplicate = {
      id: 2,
      type: "dislike" as const,
      archivedAt: null,
      createdAt: new Date("2026-01-01"),
    };

    expect(pickReactionOnMerge(canonical, duplicate)).toBe(canonical);
  });

  it("keeps the canonical reaction when types match", () => {
    const duplicate = {
      id: 2,
      type: "like" as const,
      archivedAt: new Date("2026-03-01"),
      createdAt: new Date("2026-03-01"),
    };

    expect(pickReactionOnMerge(canonical, duplicate)).toBe(canonical);
  });
});
