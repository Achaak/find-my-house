import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import { PropertyMatchDiagnosticsRepository } from "./propertyMatchDiagnosticsRepository.js";
import type { PrismaClient } from "../generated/prisma/client.js";

describe("PropertyMatchDiagnosticsRepository", () => {
  let diagnosticsRepository: PropertyMatchDiagnosticsRepository;
  let repository: ReturnType<typeof createTestRepository>["repository"];
  let prisma: PrismaClient;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    diagnosticsRepository = new PropertyMatchDiagnosticsRepository(
      testDb.prisma
    );
    repository = testDb.repository;
    prisma = testDb.prisma;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("returns recent persisted diagnostics ordered by recency", async () => {
    await repository.upsert(
      makeListing({
        externalId: "diag-repo-base",
        url: "https://www.bienici.com/annonce/diag-repo-base",
        postalCode: "75001",
        price: 300_000,
      })
    );
    await repository.upsert(
      makeListing({
        externalId: "diag-repo-near-miss",
        url: "https://www.bienici.com/annonce/diag-repo-near-miss",
        postalCode: "75001",
        price: 293_000,
      })
    );

    const page = await diagnosticsRepository.findRecent(10);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0]?.listingExternalId).toBe("diag-repo-near-miss");
    expect(typeof page.items[0]?.createdAt).toBe("string");
    expect(page.nextBeforeId).toBeNull();
  });

  it("supports source and postalCode filters", async () => {
    await repository.upsert(
      makeListing({
        externalId: "diag-repo-source-a",
        source: "bienici",
        url: "https://www.bienici.com/annonce/diag-repo-source-a",
        postalCode: "76170",
        price: 300_000,
      })
    );
    await repository.upsert(
      makeListing({
        externalId: "diag-repo-source-b",
        source: "bienici",
        url: "https://www.bienici.com/annonce/diag-repo-source-b",
        postalCode: "76170",
        price: 293_000,
      })
    );

    const filtered = await diagnosticsRepository.findRecent(10, {
      source: "bienici",
      postalCode: "76170",
    });
    expect(
      filtered.items.some(
        (item) => item.listingExternalId === "diag-repo-source-b"
      )
    ).toBe(true);
    expect(filtered.items.every((item) => item.postalCode === "76170")).toBe(
      true
    );
  });

  it("supports bestVeto and beforeId filters", async () => {
    await repository.upsert(
      makeListing({
        externalId: "diag-repo-veto-base",
        url: "https://www.bienici.com/annonce/diag-repo-veto-base",
        postalCode: "75001",
        price: 300_000,
      })
    );
    await repository.upsert(
      makeListing({
        externalId: "diag-repo-veto-near",
        url: "https://www.bienici.com/annonce/diag-repo-veto-near",
        postalCode: "75001",
        price: 293_000,
      })
    );

    const withVeto = await diagnosticsRepository.findRecent(10, {
      bestVeto: "price_out_of_tolerance",
    });
    expect(withVeto.items.length).toBeGreaterThan(0);

    const topId = withVeto.items[0]?.id;
    expect(topId).toBeDefined();
    if (!topId) return;

    const paged = await diagnosticsRepository.findRecent(10, {
      bestVeto: "price_out_of_tolerance",
      beforeId: topId,
    });
    expect(paged.items.every((item) => item.id < topId)).toBe(true);
  });

  it("returns nextBeforeId when there are more rows than limit", async () => {
    await prisma.propertyMatchDiagnostic.createMany({
      data: [
        {
          listingSource: "bienici",
          listingExternalId: "diag-page-a",
          postalCode: "76000",
          threshold: 0.85,
          bestScore: 0.75,
          bestCandidateId: 1,
          bestVeto: "price_out_of_tolerance",
          nearMisses: [
            { candidateId: 1, score: 0.75, veto: "price_out_of_tolerance" },
          ],
        },
        {
          listingSource: "bienici",
          listingExternalId: "diag-page-b",
          postalCode: "76000",
          threshold: 0.85,
          bestScore: 0.74,
          bestCandidateId: 2,
          bestVeto: "price_out_of_tolerance",
          nearMisses: [
            { candidateId: 2, score: 0.74, veto: "price_out_of_tolerance" },
          ],
        },
      ],
    });

    const page = await diagnosticsRepository.findRecent(1, {
      source: "bienici",
      postalCode: "76000",
    });
    expect(page.items).toHaveLength(1);
    expect(page.nextBeforeId).not.toBeNull();
  });
});
