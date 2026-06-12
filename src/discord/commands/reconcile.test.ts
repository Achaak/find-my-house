import { describe, expect, it, vi } from "vitest";
import { handleReconcile } from "./reconcile.js";

vi.mock("../auth.js", () => ({
  canRunPrivilegedCommand: vi.fn(() => true),
  denyPrivilegedCommand: vi.fn(),
}));

vi.mock("../../scripts/reconcile-properties.js", () => ({
  reconcileProperties: vi.fn(() =>
    Promise.resolve({
      merged: 1,
      fuzzyMerged: 2,
      unique: 42,
      agencyFieldsUpdated: 10,
    })
  ),
}));

function makeInteraction() {
  return {
    deferReply: vi.fn(() => Promise.resolve(undefined)),
    editReply: vi.fn(() => Promise.resolve(undefined)),
  };
}

describe("handleReconcile", () => {
  it("reports reconcile results in the Discord reply", async () => {
    const interaction = makeInteraction();

    await handleReconcile(interaction as never, {
      repository: {} as never,
      reactionRepository: {} as never,
      scraperService: {} as never,
      defaultScrapeOptions: {
        city: "Paris",
        maxPrice: 500_000,
        minSurface: 30,
      },
      discord: {
        token: "token",
        adminRoleId: "admin",
      },
      notifyScrapeResults: vi.fn(),
    });

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledOnce();

    const reply = String(vi.mocked(interaction.editReply).mock.calls[0]?.[0]);
    expect(reply).toContain("1 doublon(s) strict(s)");
    expect(reply).toContain("2 doublon(s) fuzzy");
    expect(reply).toContain("42 bien(s) unique(s)");
    expect(reply).toContain("10 publication(s) agence");
  });
});
