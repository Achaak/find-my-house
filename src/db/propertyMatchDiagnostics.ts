import type { Listing } from "../types/listing.js";
import type { MatchDiagnostics } from "../domain/propertyMatching/index.js";
import { createLogger } from "../utils/logger.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";

export type PropertyMatchDiagnosticsSink = {
  recordCandidateMiss(
    listing: Listing,
    diagnostics: MatchDiagnostics
  ): void | Promise<void>;
};

const log = createLogger("db");

export class LoggerPropertyMatchDiagnosticsSink implements PropertyMatchDiagnosticsSink {
  recordCandidateMiss(listing: Listing, diagnostics: MatchDiagnostics): void {
    if (diagnostics.nearMisses.length === 0) return;
    log.debug(
      `Property match miss ${listing.source}:${listing.externalId} postal=${String(listing.postalCode)} threshold=${diagnostics.threshold.toFixed(
        2
      )} best=${diagnostics.bestScore?.toFixed(3) ?? "none"} veto=${diagnostics.bestVeto ?? "none"} nearMisses=${JSON.stringify(
        diagnostics.nearMisses
      )}`
    );
  }
}

export class PrismaPropertyMatchDiagnosticsSink implements PropertyMatchDiagnosticsSink {
  constructor(private readonly prisma: PrismaClient) {}

  async recordCandidateMiss(
    listing: Listing,
    diagnostics: MatchDiagnostics
  ): Promise<void> {
    if (diagnostics.nearMisses.length === 0) return;
    try {
      await this.prisma.propertyMatchDiagnostic.create({
        data: {
          listingSource: listing.source,
          listingExternalId: listing.externalId,
          postalCode: listing.postalCode,
          threshold: diagnostics.threshold,
          bestScore: diagnostics.bestScore,
          bestCandidateId: diagnostics.bestCandidateId,
          bestVeto: diagnostics.bestVeto,
          nearMisses: diagnostics.nearMisses,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        log.warn(
          "property_match_diagnostics table missing — run `pnpm exec prisma migrate deploy`"
        );
        return;
      }
      throw error;
    }
  }
}

export class CompositePropertyMatchDiagnosticsSink implements PropertyMatchDiagnosticsSink {
  constructor(private readonly sinks: PropertyMatchDiagnosticsSink[]) {}

  async recordCandidateMiss(
    listing: Listing,
    diagnostics: MatchDiagnostics
  ): Promise<void> {
    for (const sink of this.sinks) {
      await sink.recordCandidateMiss(listing, diagnostics);
    }
  }
}
